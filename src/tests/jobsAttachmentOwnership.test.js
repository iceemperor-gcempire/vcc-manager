/**
 * 작업 생성·재시도의 첨부 참조 검증 (#959).
 *
 * 첨부 필드와 참조 이미지가 모두 같은 검증을 거치는지, 첨부 메타데이터를 읽는 사전 검사보다
 * 먼저인지, 재시도로 우회되지 않는지를 라우트 단위로 고정한다.
 */
const express = require('express');
const request = require('supertest');

let mockCurrentUser;

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = mockCurrentUser; next(); },
  userHasWorkboardAccess: () => true,
  userHasProjectAccess: () => true,
}));
jest.mock('../services/queueService', () => ({
  addImageGenerationJob: jest.fn(async () => ({ _id: 'job-new', status: 'pending', progress: 0, createdAt: new Date() })),
  getQueueStats: jest.fn(),
  cancelQueueJob: jest.fn(),
  abortActiveJob: jest.fn(),
}));
jest.mock('../models/Workboard', () => ({ findById: jest.fn() }));
jest.mock('../models/ImageGenerationJob', () => ({ findById: jest.fn(), find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../models/UploadedImage', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../services/videoAudioGuard', () => ({ findSilentVideoViolation: jest.fn(async () => null) }));
jest.mock('../services/imageOrientationGuard', () => ({ findOrientationViolation: jest.fn(async () => null) }));
jest.mock('../models/mediaModels', () => {
  const owners = {
    ['a'.repeat(24)]: 'user-1', // 내 업로드
    ['c'.repeat(24)]: 'user-2', // 남의 업로드
  };
  const model = {
    findById: (id) => ({ select: () => ({ lean: async () => (owners[id] ? { _id: id, userId: owners[id] } : null) }) }),
  };
  const empty = { findById: () => ({ select: () => ({ lean: async () => null }) }) };
  return {
    UPLOADED_MEDIA_MODELS_BY_TYPE: { image: model, video: model, audio: model },
    GENERATED_MEDIA_MODELS_BY_TYPE: { image: empty, video: empty, audio: empty },
  };
});

const Workboard = require('../models/Workboard');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { addImageGenerationJob } = require('../services/queueService');
const { findSilentVideoViolation } = require('../services/videoAudioGuard');

const MINE = 'a'.repeat(24);
const OTHERS = 'c'.repeat(24);

const wb = {
  _id: 'wb-1',
  isActive: true,
  additionalInputFields: [{ name: 'start_image', label: '시작 이미지', type: 'image' }],
};
const wbQuery = (doc) => ({ lean: async () => doc, then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject) });

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
  mockCurrentUser = { _id: 'user-1', isAdmin: false };
  Workboard.findById.mockImplementation(() => wbQuery(wb));
});
afterEach(() => logSpy.mockRestore());

const generate = (body) => request(app).post('/api/jobs/generate').send({ workboardId: 'wb-1', prompt: '고양이', ...body });

describe('POST /api/jobs/generate — 첨부 참조 (#959)', () => {
  test('남의 첨부 → 400, 작업을 만들지 않고 첨부 메타데이터 검사도 하지 않는다', async () => {
    const res = await generate({ additionalParams: { start_image: [{ imageId: OTHERS }] } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('시작 이미지');
    expect(addImageGenerationJob).not.toHaveBeenCalled();
    expect(findSilentVideoViolation).not.toHaveBeenCalled();
  });

  test('없는 id 도 같은 메시지 — 존재 여부를 흘리지 않는다', async () => {
    const foreign = await generate({ additionalParams: { start_image: [OTHERS] } });
    const missing = await generate({ additionalParams: { start_image: ['d'.repeat(24)] } });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe(foreign.body.message);
  });

  test('참조 이미지도 같은 검증을 거친다', async () => {
    const res = await generate({ referenceImages: [{ imageId: OTHERS }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('참조 이미지');
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('내 첨부 → 작업 생성', async () => {
    const res = await generate({ additionalParams: { start_image: [{ imageId: MINE }] } });
    expect(res.status).toBe(201);
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
  });

  test('admin 은 검증하지 않는다', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    const res = await generate({ additionalParams: { start_image: [OTHERS] } });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/jobs/:id/retry — 첨부 참조 (#959)', () => {
  const failedJob = (inputData) => ({
    _id: 'job-1',
    userId: 'user-1',
    workboardId: 'wb-1',
    status: 'failed',
    inputData,
    canRetry: () => true,
    incrementRetry: jest.fn(async () => {}),
  });

  test('저장된 입력에 남의 첨부가 있으면 재시도로도 통과하지 않는다', async () => {
    const job = failedJob({ prompt: 'x', additionalParams: { start_image: [OTHERS] } });
    ImageGenerationJob.findById.mockResolvedValue(job);
    const res = await request(app).post('/api/jobs/job-1/retry');
    expect(res.status).toBe(400);
    expect(job.incrementRetry).not.toHaveBeenCalled();
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('작업 주인의 첨부면 재시도 — admin 이 남의 작업을 재시도해도 주인 기준', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    const job = failedJob({ prompt: 'x', additionalParams: { start_image: [MINE] } });
    ImageGenerationJob.findById.mockResolvedValue(job);
    const res = await request(app).post('/api/jobs/job-1/retry');
    expect(res.status).toBe(200);
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
  });
});
