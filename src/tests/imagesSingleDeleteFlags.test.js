/**
 * 생성물 개별 삭제의 deleteJob 쿼리 값 (#1323).
 *
 * `deleteJob=true` 면 그 콘텐츠를 만든 작업 기록도 함께 지운다 (의도된 동작).
 * 값이 true · false 가 아니면 꺼짐으로 읽고 지나가지 않고 거절한다 — 아무것도 지우지 않는다.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();
const me = oid();
const mockMe = () => me;
let mockAdmin = false;
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { _id: mockMe(), isAdmin: mockAdmin }; next(); },
}));
function mockMediaModel() {
  return { findById: jest.fn(), findByIdAndDelete: jest.fn(async () => ({})), find: jest.fn(), countDocuments: jest.fn(), deleteMany: jest.fn() };
}
jest.mock('../models/GeneratedImage', () => mockMediaModel());
jest.mock('../models/GeneratedVideo', () => mockMediaModel());
jest.mock('../models/GeneratedAudio', () => mockMediaModel());
jest.mock('../models/UploadedImage', () => mockMediaModel());
jest.mock('../models/UploadedVideo', () => mockMediaModel());
jest.mock('../models/UploadedAudio', () => mockMediaModel());
jest.mock('../models/Tag', () => ({ find: jest.fn(), updateMany: jest.fn(async () => ({})), updateOne: jest.fn(async () => ({})) }));
jest.mock('../models/ImageGenerationJob', () => ({ find: jest.fn(), findByIdAndDelete: jest.fn(async () => ({})), deleteMany: jest.fn() }));
jest.mock('../utils/fileUpload', () => ({
  upload: { single: () => (req, res, next) => next() },
  processAndSaveImage: jest.fn(), deleteFile: jest.fn(async () => {}), validateImageDimensions: jest.fn(),
}));

const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const GeneratedAudio = require('../models/GeneratedAudio');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const Tag = require('../models/Tag');
const { deleteFile } = require('../utils/fileUpload');

const ROUTES = [
  ['생성 이미지', '/api/images/generated', () => GeneratedImage],
  ['영상', '/api/images/videos', () => GeneratedVideo],
  ['생성 음악', '/api/images/audios', () => GeneratedAudio],
];

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/images', require('../routes/images'));
});
beforeEach(() => { jest.clearAllMocks(); mockAdmin = false; });

describe.each(ROUTES)('DELETE %s/:id — deleteJob (#1323)', (_n, path, model) => {
  const jobId = oid();
  const doc = (over = {}) => ({ _id: oid(), userId: me, path: '/x.bin', tags: [], jobId, ...over });
  const seed = (d) => model().findById.mockResolvedValue(d);
  const del = (id, q = '') => request(app).delete(`${path}/${id}${q}`);
  const expectNothingDeleted = () => {
    expect(model().findByIdAndDelete).not.toHaveBeenCalled();
    expect(ImageGenerationJob.findByIdAndDelete).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
    expect(Tag.updateMany).not.toHaveBeenCalled();
  };

  test.each([
    ['값이 없다', ''],
    ['false', '?deleteJob=false'],
  ])('%s → 콘텐츠만 지우고 작업 기록은 남긴다', async (_c, q) => {
    const d = doc(); seed(d);
    const res = await del(d._id, q);
    expect(res.status).toBe(200);
    expect(model().findByIdAndDelete).toHaveBeenCalledWith(String(d._id));
    expect(deleteFile.mock.calls).toEqual([['/x.bin']]);
    expect(ImageGenerationJob.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test('true → 콘텐츠와 그 작업 기록을 지운다', async () => {
    const d = doc(); seed(d);
    const res = await del(d._id, '?deleteJob=true');
    expect(res.status).toBe(200);
    expect(ImageGenerationJob.findByIdAndDelete.mock.calls).toEqual([[jobId]]);
    expect(model().findByIdAndDelete).toHaveBeenCalledWith(String(d._id));
  });

  test('true 여도 작업 기록이 없는 콘텐츠는 콘텐츠만 지운다', async () => {
    const d = doc({ jobId: undefined }); seed(d);
    expect((await del(d._id, '?deleteJob=true')).status).toBe(200);
    expect(ImageGenerationJob.findByIdAndDelete).not.toHaveBeenCalled();
  });

  test.each([
    ['1', '?deleteJob=1'],
    ['TRUE', '?deleteJob=TRUE'],
    ['yes', '?deleteJob=yes'],
    ['빈 값', '?deleteJob='],
    ['같은 이름을 두 번', '?deleteJob=false&deleteJob=true'],
  ])('deleteJob=%s → 400 이고 찾지도 지우지도 않는다', async (_c, q) => {
    const d = doc(); seed(d);
    const res = await del(d._id, q);
    expect(res.status).toBe(400);
    expect(model().findById).not.toHaveBeenCalled();
    expectNothingDeleted();
  });

  test('남의 것은 403 이고 아무것도 지우지 않는다 — deleteJob=true 여도', async () => {
    const d = doc({ userId: oid() }); seed(d);
    expect((await del(d._id, '?deleteJob=true')).status).toBe(403);
    expectNothingDeleted();
  });

  test('없는 것은 404 이고 아무것도 지우지 않는다', async () => {
    seed(null);
    expect((await del(oid(), '?deleteJob=true')).status).toBe(404);
    expectNothingDeleted();
  });

  test('태그 사용 횟수는 지운 콘텐츠에 붙어 있던 태그만 줄인다', async () => {
    const t1 = oid();
    const d = doc({ tags: [t1] }); seed(d);
    await del(d._id);
    expect(Tag.updateMany.mock.calls).toEqual([[{ _id: { $in: [t1] } }, { $inc: { usageCount: -1 } }]]);
  });
});
