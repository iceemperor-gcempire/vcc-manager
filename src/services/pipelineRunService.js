const Queue = require('bull');
const PipelineRun = require('../models/PipelineRun');
const Pipeline = require('../models/Pipeline');
const Workboard = require('../models/Workboard');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const UploadedText = require('../models/UploadedText');
const Project = require('../models/Project');
const Tag = require('../models/Tag');
const openAIChatService = require('./openAIChatService');
const geminiService = require('./geminiService');
const { getFieldValueByRole } = require('../utils/customFieldHelpers');
const { decryptSecret } = require('../utils/secretCrypto');
const { FIELD_ROLES } = require('../constants/fieldRoles');
const { computeOpenAITextCost, computeGeminiTextCost } = require('../utils/pricing');
const queueService = require('./queueService');

// 파이프라인 실행 background worker (#407).
// Bull queue 사용 — 사용자가 페이지 떠나도 계속 진행. 부분 retry 지원.

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
  pipelineRunQueue.on('failed', (job, err) => {
    console.error(`[PipelineRun] job ${job.id} failed:`, err.message);
  });
  pipelineRunQueue.on('completed', (job) => {
    console.log(`[PipelineRun] job ${job.id} completed`);
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

// 단계 입력 빌드 — 사전 입력 + 자동 주입 + 초기 프롬프트
function buildStepInput(workboard, prevOutput, stepInputs, stepIdx, initialPrompt) {
  const inputData = { ...(stepInputs || {}) };
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

function composeSystemPrompt(systemPrompt, worldviewTexts) {
  const parts = [];
  if (systemPrompt) parts.push('[작업 지침]\n' + systemPrompt);
  if (worldviewTexts && worldviewTexts.length > 0) {
    const ctx = worldviewTexts.map((t) => (t.title ? `## ${t.title}\n` : '') + (t.content || '')).join('\n\n---\n\n');
    parts.push('[배경 / 사전 컨텍스트]\n' + ctx);
  }
  return parts.join('\n\n');
}

// 텍스트 단계 실행 — prompt-generate 로직 직접 호출 (HTTP 우회)
async function runTextStep(userId, pipelineRun, step, pipelineStep, inputData, prevOutput) {
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
  let resolvedSystem = systemPrompt;
  let worldviewTexts = [];
  if (pipelineStep.systemPromptDocId) {
    const spDoc = await UploadedText.findOne({ userId, _id: pipelineStep.systemPromptDocId }).lean();
    if (spDoc) {
      resolvedSystem = spDoc.title ? `## ${spDoc.title}\n${spDoc.content || ''}` : (spDoc.content || '');
    }
  }
  if (Array.isArray(pipelineStep.contextDocIds) && pipelineStep.contextDocIds.length > 0) {
    worldviewTexts = await UploadedText.find({
      userId,
      _id: { $in: pipelineStep.contextDocIds },
    }).sort({ createdAt: 1 }).lean();
  }
  const composedSystem = composeSystemPrompt(resolvedSystem, worldviewTexts);
  const worldviewContext = worldviewTexts.length > 0
    ? worldviewTexts.map((t) => (t.title ? `## ${t.title}\n` : '') + (t.content || '')).join('\n\n---\n\n')
    : '';

  const messages = [];
  if (composedSystem) messages.push({ role: 'system', content: composedSystem });
  messages.push({ role: 'user', content: inputData.userPrompt });

  // 프로젝트 태그 자동 부여
  let projectTagIds = [];
  if (pipelineRun.projectId) {
    const projectDoc = await Project.findOne({ _id: pipelineRun.projectId, userId }).lean();
    if (projectDoc?.tagId) projectTagIds = [projectDoc.tagId];
  }

  const conversation = await ConversationJob.create({
    userId,
    workboardId: workboard._id,
    projectId: pipelineRun.projectId,
    tags: projectTagIds,
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
async function runImageStep(userId, pipelineRun, step, inputData) {
  const workboard = await Workboard.findById(step.workboardId);
  if (!workboard) throw new Error('작업판이 삭제됨');

  // 프로젝트 태그 주입
  let mergedTags = Array.isArray(inputData.tags) ? [...inputData.tags] : [];
  if (pipelineRun.projectId) {
    const projectDoc = await Project.findOne({ _id: pipelineRun.projectId, userId }).lean();
    if (projectDoc?.tagId && !mergedTags.some((t) => String(t) === String(projectDoc.tagId))) {
      mergedTags.push(projectDoc.tagId);
    }
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
  });

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

// 메인 worker 함수
async function processPipelineRun(job) {
  const { runId, fromStep = 0 } = job.data;
  const run = await PipelineRun.findById(runId);
  if (!run) throw new Error(`PipelineRun ${runId} not found`);

  const pipeline = await Pipeline.findById(run.pipelineId);
  if (!pipeline) {
    run.status = 'failed';
    run.error = { message: '파이프라인이 삭제됨' };
    run.completedAt = new Date();
    await run.save();
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

  for (let i = fromStep; i < run.steps.length; i++) {
    const pipelineStep = pipeline.steps[i];
    const runStep = run.steps[i];
    if (!pipelineStep) {
      runStep.status = 'failed';
      runStep.error = { message: '파이프라인 단계 불일치' };
      run.status = 'failed';
      run.completedAt = new Date();
      await run.save();
      return;
    }

    runStep.status = 'running';
    runStep.startedAt = new Date();
    run.markModified('steps');
    await run.save();

    try {
      const workboard = await Workboard.findById(runStep.workboardId);
      if (!workboard) throw new Error('작업판이 삭제됨');

      const autoInject = i === 0 ? false : (pipelineStep.autoInject !== false);
      const inputData = buildStepInput(workboard, autoInject ? prevOutput : null, pipelineStep.inputs, i, run.initialPrompt);

      let stepResult;
      if (workboard.outputFormat === 'text') {
        stepResult = await runTextStep(run.userId, run, runStep, pipelineStep, inputData, prevOutput);
        runStep.conversationJobId = stepResult.conversationJobId;
      } else {
        stepResult = await runImageStep(run.userId, run, runStep, inputData);
        runStep.imageGenerationJobId = stepResult.imageGenerationJobId;
      }

      runStep.output = stepResult.output;
      runStep.status = 'completed';
      runStep.completedAt = new Date();
      prevOutput = stepResult.output;
      run.markModified('steps');
      await run.save();
    } catch (err) {
      console.error(`[PipelineRun ${runId}] step ${i} failed:`, err.message);
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

// 종료 시 큐 정리 — active 잡 완료를 기다리지 않음 (#523)
const closePipelineRunQueue = async () => {
  if (!pipelineRunQueue) return;
  await pipelineRunQueue.close(true);
  console.log('🛑 Pipeline run queue closed');
};

module.exports = {
  initPipelineRunQueue,
  startPipelineRun,
  retryPipelineRun,
  closePipelineRunQueue,
};
