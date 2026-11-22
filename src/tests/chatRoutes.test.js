/**
 * 채팅 API (#1284) — /api/chat
 * 대화는 본인 것만, 채팅 대화만. 메시지 보내기는 검증을 JSON 으로 끝낸 뒤 SSE 로 넘어간다.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  userHasWorkboardAccess: jest.requireActual('../middleware/auth').userHasWorkboardAccess,
  buildWorkboardAccessFilter: jest.requireActual('../middleware/auth').buildWorkboardAccessFilter,
}));
jest.mock('../models/Workboard', () => ({ find: jest.fn(), findById: jest.fn() }));
jest.mock('../models/ConversationJob', () => ({ find: jest.fn(), findById: jest.fn(), findOneAndUpdate: jest.fn(), countDocuments: jest.fn(), create: jest.fn(), updateOne: jest.fn(async () => ({})) }));
jest.mock('../models/ImageGenerationJob', () => ({ find: jest.fn(), updateMany: jest.fn(async () => ({ modifiedCount: 2 })) }));
jest.mock('../utils/visionImages', () => ({ MAX_IMAGES: 4 }));
jest.mock('../models/UploadedImage', () => ({ find: jest.fn() }));
jest.mock('../models/GeneratedImage', () => ({ find: jest.fn() }));
jest.mock('../services/chatService', () => ({
  ...jest.requireActual('../services/chatService'),
  runChatTurn: jest.fn(),
}));

const Workboard = require('../models/Workboard');
const ConversationJob = require('../models/ConversationJob');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const { runChatTurn, CHAT_SYSTEM_PROMPT } = require('../services/chatService');

const hex = (c) => c.charCodeAt(0).toString(16).padStart(2, '0').repeat(12);
const ME = hex('u');
const GROUP = hex('g');
const WB = hex('w');
const CONV = hex('c');
const IMG = hex('i');

const textBoard = (extra = {}) => ({
  _id: WB, name: '채팅 판', description: '', isActive: true, outputFormat: 'text', usageCount: 5, allowedGroupIds: [GROUP],
  serverId: { name: 'Local', isActive: true, serverType: 'OpenAI Compatible', serverUrl: 'http://llm.invalid', configuration: {} },
  additionalInputFields: [{ name: 'base_model', type: 'baseModel', defaultValue: 'board-model' }, { name: 'input_images', type: 'image' }],
  ...extra,
});

const chatDoc = (extra = {}) => {
  const doc = {
    _id: CONV, userId: ME, workboardId: WB, kind: 'chat', title: '제목', status: 'completed', updatedAt: new Date(),
    messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }],
    save: jest.fn(async () => {}), deleteOne: jest.fn(async () => {}), populate: jest.fn(async () => {}),
    ...extra,
  };
  doc.toJSON = () => { const { save, deleteOne, populate, toJSON, ...plain } = doc; return plain; };
  return doc;
};

const chain = (result) => { const c = {}; for (const m of ['select', 'sort', 'skip', 'limit', 'populate']) c[m] = () => c; c.lean = async () => result; c.then = (res, rej) => Promise.resolve(result).then(res, rej); return c; };
const boardChain = (doc) => ({ populate: async () => doc });

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', require('../routes/chat'));
  return app;
}

const sseEvents = (text) => [...text.matchAll(/event: (\w+)\ndata: (.*)\n/g)].map((m) => [m[1], JSON.parse(m[2])]);

let app;
let logSpy;
beforeAll(() => { app = createApp(); });
beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockCurrentUser = { _id: ME, isAdmin: false, groupIds: [GROUP] };
  Workboard.findById.mockImplementation(() => boardChain(textBoard()));
  runChatTurn.mockImplementation(async ({ emit }) => { emit('token', { delta: '네' }); emit('done', { content: '네' }); return { ok: true }; });
  UploadedImage.find.mockReturnValue(chain([]));
  GeneratedImage.find.mockReturnValue(chain([]));
});
afterEach(() => logSpy.mockRestore());

describe('GET /workboards', () => {
  test('접근 가능한 텍스트 판 중 대화 상대로 쓸 수 있는 것만 — 전체 텍스트 판 수도 함께', async () => {
    Workboard.find.mockReturnValue(chain([
      textBoard(),
      textBoard({ _id: hex('x'), name: 'Gemini 판', serverId: { name: 'G', isActive: true, serverType: 'Gemini' } }),
      textBoard({ _id: hex('y'), name: '꺼진 서버', serverId: { name: 'S', isActive: false, serverType: 'OpenAI' } }),
      textBoard({ _id: hex('v'), name: '기본 모델 없음', additionalInputFields: [{ name: 'base_model', type: 'baseModel' }] }),
    ]));
    const res = await request(app).get('/api/chat/workboards');
    expect(res.status).toBe(200);
    expect(Workboard.find).toHaveBeenCalledWith({ allowedGroupIds: { $in: [GROUP] }, isActive: true, outputFormat: 'text' });
    expect(res.body.data.textWorkboards).toBe(4);
    expect(res.body.data.workboards).toEqual([
      { _id: WB, name: '채팅 판', description: '', usageCount: 5, model: 'board-model', server: { name: 'Local', serverType: 'OpenAI Compatible' }, acceptsImages: true },
    ]);
  });

  test('없으면 빈 목록 (화면이 만들라고 안내한다)', async () => {
    Workboard.find.mockReturnValue(chain([]));
    const res = await request(app).get('/api/chat/workboards');
    expect(res.body.data).toEqual({ workboards: [], textWorkboards: 0 });
  });
});

describe('대화 목록·상세·제목·삭제', () => {
  test('GET /sessions — 내 채팅 대화만 묻는다', async () => {
    ConversationJob.find.mockReturnValue(chain([{ _id: CONV, title: '제목' }]));
    ConversationJob.countDocuments.mockResolvedValue(1);
    const res = await request(app).get('/api/chat/sessions');
    expect(res.status).toBe(200);
    expect(ConversationJob.find).toHaveBeenCalledWith({ userId: ME, kind: 'chat' });
    expect(res.body.data.sessions).toEqual([{ _id: CONV, title: '제목' }]);
    expect(res.body.data.pagination).toEqual({ current: 1, pages: 1, total: 1 });
  });

  test('GET /sessions/:id — 대화와 그 대화에서 만든 내 작업', async () => {
    ConversationJob.findById.mockResolvedValue(chatDoc());
    ImageGenerationJob.find.mockReturnValue(chain([{ _id: hex('j'), status: 'completed' }]));
    const res = await request(app).get(`/api/chat/sessions/${CONV}`);
    expect(res.status).toBe(200);
    expect(ImageGenerationJob.find).toHaveBeenCalledWith({ conversationId: CONV, userId: ME });
    expect(res.body.data.session.messages).toHaveLength(3);
    expect(res.body.data.jobs).toEqual([{ _id: hex('j'), status: 'completed' }]);
  });

  test.each([
    ['남의 대화', () => chatDoc({ userId: hex('o') })],
    ['채팅이 아닌 대화', () => chatDoc({ kind: 'prompt' })],
    ['없는 대화', () => null],
  ])('%s 는 404 — 상세·제목·삭제 모두', async (_, make) => {
    ConversationJob.findById.mockImplementation(async () => make());
    expect((await request(app).get(`/api/chat/sessions/${CONV}`)).status).toBe(404);
    expect((await request(app).patch(`/api/chat/sessions/${CONV}`).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/chat/sessions/${CONV}`)).status).toBe(404);
    expect(ConversationJob.updateOne).not.toHaveBeenCalled();
    expect(ImageGenerationJob.updateMany).not.toHaveBeenCalled();
  });

  test('형식이 틀린 id 는 DB 를 묻지 않고 404', async () => {
    expect((await request(app).get('/api/chat/sessions/all')).status).toBe(404);
    expect(ConversationJob.findById).not.toHaveBeenCalled();
  });

  test('PATCH — 제목만 바꾼다 (문서 전체를 저장하지 않는다)', async () => {
    const doc = chatDoc();
    ConversationJob.findById.mockResolvedValue(doc);
    const res = await request(app).patch(`/api/chat/sessions/${CONV}`).send({ title: '  새 제목  ' });
    expect(res.status).toBe(200);
    expect(ConversationJob.updateOne).toHaveBeenCalledWith({ _id: CONV }, { $set: { title: '새 제목' } }, { timestamps: false });
    expect(doc.save).not.toHaveBeenCalled();
    expect((await request(app).patch(`/api/chat/sessions/${CONV}`).send({ title: '   ' })).status).toBe(400);
    expect((await request(app).patch(`/api/chat/sessions/${CONV}`).send({ title: 'a'.repeat(201) })).status).toBe(400);
  });

  test('DELETE — 대화를 지우고 작업은 연결만 끊는다', async () => {
    const doc = chatDoc();
    ConversationJob.findById.mockResolvedValue(doc);
    const res = await request(app).delete(`/api/chat/sessions/${CONV}`);
    expect(res.status).toBe(200);
    expect(doc.deleteOne).toHaveBeenCalled();
    expect(ImageGenerationJob.updateMany).toHaveBeenCalledWith({ conversationId: CONV }, { $unset: { conversationId: 1 } });
  });

  test('DELETE — 응답을 받는 중이면 409', async () => {
    const doc = chatDoc({ status: 'processing', updatedAt: new Date() });
    ConversationJob.findById.mockResolvedValue(doc);
    expect((await request(app).delete(`/api/chat/sessions/${CONV}`)).status).toBe(409);
    expect(doc.deleteOne).not.toHaveBeenCalled();
  });
});

describe('POST /messages', () => {
  const send = (body) => request(app).post('/api/chat/messages').send(body);

  test('새 대화 — 채팅 대화로 만들고 SSE 로 session → 턴 이벤트', async () => {
    ConversationJob.create.mockImplementation(async (doc) => ({ _id: CONV, ...doc }));
    const res = await send({ workboardId: WB, text: '  고양이 그려 줘  ' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const created = ConversationJob.create.mock.calls[0][0];
    expect(created).toMatchObject({ userId: ME, workboardId: WB, kind: 'chat', title: '고양이 그려 줘', model: 'board-model', serverType: 'OpenAI Compatible', status: 'processing' });
    expect(created.messages.map((m) => [m.role, m.content])).toEqual([['system', CHAT_SYSTEM_PROMPT], ['user', '고양이 그려 줘']]);
    expect(sseEvents(res.text)).toEqual([
      ['session', { sessionId: CONV, title: '고양이 그려 줘' }],
      ['token', { delta: '네' }],
      ['done', { content: '네' }],
    ]);
    expect(runChatTurn.mock.calls[0][0]).toMatchObject({ user: mockCurrentUser });
  });

  test('이어가기 — 턴 잡기와 메시지 붙이기를 한 번의 갱신으로. 판은 대화에 저장된 것', async () => {
    const doc = chatDoc({ status: 'failed', error: { message: 'x' } });
    const claimed = chatDoc({ status: 'processing' });
    ConversationJob.findById.mockResolvedValue(doc);
    ConversationJob.findOneAndUpdate.mockResolvedValue(claimed);
    const res = await send({ sessionId: CONV, workboardId: hex('z'), text: '하나 더' });
    expect(res.status).toBe(200);
    expect(Workboard.findById).toHaveBeenCalledWith(WB);
    const [filter, update, options] = ConversationJob.findOneAndUpdate.mock.calls[0];
    expect(filter._id).toBe(CONV);
    expect(filter.$or[0]).toEqual({ status: { $ne: 'processing' } });
    expect(filter.$or[1].updatedAt.$lt).toBeInstanceOf(Date);
    expect(update.$push.messages).toMatchObject({ role: 'user', content: '하나 더', attachments: [] });
    expect(update.$set).toEqual({ status: 'processing' });
    expect(update.$unset).toEqual({ error: 1 });
    expect(options).toEqual({ new: true });
    expect(doc.save).not.toHaveBeenCalled();
    expect(runChatTurn.mock.calls[0][0].conversation).toBe(claimed); // 갱신된 문서로 턴을 돌린다
    expect(ConversationJob.create).not.toHaveBeenCalled();
  });

  test('동시에 온 요청이 턴을 먼저 잡았으면 409 (검사는 통과했어도 갱신이 못 잡는다)', async () => {
    ConversationJob.findById.mockResolvedValue(chatDoc());
    ConversationJob.findOneAndUpdate.mockResolvedValue(null);
    const res = await send({ sessionId: CONV, text: '하나 더' });
    expect(res.status).toBe(409);
    expect(runChatTurn).not.toHaveBeenCalled();
  });

  test('이미지 첨부 — 올린 것·만든 것 모두 내 것만, 받은 순서대로 id 와 주소를 남긴다', async () => {
    const GEN = hex('k');
    UploadedImage.find.mockReturnValue(chain([{ _id: IMG, url: '/uploads/a.png' }]));
    GeneratedImage.find.mockReturnValue(chain([{ _id: GEN, url: '/uploads/generated/b.png' }]));
    ConversationJob.create.mockImplementation(async (doc) => ({ _id: CONV, ...doc }));
    const res = await send({ workboardId: WB, text: '이걸 영상으로', imageIds: [GEN, IMG] });
    expect(res.status).toBe(200);
    expect(UploadedImage.find).toHaveBeenCalledWith({ _id: { $in: [GEN, IMG] }, userId: ME });
    expect(GeneratedImage.find).toHaveBeenCalledWith({ _id: { $in: [GEN, IMG] }, userId: ME });
    expect(ConversationJob.create.mock.calls[0][0].messages[1].attachments).toEqual([
      { imageId: GEN, url: '/uploads/generated/b.png' }, { imageId: IMG, url: '/uploads/a.png' },
    ]);
  });

  test('내 것이 아닌 이미지가 섞이면 400 — 조용히 빼지 않는다', async () => {
    UploadedImage.find.mockReturnValue(chain([{ _id: IMG, url: '/uploads/a.png' }]));
    const res = await send({ workboardId: WB, text: '이걸 영상으로', imageIds: [IMG, hex('q')] });
    expect(res.status).toBe(400);
    expect(ConversationJob.create).not.toHaveBeenCalled();
    expect(runChatTurn).not.toHaveBeenCalled();
  });

  test.each([
    ['빈 메시지', { workboardId: WB, text: '   ' }],
    ['너무 긴 메시지', { workboardId: WB, text: 'a'.repeat(20001) }],
    ['새 대화인데 판이 없음', { text: 'hi' }],
    ['이미지 5장', { workboardId: WB, text: 'hi', imageIds: [IMG, IMG, IMG, IMG, IMG] }],
    ['형식이 틀린 이미지 id', { workboardId: WB, text: 'hi', imageIds: ['img-1'] }],
  ])('%s → 400, 턴을 돌리지 않는다', async (_, body) => {
    const res = await send(body);
    expect(res.status).toBe(400);
    expect(runChatTurn).not.toHaveBeenCalled();
    expect(ConversationJob.create).not.toHaveBeenCalled();
  });

  test('같은 대화에 턴이 돌고 있으면 409 — 메시지를 붙이지 않는다', async () => {
    const doc = chatDoc({ status: 'processing', updatedAt: new Date() });
    ConversationJob.findById.mockResolvedValue(doc);
    const res = await send({ sessionId: CONV, text: '하나 더' });
    expect(res.status).toBe(409);
    expect(ConversationJob.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('오래 processing 에 머문 대화(죽은 턴)는 다시 받는다', async () => {
    const doc = chatDoc({ status: 'processing', updatedAt: new Date(Date.now() - 11 * 60 * 1000) });
    ConversationJob.findById.mockResolvedValue(doc);
    ConversationJob.findOneAndUpdate.mockResolvedValue(chatDoc({ status: 'processing' }));
    expect((await send({ sessionId: CONV, text: '하나 더' })).status).toBe(200);
  });

  test('남의 대화·채팅이 아닌 대화로는 못 잇는다 (404)', async () => {
    ConversationJob.findById.mockResolvedValue(chatDoc({ userId: hex('o') }));
    expect((await send({ sessionId: CONV, text: 'hi' })).status).toBe(404);
    ConversationJob.findById.mockResolvedValue(chatDoc({ kind: undefined }));
    expect((await send({ sessionId: CONV, text: 'hi' })).status).toBe(404);
    expect(runChatTurn).not.toHaveBeenCalled();
  });

  test.each([
    ['권한 없는 판', () => textBoard({ allowedGroupIds: [hex('n')] }), 404],
    ['없는 판', () => null, 404],
    ['이미지 판', () => textBoard({ outputFormat: 'image' }), 400],
    ['Gemini 서버의 판', () => textBoard({ serverId: { isActive: true, serverType: 'Gemini' } }), 400],
    ['꺼진 판', () => textBoard({ isActive: false }), 400],
  ])('대화 상대로 못 쓰는 판: %s', async (_, make, status) => {
    Workboard.findById.mockImplementation(() => boardChain(make()));
    const res = await send({ workboardId: WB, text: 'hi' });
    expect(res.status).toBe(status);
    expect(ConversationJob.create).not.toHaveBeenCalled();
  });

  test('판에 기본 모델이 없으면 400', async () => {
    Workboard.findById.mockImplementation(() => boardChain(textBoard({ additionalInputFields: [] })));
    const res = await send({ workboardId: WB, text: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/기본 모델/);
  });

  test('턴이 던져도 스트림을 error 이벤트로 닫는다', async () => {
    ConversationJob.create.mockImplementation(async (doc) => ({ _id: CONV, ...doc }));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    runChatTurn.mockRejectedValue(new Error('unexpected'));
    const res = await send({ workboardId: WB, text: 'hi' });
    errSpy.mockRestore();
    expect(res.status).toBe(200);
    const events = sseEvents(res.text);
    expect(events[events.length - 1]).toEqual(['error', { message: 'unexpected' }]);
  });
});
