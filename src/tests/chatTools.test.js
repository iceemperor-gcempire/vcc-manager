/**
 * 채팅 도구 (#1284) — 요청자 권한으로 실행하고, 모델이 준 id·값은 전부 다시 검사한다.
 */
jest.mock('../middleware/auth', () => ({
  userHasWorkboardAccess: jest.requireActual('../middleware/auth').userHasWorkboardAccess,
  buildWorkboardAccessFilter: jest.requireActual('../middleware/auth').buildWorkboardAccessFilter,
}));
jest.mock('../models/Workboard', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../models/ImageGenerationJob', () => ({ findById: jest.fn(), updateOne: jest.fn(async () => ({})) }));
jest.mock('../services/workboardReadiness', () => ({ checkWorkboardReadiness: jest.fn() }));
jest.mock('../services/generationRequest', () => {
  class GenerationRequestError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  return { submitGenerationRequest: jest.fn(), GenerationRequestError };
});

const Workboard = require('../models/Workboard');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { checkWorkboardReadiness } = require('../services/workboardReadiness');
const { submitGenerationRequest, GenerationRequestError } = require('../services/generationRequest');
const { createChatTools, TOOL_DEFINITIONS, MAX_FOUND_WORKBOARDS, MAX_GENERATIONS_PER_TURN } = require('../services/chatTools');

// 24자 hex — 도구가 id 형식을 검사한다
const id = (c) => c.charCodeAt(0).toString(16).padStart(2, '0').repeat(12);
const GROUP = id('g');
const user = { _id: id('1'), isAdmin: false, groupIds: [GROUP] };
const conversation = { _id: id('c') };
const activeServer = { isActive: true, serverType: 'ComfyUI', serverUrl: 'http://comfy.invalid' };

const board = (c, extra = {}) => ({
  _id: id(c), name: `판 ${c}`, isActive: true, outputFormat: 'image', usageCount: 0,
  allowedGroupIds: [GROUP], serverId: activeServer, workflowData: '{"secret":"wf","text":"{{##prompt##}}"}', serverUrl: 'http://comfy.invalid',
  additionalInputFields: [
    { name: 'base_model', type: 'baseModel', defaultValue: 'm.safetensors' },
    { name: 'size', type: 'select', defaultValue: 'a', options: [{ key: 'A', value: 'a' }, { key: 'B', value: 'b' }] },
  ],
  ...extra,
});

const findChain = (docs) => { const chain = { sort: () => chain, populate: async () => docs }; return chain; };
const byIdChain = (doc) => { const chain = { populate: async () => doc, then: (res, rej) => Promise.resolve(doc).then(res, rej) }; return chain; };

let logs;
const make = (extra = {}) => createChatTools({ user, conversation, log: (l) => logs.push(l), ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  logs = [];
  checkWorkboardReadiness.mockResolvedValue({ issues: [], unavailable: null });
  submitGenerationRequest.mockImplementation(async () => ({ _id: id('j'), status: 'pending' }));
});

test('도구 정의는 넷 — 이름과 필수 인자', () => {
  expect(TOOL_DEFINITIONS.map((t) => [t.name, t.parameters.required])).toEqual([
    ['find_workboards', ['output']], ['get_workboard', ['workboardId']], ['generate', ['workboardId']], ['get_job', ['jobId']],
  ]);
});

describe('find_workboards', () => {
  test('접근·활성·출력 종류로 묻고, 서버가 꺼진 판은 뺀다', async () => {
    Workboard.find.mockReturnValue(findChain([board('a'), board('b', { serverId: { ...activeServer, isActive: false } }), board('d', { serverId: null })]));
    const r = await make().handlers.find_workboards({ output: 'image' });
    expect(Workboard.find).toHaveBeenCalledWith({ allowedGroupIds: { $in: [GROUP] }, isActive: true, outputFormat: 'image' });
    expect(r.workboards.map((w) => w.id)).toEqual([id('a')]);
  });

  test('이미지 입력: needsImageInput=true 면 받는 판만, 아니면 이미지 없이 도는 판만', async () => {
    const plain = board('a');
    const optional = board('b', { additionalInputFields: [{ name: 'ref', type: 'image', required: false }] });
    const required = board('d', { additionalInputFields: [{ name: 'start', type: 'image', required: true, imageConfig: { maxImages: 2 } }] });
    Workboard.find.mockReturnValue(findChain([plain, optional, required]));
    const withImage = await make().handlers.find_workboards({ output: 'image', needsImageInput: true });
    expect(withImage.workboards.map((w) => w.id)).toEqual([id('b'), id('d')]);
    expect(withImage.workboards[1].imageInputs).toEqual([{ field: 'start', required: true, max: 2 }]);
    const without = await make().handlers.find_workboards({ output: 'image' });
    expect(without.workboards.map((w) => w.id)).toEqual([id('a'), id('b')]);
  });

  test('준비 검사: 문제가 확인된 판만 빼고, 확인 못 한 판은 남긴다 — 사유를 로그에', async () => {
    Workboard.find.mockReturnValue(findChain([board('a'), board('b'), board('d')]));
    checkWorkboardReadiness.mockImplementation(async ({ workboard }) => {
      if (String(workboard._id) === id('a')) return { issues: [{ code: 'NODE_MISSING' }], unavailable: null };
      if (String(workboard._id) === id('b')) return { issues: [], unavailable: 'ComfyUI 에 닿지 못해' };
      throw new Error('boom');
    });
    const r = await make().handlers.find_workboards({ output: 'image' });
    expect(r.workboards.map((w) => w.id)).toEqual([id('b'), id('d')]);
    expect(logs.find((l) => l.includes('readiness'))).toMatch(/asked=3 kept=2 unchecked=2 dropped=1 .*NODE_MISSING/);
  });

  test('사용량 순서를 지키고 상한까지만 — 더 있으면 알린다', async () => {
    const many = Array.from({ length: MAX_FOUND_WORKBOARDS + 3 }, (_, i) => board(String.fromCharCode(97 + i)));
    Workboard.find.mockReturnValue(findChain(many));
    const r = await make().handlers.find_workboards({ output: 'image' });
    expect(r.workboards.map((w) => w.id)).toEqual(many.slice(0, MAX_FOUND_WORKBOARDS).map((w) => String(w._id)));
    expect(r.more).toBe(3);
  });

  test('0건이어도 로그를 남기고 안내를 준다', async () => {
    Workboard.find.mockReturnValue(findChain([]));
    const r = await make().handlers.find_workboards({ output: 'video', needsImageInput: true });
    expect(r.workboards).toEqual([]);
    expect(r.note).toMatch(/이미지를 입력으로 받는/);
    expect(logs.find((l) => l.includes('find_workboards'))).toMatch(/accessible=0 serverActive=0 matched=0 returned=0/);
  });

  test('모르는 출력 종류(텍스트 포함)는 오류', async () => {
    expect((await make().handlers.find_workboards({ output: 'text' })).error).toBeDefined();
    expect(Workboard.find).not.toHaveBeenCalled();
  });
});

describe('get_workboard', () => {
  test('입력 칸·선택지·기본값만 — 워크플로·서버 주소·그룹은 내보내지 않는다', async () => {
    Workboard.findById.mockReturnValue(byIdChain(board('a', { description: '설명', promptGeneratorInstructions: '영어로' })));
    const r = await make().handlers.get_workboard({ workboardId: id('a') });
    expect(r).toMatchObject({ id: id('a'), name: '판 a', output: 'image', promptRequired: true, promptInstructions: '영어로' });
    expect(r.fields).toEqual([
      { name: 'base_model', type: 'baseModel', required: false, default: 'm.safetensors' },
      { name: 'size', type: 'select', required: false, default: 'a', options: ['a', 'b'] },
    ]);
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/secret|comfy\.invalid|allowedGroupIds/);
  });

  test.each([
    ['없는 판', null],
    ['권한 없는 판', board('a', { allowedGroupIds: [id('x')] })],
    ['꺼진 판', board('a', { isActive: false })],
  ])('%s — 같은 말로 거절', async (_, doc) => {
    Workboard.findById.mockReturnValue(byIdChain(doc));
    const r = await make().handlers.get_workboard({ workboardId: id('a') });
    expect(r).toEqual({ error: '쓸 수 없는 작업판입니다. find_workboards 로 다시 찾으세요.' });
  });

  test('텍스트 판과 형식이 틀린 id 는 거절', async () => {
    Workboard.findById.mockReturnValue(byIdChain(board('a', { outputFormat: 'text' })));
    expect((await make().handlers.get_workboard({ workboardId: id('a') })).error).toMatch(/생성용이 아닙니다/);
    expect((await make().handlers.get_workboard({ workboardId: 'w1' })).error).toMatch(/올바르지 않습니다/);
    expect((await make().handlers.get_workboard({})).error).toMatch(/올바르지 않습니다/);
  });
});

describe('generate', () => {
  beforeEach(() => Workboard.findById.mockReturnValue(byIdChain(board('a'))));

  test('기본값을 채워 등록하고, 작업을 대화에 잇고, id 만 바로 돌려준다', async () => {
    const onJob = jest.fn();
    const tools = make({ onJob });
    const r = await tools.handlers.generate({ workboardId: id('a'), prompt: 'a cat', params: { size: 'B' } });
    expect(submitGenerationRequest).toHaveBeenCalledWith({
      user,
      body: {
        workboardId: id('a'), prompt: 'a cat', negativePrompt: undefined, randomSeed: true,
        additionalParams: { base_model: 'm.safetensors', size: { key: 'B', value: 'b' } },
      },
    });
    expect(ImageGenerationJob.updateOne).toHaveBeenCalledWith({ _id: id('j') }, { $set: { conversationId: conversation._id } });
    expect(r).toMatchObject({ jobId: id('j'), status: 'pending', workboard: { id: id('a'), name: '판 a', output: 'image' } });
    expect(tools.state).toEqual({ generations: 1, jobIds: [id('j')] });
    expect(onJob).toHaveBeenCalledTimes(1);
  });

  test('없는 칸·선택지 밖 값은 등록하지 않고 무엇이 틀렸는지 돌려준다', async () => {
    const tools = make();
    const r = await tools.handlers.generate({ workboardId: id('a'), prompt: 'p', params: { size: 'huge', cfg: 7 } });
    expect(r.error).toBeDefined();
    expect(r.details).toHaveLength(2);
    expect(submitGenerationRequest).not.toHaveBeenCalled();
    expect(tools.state.generations).toBe(0);
  });

  test('등록 쪽 검증 거절은 문구 그대로 돌려주고 횟수에 세지 않는다', async () => {
    submitGenerationRequest.mockRejectedValue(new GenerationRequestError(400, '필수 첨부가 누락되었습니다: 시작 이미지'));
    const tools = make();
    const r = await tools.handlers.generate({ workboardId: id('a'), prompt: 'p' });
    expect(r).toEqual({ error: '필수 첨부가 누락되었습니다: 시작 이미지' });
    expect(tools.state.generations).toBe(0);
    expect(ImageGenerationJob.updateOne).not.toHaveBeenCalled();
  });

  test('검증이 아닌 오류는 올려 보낸다 (루프가 handler_error 로 돌려준다)', async () => {
    submitGenerationRequest.mockRejectedValue(new Error('redis down'));
    await expect(make().handlers.generate({ workboardId: id('a'), prompt: 'p' })).rejects.toThrow('redis down');
  });

  test('권한 없는 판에는 등록하지 않는다', async () => {
    Workboard.findById.mockReturnValue(byIdChain(board('a', { allowedGroupIds: [] })));
    const r = await make().handlers.generate({ workboardId: id('a'), prompt: 'p' });
    expect(r.error).toMatch(/쓸 수 없는 작업판/);
    expect(submitGenerationRequest).not.toHaveBeenCalled();
  });

  test(`한 턴에 ${MAX_GENERATIONS_PER_TURN}개까지 — 넘으면 등록하지 않고 오류`, async () => {
    const tools = make();
    for (let i = 0; i < MAX_GENERATIONS_PER_TURN; i += 1) {
      expect((await tools.handlers.generate({ workboardId: id('a'), prompt: 'p' })).jobId).toBeDefined();
    }
    const over = await tools.handlers.generate({ workboardId: id('a'), prompt: 'p' });
    expect(over.error).toMatch(/까지만/);
    expect(submitGenerationRequest).toHaveBeenCalledTimes(MAX_GENERATIONS_PER_TURN);
  });

  test('대화 연결이 실패해도 등록된 작업은 돌려준다', async () => {
    ImageGenerationJob.updateOne.mockRejectedValueOnce(new Error('write failed'));
    const r = await make().handlers.generate({ workboardId: id('a'), prompt: 'p' });
    expect(r.jobId).toBe(id('j'));
    expect(logs.some((l) => l.includes('잇지 못함'))).toBe(true);
  });
});

describe('get_job', () => {
  const lean = (doc) => ({ lean: async () => doc });

  test('내 작업의 상태와 결과 id', async () => {
    ImageGenerationJob.findById.mockReturnValue(lean({ _id: id('j'), userId: user._id, status: 'completed', progress: 100, resultImages: [id('r')], resultVideos: [] }));
    expect(await make().handlers.get_job({ jobId: id('j') })).toEqual({
      jobId: id('j'), status: 'completed', progress: 100, resultImageIds: [id('r')], resultVideoIds: [], resultAudioIds: [],
    });
  });

  test('남의 작업·없는 작업·틀린 id 는 내용을 주지 않는다', async () => {
    ImageGenerationJob.findById.mockReturnValue(lean({ _id: id('j'), userId: id('9'), status: 'completed' }));
    expect(await make().handlers.get_job({ jobId: id('j') })).toEqual({ error: '작업을 찾을 수 없습니다.' });
    ImageGenerationJob.findById.mockReturnValue(lean(null));
    expect(await make().handlers.get_job({ jobId: id('j') })).toEqual({ error: '작업을 찾을 수 없습니다.' });
    expect((await make().handlers.get_job({ jobId: 'job-1' })).error).toMatch(/올바르지 않습니다/);
  });
});
