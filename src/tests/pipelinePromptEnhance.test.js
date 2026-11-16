/**
 * 파이프라인 이미지·영상 단계의 AI 프롬프트 늘려 쓰기 (#1212).
 *
 *   (1) 텍스트 판으로 늘려 쓰고, 단계 판의 AI 프롬프트 지침이 [대상 작업판 지침] 층으로 들어가는지
 *   (2) 늘려 쓴 결과가 생성 입력이 되고, 실행 기록에 대화·늘려 쓴 프롬프트가 남는지
 *   (3) 빈 결과면 원래 프롬프트로 대신하는지 (#1204)
 *   (4) 텍스트 판 접근을 실행 직전에 다시 보는지 (#802)
 *   (5) 요청·이미지가 없으면 멈추고, 이미지만 있으면 고정 요청을 보내는지
 */
jest.mock('bull', () => jest.fn());
jest.mock('../models/PipelineRun', () => ({ findById: jest.fn() }));
jest.mock('../models/Pipeline', () => ({ findById: jest.fn() }));
jest.mock('../models/SequenceRun', () => ({ findById: jest.fn() }));
jest.mock('../models/Sequence', () => ({ findById: jest.fn() }));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/ConversationJob', () => ({ create: jest.fn() }));
jest.mock('../models/ImageGenerationJob', () => ({ findById: jest.fn() }));
jest.mock('../models/Project', () => ({ findById: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Tag', () => ({}));
jest.mock('../services/openAIChatService', () => ({ complete: jest.fn() }));
jest.mock('../services/geminiService', () => ({ complete: jest.fn() }));
jest.mock('../services/queueService', () => ({ addImageGenerationJob: jest.fn() }));
jest.mock('../services/promptGuideService', () => ({ loadGuidesForWorkboard: jest.fn(async () => []) }));
jest.mock('../utils/secretCrypto', () => ({ decryptSecret: (v) => v }));
jest.mock('../utils/customFieldHelpers', () => {
  const { FIELD_ROLES } = jest.requireActual('../constants/fieldRoles');
  return { getFieldValueByRole: (wb, input, role) => (role === FIELD_ROLES.MODEL ? 'gpt-test' : undefined) };
});
jest.mock('../services/containerDocAccess', () => {
  const makeSource = (kind) => ({
    loadSystemPrompt: jest.fn(async ({ docId }) => (docId ? { title: `${kind} 지침`, content: `${kind} 본문` } : null)),
    loadContext: jest.fn(async () => []),
    loadVisionImages: jest.fn(async () => []),
    attachmentOwnerIds: jest.fn(() => (kind === 'sequence' ? ['u1'] : ['u1', 'owner1'])),
  });
  return {
    createSequenceDocSource: jest.fn(() => makeSource('sequence')),
    createProjectDocSource: jest.fn(() => makeSource('project')),
    resolveProjectTag: jest.fn(() => null),
  };
});
jest.mock('../services/attachmentOwnership', () => ({
  findUnusableAttachments: jest.fn(async () => []),
  describeUnusableAttachments: jest.fn((list) => `쓸 수 없는 첨부가 있습니다: ${list.map((u) => u.label).join(', ')}`),
}));
jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  return {
    userHasWorkboardAccess: actual.userHasWorkboardAccess,
    userHasSequenceAccess: actual.userHasSequenceAccess,
  };
});

const PipelineRun = require('../models/PipelineRun');
const Pipeline = require('../models/Pipeline');
const SequenceRun = require('../models/SequenceRun');
const Sequence = require('../models/Sequence');
const Workboard = require('../models/Workboard');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const Project = require('../models/Project');
const User = require('../models/User');
const openAIChatService = require('../services/openAIChatService');
const queueService = require('../services/queueService');
const { createSequenceDocSource, createProjectDocSource } = require('../services/containerDocAccess');
const { processPipelineRun } = require('../services/pipelineRunService');
const { IMAGE_ONLY_REQUEST } = require('../utils/promptEnhance');

const WB_TEXT = 'a'.repeat(24);
const WB_IMAGE = 'b'.repeat(24);
const DOC_SP = 'c'.repeat(24);
const runner = { _id: 'u1', groupIds: ['g1'] };

const lean = (value) => ({ lean: async () => value });

function workboardDoc(id, overrides = {}) {
  const base = id === WB_TEXT
    ? {
      _id: WB_TEXT, name: '프롬프트 LLM', outputFormat: 'text', allowedGroupIds: ['g1'], additionalInputFields: [],
      serverId: { isActive: true, serverType: 'OpenAI', serverUrl: 'http://llm', configuration: {} },
    }
    : { _id: WB_IMAGE, name: '이미지', outputFormat: 'image', allowedGroupIds: ['g1'], additionalInputFields: [{ name: 'prompt', type: 'string' }] };
  return { ...base, incrementUsage: jest.fn(), ...overrides };
}

function mockWorkboards(byId) {
  Workboard.findById.mockImplementation((id) => {
    const wb = byId[String(id)] || null;
    return { populate: async () => wb, lean: async () => wb, then: (resolve, reject) => Promise.resolve(wb).then(resolve, reject) };
  });
}

function fakeRun(overrides = {}) {
  return {
    _id: 'run1',
    userId: 'u1',
    sequenceId: 'seq1',
    initialPrompt: '고양이 한 마리',
    status: 'pending',
    steps: [{ workboardId: WB_TEXT, status: 'pending' }, { workboardId: WB_IMAGE, status: 'pending' }],
    markModified: jest.fn(),
    save: jest.fn(async () => undefined),
    ...overrides,
  };
}

function definition(overrides = {}) {
  return {
    _id: 'seq1',
    isActive: true,
    allowedGroupIds: ['g1'],
    steps: [
      { workboardId: WB_TEXT, systemPromptDocId: DOC_SP, contextDocIds: [], inputs: {} },
      { workboardId: WB_IMAGE, autoInject: true, inputs: { seed: 7 } },
    ],
    ...overrides,
  };
}

let consoleSpies = [];
beforeEach(() => {
  jest.clearAllMocks();
  consoleSpies = ['log', 'warn', 'error'].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  mockWorkboards({ [WB_TEXT]: workboardDoc(WB_TEXT), [WB_IMAGE]: workboardDoc(WB_IMAGE) });
  User.findById.mockReturnValue(lean(runner));
  Project.findById.mockReturnValue(lean(null));
  ConversationJob.create.mockImplementation(async (doc) => ({ ...doc, _id: 'conv1', messages: [...doc.messages], save: jest.fn() }));
  openAIChatService.complete.mockResolvedValue({ content: '생성된 프롬프트', usage: {} });
  queueService.addImageGenerationJob.mockResolvedValue({ _id: 'img-job1' });
  ImageGenerationJob.findById.mockReturnValue({
    populate: () => lean({ _id: 'img-job1', status: 'completed', resultImages: [{ _id: 'img1' }] }),
  });
});
afterEach(() => {
  jest.useRealTimers();
  consoleSpies.forEach((s) => s.mockRestore());
});


const WB_VIDEO = 'd'.repeat(24);
const INSTRUCTIONS = 'H3 구조로 쓴다: integrated_multimodal_description …';

function videoBoard(overrides = {}) {
  return {
    _id: WB_VIDEO, name: 'H3 I2V', outputFormat: 'video', allowedGroupIds: ['g1'],
    additionalInputFields: [{ name: 'prompt', type: 'string' }, { name: 'first_frame', label: '첫 프레임 (선택)', type: 'image' }, { name: 'last_frame', label: '끝 프레임 (선택)', type: 'image' }],
    promptGeneratorInstructions: INSTRUCTIONS,
    incrementUsage: jest.fn(),
    ...overrides,
  };
}

function pipelineRun(steps, overrides = {}) {
  return fakeRun({ pipelineId: 'pl1', projectId: 'p1', steps: steps.map((s) => ({ workboardId: s.workboardId, status: 'pending' })), ...overrides });
}

async function runPipeline(run, defSteps) {
  PipelineRun.findById.mockResolvedValue(run);
  Pipeline.findById.mockResolvedValue({ steps: defSteps });
  Project.findById.mockReturnValue(lean({ _id: 'p1', userId: 'u1' }));
  jest.useFakeTimers();
  const done = processPipelineRun({ data: { runId: 'run1' } });
  await jest.advanceTimersByTimeAsync(3000); // 이미지 단계 폴링 간격
  await done;
}

const enhanceStep = (extra = {}) => ({
  workboardId: WB_VIDEO,
  inputs: {},
  promptEnhance: { enabled: true, workboardId: WB_TEXT, inputs: {}, includeImages: true, ...extra },
});

describe('AI 프롬프트 늘려 쓰기 (#1212)', () => {
  beforeEach(() => {
    mockWorkboards({ [WB_TEXT]: workboardDoc(WB_TEXT), [WB_VIDEO]: videoBoard() });
    openAIChatService.complete.mockResolvedValue({ content: '  integrated_multimodal_description: [Shot 1] 늘려 쓴 결과  ', usage: {} });
  });

  test('단계 판 지침이 [대상 작업판 지침] 으로 들어가고, 늘려 쓴 결과로 생성한다', async () => {
    const run = pipelineRun([enhanceStep()]);
    await runPipeline(run, [enhanceStep()]);

    expect(run.status).toBe('completed');
    const conv = ConversationJob.create.mock.calls[0][0];
    expect(conv.workboardId).toBe(WB_TEXT);
    expect(conv.targetWorkboardId).toBe(WB_VIDEO);
    expect(conv.targetWorkboardInstructions).toBe(INSTRUCTIONS);
    const system = conv.messages.find((m) => m.role === 'system').content;
    expect(system).toContain('[대상 작업판 지침]\n' + INSTRUCTIONS);
    expect(conv.messages.at(-1).content).toBe('고양이 한 마리'); // 시작 프롬프트가 요청

    const input = queueService.addImageGenerationJob.mock.calls[0][2];
    expect(input.prompt).toBe('integrated_multimodal_description: [Shot 1] 늘려 쓴 결과');
    expect(run.steps[0].conversationJobId).toBe('conv1');
    expect(run.steps[0].imageGenerationJobId).toBe('img-job1');
    expect(run.steps[0].output.enhancedPrompt).toBe('integrated_multimodal_description: [Shot 1] 늘려 쓴 결과');
    expect(run.steps[0].output).not.toHaveProperty('promptEnhanceFallback');
  });

  test('단계 문서(시스템 프롬프트)도 늘려 쓰는 LLM 호출에 들어간다', async () => {
    const step = { ...enhanceStep(), systemPromptDocId: DOC_SP };
    const run = pipelineRun([step]);
    await runPipeline(run, [step]);

    const conv = ConversationJob.create.mock.calls[0][0];
    expect(conv.workboardSystemPrompt).toContain('project 본문');
    const system = conv.messages.find((m) => m.role === 'system').content;
    expect(system.indexOf('[대상 작업판 지침]')).toBeLessThan(system.indexOf('[작업 지침]'));
  });

  test('빈 결과면 원래 프롬프트로 생성하고 대신했다고 남긴다 (#1204)', async () => {
    openAIChatService.complete.mockResolvedValue({ content: '   ', usage: {} });
    const run = pipelineRun([enhanceStep()]);
    await runPipeline(run, [enhanceStep()]);

    expect(run.status).toBe('completed');
    expect(queueService.addImageGenerationJob.mock.calls[0][2].prompt).toBe('고양이 한 마리');
    expect(run.steps[0].output.promptEnhanceFallback).toBe(true);
    expect(run.steps[0].output.enhancedPrompt).toBe('고양이 한 마리');
  });

  test('텍스트 판 접근 권한이 없으면 생성하지 않고 그 단계에서 멈춘다 (#802)', async () => {
    mockWorkboards({ [WB_TEXT]: workboardDoc(WB_TEXT, { allowedGroupIds: ['other'] }), [WB_VIDEO]: videoBoard() });
    const run = pipelineRun([enhanceStep()]);
    await runPipeline(run, [enhanceStep()]);

    expect(run.status).toBe('failed');
    expect(run.steps[0].error.message).toContain('AI 프롬프트 판 접근 권한이 없습니다');
    expect(openAIChatService.complete).not.toHaveBeenCalled();
    expect(queueService.addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('텍스트 판이 아닌 판을 골랐으면 멈춘다', async () => {
    mockWorkboards({ [WB_TEXT]: workboardDoc(WB_TEXT, { outputFormat: 'image' }), [WB_VIDEO]: videoBoard() });
    const run = pipelineRun([enhanceStep()]);
    await runPipeline(run, [enhanceStep()]);

    expect(run.status).toBe('failed');
    expect(run.steps[0].error.message).toContain('텍스트 판만');
    expect(queueService.addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('요청도 이미지도 없으면 LLM 을 부르지 않고 멈춘다', async () => {
    const run = pipelineRun([enhanceStep()], { initialPrompt: '' });
    await runPipeline(run, [enhanceStep()]);

    expect(run.status).toBe('failed');
    expect(run.steps[0].error.message).toContain('AI 프롬프트에 넘길 요청이 없습니다');
    expect(openAIChatService.complete).not.toHaveBeenCalled();
  });

  test('이미지만 있으면 고정 요청과 함께 단계 이미지를 보낸다', async () => {
    createProjectDocSource.mockImplementationOnce(() => ({
      loadSystemPrompt: jest.fn(async () => null),
      loadContext: jest.fn(async () => []),
      loadVisionImages: jest.fn(async ({ imageIds }) => imageIds.map((id) => ({ imageId: id, base64: 'AAAA', mimeType: 'image/png' }))),
      attachmentOwnerIds: jest.fn(() => ['u1']),
    }));
    const step = { ...enhanceStep(), inputs: { first_frame: ['e'.repeat(24)] } };
    const run = pipelineRun([step], { initialPrompt: '' });
    await runPipeline(run, [step]);

    expect(run.status).toBe('completed');
    const userMsg = openAIChatService.complete.mock.calls[0][2].at(-1);
    expect(userMsg.content.startsWith(IMAGE_ONLY_REQUEST)).toBe(true);
    expect(userMsg.images).toHaveLength(1);
  });

  test('보낸 이미지마다 어느 칸의 그림인지 요청에 붙인다 — 칸 순서, 못 읽은 이미지는 번호에서 뺀다', async () => {
    const FIRST = 'e'.repeat(24);
    const LAST = 'f'.repeat(24);
    createProjectDocSource.mockImplementationOnce(() => ({
      loadSystemPrompt: jest.fn(async () => null),
      loadContext: jest.fn(async () => []),
      // 첫 프레임은 못 읽었다고 가정 — 끝 프레임이 그림 1 이 된다
      loadVisionImages: jest.fn(async ({ imageIds }) => imageIds.filter((id) => id === LAST).map((id) => ({ imageId: id, base64: 'BBBB', mimeType: 'image/png' }))),
      attachmentOwnerIds: jest.fn(() => ['u1']),
    }));
    const step = { ...enhanceStep(), inputs: { last_frame: [LAST], first_frame: [FIRST] } };
    const run = pipelineRun([step]);
    await runPipeline(run, [step]);

    const userMsg = openAIChatService.complete.mock.calls[0][2].at(-1);
    expect(userMsg.content).toBe('고양이 한 마리\n\n[이 단계에 들어가는 이미지 — 첨부한 순서]\n- 첫 프레임 (불러오지 못해 보내지 않았다)\n- 그림 1: 끝 프레임');
    expect(userMsg.images).toHaveLength(1);
  });

  test('이미지를 보내지 않아도 어느 칸이 차 있는지는 알린다 (지침이 칸 이름으로 모드를 정한다)', async () => {
    const step = { ...enhanceStep({ includeImages: false }), inputs: { first_frame: ['e'.repeat(24)] } };
    const run = pipelineRun([step]);
    await runPipeline(run, [step]);

    const userMsg = openAIChatService.complete.mock.calls[0][2].at(-1);
    expect(userMsg.content).toBe('고양이 한 마리\n\n[이 단계에 들어가는 이미지 — 이미지는 보내지 않았다]\n- 첫 프레임');
    expect(userMsg.images).toBeUndefined();
  });

  test('이미지 넘기기를 끄면 단계 이미지를 읽지 않는다', async () => {
    const step = { ...enhanceStep({ includeImages: false }), inputs: { first_frame: ['e'.repeat(24)] } };
    const run = pipelineRun([step]);
    await runPipeline(run, [step]);

    expect(run.status).toBe('completed');
    const source = createProjectDocSource.mock.results[0].value;
    expect(source.loadVisionImages).not.toHaveBeenCalled();
    expect(openAIChatService.complete.mock.calls[0][2].at(-1).images).toBeUndefined();
  });

  test('꺼져 있으면 지금처럼 LLM 없이 생성한다', async () => {
    const step = enhanceStep({ enabled: false });
    const run = pipelineRun([step]);
    await runPipeline(run, [step]);

    expect(run.status).toBe('completed');
    expect(openAIChatService.complete).not.toHaveBeenCalled();
    expect(queueService.addImageGenerationJob.mock.calls[0][2].prompt).toBe('고양이 한 마리');
    expect(run.steps[0].output).not.toHaveProperty('enhancedPrompt');
  });

  test('텍스트 단계는 대상 판 지침 없이 지금처럼 돈다', async () => {
    const run = pipelineRun([{ workboardId: WB_TEXT }]);
    await runPipeline(run, [{ workboardId: WB_TEXT }]);

    expect(run.status).toBe('completed');
    const conv = ConversationJob.create.mock.calls[0][0];
    expect(conv.targetWorkboardId).toBeUndefined();
    expect(conv.targetWorkboardInstructions).toBeUndefined();
  });
});
