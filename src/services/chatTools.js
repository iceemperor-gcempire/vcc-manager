// 채팅 화면의 LLM 에게 주는 도구 (#1284, 에픽 #1267).
//
// 도구는 요청자 권한으로 실행한다. 모델이 주는 id·값은 전부 미검증 입력이다 — 작업판은 접근 권한을,
// 작업은 소유자를 매번 다시 본다. 판은 능력(출력 종류, 받는 입력)과 사용량으로만 고른다. 판·모델 이름을
// 코드에 적지 않는다.
//
// 도구 결과에는 id 만 싣는다. 미디어 주소는 서명이 필요한데(utils/signedUrl) 서명은 res.json 응답에만
// 붙는다 — 화면은 id 로 JSON 엔드포인트를 다시 읽는다.

const mongoose = require('mongoose');
const Workboard = require('../models/Workboard');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { userHasWorkboardAccess, buildWorkboardAccessFilter } = require('../middleware/auth');
const { ATTACHMENT_FIELD_TYPES } = require('../constants/mediaTypes');
const { checkWorkboardReadiness } = require('./workboardReadiness');
const { submitGenerationRequest, GenerationRequestError } = require('./generationRequest');
const { normalizeGenerationParams, attachmentLimit, MAX_LISTED_OPTIONS } = require('./generationParams');
const { isPromptOptional } = require('../utils/workflowDirectives');

/** 채팅으로 만들 수 있는 출력 종류 — 텍스트 판은 대화 상대이지 생성 대상이 아니다 */
const GENERATION_OUTPUTS = ['image', 'video', 'audio'];
/** find_workboards 가 돌려주는 판 수 */
const MAX_FOUND_WORKBOARDS = 6;
/** 한 턴(사용자 메시지 하나)에 등록할 수 있는 생성 작업 수. 라운드 상한과 따로 둔다 — 생성은 분 단위로 GPU 를 쓴다 */
const MAX_GENERATIONS_PER_TURN = 2;

const TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'find_workboards',
    description: 'List workboards (generation presets) the user can run, most used first. Call this before generate to pick a workboard. Use needsImageInput=true when the user attached an image that must be used as input (e.g. image-to-video, image edit).',
    parameters: {
      type: 'object',
      properties: {
        output: { type: 'string', enum: GENERATION_OUTPUTS, description: 'What the workboard produces.' },
        needsImageInput: { type: 'boolean', description: 'true: only workboards that accept an input image. false or omitted: only workboards that can run without one.' },
      },
      required: ['output'],
    },
  },
  {
    name: 'get_workboard',
    description: 'Show one workboard: its input fields with types, allowed options and defaults. Call this before generate when you need to set anything other than the prompt, or to learn which field takes an attached image.',
    parameters: {
      type: 'object',
      properties: { workboardId: { type: 'string', description: 'id from find_workboards' } },
      required: ['workboardId'],
    },
  },
  {
    name: 'generate',
    description: `Start a generation job on a workboard. Returns a job id immediately; the job runs in the background for seconds to minutes and the user sees progress and results in the side panel, so do not wait or poll. Fields you omit use the workboard defaults. At most ${MAX_GENERATIONS_PER_TURN} jobs per user message.`,
    parameters: {
      type: 'object',
      properties: {
        workboardId: { type: 'string', description: 'id from find_workboards' },
        prompt: { type: 'string', description: 'The generation prompt. Follow the workboard description if it says how prompts should be written.' },
        negativePrompt: { type: 'string', description: 'Optional. Omit to use the workboard default.' },
        params: { type: 'object', description: 'Optional input field values by field name (see get_workboard). Attachment fields take the attachment id, or an array of ids.' },
      },
      required: ['workboardId'],
    },
  },
  {
    name: 'get_job',
    description: 'Check a generation job started in this chat: status, progress, error and result ids. Use it only when the user asks about a job.',
    parameters: {
      type: 'object',
      properties: { jobId: { type: 'string', description: 'id returned by generate' } },
      required: ['jobId'],
    },
  },
]);

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v) && v.length === 24;
const attachmentFields = (wb, type) => (wb.additionalInputFields || []).filter((f) => f && f.type === type);

/** 판 한 줄 요약 — find_workboards 결과 */
function summarizeWorkboard(wb) {
  const imageFields = attachmentFields(wb, 'image');
  return {
    id: String(wb._id),
    name: wb.name,
    ...(wb.description ? { description: wb.description } : {}),
    output: wb.outputFormat,
    usageCount: wb.usageCount || 0,
    imageInputs: imageFields.map((f) => ({ field: f.name, required: Boolean(f.required), max: attachmentLimit(f) })),
    ...(attachmentFields(wb, 'video').length > 0 ? { videoInputs: attachmentFields(wb, 'video').map((f) => ({ field: f.name, required: Boolean(f.required) })) } : {}),
    ...(attachmentFields(wb, 'audio').length > 0 ? { audioInputs: attachmentFields(wb, 'audio').map((f) => ({ field: f.name, required: Boolean(f.required) })) } : {}),
  };
}

/** 판 상세 — get_workboard 결과. 워크플로·서버 주소·그룹은 내보내지 않는다 */
function describeWorkboard(wb) {
  const fields = (wb.additionalInputFields || []).filter(Boolean).map((f) => {
    const out = { name: f.name, type: f.type, required: Boolean(f.required) };
    if (f.label && f.label !== f.name) out.label = f.label;
    if (f.description) out.description = f.description;
    if (ATTACHMENT_FIELD_TYPES.includes(f.type)) {
      out.max = attachmentLimit(f);
      return out;
    }
    const def = valueOf(f.defaultValue);
    if (def !== undefined && def !== null && def !== '') out.default = def;
    let options = null;
    if (f.type === 'select') options = (f.options || []).map((o) => o.value);
    else if (f.type === 'baseModel' && wb.modelExposurePolicy === 'whitelist' && (wb.modelWhitelist || []).length > 0) options = wb.modelWhitelist;
    if (options) {
      out.options = options.slice(0, MAX_LISTED_OPTIONS);
      if (options.length > MAX_LISTED_OPTIONS) out.moreOptions = options.length - MAX_LISTED_OPTIONS;
    }
    return out;
  });
  return {
    id: String(wb._id),
    name: wb.name,
    ...(wb.description ? { description: wb.description } : {}),
    output: wb.outputFormat,
    promptRequired: !isPromptOptional(wb),
    ...(wb.promptGeneratorInstructions ? { promptInstructions: wb.promptGeneratorInstructions } : {}),
    ...(wb.defaultNegativePrompt ? { defaultNegativePrompt: wb.defaultNegativePrompt } : {}),
    fields,
  };
}

/**
 * 준비 상태로 거른다 (services/workboardReadiness). 문제가 확인된 판만 뺀다 — 서버에 못 닿아 확인하지 못한
 * 판은 남긴다 ("확인 못 함"을 "쓸 수 없음"으로 뭉개지 않는다).
 */
async function filterReady(workboards, log) {
  const kept = [];
  const dropped = [];
  let unchecked = 0;
  await Promise.all(workboards.map(async (wb) => {
    try {
      const r = await checkWorkboardReadiness({ workboard: wb, server: wb.serverId });
      if (r.issues.length > 0) {
        dropped.push(`${wb.name}: ${r.issues[0].code}`);
        return;
      }
      if (r.unavailable) unchecked += 1;
    } catch (e) {
      unchecked += 1;
    }
    kept.push(wb);
  }));
  const order = new Map(workboards.map((wb, i) => [wb, i]));
  kept.sort((a, b) => order.get(a) - order.get(b));
  log(`[chatTools] readiness asked=${workboards.length} kept=${kept.length} unchecked=${unchecked} dropped=${dropped.length}${dropped.length ? ` (${dropped.slice(0, 5).join('; ')})` : ''}`);
  return kept;
}

/**
 * @param {Object} ctx
 * @param {Object} ctx.user 요청자
 * @param {Object} ctx.conversation 지금 대화 (만든 작업을 여기에 잇는다)
 * @param {Function} [ctx.onJob] (job, workboard) => void — 작업이 등록된 직후 (화면에 알리는 용도)
 * @param {Function} [ctx.log]
 * @returns {{ tools: Array, handlers: Object, state: { generations: number, jobIds: string[] } }}
 */
function createChatTools({ user, conversation, onJob, log = console.log }) {
  const state = { generations: 0, jobIds: [] };

  /** 접근 가능하고 활성인 생성용 판 하나. 못 쓰면 도구 결과로 돌려줄 오류 객체 */
  async function loadWorkboard(workboardId, { populateServer = false } = {}) {
    if (!isObjectId(workboardId)) return { error: 'workboardId 가 올바르지 않습니다. find_workboards 가 준 id 를 쓰세요.' };
    const query = Workboard.findById(workboardId);
    const wb = await (populateServer ? query.populate('serverId') : query);
    // 없는 판과 권한 없는 판을 같은 말로 답한다 — id 로 판의 존재를 캐지 못하게
    if (!wb || !wb.isActive || !userHasWorkboardAccess(user, wb)) return { error: '쓸 수 없는 작업판입니다. find_workboards 로 다시 찾으세요.' };
    if (!GENERATION_OUTPUTS.includes(wb.outputFormat)) return { error: '이 작업판은 생성용이 아닙니다 (텍스트 작업판).' };
    return { wb };
  }

  const handlers = {
    async find_workboards({ output, needsImageInput } = {}) {
      if (!GENERATION_OUTPUTS.includes(output)) return { error: `output 은 ${GENERATION_OUTPUTS.join(', ')} 중 하나여야 합니다.` };
      const all = await Workboard.find({ ...buildWorkboardAccessFilter(user), isActive: true, outputFormat: output })
        .sort({ usageCount: -1, name: 1 })
        .populate('serverId');
      const usable = all.filter((wb) => wb.serverId && wb.serverId.isActive);
      const wantsImage = needsImageInput === true;
      const matched = usable.filter((wb) => {
        const imageFields = attachmentFields(wb, 'image');
        // 이미지를 써야 하면 받는 칸이 있는 판만, 아니면 이미지 없이 돌 수 있는 판만
        return wantsImage ? imageFields.length > 0 : !imageFields.some((f) => f.required);
      });
      const ready = await filterReady(matched.slice(0, MAX_FOUND_WORKBOARDS * 2), log);
      const picked = ready.slice(0, MAX_FOUND_WORKBOARDS);
      log(`[chatTools] find_workboards output=${output} needsImageInput=${wantsImage} accessible=${all.length} serverActive=${usable.length} matched=${matched.length} returned=${picked.length}`);
      return {
        workboards: picked.map(summarizeWorkboard),
        ...(picked.length === 0 ? { note: wantsImage ? '이미지를 입력으로 받는 작업판이 없습니다.' : '조건에 맞는 작업판이 없습니다. 관리자가 작업판을 만들어야 합니다.' } : {}),
        ...(matched.length > picked.length ? { more: matched.length - picked.length } : {}),
      };
    },

    async get_workboard({ workboardId } = {}) {
      const { wb, error } = await loadWorkboard(workboardId);
      if (error) return { error };
      return describeWorkboard(wb);
    },

    async generate({ workboardId, prompt, negativePrompt, params } = {}) {
      if (state.generations >= MAX_GENERATIONS_PER_TURN) {
        log(`[chatTools] generate 거절 — 턴당 상한 ${MAX_GENERATIONS_PER_TURN} 도달`);
        return { error: `한 번에 ${MAX_GENERATIONS_PER_TURN}개까지만 만들 수 있습니다. 더 만들려면 사용자에게 다시 요청받으세요.` };
      }
      const { wb, error } = await loadWorkboard(workboardId);
      if (error) return { error };

      const normalized = normalizeGenerationParams(wb, params);
      if (normalized.errors.length > 0) {
        log(`[chatTools] generate 입력 오류 workboard=${wb._id} errors=${normalized.errors.length}`);
        return { error: '입력 값이 작업판과 맞지 않습니다.', details: normalized.errors };
      }

      let job;
      try {
        job = await submitGenerationRequest({
          user,
          body: {
            workboardId: String(wb._id),
            prompt: typeof prompt === 'string' ? prompt : '',
            negativePrompt: typeof negativePrompt === 'string' ? negativePrompt : undefined,
            additionalParams: normalized.additionalParams,
            randomSeed: true,
          },
        });
      } catch (e) {
        // 검증 실패는 모델이 고쳐 다시 부를 수 있게 문구 그대로. 그 밖의 오류는 루프(runToolCall)가 handler_error 로 돌려준다
        if (e instanceof GenerationRequestError) {
          log(`[chatTools] generate 검증 거절 workboard=${wb._id} status=${e.status}`);
          return { error: e.message };
        }
        throw e;
      }

      state.generations += 1;
      state.jobIds.push(String(job._id));
      // 대화와 잇는다. 등록은 이미 끝났으므로 연결 실패가 작업을 무르지 않는다 — 로그만 남긴다
      try {
        await ImageGenerationJob.updateOne({ _id: job._id }, { $set: { conversationId: conversation._id } });
      } catch (e) {
        log(`[chatTools] 작업 ${job._id} 를 대화 ${conversation._id} 에 잇지 못함: ${e.message}`);
      }
      log(`[chatTools] generate 등록 job=${job._id} workboard=${wb._id} filledDefaults=${normalized.filled.length} turnGenerations=${state.generations}`);
      if (typeof onJob === 'function') onJob(job, wb);
      return {
        jobId: String(job._id),
        status: job.status,
        workboard: { id: String(wb._id), name: wb.name, output: wb.outputFormat },
        note: '작업이 등록됐습니다. 진행과 결과는 화면의 작업 패널에 나타납니다. 기다리지 말고 사용자에게 무엇을 시작했는지 알려 주세요.',
      };
    },

    async get_job({ jobId } = {}) {
      if (!isObjectId(jobId)) return { error: 'jobId 가 올바르지 않습니다.' };
      const job = await ImageGenerationJob.findById(jobId).lean();
      // 남의 작업과 없는 작업을 같은 말로 답한다
      if (!job || String(job.userId) !== String(user._id)) return { error: '작업을 찾을 수 없습니다.' };
      return {
        jobId: String(job._id),
        status: job.status,
        progress: job.progress || 0,
        ...(job.error?.message ? { error: job.error.message } : {}),
        resultImageIds: (job.resultImages || []).map(String),
        resultVideoIds: (job.resultVideos || []).map(String),
        resultAudioIds: (job.resultAudios || []).map(String),
      };
    },
  };

  return { tools: TOOL_DEFINITIONS, handlers, state };
}

module.exports = {
  createChatTools,
  summarizeWorkboard,
  describeWorkboard,
  TOOL_DEFINITIONS,
  GENERATION_OUTPUTS,
  MAX_FOUND_WORKBOARDS,
  MAX_GENERATIONS_PER_TURN,
};
