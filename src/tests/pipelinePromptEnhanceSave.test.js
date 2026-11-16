/**
 * 파이프라인 저장 — AI 프롬프트 늘려 쓰기 설정 검사 (#1212).
 *
 * 텍스트 판도 단계 판과 같은 접근 검사를 받고(#802), 판 종류가 맞지 않으면 저장하지 않는다.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;
const mockProject = { _id: 'p1', userId: 'u1' };

jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  return {
    requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
    userHasWorkboardAccess: actual.userHasWorkboardAccess,
  };
});
jest.mock('../middleware/projectAccess', () => ({
  loadProjectForRead: () => async () => mockProject,
  loadProjectForManage: () => async () => mockProject,
}));
jest.mock('../models/Pipeline', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Project', () => ({}));
jest.mock('../models/Workboard', () => ({ find: jest.fn() }));

const Pipeline = require('../models/Pipeline');
const Workboard = require('../models/Workboard');

const TEXT = 'a'.repeat(24);
const VIDEO = 'b'.repeat(24);
const IMAGE_AS_ENHANCER = 'c'.repeat(24);
const HIDDEN_TEXT = 'd'.repeat(24);

const BOARDS = [
  { _id: TEXT, name: '프롬프트 LLM', outputFormat: 'text', allowedGroupIds: ['g1'] },
  { _id: VIDEO, name: 'H3 I2V', outputFormat: 'video', allowedGroupIds: ['g1'] },
  { _id: IMAGE_AS_ENHANCER, name: '이미지 판', outputFormat: 'image', allowedGroupIds: ['g1'] },
  { _id: HIDDEN_TEXT, name: '남의 LLM', outputFormat: 'text', allowedGroupIds: ['other'] },
];

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/pipelines', require('../routes/pipelines'));
  return app;
}

const post = (app, steps) => request(app).post('/api/projects/p1/pipelines').send({ name: '늘려 쓰기', steps });

describe('파이프라인 저장 — promptEnhance (#1212)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'u1', groupIds: ['g1'] };
    Workboard.find.mockImplementation(({ _id: { $in: ids } }) => ({
      lean: async () => BOARDS.filter((b) => ids.map(String).includes(b._id)),
    }));
    Pipeline.create.mockImplementation(async (doc) => ({ _id: 'pl1', ...doc }));
  });

  test('켜고 텍스트 판을 고르면 정리된 모양으로 저장한다', async () => {
    const res = await post(app, [{
      workboardId: VIDEO,
      promptEnhance: { enabled: true, workboardId: { _id: TEXT, name: '프롬프트 LLM' }, inputs: { model: 'm1' } },
    }]);
    expect(res.status).toBe(201);
    expect(Pipeline.create.mock.calls[0][0].steps[0].promptEnhance).toEqual({
      enabled: true, workboardId: TEXT, inputs: { model: 'm1' }, includeImages: true,
    });
  });

  test('설정이 없는 단계는 promptEnhance 를 남기지 않는다', async () => {
    const res = await post(app, [{ workboardId: VIDEO }]);
    expect(res.status).toBe(201);
    expect(Pipeline.create.mock.calls[0][0].steps[0].promptEnhance).toBeUndefined();
  });

  test('꺼도 고른 판·입력은 남긴다', async () => {
    const res = await post(app, [{ workboardId: VIDEO, promptEnhance: { enabled: false, workboardId: TEXT, includeImages: false } }]);
    expect(res.status).toBe(201);
    expect(Pipeline.create.mock.calls[0][0].steps[0].promptEnhance).toEqual({
      enabled: false, workboardId: TEXT, inputs: {}, includeImages: false,
    });
  });

  test('켰는데 텍스트 판이 없으면 400', async () => {
    const res = await post(app, [{ workboardId: VIDEO, promptEnhance: { enabled: true } }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('텍스트 판을 고르세요');
    expect(Pipeline.create).not.toHaveBeenCalled();
  });

  test('텍스트 판이 아닌 판을 고르면 400', async () => {
    const res = await post(app, [{ workboardId: VIDEO, promptEnhance: { enabled: true, workboardId: IMAGE_AS_ENHANCER } }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('텍스트 판만');
  });

  test('텍스트 단계에는 켤 수 없다', async () => {
    const res = await post(app, [{ workboardId: TEXT, promptEnhance: { enabled: true, workboardId: TEXT } }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('텍스트 단계에는');
  });

  test('접근 권한이 없는 텍스트 판은 꺼져 있어도 400 (#802)', async () => {
    const res = await post(app, [{ workboardId: VIDEO, promptEnhance: { enabled: false, workboardId: HIDDEN_TEXT } }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('남의 LLM');
  });

  test('없는 텍스트 판은 400', async () => {
    const res = await post(app, [{ workboardId: VIDEO, promptEnhance: { enabled: true, workboardId: 'e'.repeat(24) } }]);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('찾을 수 없습니다');
  });
});
