/**
 * 검색 결과 일괄 삭제의 대상 범위 (#1314).
 *
 * 삭제는 목록과 같은 조건으로만 지워야 한다. 조건이 형식에 안 맞으면 "조건 없음"으로 읽지 않고 거절한다.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const userId = new mongoose.Types.ObjectId();

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { _id: mockUserId(), isAdmin: false }; next(); },
}));
const mockUserId = () => userId;

const chain = (docs) => ({ select: () => ({ lean: async () => docs }) });
jest.mock('../models/UploadedImage', () => mockMediaModel());
jest.mock('../models/GeneratedImage', () => mockMediaModel());
jest.mock('../models/GeneratedVideo', () => mockMediaModel());
jest.mock('../models/Tag', () => ({ find: jest.fn(), updateOne: jest.fn(async () => ({})) }));
jest.mock('../models/ImageGenerationJob', () => ({ find: jest.fn(), deleteMany: jest.fn(async () => ({})) }));
jest.mock('../utils/fileUpload', () => ({
  upload: { single: () => (req, res, next) => next() },
  processAndSaveImage: jest.fn(), deleteFile: jest.fn(async () => {}), validateImageDimensions: jest.fn(),
}));
function mockMediaModel() {
  return { find: jest.fn(() => ({ select: () => ({ lean: async () => [] }) })), deleteMany: jest.fn(async () => ({})) };
}

const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const Tag = require('../models/Tag');
const { deleteFile } = require('../utils/fileUpload');

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/images', require('../routes/images'));
});
beforeEach(() => {
  jest.clearAllMocks();
  Tag.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  for (const M of [UploadedImage, GeneratedImage, GeneratedVideo]) M.find.mockImplementation(() => chain([]));
});

const post = (body) => request(app).post('/api/images/bulk-delete-by-filter').send(body);

describe('POST /api/images/bulk-delete-by-filter (#1314)', () => {
  test.each([
    ['search 가 배열', { type: 'generated', search: ['a', 'b'] }],
    ['search 가 객체', { type: 'generated', search: { $ne: '' } }],
    ['tags 가 배열', { type: 'uploaded', tags: ['x'] }],
  ])('%s → 400, 아무것도 찾거나 지우지 않는다', async (_n, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    for (const M of [UploadedImage, GeneratedImage, GeneratedVideo]) {
      expect(M.find).not.toHaveBeenCalled();
      expect(M.deleteMany).not.toHaveBeenCalled();
    }
  });

  test('검색어와 태그를 함께 보내면 둘 다 조건에 들어간다 (목록과 같은 범위)', async () => {
    const tagA = new mongoose.Types.ObjectId().toString();
    const res = await post({ type: 'generated', search: 'cat', tags: tagA });
    expect(res.status).toBe(200);
    const filter = GeneratedImage.find.mock.calls[0][0];
    expect(String(filter.userId)).toBe(String(userId));
    expect(filter.tags).toEqual({ $in: [tagA] });
    expect(filter.$or).toEqual([
      { originalName: { $regex: 'cat', $options: 'i' } },
      { 'generationParams.prompt': { $regex: 'cat', $options: 'i' } },
    ]);
  });

  test('검색어가 태그 이름과 맞으면 그 태그의 id 로 찾는다', async () => {
    const tagId = new mongoose.Types.ObjectId();
    Tag.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: tagId }] }) });
    await post({ type: 'uploaded', search: 'cat' });
    expect(UploadedImage.find.mock.calls[0][0].$or).toEqual([
      { originalName: { $regex: 'cat', $options: 'i' } },
      { tags: { $in: [tagId] } },
    ]);
  });

  test('찾은 문서만 지운다', async () => {
    const id = new mongoose.Types.ObjectId();
    GeneratedImage.find.mockImplementation(() => chain([{ _id: id, path: '/x.png', tags: [] }]));
    const res = await post({ type: 'generated', search: 'cat' });
    expect(res.body.data.deleted).toBe(1);
    expect(deleteFile).toHaveBeenCalledWith('/x.png');
    expect(GeneratedImage.deleteMany).toHaveBeenCalledWith({ _id: { $in: [id] } });
  });
});
