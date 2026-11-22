/**
 * 채팅 대화를 만나는 기존 독자 (#1282).
 *
 * - GET /conversations/my·/all — 도구 결과 본문을 통째로 내보내지 않는다
 * - POST /jobs/generate-prompt 이어가기 — 채팅 대화는 거절한다 (메시지를 {role, content} 로만 넘겨 도구 짝이 깨진다)
 * - POST /texts/generated — 도구 호출만 있는 빈 assistant 메시지는 저장하지 않는다
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  requireAdmin: (req, res, next) => { req.user = { _id: 'admin-1', isAdmin: true }; next(); },
  userHasWorkboardAccess: () => true,
  userHasProjectAccess: () => true,
}));
jest.mock('../services/queueService', () => ({
  addImageGenerationJob: jest.fn(), getQueueStats: jest.fn(), cancelQueueJob: jest.fn(), abortActiveJob: jest.fn(),
}));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/ConversationJob', () => ({ create: jest.fn(), find: jest.fn(), findById: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/ImageGenerationJob', () => ({ updateMany: jest.fn(async () => ({})) }));
jest.mock('../models/GeneratedText', () => ({ create: jest.fn(async (doc) => ({ _id: 'gt-1', ...doc })) }));
jest.mock('../services/promptGuideService', () => ({ loadGuidesForWorkboard: jest.fn(async () => []) }));
jest.mock('../services/openAIChatService', () => ({ completeStream: jest.fn(async () => ({ content: 'ok', usage: {} })) }));
jest.mock('../services/geminiService', () => ({}));

const Workboard = require('../models/Workboard');
const ConversationJob = require('../models/ConversationJob');
const GeneratedText = require('../models/GeneratedText');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const openAIChatService = require('../services/openAIChatService');
const { LIST_TOOL_CONTENT_CHARS } = require('../utils/conversationView');

const WB_ID = 'a'.repeat(24);
const workboard = () => ({
  _id: WB_ID, isActive: true, outputFormat: 'text', workboardType: 'prompt',
  serverId: { _id: 'srv', isActive: true, serverType: 'OpenAI Compatible', serverUrl: 'http://llm.invalid', configuration: {} },
  additionalInputFields: [{ name: 'base_model', type: 'string' }],
  incrementUsage: jest.fn(async () => {}),
});

const chatMessages = () => [
  { role: 'user', content: '고양이 그려 줘' },
  { role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'find_workboards', arguments: '{}' }] },
  { role: 'tool', toolCallId: 'call_1', name: 'find_workboards', content: 'y'.repeat(LIST_TOOL_CONTENT_CHARS * 10) },
  { role: 'assistant', content: '만들었습니다.' },
];

function listChain(result) {
  const chain = {};
  chain.sort = () => chain; chain.skip = () => chain; chain.limit = () => chain; chain.populate = () => chain;
  chain.lean = () => Promise.resolve(result);
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/conversations', require('../routes/conversations'));
  app.use('/api/jobs', require('../routes/jobs'));
  app.use('/api/texts', require('../routes/texts'));
  return app;
}

let app;
let logSpy;
beforeAll(() => { app = createApp(); });
beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockCurrentUser = { _id: 'user-1', isAdmin: false };
});
afterEach(() => logSpy.mockRestore());

describe('대화 목록 (#1282)', () => {
  test.each(['/my', '/all'])('GET %s — 도구 결과는 줄이고 메시지 순번은 그대로', async (path) => {
    ConversationJob.find.mockReturnValue(listChain([{ _id: 'c1', kind: 'chat', messages: chatMessages() }]));
    ConversationJob.countDocuments.mockResolvedValue(1);

    const res = await request(app).get(`/api/conversations${path}`);

    expect(res.status).toBe(200);
    const { messages } = res.body.data.conversations[0];
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(messages[2].content.length).toBe(LIST_TOOL_CONTENT_CHARS + 1);
    expect(messages[2].contentTruncated).toBe(true);
    expect(messages[3].content).toBe('만들었습니다.');
  });

  test('GET /:id — 상세는 도구 결과 전체를 준다', async () => {
    ConversationJob.findById.mockReturnValue(listChain({ _id: 'c1', userId: 'user-1', kind: 'chat', messages: chatMessages() }));
    const res = await request(app).get('/api/conversations/c1');
    expect(res.status).toBe(200);
    expect(res.body.data.messages[2].content.length).toBe(LIST_TOOL_CONTENT_CHARS * 10);
  });
});

describe('AI 프롬프트 생성 이어가기 (#1282)', () => {
  const continueWith = (conversation) => {
    const wb = workboard();
    const chain = { populate: () => chain, then: (resolve, reject) => Promise.resolve(wb).then(resolve, reject) };
    Workboard.findById.mockReturnValue(chain);
    ConversationJob.findById.mockResolvedValue(conversation);
    return request(app).post('/api/jobs/generate-prompt')
      .send({ workboardId: WB_ID, conversationId: 'c1', inputData: { userPrompt: '이어서' } });
  };

  test('채팅 대화는 400 — 대화를 건드리지 않고 LLM 도 부르지 않는다', async () => {
    const save = jest.fn();
    const conversation = { _id: 'c1', userId: 'user-1', workboardId: WB_ID, kind: 'chat', model: 'm', messages: chatMessages(), save };
    const before = conversation.messages.length;

    const res = await continueWith(conversation);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/채팅 화면/);
    expect(save).not.toHaveBeenCalled();
    expect(conversation.messages).toHaveLength(before);
    expect(openAIChatService.completeStream).not.toHaveBeenCalled();
  });

  test('보통 대화(kind 없음·prompt)는 예전처럼 이어진다', async () => {
    for (const kind of [undefined, 'prompt']) {
      openAIChatService.completeStream.mockClear();
      const conversation = {
        _id: 'c1', userId: 'user-1', workboardId: WB_ID, kind, model: 'm',
        messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }],
        save: jest.fn(async () => {}),
      };
      const res = await continueWith(conversation);
      expect(res.status).toBe(200);
      expect(openAIChatService.completeStream).toHaveBeenCalledTimes(1);
      expect(conversation.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    }
  });
});

describe('대화 메시지를 텍스트로 저장 (#1282)', () => {
  const save = (messageIndex) => {
    ConversationJob.findById.mockReturnValue({ lean: async () => ({ _id: 'c1', userId: 'user-1', workboardId: WB_ID, model: 'm', kind: 'chat', messages: chatMessages() }) });
    return request(app).post('/api/texts/generated').send({ conversationJobId: 'c1', messageIndex });
  };

  test('도구 호출만 있는 빈 assistant 메시지는 400', async () => {
    const res = await save(1);
    expect(res.status).toBe(400);
    expect(GeneratedText.create).not.toHaveBeenCalled();
  });

  test('도구 결과 메시지는 400 (assistant 만 저장)', async () => {
    const res = await save(2);
    expect(res.status).toBe(400);
    expect(GeneratedText.create).not.toHaveBeenCalled();
  });

  test('내용이 있는 assistant 메시지는 저장되고, 직전 사용자 글이 출처가 된다', async () => {
    const res = await save(3);
    expect(res.status).toBeLessThan(300);
    expect(GeneratedText.create).toHaveBeenCalledWith(expect.objectContaining({ content: '만들었습니다.', sourcePrompt: '고양이 그려 줘', messageIndex: 3 }));
  });
});

describe('작업 히스토리에서 대화 삭제 (#1284)', () => {
  const remove = (kind) => {
    const deleteOne = jest.fn(async () => {});
    ConversationJob.findById.mockResolvedValue({ _id: 'c1', userId: 'user-1', kind, deleteOne });
    return request(app).delete('/api/conversations/c1').then((res) => ({ res, deleteOne }));
  };

  test('채팅 대화를 지우면 그 대화에서 만든 작업은 남기고 연결만 끊는다', async () => {
    const { res, deleteOne } = await remove('chat');
    expect(res.status).toBe(200);
    expect(deleteOne).toHaveBeenCalled();
    expect(ImageGenerationJob.updateMany).toHaveBeenCalledWith({ conversationId: 'c1' }, { $unset: { conversationId: 1 } });
  });

  test('보통 대화는 작업을 건드리지 않는다', async () => {
    const { res } = await remove(undefined);
    expect(res.status).toBe(200);
    expect(ImageGenerationJob.updateMany).not.toHaveBeenCalled();
  });
});
