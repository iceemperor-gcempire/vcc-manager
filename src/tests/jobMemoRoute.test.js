/**
 * PATCH /api/jobs/:id/memo (#879) — 소유권·검증 회귀 테스트.
 * jobsRouteAuth.test.js 와 같은 방식으로 미들웨어/모델/큐를 mock 한다.
 */
const express = require('express');
const request = require('supertest');
const { JOB_MEMO_MAX_LENGTH } = require('../constants/jobMemo');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/queueService', () => ({
  addImageGenerationJob: jest.fn(), getQueueStats: jest.fn(), cancelQueueJob: jest.fn(), abortActiveJob: jest.fn(),
}));
jest.mock('../models/ImageGenerationJob', () => ({
  findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn(), updateOne: jest.fn(),
}));

const ImageGenerationJob = require('../models/ImageGenerationJob');

function chainable(result) {
  const chain = {};
  chain.populate = () => chain; chain.select = () => chain; chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', require('../routes/jobs'));
  return app;
}

describe('PATCH /api/jobs/:id/memo (#879)', () => {
  let app;
  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
    ImageGenerationJob.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  const ownJob = { _id: 'job-1', userId: 'user-1', memo: '' };
  const otherJob = { _id: 'job-2', userId: 'user-2', memo: '' };

  test('본인 작업 — 정규화해 저장하고 200', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(ownJob));
    const res = await request(app).patch('/api/jobs/job-1/memo').send({ memo: '  양갈래\n밀밭  ' });
    expect(res.status).toBe(200);
    expect(res.body.job.memo).toBe('양갈래 밀밭');
    expect(ImageGenerationJob.updateOne).toHaveBeenCalledWith({ _id: 'job-1' }, { $set: { memo: '양갈래 밀밭' } });
  });

  test('빈 문자열/누락은 메모 삭제로 처리', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(ownJob));
    const res = await request(app).patch('/api/jobs/job-1/memo').send({});
    expect(res.status).toBe(200);
    expect(res.body.job.memo).toBe('');
  });

  test('상한 초과는 400 이고 DB 를 건드리지 않는다', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(ownJob));
    const res = await request(app).patch('/api/jobs/job-1/memo').send({ memo: '가'.repeat(JOB_MEMO_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/이내/);
    expect(ImageGenerationJob.updateOne).not.toHaveBeenCalled();
  });

  test('타인 작업은 403', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(otherJob));
    const res = await request(app).patch('/api/jobs/job-2/memo').send({ memo: 'x' });
    expect(res.status).toBe(403);
    expect(ImageGenerationJob.updateOne).not.toHaveBeenCalled();
  });

  test('admin 은 타인 작업도 저장 가능', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    ImageGenerationJob.findById.mockReturnValue(chainable(otherJob));
    const res = await request(app).patch('/api/jobs/job-2/memo').send({ memo: '관리자 메모' });
    expect(res.status).toBe(200);
  });

  test('없는 작업은 404', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(null));
    const res = await request(app).patch('/api/jobs/nope/memo').send({ memo: 'x' });
    expect(res.status).toBe(404);
  });
});
