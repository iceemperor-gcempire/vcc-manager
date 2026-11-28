/**
 * 작업 삭제 라우트와 대기열 (#1325).
 * 대기 중인 작업은 지우기 전에 대기열에서 빼고, 워커가 이미 가져간 작업은 지우지 않는다.
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
  return {
    checkDeletable: actual.checkDeletable,
    dequeueIfPending: jest.fn().mockResolvedValue({ ok: true }),
    deleteJobRecord: jest.fn().mockResolvedValue({ deletedImagesCount: 0, deletedVideosCount: 0, deletedAudiosCount: 0 }),
  };
});

const ImageGenerationJob = require('../models/ImageGenerationJob');
const { deleteJobRecord, dequeueIfPending } = require('../services/jobDeletionService');

function chainable(result) {
  const chain = {}; chain.populate = () => chain; chain.select = () => chain; chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject); return chain;
}

const ID = { pending1: 'a'.repeat(23) + '1', pending2: 'a'.repeat(23) + '2', busy: 'b'.repeat(23) + '1', other: 'c'.repeat(23) + '1', nope: 'd'.repeat(23) + '1' };
const JOBS = {
  [ID.pending1]: { _id: ID.pending1, userId: 'user-1', status: 'pending', queueJobId: '11' },
  [ID.pending2]: { _id: ID.pending2, userId: 'user-1', status: 'pending', queueJobId: '12' },
  [ID.busy]: { _id: ID.busy, userId: 'user-1', status: 'processing', queueJobId: '13' },
  [ID.other]: { _id: ID.other, userId: 'user-2', status: 'pending', queueJobId: '14' },
};
const BUSY = { ok: false, status: 400, reason: 'Cannot delete job that is currently processing' };

let app;
beforeAll(() => { app = express(); app.use(express.json()); app.use('/api/jobs', require('../routes/jobs')); });
beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentUser = { _id: 'user-1', isAdmin: false };
  ImageGenerationJob.findById.mockImplementation((id) => chainable(JOBS[id] || null));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => console.log.mockRestore());

describe('DELETE /api/jobs/:id', () => {
  test('대기 중인 작업은 대기열에서 뺀 뒤에 기록을 지운다', async () => {
    const order = [];
    dequeueIfPending.mockImplementationOnce(async () => { order.push('queue'); return { ok: true }; });
    deleteJobRecord.mockImplementationOnce(async () => { order.push('record'); return { deletedImagesCount: 0, deletedVideosCount: 0, deletedAudiosCount: 0 }; });
    const res = await request(app).delete(`/api/jobs/${ID.pending1}`);
    expect(res.status).toBe(200);
    expect(dequeueIfPending).toHaveBeenCalledWith(JOBS[ID.pending1]);
    expect(order).toEqual(['queue', 'record']);
  });

  test('워커가 이미 가져갔으면 400 이고 기록을 지우지 않는다', async () => {
    dequeueIfPending.mockResolvedValueOnce(BUSY);
    const res = await request(app).delete(`/api/jobs/${ID.pending1}`);
    expect(res.status).toBe(400);
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });

  test.each([
    ['남의 작업', ID.other, 403],
    ['처리 중인 작업', ID.busy, 400],
    ['없는 작업', ID.nope, 404],
  ])('%s 은 대기열을 건드리지 않는다', async (_n, id, status) => {
    const res = await request(app).delete(`/api/jobs/${id}`);
    expect(res.status).toBe(status);
    expect(dequeueIfPending).not.toHaveBeenCalled();
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });
});

describe('POST /api/jobs/bulk-delete', () => {
  test('워커가 이미 가져간 작업만 건너뛰고 나머지는 지운다', async () => {
    dequeueIfPending.mockResolvedValueOnce(BUSY);
    const res = await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.pending1, ID.pending2] });
    expect(res.body).toMatchObject({ deleted: 1, skipped: 1 });
    expect(res.body.results.find((r) => r.id === ID.pending1)).toMatchObject({ status: 'skipped', reason: BUSY.reason });
    expect(deleteJobRecord.mock.calls.map(([j]) => j._id)).toEqual([ID.pending2]);
  });

  test('권한 · 상태 확인을 통과하지 못한 작업은 대기열에서 빼지 않는다', async () => {
    await request(app).post('/api/jobs/bulk-delete').send({ ids: [ID.other, ID.busy, ID.nope] });
    expect(dequeueIfPending).not.toHaveBeenCalled();
    expect(deleteJobRecord).not.toHaveBeenCalled();
  });
});
