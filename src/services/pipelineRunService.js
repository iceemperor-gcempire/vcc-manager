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

// 텍스트 단계 실행 — prompt-generate 로직 직접 호출 (HTTP 우회)
// ctx: { runner, project, destProject, docs, jobMarker } — 문서 주입·결과 귀속 (#923, #952)
async function runTextStep(userId, run, step, definitionStep, inputData, prevOutput, ctx = {}) {
  const viewer = ctx.runner || { _id: userId };
  const docs = ctx.docs || createProjectDocSource({ viewer, project: ctx.project });
  const workboard = await Workboard.findById(step.workboardId).populate('serverId');
  if (!workboard) throw new Error('작업판이 삭제됨');
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
    docId: definitionStep.systemPromptDocId, label: `step${step.workboardId} systemPromptDoc`,
  });
  if (spDoc) {
    resolvedSystem = spDoc.title ? `## ${spDoc.title}\n${spDoc.content || ''}` : (spDoc.content || '');
  }
  const worldviewTexts = await docs.loadContext({
    docIds: definitionStep.contextDocIds, label: `step${step.workboardId} contextDocs`,
  });
  // 작업판에 연결된 프롬프트 가이드 (#766) — jobs.js 의 단발 경로와 동일하게 적용.
  const guides = await loadGuidesForWorkboard(workboard);
  const composedSystem = composeSystemPrompt({
    guides,
    systemPrompt: resolvedSystem,
    worldviewTexts,
  });
  const worldviewContext = worldviewTexts.length > 0
    ? joinDocs(worldviewTexts)
    : '';

  // 이미지 입력(vision) — image 타입 필드 값(앞 이미지 단계 산출물 또는 사전 첨부)을 LLM 에 전달.
  // buildStepInput 은 {imageId} 객체 배열로, 프론트 사전입력은 id 배열일 수 있어 둘 다 유연 파싱.
  const imageFieldNames = (workboard.additionalInputFields || []).filter((f) => f.type === 'image').map((f) => f.name);
  const collectedImageIds = collectImageIds(inputData, imageFieldNames);
  let stepImages = [];
  if (collectedImageIds.length > 0) {
    const loaded = await docs.loadVisionImages({ imageIds: collectedImageIds });
    stepImages = loaded.map((im) => ({ base64: im.base64, mimeType: im.mimeType }));
  }

  const messages = [];
  if (composedSystem) messages.push({ role: 'system', content: composedSystem });
  messages.push({ role: 'user', content: inputData.userPrompt, ...(stepImages.length ? { images: stepImages } : {}) });

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

  return {
    conversationJobId: conversation._id,
    output: { type: 'text', value: result },
  };
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

  // queueService 의 addImageGenerationJob 재사용
  const job = await queueService.addImageGenerationJob(userId, workboard._id, {
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
  }, ctx.jobMarker || {});

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

      const autoInject = i === 0 ? false : (definitionStep.autoInject !== false);
      const inputData = buildStepInput(workboard, autoInject ? prevOutput : null, definitionStep.inputs, i, run.initialPrompt);

      let stepResult;
      if (workboard.outputFormat === 'text') {
        stepResult = await runTextStep(run.userId, run, runStep, definitionStep, inputData, prevOutput, ctx);
        runStep.conversationJobId = stepResult.conversationJobId;
      } else {
        stepResult = await runImageStep(run.userId, run, runStep, inputData, ctx);
        runStep.imageGenerationJobId = stepResult.imageGenerationJobId;
      }

      runStep.output = stepResult.output;
      runStep.status = 'completed';
      runStep.completedAt = new Date();
      prevOutput = stepResult.output;
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
  processPipelineRun,
  processSequenceRun,
};
