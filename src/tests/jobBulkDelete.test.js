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

const JOBS = {
  'own-1': { _id: 'own-1', userId: 'user-1', status: 'completed' },
  'own-2': { _id: 'own-2', userId: 'user-1', status: 'failed' },
  'busy-1': { _id: 'busy-1', userId: 'user-1', status: 'processing' },
  'other-1': { _id: 'other-1', userId: 'user-2', status: 'completed' },
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
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: ['own-1', 'busy-1', 'other-1', 'nope', 'own-2'], deleteContent: true });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(2);
    expect(res.body.skipped).toBe(3);
    expect(res.body.deletedImagesCount).toBe(4);
    const byId = Object.fromEntries(res.body.results.map((r) => [r.id, r]));
    expect(byId['busy-1'].reason).toMatch(/processing/);
    expect(byId['other-1'].reason).toMatch(/Access denied/);
    expect(byId['nope'].reason).toMatch(/not found/);
    expect(deleteJobRecord).toHaveBeenCalledTimes(2);
    expect(deleteJobRecord).toHaveBeenCalledWith(JOBS['own-1'], { deleteContent: true });
  });

  test('deleteContent 미지정은 콘텐츠 보존', async () => {
    await request(app).post('/api/jobs/bulk-delete').send({ ids: ['own-1'] });
    expect(deleteJobRecord).toHaveBeenCalledWith(JOBS['own-1'], { deleteContent: false });
  });

  test('중복 id 는 한 번만', async () => {
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: ['own-1', 'own-1'] });
    expect(res.body.deleted).toBe(1);
    expect(deleteJobRecord).toHaveBeenCalledTimes(1);
  });

  test('빈 ids 400 · 200개 초과 400', async () => {
    expect((await request(app).post('/api/jobs/bulk-delete').send({ ids: [] })).status).toBe(400);
    expect((await request(app).post('/api/jobs/bulk-delete').send({ ids: Array.from({ length: 201 }, (_, i) => `j${i}`) })).status).toBe(400);
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });

  test('admin 은 타인 작업도 삭제', async () => {
    mockCurrentUser = { _id: 'admin', isAdmin: true };
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: ['other-1'] });
    expect(res.body.deleted).toBe(1);
  });
});
