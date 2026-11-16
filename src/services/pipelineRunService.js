const Queue = require('bull');
const PipelineRun = require('../models/PipelineRun');
const Pipeline = require('../models/Pipeline');
const SequenceRun = require('../models/SequenceRun');
const Sequence = require('../models/Sequence');
const Workboard = require('../models/Workboard');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const Project = require('../models/Project');
const User = require('../models/User');
const Tag = require('../models/Tag');
const openAIChatService = require('./openAIChatService');
const geminiService = require('./geminiService');
const { getFieldValueByRole } = require('../utils/customFieldHelpers');
const { userHasWorkboardAccess, userHasSequenceAccess } = require('../middleware/auth');
const { decryptSecret } = require('../utils/secretCrypto');
const { FIELD_ROLES } = require('../constants/fieldRoles');
const { computeOpenAITextCost, computeGeminiTextCost } = require('../utils/pricing');
const {
  createProjectDocSource, createSequenceDocSource, resolveProjectTag,
} = require('./containerDocAccess');
const { findDefinitionMismatch } = require('../utils/runSteps');
const { MEDIA_FIELD_TYPES } = require('../utils/sequenceSteps');
const { findUnusableAttachments, describeUnusableAttachments } = require('./attachmentOwnership');
const { findModelFolderViolation } = require('./modelFolderGuard');
const { IMAGE_ONLY_REQUEST, isPromptEnhanceOn, findPromptEnhanceProblem } = require('../utils/promptEnhance');
const { findLoraFolderViolation, findLoraFieldViolation } = require('./loraFolderGuard');
const { buildSequenceStepInput } = require('../utils/sequenceInputs');
const queueService = require('./queueService');

// 파이프라인·작업 절차 실행 background worker (#407, #952).
// Bull queue 사용 — 사용자가 페이지 떠나도 계속 진행. 부분 retry 지원.
// 두 실행 종류는 정의·실행 기록 모델만 다르고, 단계를 도는 루프(executeRunSteps)는 하나다.

let pipelineRunQueue;

function getRedisConfig() {
  const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
  const u = new URL(REDIS_URL);
  return {
    host: u.hostname,
    port: parseInt(u.port, 10) || 6379,
    password: u.password || undefined,
  };
}

async function initPipelineRunQueue() {
  if (pipelineRunQueue) return pipelineRunQueue;
  pipelineRunQueue = new Queue('pipeline run', {
    redis: getRedisConfig(),
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  pipelineRunQueue.process('runPipeline', 2, processPipelineRun);
  // 작업 절차 실행 (#952) — 같은 큐를 쓴다. Bull 은 이름별 처리기의 동시 실행 수를 합산한다.
  pipelineRunQueue.process('runSequence', 2, processSequenceRun);
  pipelineRunQueue.on('failed', (job, err) => {
    console.error(`[PipelineRun] job ${job.id} (${job.name}) failed:`, err.message);
  });
  pipelineRunQueue.on('completed', (job) => {
    console.log(`[PipelineRun] job ${job.id} (${job.name}) completed`);
  });
  console.log('[PipelineRun] queue initialized');
  return pipelineRunQueue;
}

async function startPipelineRun(runId) {
  await initPipelineRunQueue();
  await pipelineRunQueue.add('runPipeline', { runId: runId.toString(), fromStep: 0 });
}

async function retryPipelineRun(runId, fromStep) {
  await initPipelineRunQueue();
  await pipelineRunQueue.add('runPipeline', { runId: runId.toString(), fromStep });
}

async function startSequenceRun(runId) {
  await initPipelineRunQueue();
  await pipelineRunQueue.add('runSequence', { runId: runId.toString(), fromStep: 0 });
}

async function retrySequenceRun(runId, fromStep) {
  await initPipelineRunQueue();
  await pipelineRunQueue.add('runSequence', { runId: runId.toString(), fromStep });
}

// 단계 사전 입력에 키가 없는 필드는 작업판 기본값으로 채운다.
// 생성 화면은 기본값을 채워 보내는데 실행기는 사전 입력만 봐서, 모델을 따로 고르지 않은 LLM 단계가
// "작업판에 모델이 선택되지 않음" 으로 실패했다 (#952 alpha E2E 에서 발견).
// 키가 있는 값은 덮지 않는다 — 빈 문자열은 사전 입력에서 고른 "선택 없음" 이다.
// 미디어 필드는 값이 업로드를 가리키므로 채우지 않는다.
function applyStepFieldDefaults(workboard, stepInputs) {
  const values = { ...(stepInputs || {}) };
  for (const field of workboard?.additionalInputFields || []) {
    if (!field?.name || MEDIA_FIELD_TYPES.has(field.type)) continue;
    if (values[field.name] !== undefined) continue;
    if (field.defaultValue === undefined || field.defaultValue === null) continue;
    values[field.name] = field.defaultValue;
  }
  return values;
}

// 단계 입력 빌드 — 작업판 기본값 + 사전 입력 + 자동 주입 + 초기 프롬프트
function buildStepInput(workboard, prevOutput, stepInputs, stepIdx, initialPrompt) {
  const inputData = applyStepFieldDefaults(workboard, stepInputs);
  if (inputData.userPrompt == null) inputData.userPrompt = '';

  if (stepIdx === 0) {
    inputData.userPrompt = initialPrompt;
    const promptField = (workboard.additionalInputFields || []).find(
      (f) => f.name === 'prompt' || f.name === 'userPrompt'
    );
    if (promptField) inputData[promptField.name] = initialPrompt;
  } else if (prevOutput) {
    if (prevOutput.type === 'text') {
      inputData.userPrompt = prevOutput.value;
      const promptField = (workboard.additionalInputFields || []).find(
        (f) => f.name === 'prompt' || f.name === 'userPrompt'
      );
      if (promptField) inputData[promptField.name] = prevOutput.value;
    } else if (prevOutput.type === 'image' && prevOutput.imageIds?.length > 0) {
      const imgField = (workboard.additionalInputFields || []).find((f) => f.type === 'image');
      if (imgField) {
        inputData[imgField.name] = prevOutput.imageIds.map((id) => ({ imageId: id }));
      }
    }
  }
  return inputData;
}

function extractOpt(v) {
  return v && typeof v === 'object' && v.value !== undefined ? v.value : v;
}

// image 타입 필드 값에서 imageId 목록 추출 — id 문자열/배열, {imageId} 객체 배열 모두 유연 처리.
// (buildStepInput 은 {imageId} 객체 배열, 프론트 사전입력은 id 배열일 수 있음)
function collectImageIds(inputData, imageFieldNames) {
  const ids = [];
  for (const fname of imageFieldNames || []) {
    const v = inputData?.[fname];
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    for (const it of arr) {
      if (!it) continue;
      const id = typeof it === 'object' ? (it.imageId || it._id || it.id) : it;
      if (id) ids.push(String(id));
    }
  }
  return ids;
}

// composeSystemPrompt 는 utils/promptComposition 으로 이관 (#766) — routes/jobs.js 와
// 중복 정의라 가이드 층 추가 시 파이프라인만 누락되는 사고가 났을 지점.
const { composeSystemPrompt, joinDocs } = require('../utils/promptComposition');
const { loadGuidesForWorkboard } = require('./promptGuideService');

// 텍스트 판으로 LLM 을 한 번 부르고 대화 기록을 남긴다 — prompt-generate 로직 직접 호출 (HTTP 우회).
// 텍스트 단계와 AI 프롬프트 늘려 쓰기(#1212)가 이 함수 하나를 쓴다. 합성·문서·비용 기록을 한쪽만 고치는
// 사고(#766)를 막기 위해서다.
// args.inputData     텍스트 판 필드 값 (모델·온도·시스템 프롬프트를 role 로 찾는다)
// args.targetWorkboard 프롬프트를 받을 이미지·영상 판 — 있으면 그 판의 AI 프롬프트 생성 지침이 [대상 작업판 지침] 층으로 (#1109)
// ctx: { runner, project, destProject, docs, jobMarker } — 문서 주입·결과 귀속 (#923, #952)
async function callTextWorkboard({ userId, run, textWorkboard, inputData, definitionStep, targetWorkboard, userContent, images, ctx = {} }) {
  const viewer = ctx.runner || { _id: userId };
  const docs = ctx.docs || createProjectDocSource({ viewer, project: ctx.project });
  const workboard = textWorkboard;
  const server = workboard.serverId;
  if (!server || !server.isActive) throw new Error('서버가 비활성');

  const systemPrompt = extractOpt(getFieldValueByRole(workboard, inputData, FIELD_ROLES.SYSTEM_PROMPT)) || '';
  const resolvedModel = extractOpt(getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL));
  if (!resolvedModel) throw new Error('작업판에 모델이 선택되지 않음');
  const temperatureValue = extractOpt(getFieldValueByRole(workboard, inputData, FIELD_ROLES.TEMPERATURE));
  const temperature = temperatureValue != null ? Number(temperatureValue) : 0.7;

  // 사전 컨텍스트 / 시스템 프롬프트 문서 적용 (#401)
  // 어디서 읽을지는 실행 종류가 정한다 — 파이프라인은 컨테이너(프로젝트) 기준 (#923: 공유 프로젝트의
  // 독자가 실행해도 소유자의 문서가 주입된다), 작업 절차는 소유자 없는 작업 절차 문서 (#952).
  let resolvedSystem = systemPrompt;
  const spDoc = await docs.loadSystemPrompt({
    docId: definitionStep.systemPromptDocId, label: `step${workboard._id} systemPromptDoc`,
  });
  if (spDoc) {
    resolvedSystem = spDoc.title ? `## ${spDoc.title}\n${spDoc.content || ''}` : (spDoc.content || '');
  }
  const worldviewTexts = await docs.loadContext({
    docIds: definitionStep.contextDocIds, label: `step${workboard._id} contextDocs`,
  });
  // 작업판에 연결된 프롬프트 가이드 (#766) — jobs.js 의 단발 경로와 동일하게 적용.
  const guides = await loadGuidesForWorkboard(workboard);
  const targetInstructions = (targetWorkboard?.promptGeneratorInstructions || '').trim();
  const composedSystem = composeSystemPrompt({
    guides,
    targetInstructions,
    systemPrompt: resolvedSystem,
    worldviewTexts,
  });
  const worldviewContext = worldviewTexts.length > 0
    ? joinDocs(worldviewTexts)
    : '';

  const stepImages = images || [];
  const messages = [];
  if (composedSystem) messages.push({ role: 'system', content: composedSystem });
  messages.push({ role: 'user', content: userContent, ...(stepImages.length ? { images: stepImages } : {}) });

  // 결과 귀속 프로젝트 태그 (#923) — targetProjectId 가 있으면 그쪽, 없으면 파이프라인의 프로젝트.
  const destProject = ctx.destProject || ctx.project || null;
  const destTagId = resolveProjectTag({ viewer, project: destProject });
  const projectTagIds = destTagId ? [destTagId] : [];

  const conversation = await ConversationJob.create({
    userId,
    workboardId: workboard._id,
    projectId: destProject?._id || run.projectId,
    tags: projectTagIds,
    ...(ctx.jobMarker || {}),
    serverType: server.serverType,
    model: resolvedModel,
    workboardSystemPrompt: resolvedSystem || undefined,
    // 생성 화면의 AI 프롬프트 생성과 같은 기록 (#1109) — 어느 판의 지침으로 썼는지 남긴다
    targetWorkboardId: targetWorkboard?._id,
    targetWorkboardInstructions: targetInstructions || undefined,
    worldviewContext: worldviewContext || undefined,
    messages: messages.map((m) => ({ ...m, createdAt: new Date() })),
    status: 'processing',
  });

  const chatService = server.serverType === 'Gemini' ? geminiService : openAIChatService;
  let result, usage;
  try {
    ({ content: result, usage } = await chatService.complete(
      server.serverUrl,
      decryptSecret(server.configuration?.apiKey), // at-rest 복호화 (#594)
      messages,
      { model: resolvedModel, temperature, timeout: server.configuration?.timeout || 60000, extraParams: workboard.llmExtraParams }
    ));
  } catch (err) {
    conversation.status = 'failed';
    conversation.error = { message: err.message };
    conversation.completedAt = new Date();
    await conversation.save();
    throw err;
  }

  conversation.messages.push({ role: 'assistant', content: result, createdAt: new Date() });
  conversation.usage = usage;
  const computeCost = server.serverType === 'Gemini' ? computeGeminiTextCost : computeOpenAITextCost;
  const turnCost = computeCost(resolvedModel, usage);
  if (turnCost) conversation.costEstimate = turnCost;
  conversation.status = 'completed';
  conversation.completedAt = new Date();
  await conversation.save();

  await workboard.incrementUsage();

  return { conversationJobId: conversation._id, content: result };
}

// 이미지 필드 값 → LLM 비전 입력. buildStepInput 은 {imageId} 객체 배열로, 프론트 사전입력은 id 배열일 수 있어 둘 다 유연 파싱.
async function loadStepVisionImages(workboard, inputData, docs) {
  const imageFieldNames = (workboard.additionalInputFields || []).filter((f) => f.type === 'image').map((f) => f.name);
  const collectedImageIds = collectImageIds(inputData, imageFieldNames);
  if (collectedImageIds.length === 0) return [];
  const loaded = await docs.loadVisionImages({ imageIds: collectedImageIds });
  return loaded.map((im) => ({ base64: im.base64, mimeType: im.mimeType }));
}

// 텍스트 단계 실행
async function runTextStep(userId, run, step, definitionStep, inputData, prevOutput, ctx = {}) {
  const viewer = ctx.runner || { _id: userId };
  const docs = ctx.docs || createProjectDocSource({ viewer, project: ctx.project });
  const workboard = await Workboard.findById(step.workboardId).populate('serverId');
  if (!workboard) throw new Error('작업판이 삭제됨');

  // 이미지 입력(vision) — image 타입 필드 값(앞 이미지 단계 산출물 또는 사전 첨부)을 LLM 에 전달.
  const stepImages = await loadStepVisionImages(workboard, inputData, docs);
  const { conversationJobId, content } = await callTextWorkboard({
    userId, run, textWorkboard: workboard, inputData, definitionStep,
    userContent: inputData.userPrompt, images: stepImages, ctx,
  });

  return {
    conversationJobId,
    output: { type: 'text', value: content },
  };
}

// 단계 이미지 칸 안내 (#1212). 판 지침은 사용자가 "첫 프레임", "참조 이미지 1" 처럼 칸을 말한다고 보고
// 모드를 정한다 (H3 FL2V 는 프레임 언급이 없으면 T2VA). 이미지만 보내면 LLM 은 어느 칸의 이미지인지 모르고,
// 첫 프레임을 끝 프레임처럼 다뤘다 (알파 확인). 그래서 칸 이름을 요청에 붙인다 — 이미지를 보내지 않을 때도.
// @returns {{ note: string, orderedIds: string[] }} orderedIds 는 그림 번호 순서 (칸 순서 → 칸 안 순서)
function describeStepImages(workboard, inputData) {
  const entries = [];
  for (const field of (workboard.additionalInputFields || []).filter((f) => f.type === 'image')) {
    const ids = collectImageIds(inputData, [field.name]);
    const label = String(field.label || field.name).replace(/\s*\((선택|optional)\)\s*$/i, '').trim() || field.name;
    ids.forEach((id, k) => entries.push({ id, label: ids.length > 1 ? `${label} ${k + 1}` : label }));
  }
  return { entries, orderedIds: entries.map((e) => e.id) };
}

function buildImageNote(entries, sentIds) {
  if (entries.length === 0) return '';
  const sent = new Set((sentIds || []).map(String));
  if (sent.size === 0) {
    return `[이 단계에 들어가는 이미지 — 이미지는 보내지 않았다]\n${entries.map((e) => `- ${e.label}`).join('\n')}`;
  }
  let n = 0;
  const lines = entries.map((e) => (sent.has(String(e.id)) ? `- 그림 ${++n}: ${e.label}` : `- ${e.label} (불러오지 못해 보내지 않았다)`));
  return `[이 단계에 들어가는 이미지 — 첨부한 순서]\n${lines.join('\n')}`;
}

// 이미지·영상 단계가 생성에 쓸 프롬프트 — runImageStep 의 jobInput.prompt 와 같은 우선순위
function resolveStepPrompt(inputData) {
  return (inputData?.prompt || inputData?.userPrompt || '').toString();
}

// 늘려 쓴 프롬프트를 단계 입력에 넣는다 — buildStepInput 이 프롬프트를 넣는 자리와 같다
function applyStepPrompt(workboard, inputData, prompt) {
  inputData.userPrompt = prompt;
  if (inputData.prompt !== undefined && inputData.prompt !== null) inputData.prompt = prompt;
  const promptField = (workboard.additionalInputFields || []).find(
    (f) => f.name === 'prompt' || f.name === 'userPrompt'
  );
  if (promptField) inputData[promptField.name] = prompt;
  return inputData;
}

// AI 프롬프트로 먼저 늘려 쓰기 (#1212) — 이미지·영상 단계가 생성 전에 텍스트 판으로 프롬프트를 쓴다.
// 정의 단계의 promptEnhance 만 읽는다. 작업 절차(#952)도 같은 루프라, 정의에 칸이 생기면 그대로 따라온다.
// @returns {{ conversationJobId, prompt: string, fallback: boolean }}
async function enhanceStepPrompt({ userId, run, stepWorkboard, definitionStep, inputData, stepIndex, ctx = {} }) {
  const viewer = ctx.runner || { _id: userId };
  const docs = ctx.docs || createProjectDocSource({ viewer, project: ctx.project });
  const pe = definitionStep.promptEnhance || {};
  const enhancer = await Workboard.findById(pe.workboardId).populate('serverId');
  const problem = findPromptEnhanceProblem({ stepWorkboard, enhancerWorkboard: enhancer, stepNumber: stepIndex + 1 });
  if (problem) throw new Error(problem);
  // 실행 직전 접근 검사 (#802) — 단계 판과 같은 최종 방어선. 저장 이후 그룹·판 권한이 바뀔 수 있다.
  if (!ctx.runner || !userHasWorkboardAccess(ctx.runner, enhancer)) {
    throw new Error(`AI 프롬프트 판 접근 권한이 없습니다: ${enhancer.name}`);
  }

  const original = resolveStepPrompt(inputData);
  const { entries, orderedIds } = describeStepImages(stepWorkboard, inputData);
  let images = [];
  let sentIds = [];
  if (pe.includeImages !== false && orderedIds.length > 0) {
    // 칸 순서대로 보내고, 못 읽은 이미지는 번호에서 뺀다 — 그림 번호와 첨부 순서가 어긋나지 않게
    const loaded = await docs.loadVisionImages({ imageIds: orderedIds });
    const byId = new Map(loaded.map((im) => [String(im.imageId), im]));
    sentIds = orderedIds.filter((id) => byId.has(String(id)));
    images = sentIds.map((id) => ({ base64: byId.get(String(id)).base64, mimeType: byId.get(String(id)).mimeType }));
  }
  if (!original.trim() && images.length === 0) {
    throw new Error('AI 프롬프트에 넘길 요청이 없습니다 — 프롬프트를 입력하거나 이미지를 넣으세요');
  }
  const imageNote = buildImageNote(entries, sentIds);
  const request = original.trim() || IMAGE_ONLY_REQUEST;

  // 텍스트 판의 비운 칸은 판 기본값으로 (#952 — 모델을 안 고르면 "모델이 선택되지 않음" 으로 실패했다)
  const enhancerInputs = applyStepFieldDefaults(enhancer, pe.inputs);
  const { conversationJobId, content } = await callTextWorkboard({
    userId, run, textWorkboard: enhancer, inputData: enhancerInputs, definitionStep,
    targetWorkboard: stepWorkboard,
    userContent: imageNote ? `${request}\n\n${imageNote}` : request,
    images, ctx,
  });

  const enhanced = (content || '').trim();
  // 빈 결과는 오류 없이 다음 단계로 흘러간다 (#1204) — 원래 프롬프트로 대신하고 남긴다.
  const fallback = !enhanced;
  console.log(`[${ctx.logLabel || 'Run'}] step ${stepIndex} prompt enhance: board="${enhancer.name}" requestChars=${original.trim().length} imageFields=${entries.length} images=${images.length} resultChars=${enhanced.length} fallback=${fallback}`);
  return { conversationJobId, prompt: fallback ? original : enhanced, fallback };
}

// 이미지 단계 실행 — ImageGenerationJob 생성 후 폴링
async function runImageStep(userId, run, step, inputData, ctx = {}) {
  const viewer = ctx.runner || { _id: userId };
  const workboard = await Workboard.findById(step.workboardId);
  if (!workboard) throw new Error('작업판이 삭제됨');

  // 프로젝트 태그 주입
  const mergedTags = Array.isArray(inputData.tags) ? [...inputData.tags] : [];
  const destTagId = resolveProjectTag({ viewer, project: ctx.destProject || ctx.project || null });
  if (destTagId && !mergedTags.some((t) => String(t) === String(destTagId))) {
    mergedTags.push(destTagId);
  }

  const jobInput = {
    prompt: (inputData.prompt || inputData.userPrompt || '').toString(),
    negativePrompt: inputData.negativePrompt,
    referenceImages: inputData.referenceImages || [],
    referenceImageMethod: inputData.referenceImageMethod,
    stylePreset: inputData.stylePreset,
    upscaleMethod: inputData.upscaleMethod,
    additionalParams: inputData,
    seed: inputData.seed,
    randomSeed: inputData.randomSeed,
    tags: mergedTags,
  };

  // 첨부 참조 검증 (#959) — 실행 경로는 /jobs/generate 를 거치지 않으므로 같은 규칙을 여기서 적용한다.
  // 허용 소유자는 실행 종류가 정한다: 파이프라인은 실행자 + 프로젝트 소유자(#923), 작업 절차는 실행자.
  if (!viewer.isAdmin) {
    const docs = ctx.docs || createProjectDocSource({ viewer, project: ctx.project });
    const unusable = await findUnusableAttachments({
      workboard, inputData: jobInput, ownerIds: docs.attachmentOwnerIds(), label: `step${step.workboardId}`,
    });
    if (unusable.length > 0) throw new Error(describeUnusableAttachments(unusable));
  }

  // 판의 모델 폴더 밖이면 막는다 (#1086) — /jobs/generate 와 같은 규칙
  const folderViolation = findModelFolderViolation(workboard, jobInput);
  if (folderViolation) throw new Error(folderViolation);
  const loraViolation = await findLoraFolderViolation(workboard, jobInput.prompt) || findLoraFieldViolation(workboard, jobInput);
  if (loraViolation) throw new Error(loraViolation);

  // queueService 의 addImageGenerationJob 재사용
  const job = await queueService.addImageGenerationJob(userId, workboard._id, jobInput, ctx.jobMarker || {});

  // 폴링 — 완료까지 대기 (최대 10분)
  const start = Date.now();
  const MAX_WAIT = 10 * 60 * 1000;
  while (Date.now() - start < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, 3000));
    const fresh = await ImageGenerationJob.findById(job._id).populate('resultImages').lean();
    if (!fresh) throw new Error('Job 사라짐');
    if (fresh.status === 'completed') {
      const imageIds = (fresh.resultImages || []).map((img) => img._id);
      return {
        imageGenerationJobId: fresh._id,
        output: { type: 'image', imageIds },
      };
    }
    if (fresh.status === 'failed') {
      throw new Error(fresh.errorMessage || '이미지 생성 실패');
    }
  }
  throw new Error('이미지 생성 시간 초과 (10분)');
}

// 실행을 멈추고 기록을 닫는다 — 남은 대기 단계는 건너뜀으로.
async function failRun(run, message, { failStepIndex = -1 } = {}) {
  const now = new Date();
  const failStep = failStepIndex >= 0 ? run.steps[failStepIndex] : null;
  if (failStep) {
    failStep.status = 'failed';
    failStep.error = { message };
    failStep.completedAt = now;
  }
  for (const s of run.steps) {
    if (s.status === 'pending') s.status = 'skipped';
  }
  run.status = 'failed';
  run.error = { message };
  run.completedAt = now;
  run.markModified('steps');
  await run.save();
}

// 정의(파이프라인·작업 절차)와 실행 기록을 받아 단계를 순서대로 실행한다.
// 두 실행 종류가 이 루프 하나를 쓴다 — 작업판 접근 재검사·입력 조립·결과 기록을 한쪽만
// 고치는 사고(#794/#802)를 막기 위해서다. 실행 종류별 차이는 ctx 로만 들어온다:
//   ctx.runner     실행자 (lean User)
//   ctx.docs       단계 문서·비전 이미지 로더 (containerDocAccess.create*DocSource)
//   ctx.jobMarker  단계 작업에 남길 소속 표시 (작업 절차만 — { sequenceRunId })
//   ctx.kindLabel  오류 메시지용 이름, ctx.logLabel 로그 접두
async function executeRunSteps({ run, definition, fromStep = 0, ctx }) {
  // 실행 기록을 만든 뒤 정의가 바뀌었으면 옛 작업판에 새 입력·문서가 섞인다 — 멈춘다.
  const mismatch = findDefinitionMismatch(definition.steps, run.steps);
  if (mismatch) {
    console.warn(`[${ctx.logLabel}] definition mismatch at step ${mismatch.stepIndex} (${mismatch.reason})`);
    const failStepIndex = run.steps.findIndex((s, i) => i >= fromStep && s.status !== 'completed');
    await failRun(run, `${ctx.kindLabel} 단계 구성이 실행을 만든 뒤 바뀌었습니다 — 새로 실행하세요`, { failStepIndex });
    return;
  }

  run.status = 'running';
  if (!run.startedAt) run.startedAt = new Date();
  await run.save();

  // 이전 단계의 output 회수 (retry 시)
  let prevOutput = null;
  if (fromStep > 0) {
    const prevRunStep = run.steps[fromStep - 1];
    if (prevRunStep?.output) prevOutput = prevRunStep.output;
  }

  const { runner } = ctx;
  // 작업 절차의 기본 입력 출처는 앞 단계 작업판의 출력 형식에 따라 달라진다 (#953) — 재시도면 앞 단계를 읽어 둔다
  let previousWorkboard = ctx.resolveStepInput && fromStep > 0
    ? await Workboard.findById(run.steps[fromStep - 1].workboardId).lean()
    : null;
  for (let i = fromStep; i < run.steps.length; i++) {
    const definitionStep = definition.steps[i];
    const runStep = run.steps[i];

    runStep.status = 'running';
    runStep.startedAt = new Date();
    run.markModified('steps');
    await run.save();

    try {
      const workboard = await Workboard.findById(runStep.workboardId);
      if (!workboard) throw new Error('작업판이 삭제됨');

      // 실행 시점 접근 검사 (#802) — **최종 방어선**.
      // 정의 저장·실행 요청 시에도 검사하지만, 그 이후에 실행자가 그룹에서 빠지거나
      // 작업판의 allowedGroupIds 가 바뀔 수 있다. 실행 직전에 다시 보지 않으면
      // 그 창으로 권한 없는 실행이 통과한다. 작업 절차 권한은 작업판 권한을 열지 않는다.
      if (!runner) throw new Error('실행자를 찾을 수 없음');
      if (!userHasWorkboardAccess(runner, workboard)) {
        throw new Error(`작업판 접근 권한이 없습니다: ${workboard.name}`);
      }

      let inputData;
      if (ctx.resolveStepInput) {
        inputData = ctx.resolveStepInput({ workboard, definitionStep, stepIndex: i, previousWorkboard, prevOutput });
      } else {
        const autoInject = i === 0 ? false : (definitionStep.autoInject !== false);
        inputData = buildStepInput(workboard, autoInject ? prevOutput : null, definitionStep.inputs, i, run.initialPrompt);
      }

      let stepResult;
      if (workboard.outputFormat === 'text') {
        stepResult = await runTextStep(run.userId, run, runStep, definitionStep, inputData, prevOutput, ctx);
        runStep.conversationJobId = stepResult.conversationJobId;
      } else {
        // AI 프롬프트로 먼저 늘려 쓰기 (#1212). 대화는 생성 전에 기록해 둔다 — 생성이 실패해도 무엇으로 늘려 썼는지 남는다.
        let enhancement = null;
        if (isPromptEnhanceOn(definitionStep)) {
          const enh = await enhanceStepPrompt({
            userId: run.userId, run, stepWorkboard: workboard, definitionStep, inputData, stepIndex: i, ctx,
          });
          runStep.conversationJobId = enh.conversationJobId;
          run.markModified('steps');
          await run.save();
          applyStepPrompt(workboard, inputData, enh.prompt);
          enhancement = { enhancedPrompt: enh.prompt, ...(enh.fallback ? { promptEnhanceFallback: true } : {}) };
        }
        stepResult = await runImageStep(run.userId, run, runStep, inputData, ctx);
        runStep.imageGenerationJobId = stepResult.imageGenerationJobId;
        if (enhancement) stepResult.output = { ...stepResult.output, ...enhancement };
      }

      runStep.output = stepResult.output;
      runStep.status = 'completed';
      runStep.completedAt = new Date();
      prevOutput = stepResult.output;
      previousWorkboard = workboard;
      run.markModified('steps');
      await run.save();
    } catch (err) {
      console.error(`[${ctx.logLabel}] step ${i} failed:`, err.message);
      runStep.status = 'failed';
      runStep.completedAt = new Date();
      runStep.error = { message: err.message };
      // 이후 단계는 건너뜀
      for (let j = i + 1; j < run.steps.length; j++) {
        if (run.steps[j].status === 'pending') run.steps[j].status = 'skipped';
      }
      run.status = 'failed';
      run.completedAt = new Date();
      run.error = { message: `단계 ${i + 1} 실패: ${err.message}` };
      run.markModified('steps');
      await run.save();
      return;
    }
  }

  run.status = 'completed';
  run.completedAt = new Date();
  await run.save();
}

// 파이프라인 실행 worker
async function processPipelineRun(job) {
  const { runId, fromStep = 0 } = job.data;
  const run = await PipelineRun.findById(runId);
  if (!run) throw new Error(`PipelineRun ${runId} not found`);

  const pipeline = await Pipeline.findById(run.pipelineId);
  if (!pipeline) {
    await failRun(run, '파이프라인이 삭제됨');
    return;
  }

  // 실행자 — 단계마다 작업판 접근을 검사하는 데 쓴다 (#802)
  const runner = await User.findById(run.userId).lean();
  // 컨테이너 기준 문서 주입 + 결과 귀속 (#923) — 단계마다 다시 읽지 않도록 한 번 로드
  const project = run.projectId ? await Project.findById(run.projectId).lean() : null;
  const destProject = run.targetProjectId ? await Project.findById(run.targetProjectId).lean() : project;
  const ctx = {
    runner,
    project,
    destProject,
    docs: createProjectDocSource({ viewer: runner || { _id: run.userId }, project }),
    kindLabel: '파이프라인',
    logLabel: `PipelineRun ${runId}`,
  };
  await executeRunSteps({ run, definition: pipeline, fromStep, ctx });
}

// 작업 절차 실행 worker (#952)
async function processSequenceRun(job) {
  const { runId, fromStep = 0 } = job.data;
  const run = await SequenceRun.findById(runId);
  if (!run) throw new Error(`SequenceRun ${runId} not found`);

  const sequence = await Sequence.findById(run.sequenceId);
  if (!sequence) {
    await failRun(run, '작업 절차가 삭제됨');
    return;
  }

  const runner = await User.findById(run.userId).lean();
  if (!runner) {
    await failRun(run, '실행자를 찾을 수 없음');
    return;
  }
  // 요청 시점 검사만으로는 대기 중·재시도 사이에 그룹에서 빠지거나 작업 절차가 비활성화된 경우가
  // 통과한다. 작업판 접근은 여기가 아니라 단계마다 따로 본다.
  if (!userHasSequenceAccess(runner, sequence)) {
    await failRun(run, '작업 절차 접근 권한이 없습니다');
    return;
  }

  const destProject = run.targetProjectId ? await Project.findById(run.targetProjectId).lean() : null;
  const ctx = {
    runner,
    project: null,
    destProject,
    docs: createSequenceDocSource({ viewer: runner }),
    jobMarker: { sequenceRunId: run._id },
    // 단계 입력은 필드별 출처(노출·잠금·앞 단계)로 정한다 (#953)
    resolveStepInput: ({ workboard, definitionStep, stepIndex, previousWorkboard, prevOutput }) => {
      const stepRunInputs = run.runInputs?.[String(definitionStep._id)];
      const { values, skippedPrevious } = buildSequenceStepInput({
        workboard, step: definitionStep, stepIndex, previousWorkboard, prevOutput, stepRunInputs, initialPrompt: run.initialPrompt,
      });
      console.log(`[SequenceRun ${runId}] step ${stepIndex} inputs: values=${Object.keys(values).length} provided=${Object.keys(stepRunInputs || {}).length} skippedPrevious=${JSON.stringify(skippedPrevious)}`);
      return values;
    },
    kindLabel: '작업 절차',
    logLabel: `SequenceRun ${runId}`,
  };
  await executeRunSteps({ run, definition: sequence, fromStep, ctx });
}

// 종료 시 큐 정리 — active 잡 완료를 기다리지 않음 (#523)
const closePipelineRunQueue = async () => {
  if (!pipelineRunQueue) return;
  await pipelineRunQueue.close(true);
  console.log('🛑 Pipeline run queue closed');
};

// 복원 완료 후 큐 전체 비우기 (#650) — best-effort.
const clearPipelineRunQueue = async () => {
  if (!pipelineRunQueue) return { cleared: false, reason: 'not-initialized' };
  try {
    await pipelineRunQueue.obliterate({ force: true });
    console.log('🧹 pipeline run 큐 정리 완료 (복원 후)');
    return { cleared: true };
  } catch (error) {
    console.error('pipeline run 큐 정리 실패:', error.message);
    return { cleared: false, error: error.message };
  }
};

module.exports = {
  initPipelineRunQueue,
  startPipelineRun,
  retryPipelineRun,
  startSequenceRun,
  retrySequenceRun,
  closePipelineRunQueue,
  clearPipelineRunQueue,
  // 테스트용 내부 헬퍼
  collectImageIds,
  applyStepFieldDefaults,
  resolveStepPrompt,
  applyStepPrompt,
  processPipelineRun,
  processSequenceRun,
};
