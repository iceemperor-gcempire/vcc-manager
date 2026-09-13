/**
 * 단계 실행 루프 — 작업 절차 실행 (#952).
 *
 * 작업 절차 실행이 파이프라인과 같은 루프를 쓰면서
 *   (1) 단계 작업에 소속 표시(sequenceRunId)를 남기고
 *   (2) 작업 절차 문서를 읽고
 *   (3) 작업 절차 접근과 작업판 접근을 각각 다시 보고
 *   (4) 실행을 만든 뒤 정의가 바뀌면 섞어 돌리지 않는지
 * 를 검증한다.
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
const { processSequenceRun, processPipelineRun } = require('../services/pipelineRunService');

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
    return { populate: async () => wb, then: (resolve, reject) => Promise.resolve(wb).then(resolve, reject) };
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

describe('processSequenceRun', () => {
  test('작업 절차 문서를 읽고, 단계 작업에 sequenceRunId 를 남기며 끝까지 실행', async () => {
    jest.useFakeTimers();
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition());

    const done = processSequenceRun({ data: { runId: 'run1', fromStep: 0 } });
    await jest.advanceTimersByTimeAsync(3000); // 이미지 단계 폴링 간격
    await done;

    expect(run.status).toBe('completed');
    expect(run.steps.map((s) => s.status)).toEqual(['completed', 'completed']);

    expect(createSequenceDocSource).toHaveBeenCalledWith({ viewer: runner });
    expect(createProjectDocSource).not.toHaveBeenCalled();
    const source = createSequenceDocSource.mock.results[0].value;
    expect(source.loadSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({ docId: DOC_SP }));

    const conversation = ConversationJob.create.mock.calls[0][0];
    expect(conversation.sequenceRunId).toBe('run1');
    expect(conversation.workboardSystemPrompt).toContain('sequence 본문');

    const [userId, workboardId, input, marker] = queueService.addImageGenerationJob.mock.calls[0];
    expect(userId).toBe('u1');
    expect(String(workboardId)).toBe(WB_IMAGE);
    expect(input.prompt).toBe('생성된 프롬프트'); // 앞 단계 결과 자동 주입
    expect(input.seed).toBe(7); // 사전 입력은 정의에서
    expect(marker).toEqual({ sequenceRunId: 'run1' });
    expect(run.steps[1].output).toEqual({ type: 'image', imageIds: ['img1'] });
  });

  test.each([
    ['그룹에서 빠짐', { allowedGroupIds: ['g2'] }],
    ['작업 절차 비활성', { isActive: false }],
  ])('실행 시점에 작업 절차 접근이 없으면(%s) 단계를 시작하지 않는다', async (_, change) => {
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition(change));

    await processSequenceRun({ data: { runId: 'run1' } });

    expect(run.status).toBe('failed');
    expect(run.error.message).toBe('작업 절차 접근 권한이 없습니다');
    expect(run.steps.map((s) => s.status)).toEqual(['skipped', 'skipped']);
    expect(ConversationJob.create).not.toHaveBeenCalled();
  });

  test('작업 절차 권한이 있어도 단계 작업판 접근이 없으면 그 단계에서 막힌다 (#802)', async () => {
    mockWorkboards({ [WB_TEXT]: workboardDoc(WB_TEXT, { allowedGroupIds: ['g-other'] }), [WB_IMAGE]: workboardDoc(WB_IMAGE) });
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition());

    await processSequenceRun({ data: { runId: 'run1' } });

    expect(run.status).toBe('failed');
    expect(run.steps[0]).toMatchObject({ status: 'failed', error: { message: '작업판 접근 권한이 없습니다: 프롬프트 LLM' } });
    expect(run.steps[1].status).toBe('skipped');
    expect(ConversationJob.create).not.toHaveBeenCalled();
  });

  test('실행을 만든 뒤 단계 작업판이 바뀌었으면 섞어 돌리지 않고 멈춘다', async () => {
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition({ steps: [{ workboardId: WB_IMAGE }, { workboardId: WB_IMAGE }] }));

    await processSequenceRun({ data: { runId: 'run1' } });

    expect(run.status).toBe('failed');
    expect(run.error.message).toBe('작업 절차 단계 구성이 실행을 만든 뒤 바뀌었습니다 — 새로 실행하세요');
    expect(run.steps.map((s) => s.status)).toEqual(['failed', 'skipped']);
    expect(ConversationJob.create).not.toHaveBeenCalled();
    expect(queueService.addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('재시도 중 단계 수가 바뀌면 완료된 앞 단계는 그대로 두고 재시작 지점을 실패로', async () => {
    const run = fakeRun({
      steps: [
        { workboardId: WB_TEXT, status: 'completed', output: { type: 'text', value: 'x' } },
        { workboardId: WB_IMAGE, status: 'pending' },
      ],
    });
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition({ steps: [{ workboardId: WB_TEXT }] }));

    await processSequenceRun({ data: { runId: 'run1', fromStep: 1 } });

    expect(run.steps.map((s) => s.status)).toEqual(['completed', 'failed']);
  });

  test('실행자 것이 아닌 첨부가 들어간 이미지 단계는 작업을 만들지 않고 실패 (#959)', async () => {
    const { findUnusableAttachments } = require('../services/attachmentOwnership');
    findUnusableAttachments.mockResolvedValueOnce([{ label: '시작 이미지' }]);
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition());

    await processSequenceRun({ data: { runId: 'run1' } });

    expect(findUnusableAttachments.mock.calls[0][0].ownerIds).toEqual(['u1']);
    expect(run.steps[1]).toMatchObject({ status: 'failed', error: { message: '쓸 수 없는 첨부가 있습니다: 시작 이미지' } });
    expect(queueService.addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('admin 실행자는 첨부 검증을 건너뛴다', async () => {
    jest.useFakeTimers();
    const { findUnusableAttachments } = require('../services/attachmentOwnership');
    User.findById.mockReturnValue(lean({ _id: 'u1', isAdmin: true, groupIds: [] }));
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(definition());

    const done = processSequenceRun({ data: { runId: 'run1' } });
    await jest.advanceTimersByTimeAsync(3000);
    await done;

    expect(run.status).toBe('completed');
    expect(findUnusableAttachments).not.toHaveBeenCalled();
  });

  test('작업 절차가 삭제됐으면 실패로 닫는다', async () => {
    const run = fakeRun();
    SequenceRun.findById.mockResolvedValue(run);
    Sequence.findById.mockResolvedValue(null);

    await processSequenceRun({ data: { runId: 'run1' } });

    expect(run.status).toBe('failed');
    expect(run.error.message).toBe('작업 절차가 삭제됨');
  });
});

describe('processPipelineRun — 같은 루프, 다른 문서 출처', () => {
  test('프로젝트 기준 문서를 읽고 단계 작업에 소속 표시를 남기지 않는다', async () => {
    const run = fakeRun({ pipelineId: 'pl1', projectId: 'p1', steps: [{ workboardId: WB_TEXT, status: 'pending' }] });
    PipelineRun.findById.mockResolvedValue(run);
    Pipeline.findById.mockResolvedValue({ steps: [{ workboardId: WB_TEXT, systemPromptDocId: 'doc1' }] });
    Project.findById.mockReturnValue(lean({ _id: 'p1', userId: 'u1' }));

    await processPipelineRun({ data: { runId: 'run1' } });

    expect(run.status).toBe('completed');
    expect(createProjectDocSource).toHaveBeenCalled();
    expect(createSequenceDocSource).not.toHaveBeenCalled();
    const conversation = ConversationJob.create.mock.calls[0][0];
    expect(conversation).not.toHaveProperty('sequenceRunId');
    expect(conversation.projectId).toBe('p1');
    expect(conversation.workboardSystemPrompt).toContain('project 본문');
  });
});
