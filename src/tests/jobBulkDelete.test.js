/**
 * POST /api/jobs/bulk-delete (#902) — 건별 규칙 적용·건너뜀 사유·상한.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/queueService', () => ({ addImageGenerationJob: jest.fn(), getQueueStats: jest.fn(), cancelQueueJob: jest.fn(), abortActiveJob: jest.fn() }));
jest.mock('../models/ImageGenerationJob', () => ({ findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), updateOne: jest.fn() }));
jest.mock('../services/jobDeletionService', () => {
  const actual = jest.requireActual('../services/jobDeletionService');
  return { checkDeletable: actual.checkDeletable, deleteJobRecord: jest.fn().mockResolvedValue({ deletedImagesCount: 2, deletedVideosCount: 0, deletedAudiosCount: 0 }) };
});

const ImageGenerationJob = require('../models/ImageGenerationJob');
const { deleteJobRecord } = require('../services/jobDeletionService');

function chainable(result) {
  const chain = {}; chain.populate = () => chain; chain.select = () => chain; chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject); return chain;
}
function createApp() { const app = express(); app.use(express.json()); app.use('/api/jobs', require('../routes/jobs')); return app; }

// 24자 id 형식 — 형식이 틀린 id 는 이제 요청 전체가 400 이다 (#1323)
const ID = { own1: 'aaaaaaaaaaaaaaaaaaaaaaa1', own2: 'aaaaaaaaaaaaaaaaaaaaaaa2', busy1: 'bbbbbbbbbbbbbbbbbbbbbbb1', other1: 'ccccccccccccccccccccccc1', nope: 'ddddddddddddddddddddddd1' };
const JOBS = {
  [ID.own1]: { _id: ID.own1, userId: 'user-1', status: 'completed' },
  [ID.own2]: { _id: ID.own2, userId: 'user-1', status: 'failed' },
  [ID.busy1]: { _id: ID.busy1, userId: 'user-1', status: 'processing' },
  [ID.other1]: { _id: ID.other1, userId: 'user-2', status: 'completed' },
};

describe('POST /api/jobs/bulk-delete (#902)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    ImageGenerationJob.findById.mockImplementation((id) => chainable(JOBS[id] || null));
  });

  test('본인·완료 작업은 삭제, 처리중·타인·없는 것은 사유와 함께 건너뜀', async () => {
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.own1, ID.busy1, ID.other1, ID.nope, ID.own2], deleteContent: true });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
    expect(res.body.skipped).toBe(3);
    expect(res.body.deletedImagesCount).toBe(4);
    const byId = Object.fromEntries(res.body.results.map((r) => [r.id, r]));
    expect(byId[ID.busy1].reason).toMatch(/processing/);
    expect(byId[ID.other1].reason).toMatch(/Access denied/);
    expect(byId[ID.nope].reason).toMatch(/not found/);
    expect(deleteJobRecord).toHaveBeenCalledTimes(2);
    expect(deleteJobRecord).toHaveBeenCalledWith(JOBS[ID.own1], { deleteContent: true });
  });

  test('deleteContent 미지정은 콘텐츠 보존', async () => {
    await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.own1] });
    expect(deleteJobRecord).toHaveBeenCalledWith(JOBS[ID.own1], { deleteContent: false });
  });

  test('중복 id 는 한 번만', async () => {
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.own1, ID.own1] });
    expect(res.body.deleted).toBe(1);
    expect(deleteJobRecord).toHaveBeenCalledTimes(1);
  });

  test('빈 ids 400 · 200개 초과 400', async () => {
    expect((await request(app).post('/api/jobs/bulk-delete').send({ ids: [] })).status).toBe(400);
    expect((await request(app).post('/api/jobs/bulk-delete').send({ ids: Array.from({ length: 201 }, (_, i) => String(i).padStart(24, '0')) })).status).toBe(400);
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });

  test('admin 은 타인 작업도 삭제', async () => {
    mockCurrentUser = { _id: 'admin', isAdmin: true };
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.other1] });
    expect(res.body.deleted).toBe(1);
  });

  describe('형식이 틀린 요청은 400 이고 아무것도 지우지 않는다 (#1323)', () => {
    test.each([
      ['deleteContent 가 문자열 "false" (끄려던 값이 켜짐으로 읽히던 것)', { ids: [ID.own1], deleteContent: 'false' }],
      ['deleteContent 가 문자열 "true"', { ids: [ID.own1], deleteContent: 'true' }],
      ['deleteContent 가 숫자 1', { ids: [ID.own1], deleteContent: 1 }],
      ['deleteContent 가 숫자 0', { ids: [ID.own1], deleteContent: 0 }],
      ['deleteContent 가 null', { ids: [ID.own1], deleteContent: null }],
      ['deleteContent 가 객체', { ids: [ID.own1], deleteContent: {} }],
      ['deleteContent 가 배열', { ids: [ID.own1], deleteContent: [] }],
      ['ids 가 배열이 아니다', { ids: ID.own1 }],
      ['ids 가 없다', { deleteContent: true }],
      ['ids 에 형식이 틀린 id', { ids: [ID.own1, 'not-an-id'] }],
      ['ids 에 숫자', { ids: [ID.own1, 5] }],
      ['ids 에 객체', { ids: [ID.own1, { $ne: null }] }],
      ['ids 에 빈 문자열', { ids: [ID.own1, ''] }],
      ['본문이 비었다', {}],
    ])('%s', async (_n, body) => {
      const res = await request(app).post('/api/jobs/bulk-delete').send(body);
      expect(res.status).toBe(400);
      expect(ImageGenerationJob.findById).not.toHaveBeenCalled();
      expect(deleteJobRecord).not.toHaveBeenCalled();
    });

    test.each([[true, true], [false, false]])('deleteContent: %p 는 그대로 전해진다', async (given, passed) => {
      await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.own1], deleteContent: given });
      expect(deleteJobRecord).toHaveBeenCalledWith(JOBS[ID.own1], { deleteContent: passed });
    });

    test('deleteContent 를 쿼리로 보내면 400 — 본문에 없다고 꺼짐으로 읽고 지우지 않는다', async () => {
      const res = await request(app).post('/api/jobs/bulk-delete?deleteContent=false').send({ ids: [ID.own1] });
      expect(res.status).toBe(400);
      expect(deleteJobRecord).not.toHaveBeenCalled();
    });

    test('대문자 id 도 같은 작업이다', async () => {
      const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.own1.toUpperCase()] });
      expect(res.body.deleted).toBe(1);
    });
  });
});

describe('DELETE /api/jobs/:id — deleteContent 쿼리 값 (#1323)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    ImageGenerationJob.findById.mockImplementation((id) => chainable(JOBS[id] || null));
  });
  const del = (id, q) => request(app).delete(`/api/jobs/${id}${q || ''}`);

  test.each([
    ['값이 없다', '', false],
    ['false', '?deleteContent=false', false],
    ['true', '?deleteContent=true', true],
  ])('%s → 지우고, 콘텐츠 삭제 여부는 %p 대로', async (_n, q, _v) => {
    const res = await del(ID.own1, q);
    expect(res.status).toBe(200);
    expect(deleteJobRecord).toHaveBeenCalledWith(JOBS[ID.own1], { deleteContent: _v });
  });

  test.each([
    ['1', '?deleteContent=1'],
    ['TRUE', '?deleteContent=TRUE'],
    ['yes', '?deleteContent=yes'],
    ['빈 값', '?deleteContent='],
    ['같은 이름을 두 번', '?deleteContent=false&deleteContent=true'],
  ])('deleteContent=%s → 400 이고 지우지 않는다', async (_n, q) => {
    const res = await del(ID.own1, q);
    expect(res.status).toBe(400);
    expect(ImageGenerationJob.findById).not.toHaveBeenCalled();
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });

  test('deleteContent 를 본문으로 보내면 400 — 쿼리에 없다고 꺼짐으로 읽고 지우지 않는다', async () => {
    const res = await request(app).delete(`/api/jobs/${ID.own1}`).send({ deleteContent: false });
    expect(res.status).toBe(400);
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });

  test('남의 작업은 403, 처리 중인 작업은 400, 없는 작업은 404 — 지우지 않는다', async () => {
    expect((await del(ID.other1)).status).toBe(403);
    expect((await del(ID.busy1)).status).toBe(400);
    expect((await del(ID.nope)).status).toBe(404);
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });
});
