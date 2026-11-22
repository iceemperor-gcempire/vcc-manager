// 생성 요청의 검증과 작업 등록 (#1269).
//
// `POST /api/jobs/generate` 핸들러 안에 있던 것을 그대로 옮겼다. 생성 작업을 만드는 경로가
// 라우트 말고도 생기므로(채팅 도구 #1267), 검증을 한 곳에 둔다 — 큐 함수(addImageGenerationJob)를
// 직접 부르면 아래 검증을 전부 건너뛴다.
//
// 검증에 걸리면 GenerationRequestError(status, message) 를 던진다. 호출자가 상태 코드와 문구를
// 그대로 돌려준다. 그 밖의 오류는 그대로 올라간다 (라우트는 예전처럼 400 으로 답한다).

const { isPromptOptional } = require('../utils/workflowDirectives');
const { userHasWorkboardAccess } = require('../middleware/auth');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');
const { addImageGenerationJob } = require('./queueService');
const { reverseUploadUrls } = require('../utils/signedUrl');
const UploadedImage = require('../models/UploadedImage');
const Workboard = require('../models/Workboard');
const { getImageSizeValue, getModelValue } = require('../utils/customFieldHelpers');
const { findSilentVideoViolation } = require('./videoAudioGuard');
const { findOrientationViolation } = require('./imageOrientationGuard');
const { findModelFolderViolation } = require('./modelFolderGuard');
const { findLoraFolderViolation, findLoraFieldViolation } = require('./loraFolderGuard');
const { findUnusableAttachments, describeUnusableAttachments } = require('./attachmentOwnership');

class GenerationRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GenerationRequestError';
    this.status = status;
  }
}

/**
 * 생성 요청을 검증하고 작업을 등록한다.
 *
 * @param {Object} args
 * @param {Object} args.user 요청자 (권한·첨부 소유 판정의 기준)
 * @param {Object} args.body `POST /api/jobs/generate` 의 요청 본문과 같은 꼴
 * @returns {Promise<Object>} 등록된 작업 문서
 * @throws {GenerationRequestError} 검증 실패 (status 400/403/404)
 */
async function submitGenerationRequest({ user, body }) {
  const {
    workboardId,
    prompt: rawPrompt,
    negativePrompt,
    referenceImages,
    referenceImageMethod,
    stylePreset,
    upscaleMethod,
    additionalParams,
    seed,
    randomSeed,
    tags
  } = body;

  if (!workboardId) {
    throw new GenerationRequestError(400, 'Missing required fields: workboardId, prompt');
  }

  // 작업판 접근 권한 검사 (#198)
  const wb = await Workboard.findById(workboardId);
  if (!wb) {
    throw new GenerationRequestError(404, 'Workboard not found');
  }
  if (!userHasWorkboardAccess(user, wb)) {
    throw new GenerationRequestError(403, '이 작업판에 접근할 권한이 없습니다.');
  }

  // 프롬프트는 필수 — 워크플로가 프롬프트를 쓰지 않는 ComfyUI 판만 비워도 된다 (#1035)
  if (!rawPrompt && !isPromptOptional(wb)) {
    throw new GenerationRequestError(400, 'Missing required fields: workboardId, prompt');
  }
  const prompt = rawPrompt || '';

  // 텍스트 작업판은 작업 큐에 처리기가 없다 — 작업을 만들어 비동기로 실패시키지 말고 바로 알린다 (#1015)
  if (wb.outputFormat === 'text') {
    throw new GenerationRequestError(400, '텍스트 작업판은 이 경로로 실행할 수 없습니다. POST /api/jobs/generate-prompt 를 쓰세요 (MCP 는 generate_text).');
  }

  // required 이미지/비디오/오디오 필드 검증 (#758, #772) — 프론트 rules 를 우회하는 API/MCP 경로 커버.
  // (일반 필드의 required 는 프론트 CustomFieldControl 이 강제 — 여기서는 첨부형만 본다)
  const ap0 = additionalParams || {};
  for (const field of (wb.additionalInputFields || [])) {
    if (!field.required || !ATTACHMENT_FIELD_TYPES.includes(field.type)) continue;
    const v = ap0[field.name] !== undefined ? ap0[field.name] : body[field.name];
    const empty = Array.isArray(v) ? v.length === 0 : !v;
    if (empty) {
      throw new GenerationRequestError(400, `필수 첨부가 누락되었습니다: ${field.label || field.name}`);
    }
  }

  // 첨부 참조 검증 (#959) — 첨부 메타데이터를 읽는 아래 사전 검사들보다 먼저 한다
  if (!user.isAdmin) {
    const unusable = await findUnusableAttachments({
      workboard: wb, inputData: { ...body, additionalParams: ap0 }, ownerIds: [user._id], label: 'generate',
    });
    if (unusable.length > 0) {
      throw new GenerationRequestError(400, `${describeUnusableAttachments(unusable)} — 내가 올리거나 만든 미디어만 첨부할 수 있습니다`);
    }
  }

  // 무음 영상 + "소리도 참조" 차단 (#859) — 통과시키면 ComfyUI 에서 원인불명 실패가 된다
  const silentViolation = await findSilentVideoViolation(wb, { ...body, additionalParams: ap0 });
  if (silentViolation) {
    throw new GenerationRequestError(400, silentViolation);
  }

  // 이미지·영상 방향 불일치 차단 (#862) — 늘리기 모드의 세로↔가로 조합은 시작 프레임을 뭉갠다
  const orientationViolation = await findOrientationViolation(wb, { ...body, additionalParams: ap0 });
  if (orientationViolation) {
    throw new GenerationRequestError(400, orientationViolation);
  }

  // 모델 / 이미지 크기 추출 — customField 이름이 임의일 수 있어 schema-aware lookup.
  // 작업판의 additionalInputFields 에서 type='baseModel' 인 필드 (없으면 well-known name fallback) 의
  // name 으로 inputData (top-level 또는 additionalParams) 에서 값 조회.
  const ap = additionalParams || {};
  const lookupInput = { ...body, additionalParams: ap };
  // 칸 값이 먼저, 비었으면 top-level aiModel·imageSize (#1174) — 실행(queueService)·폴더 검사와 같은 값을 기록한다
  const aiModel = getModelValue(wb, lookupInput);
  const imageSize = getImageSizeValue(wb, lookupInput);   // 빠지면 판 기본값 — 실행과 같은 값을 기록한다 (#1221)

  console.log('🔍 Extracted fields:', {
    workboardId,
    prompt: prompt?.substring(0, 50) + '...',
    aiModel,
    imageSize,
    seed,
    randomSeed,
    additionalParamsKeys: Object.keys(ap)
  });

  // 베이스 모델 필드가 없는 유틸리티 작업판(픽셀 업스케일 등, #871)은 aiModel 없이 허용.
  // 필드가 있는데 값이 없는 경우만 사용자 실수로 본다.
  const hasBaseModelField = (wb.additionalInputFields || []).some((f) => f.type === 'baseModel');
  if (!aiModel && hasBaseModelField) {
    console.error('❌ aiModel 추출 실패 — workboard customField (type=baseModel) 또는 inputData 확인 필요');
    throw new GenerationRequestError(400, '베이스 모델이 지정되지 않았습니다. 작업판 \"입력 양식\" 에 베이스 모델 타입 필드가 있는지, 사용자 페이지에서 모델을 선택했는지 확인하세요.');
  }

  // 판의 모델 폴더 밖이면 막는다 (#1086) — API·MCP 는 모델 선택 목록을 거치지 않는다
  const folderViolation = findModelFolderViolation(wb, lookupInput);
  if (folderViolation) {
    throw new GenerationRequestError(400, folderViolation);
  }
  // 판의 LoRA 폴더 밖 LoRA 태그(#1099)와 LoRA 선택 칸 값(#1157)도 막는다
  const loraViolation = await findLoraFolderViolation(wb, prompt) || findLoraFieldViolation(wb, lookupInput);
  if (loraViolation) {
    throw new GenerationRequestError(400, loraViolation);
  }


  const inputData = {
    prompt: prompt.trim(),
    // 안 보냈으면 판의 기본 부정 프롬프트 (#1262) — 실행(queueService)과 같은 값을 기록해 계속하기가 그대로 이어받는다.
    // 빈 문자열은 "없음" 으로 보낸 것이라 그대로 둔다
    negativePrompt: (negativePrompt === undefined || negativePrompt === null)
      ? (wb.defaultNegativePrompt || undefined)
      : negativePrompt.trim(),
    aiModel,
    imageSize,
    referenceImages: referenceImages || [],
    referenceImageMethod,
    stylePreset,
    upscaleMethod,
    additionalParams: additionalParams || {},
    seed,
    randomSeed,
    tags: Array.isArray(tags) ? tags : []
  };
  
  console.log('📦 Prepared inputData for job creation:', JSON.stringify(inputData, null, 2));
  
  // 첨부 주소는 서명을 떼고 /uploads 경로로 저장한다 (#966) — 응답에서 다시 서명하므로 만료가 남지 않는다.
  const job = await addImageGenerationJob(user._id, workboardId, reverseUploadUrls(inputData));
  
  console.log('✅ Job created successfully:', {
    jobId: job._id,
    status: job.status,
    createdAt: job.createdAt
  });
  
  if (referenceImages && referenceImages.length > 0) {
    for (const refImg of referenceImages) {
      await UploadedImage.findByIdAndUpdate(refImg.imageId, {
        $push: { referencedBy: { jobId: job._id } },
        isReferenced: true
      });
    }
  }

  return job;
}

module.exports = { submitGenerationRequest, GenerationRequestError };
