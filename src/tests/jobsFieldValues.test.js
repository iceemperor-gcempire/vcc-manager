/**
 * 선택지 밖 값 · 범위 밖 숫자는 실행·재시도에서 막는다 (#1163).
 *
 * API·MCP 는 화면의 선택 칸을 거치지 않는다. 막을 때는 작업을 만들지 않는다.
 * 하네스는 jobsModelFolders.test.js 와 같다.
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
  const empty = { findById: () => ({ select: () => ({ lean: async () => null }) }) };
  return {
    UPLOADED_MEDIA_MODELS_BY_TYPE: { image: empty, video: empty, audio: empty },
    GENERATED_MEDIA_MODELS_BY_TYPE: { image: empty, video: empty, audio: empty },
  };
});

const Workboard = require('../models/Workboard');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { addImageGenerationJob } = require('../services/queueService');

// 길이를 한 가지로 줄인 영상 판 (#1303 과 같은 모양)
const wb = {
  _id: 'wb-1',
  isActive: true,
  outputFormat: 'video',
  additionalInputFields: [
    { name: 'base_model', label: '베이스 모델', type: 'baseModel', required: true },
    { name: 'length', label: '길이', type: 'select', defaultValue: '124', options: [{ key: '5초 (124프레임)', value: '124' }] },
    { name: 'image_size', label: '크기', type: 'select', defaultValue: '1344x768', options: [{ key: '16:9', value: '1344x768' }] },
    { name: 'cfg', label: 'CFG', type: 'number', defaultValue: 1, validation: { min: 1, max: 5 } },
  ],
};
const wbQuery = (doc) => ({ lean: async () => doc, then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject) });

let app;
let logSpy;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/jobs', require('../routes/jobs'));
});
beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockCurrentUser = { _id: 'user-1', isAdmin: false };
  Workboard.findById.mockImplementation(() => wbQuery(wb));
});
afterEach(() => logSpy.mockRestore());

const generate = (body) => request(app).post('/api/jobs/generate').send({ workboardId: 'wb-1', prompt: '고양이', ...body });
const model = { base_model: 'video/model.safetensors' };

describe('POST /api/jobs/generate — 칸 값 (#1163)', () => {
  test('선택지 밖 길이 → 400, 작업을 만들지 않는다', async () => {
    const res = await generate({ additionalParams: { ...model, length: '362' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('지원하지 않는 값입니다: 길이 = 362');
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('선택지 안의 값 → 작업을 만든다 (숫자로 보내도)', async () => {
    const res = await generate({ additionalParams: { ...model, length: 124, cfg: '2.5' } });
    expect(res.status).toBe(201);
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
  });

  test('칸을 안 보내면 판 기본값으로 돈다', async () => {
    const res = await generate({ additionalParams: model });
    expect(res.status).toBe(201);
  });

  test('범위 밖 숫자 → 400', async () => {
    const res = await generate({ additionalParams: { ...model, cfg: 9 } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('CFG = 9');
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('top-level imageSize 가 선택지 밖 → 400', async () => {
    const res = await generate({ additionalParams: model, imageSize: '4096x4096' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('크기 = 4096x4096');
  });

  test('관리자도 같은 규칙이다', async () => {
    mockCurrentUser = { _id: 'admin-1', isAdmin: true };
    const res = await generate({ additionalParams: { ...model, length: '362' } });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/jobs/:id/retry — 칸 값 (#1163)', () => {
  const failedJob = (inputData) => ({
    _id: 'job-1',
    userId: 'user-1',
    workboardId: 'wb-1',
    status: 'failed',
    inputData,
    canRetry: () => true,
    incrementRetry: jest.fn(async () => {}),
  });

  test('선택지가 줄기 전의 값으로 만든 작업은 재시도로도 통과하지 않는다', async () => {
    const job = failedJob({ prompt: 'x', additionalParams: { ...model, length: { key: '15초 (362프레임)', value: '362' } } });
    ImageGenerationJob.findById.mockResolvedValue(job);
    const res = await request(app).post('/api/jobs/job-1/retry');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('지원하지 않는 값입니다: 길이 = 362');
    expect(job.incrementRetry).not.toHaveBeenCalled();
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('선택지 안이면 재시도한다', async () => {
    const job = failedJob({ prompt: 'x', additionalParams: { ...model, length: '124' } });
    ImageGenerationJob.findById.mockResolvedValue(job);
    const res = await request(app).post('/api/jobs/job-1/retry');
    expect(res.status).toBe(200);
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
  });
});
