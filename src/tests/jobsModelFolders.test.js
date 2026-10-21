/**
 * 판의 모델 폴더 밖 베이스 모델은 실행·재시도에서 막는다 (#1086).
 *
 * API·MCP 는 모델 선택 목록을 거치지 않는다. 막을 때는 작업을 만들지 않고, 메시지에 허용 폴더를 적는다.
 * 하네스는 jobsAttachmentOwnership.test.js 와 같다.
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

const wb = {
  _id: 'wb-1',
  isActive: true,
  outputFormat: 'image',
  allowedModelFolders: ['qwen/'],
  additionalInputFields: [{ name: 'base_model', label: '베이스 모델', type: 'baseModel', required: true }],
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

describe('POST /api/jobs/generate — 모델 폴더 (#1086)', () => {
  test('폴더 밖 모델 → 400, 허용 폴더를 알려 주고 작업을 만들지 않는다', async () => {
    const res = await generate({ additionalParams: { base_model: 'Z-Image\\pornmasterZImage_turboV01.safetensors' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('qwen/');
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('폴더 안 모델 → 작업을 만든다 (Windows 경로)', async () => {
    const res = await generate({ additionalParams: { base_model: 'qwen\\qwen_image_2.1_int8_convrot.safetensors' } });
    expect(res.status).toBe(201);
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
  });

  test('폴더 제한이 없는 판은 예전과 같다', async () => {
    Workboard.findById.mockImplementation(() => wbQuery({ ...wb, allowedModelFolders: [] }));
    const res = await generate({ additionalParams: { base_model: 'Z-Image\\z.safetensors' } });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/jobs/:id/retry — 모델 폴더 (#1086)', () => {
  const failedJob = (inputData) => ({
    _id: 'job-1',
    userId: 'user-1',
    workboardId: 'wb-1',
    status: 'failed',
    inputData,
    canRetry: () => true,
    incrementRetry: jest.fn(async () => {}),
  });

  test('나중에 생긴 폴더 제한 밖의 예전 작업은 재시도로도 통과하지 않는다', async () => {
    const job = failedJob({ prompt: 'x', aiModel: 'Z-Image\\z.safetensors', additionalParams: { base_model: 'Z-Image\\z.safetensors' } });
    ImageGenerationJob.findById.mockResolvedValue(job);
    const res = await request(app).post('/api/jobs/job-1/retry');
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('qwen/');
    expect(job.incrementRetry).not.toHaveBeenCalled();
    expect(addImageGenerationJob).not.toHaveBeenCalled();
  });

  test('폴더 안이면 재시도한다', async () => {
    const job = failedJob({ prompt: 'x', additionalParams: { base_model: 'qwen\\ok.safetensors' } });
    ImageGenerationJob.findById.mockResolvedValue(job);
    const res = await request(app).post('/api/jobs/job-1/retry');
    expect(res.status).toBe(200);
    expect(addImageGenerationJob).toHaveBeenCalledTimes(1);
  });
});
