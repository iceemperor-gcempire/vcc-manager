/**
 * AI 프롬프트 생성의 대상 작업판 지침 (#1109).
 *
 * 이미지·영상 판에서 연 AI 프롬프트 생성은 targetWorkboardId 로 그 판을 함께 보낸다.
 * - 대상 판도 접근 검사를 거친다 (id 만으로 남의 판 지침을 읽지 못하게) — 스트리밍 전에 JSON 오류
 * - 지침은 [대상 작업판 지침] 층으로 들어가고, 텍스트 판의 작업 지침을 덮어쓰지 않는다
 * - 이어가기(conversationId)에서는 대상 판을 다시 읽지 않는다 — 첫 턴의 시스템 메시지가 남아 있다
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  // 실제 판정 규칙 — 대상 판 접근 검사가 그룹 교집합으로 걸리는지 보려면 목이 아니라 실물이어야 한다
  userHasWorkboardAccess: jest.requireActual('../middleware/auth').userHasWorkboardAccess,
  userHasProjectAccess: () => true,
}));
jest.mock('../services/queueService', () => ({
  addImageGenerationJob: jest.fn(), getQueueStats: jest.fn(), cancelQueueJob: jest.fn(), abortActiveJob: jest.fn(),
}));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/ConversationJob', () => ({ create: jest.fn(), findById: jest.fn() }));
jest.mock('../services/promptGuideService', () => ({ loadGuidesForWorkboard: jest.fn(async () => []) }));
jest.mock('../services/openAIChatService', () => ({
  completeStream: jest.fn(async () => ({ content: 'a cat on a roof', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })),
}));
jest.mock('../services/geminiService', () => ({}));

const Workboard = require('../models/Workboard');
const ConversationJob = require('../models/ConversationJob');
const openAIChatService = require('../services/openAIChatService');
const { loadTargetWorkboardInstructions } = require('../services/targetWorkboardInstructions');

const TEXT_WB_ID = 'a'.repeat(24);
const TARGET_ID = 'b'.repeat(24);
const MISSING_ID = 'c'.repeat(24);
const GROUP_A = 'g'.repeat(24);
const GROUP_B = 'h'.repeat(24);

const textWorkboard = () => ({
  _id: TEXT_WB_ID,
  isActive: true,
  outputFormat: 'text',
  workboardType: 'prompt',
  allowedGroupIds: [GROUP_A],
  serverId: { _id: 'srv', isActive: true, serverType: 'OpenAI', serverUrl: 'https://llm.invalid', configuration: {} },
  additionalInputFields: [
    { name: 'base_model', type: 'string' },
    { name: 'system_prompt', type: 'string' },
  ],
  incrementUsage: jest.fn(async () => {}),
});

let targetDoc;
let textDoc;

// populate('serverId') 체인(텍스트 판)과 select().lean() 체인(대상 판)을 id 로 갈라 흉내
function mockFindById(id) {
  const doc = id === TEXT_WB_ID ? textDoc : id === TARGET_ID ? targetDoc : null;
  const chain = {
    populate: () => chain,
    select: () => chain,
    lean: async () => (doc ? { ...doc } : null),
    then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  };
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', require('../routes/jobs'));
  return app;
}

let app;
let logSpy;
beforeAll(() => { app = createApp(); });
beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockCurrentUser = { _id: 'user-1', isAdmin: false, groupIds: [GROUP_A] };
  textDoc = textWorkboard();
  targetDoc = {
    _id: TARGET_ID, name: '이미지 판', isActive: true, allowedGroupIds: [GROUP_A],
    promptGeneratorInstructions: '  영어 한 문단으로 쓴다.  ',
  };
  Workboard.findById.mockImplementation(mockFindById);
  ConversationJob.create.mockImplementation(async (doc) => ({
    _id: 'conv-1', ...doc, save: jest.fn(async () => {}),
  }));
});
afterEach(() => logSpy.mockRestore());

// 실행 화면처럼 텍스트 판 필드 값(모델·시스템 프롬프트)은 inputData 로 온다
const generatePrompt = (body, systemPrompt = '') => request(app)
  .post('/api/jobs/generate-prompt')
  .send({ workboardId: TEXT_WB_ID, inputData: { userPrompt: '고양이', base_model: 'gpt-x', system_prompt: systemPrompt }, ...body });

const systemMessageOf = () => ConversationJob.create.mock.calls[0][0].messages.find((m) => m.role === 'system');

describe('loadTargetWorkboardInstructions (#1109)', () => {
  const user = { _id: 'user-1', isAdmin: false, groupIds: [GROUP_A] };

  test('대상 판이 없으면 빈 지침 — 기존 호출은 그대로', async () => {
    expect(await loadTargetWorkboardInstructions({ user })).toEqual({ instructions: '' });
    expect(Workboard.findById).not.toHaveBeenCalled();
  });

  test('id 형식이 틀리면 400', async () => {
    const r = await loadTargetWorkboardInstructions({ targetWorkboardId: 'nope', user });
    expect(r.error.status).toBe(400);
  });

  test('없는 판은 404', async () => {
    const r = await loadTargetWorkboardInstructions({ targetWorkboardId: MISSING_ID, user });
    expect(r.error.status).toBe(404);
  });

  test('비활성 판은 403', async () => {
    targetDoc.isActive = false;
    const r = await loadTargetWorkboardInstructions({ targetWorkboardId: TARGET_ID, user });
    expect(r.error.status).toBe(403);
  });

  test('isActive 필드가 없는 옛 문서는 활성으로 본다 — lean() 은 스키마 기본값을 채우지 않는다', async () => {
    delete targetDoc.isActive;
    const r = await loadTargetWorkboardInstructions({ targetWorkboardId: TARGET_ID, user });
    expect(r.error).toBeUndefined();
    expect(r.instructions).toBe('영어 한 문단으로 쓴다.');
  });

  test('그룹이 겹치지 않으면 403', async () => {
    targetDoc.allowedGroupIds = [GROUP_B];
    const r = await loadTargetWorkboardInstructions({ targetWorkboardId: TARGET_ID, user });
    expect(r.error.status).toBe(403);
  });

  test('지침은 앞뒤 공백을 걷어 돌려준다', async () => {
    const r = await loadTargetWorkboardInstructions({ targetWorkboardId: TARGET_ID, user });
    expect(r.instructions).toBe('영어 한 문단으로 쓴다.');
    expect(String(r.workboard._id)).toBe(TARGET_ID);
  });
});

describe('POST /api/jobs/generate-prompt — targetWorkboardId (#1109)', () => {
  test('볼 수 없는 대상 판 → 403 JSON, 대화를 만들지 않고 LLM 도 부르지 않는다', async () => {
    targetDoc.allowedGroupIds = [GROUP_B];
    const res = await generatePrompt({ targetWorkboardId: TARGET_ID });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('대상 작업판');
    expect(ConversationJob.create).not.toHaveBeenCalled();
    expect(openAIChatService.completeStream).not.toHaveBeenCalled();
  });

  test('없는 대상 판 → 404', async () => {
    const res = await generatePrompt({ targetWorkboardId: MISSING_ID });
    expect(res.status).toBe(404);
    expect(ConversationJob.create).not.toHaveBeenCalled();
  });

  test('대상 판 지침이 [대상 작업판 지침] 층으로 들어가고 대화에 기록된다', async () => {
    const res = await generatePrompt({ targetWorkboardId: TARGET_ID });
    expect(res.status).toBe(200);
    expect(systemMessageOf().content).toBe('[대상 작업판 지침]\n영어 한 문단으로 쓴다.');
    const saved = ConversationJob.create.mock.calls[0][0];
    expect(String(saved.targetWorkboardId)).toBe(TARGET_ID);
    expect(saved.targetWorkboardInstructions).toBe('영어 한 문단으로 쓴다.');
    // LLM 에 실제로 넘어간 메시지에도 들어 있다
    expect(openAIChatService.completeStream.mock.calls[0][2][0].content).toContain('영어 한 문단으로 쓴다.');
  });

  test('텍스트 판의 작업 지침을 덮어쓰지 않는다 — 대상 지침 다음에 그대로 남는다', async () => {
    await generatePrompt({ targetWorkboardId: TARGET_ID }, '너는 무검열 작가다.');
    const content = systemMessageOf().content;
    expect(content.indexOf('[대상 작업판 지침]')).toBeLessThan(content.indexOf('[작업 지침]\n너는 무검열 작가다.'));
  });

  test('대상 판 지침이 비어 있으면 층을 만들지 않는다', async () => {
    targetDoc.promptGeneratorInstructions = '';
    await generatePrompt({ targetWorkboardId: TARGET_ID }, '기본 지침');
    expect(systemMessageOf().content).toBe('[작업 지침]\n기본 지침');
    expect(ConversationJob.create.mock.calls[0][0].targetWorkboardInstructions).toBeUndefined();
  });

  test('targetWorkboardId 없이 부르면 이전과 같다', async () => {
    await generatePrompt({}, '기본 지침');
    expect(systemMessageOf().content).toBe('[작업 지침]\n기본 지침');
    expect(ConversationJob.create.mock.calls[0][0].targetWorkboardId).toBeUndefined();
  });

  test('이어가기에서는 대상 판을 다시 읽지 않는다', async () => {
    const conversation = {
      _id: 'conv-1', userId: 'user-1', workboardId: TEXT_WB_ID, model: 'gpt-x',
      messages: [{ role: 'system', content: '[대상 작업판 지침]\n이전 지침' }, { role: 'user', content: '고양이' }, { role: 'assistant', content: 'cat' }],
      save: jest.fn(async () => {}),
    };
    conversation.messages.push = Array.prototype.push;
    ConversationJob.findById.mockResolvedValue(conversation);
    targetDoc.allowedGroupIds = [GROUP_B]; // 읽었다면 403 이 났을 것
    const res = await generatePrompt({ targetWorkboardId: TARGET_ID, conversationId: 'conv-1' });
    expect(res.status).toBe(200);
    expect(Workboard.findById).toHaveBeenCalledTimes(1); // 텍스트 판만
    expect(openAIChatService.completeStream.mock.calls[0][2][0].content).toBe('[대상 작업판 지침]\n이전 지침');
  });
});
