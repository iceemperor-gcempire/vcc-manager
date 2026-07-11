/**
 * jobs 라우트 인가(소유권) 회귀 테스트 (#691)
 *
 * 미들웨어/모델/큐 서비스를 mock 해 라우트 레벨의 소유권 검사
 * (본인 또는 admin 만 조회/삭제) 와 등록 순서(/my 가 /:id 에 안 가림)를 검증한다.
 */

const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  },
  userHasWorkboardAccess: jest.fn().mockResolvedValue(true),
}));

// queueService 는 bull/redis 를 물고 있어 모듈째 mock
jest.mock('../services/queueService', () => ({
  addImageGenerationJob: jest.fn(),
  getQueueStats: jest.fn(),
  cancelQueueJob: jest.fn(),
  abortActiveJob: jest.fn(),
}));

jest.mock('../models/ImageGenerationJob', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

const ImageGenerationJob = require('../models/ImageGenerationJob');

// findById().populate()...(체이닝) 뒤 await 되는 mongoose query 흉내
function chainable(result) {
  const chain = {};
  chain.populate = () => chain;
  chain.select = () => chain;
  chain.sort = () => chain;
  chain.skip = () => chain;
  chain.limit = () => chain;
  chain.lean = () => chain;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/jobs', require('../routes/jobs'));
  return app;
}

describe('jobs 라우트 소유권 검사 (#691)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'user-1', isAdmin: false };
  });

  const ownJob = { _id: 'job-1', userId: 'user-1', status: 'completed' };
  const otherJob = { _id: 'job-2', userId: 'user-2', status: 'completed' };

  test('GET /:id — 본인 작업은 200', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(ownJob));

    const res = await request(app).get('/api/jobs/job-1');
    expect(res.status).toBe(200);
    expect(res.body.job._id).toBe('job-1');
  });

  test('GET /:id — 타인 작업은 403', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(otherJob));

    const res = await request(app).get('/api/jobs/job-2');
    expect(res.status).toBe(403);
  });

  test('GET /:id — admin 은 타인 작업도 200', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    ImageGenerationJob.findById.mockReturnValue(chainable(otherJob));

    const res = await request(app).get('/api/jobs/job-2');
    expect(res.status).toBe(200);
  });

  test('GET /:id — 없는 작업은 404', async () => {
    ImageGenerationJob.findById.mockReturnValue(chainable(null));

    const res = await request(app).get('/api/jobs/nope');
    expect(res.status).toBe(404);
  });

  test('GET /my — /:id 에 가리지 않고 본인 필터 목록으로 동작 (등록 순서 회귀 방지)', async () => {
    ImageGenerationJob.find.mockReturnValue(chainable([]));
    ImageGenerationJob.countDocuments.mockResolvedValue(0);

    const res = await request(app).get('/api/jobs/my');

    expect(res.status).toBe(200);
    // /:id 로 샜다면 findById('my') 가 호출된다
    expect(ImageGenerationJob.findById).not.toHaveBeenCalled();
    expect(ImageGenerationJob.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' })
    );
  });
});
