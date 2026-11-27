/**
 * 내 콘텐츠 일괄 삭제 — 무엇이 지워지고 무엇이 안 지워지는가 (#1314).
 *
 * 휴지통이 없어 지운 것은 되돌릴 수 없다. 그래서 삭제 경로는 "지워지는 것"만이 아니라
 * "지워지면 안 되는 것"을 경우마다 고정한다: 남의 것, 조건 밖의 것, 실행 중인 작업이 쓰는 것,
 * 옵션을 켜지 않은 작업 기록, 형식이 틀린 요청.
 */
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId();
const me = oid();

jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => { req.user = { _id: mockMe(), isAdmin: false }; next(); },
}));
const mockMe = () => me;

function mockMediaModel() {
  return { find: jest.fn(), deleteMany: jest.fn(async () => ({})) };
}
jest.mock('../models/UploadedImage', () => mockMediaModel());
jest.mock('../models/GeneratedImage', () => mockMediaModel());
jest.mock('../models/GeneratedVideo', () => mockMediaModel());
jest.mock('../models/Tag', () => ({ find: jest.fn(), updateOne: jest.fn(async () => ({})) }));
jest.mock('../models/ImageGenerationJob', () => ({ find: jest.fn(), deleteMany: jest.fn(async () => ({})) }));
jest.mock('../utils/fileUpload', () => ({
  upload: { single: () => (req, res, next) => next() },
  processAndSaveImage: jest.fn(), deleteFile: jest.fn(async () => {}), validateImageDimensions: jest.fn(),
}));

const UploadedImage = require('../models/UploadedImage');
const GeneratedImage = require('../models/GeneratedImage');
const GeneratedVideo = require('../models/GeneratedVideo');
const Tag = require('../models/Tag');
const ImageGenerationJob = require('../models/ImageGenerationJob');
const { deleteFile } = require('../utils/fileUpload');

const MEDIA = { uploaded: UploadedImage, generated: GeneratedImage, video: GeneratedVideo };
const ALL = Object.values(MEDIA);

// find() 결과는 thenable 이면서 select().lean() · lean() 체인도 받는다 (두 라우트가 다르게 부른다)
const found = (docs) => {
  const q = { select: () => q, lean: async () => docs, then: (ok, no) => Promise.resolve(docs).then(ok, no) };
  return q;
};
/** 모델이 가진 문서 — find 가 실제 조건(userId · _id $in)으로 걸러 돌려준다 */
const seed = (Model, docs) => Model.find.mockImplementation((filter = {}) => {
  let out = docs.filter((d) => !filter.userId || String(d.userId) === String(filter.userId));
  if (filter._id && filter._id.$in) {
    const ids = filter._id.$in.map(String);
    out = out.filter((d) => ids.includes(String(d._id)));
  }
  return found(out);
});
const activeJobs = (ids) => ImageGenerationJob.find.mockReturnValue({ select: () => ({ lean: async () => ids.map((_id) => ({ _id })) }) });
const deletedIds = (Model) => Model.deleteMany.mock.calls.flatMap(([f]) => f._id.$in.map(String));
const expectNothingDeleted = () => {
  for (const M of ALL) expect(M.deleteMany).not.toHaveBeenCalled();
  expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  expect(deleteFile).not.toHaveBeenCalled();
};

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/images', require('../routes/images'));
});
beforeEach(() => {
  jest.clearAllMocks();
  Tag.find.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  for (const M of ALL) seed(M, []);
  activeJobs([]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

const byFilter = (body) => request(app).post('/api/images/bulk-delete-by-filter').send(body);
const bySelection = (body) => request(app).post('/api/images/bulk-delete').send(body);

describe('POST /api/images/bulk-delete-by-filter — 요청을 받지 않는 경우', () => {
  test.each([
    ['종류가 없다', { search: 'cat' }],
    ['모르는 종류', { type: 'audio', search: 'cat' }],
    ['search 가 배열', { type: 'generated', search: ['a', 'b'] }],
    ['search 가 객체', { type: 'generated', search: { $ne: '' } }],
    ['search 가 숫자', { type: 'generated', search: 1 }],
    ['tags 가 배열', { type: 'uploaded', tags: ['x'] }],
    ['tags 가 객체', { type: 'uploaded', search: 'cat', tags: { $ne: null } }],
    ['조건이 하나도 없다 (생성 이미지)', { type: 'generated' }],
    ['조건이 하나도 없다 (업로드 이미지)', { type: 'uploaded' }],
    ['조건이 하나도 없다 (영상)', { type: 'video' }],
    ['검색어가 빈 문자열', { type: 'generated', search: '' }],
    ['검색어가 공백뿐', { type: 'generated', search: '   ' }],
    ['영상에 태그만 — 영상은 태그로 거르지 않는다', { type: 'video', tags: String(oid()) }],
  ])('%s → 400, 찾지도 지우지도 않는다', async (_n, body) => {
    const res = await byFilter(body);
    expect(res.status).toBe(400);
    for (const M of ALL) expect(M.find).not.toHaveBeenCalled();
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete-by-filter — 대상 범위', () => {
  test.each(['uploaded', 'generated', 'video'])('%s: 조건에 늘 내 userId 가 들어가고, 그 종류의 모델만 건드린다', async (type) => {
    await byFilter({ type, search: 'cat' });
    const filter = MEDIA[type].find.mock.calls[0][0];
    expect(String(filter.userId)).toBe(String(me));
    for (const [t, M] of Object.entries(MEDIA)) if (t !== type) expect(M.find).not.toHaveBeenCalled();
  });

  test('검색어와 태그를 함께 보내면 둘 다 조건에 들어간다 (화면 목록과 같은 범위)', async () => {
    const tagA = String(oid());
    const res = await byFilter({ type: 'generated', search: 'cat', tags: tagA });
    expect(res.status).toBe(200);
    const filter = GeneratedImage.find.mock.calls[0][0];
    expect(filter.tags).toEqual({ $in: [tagA] });
    expect(filter.$or).toEqual([
      { originalName: { $regex: 'cat', $options: 'i' } },
      { 'generationParams.prompt': { $regex: 'cat', $options: 'i' } },
    ]);
  });

  test('태그만 보내면 그 태그가 붙은 것만 대상이다 — 검색 조건은 넣지 않는다', async () => {
    const tagA = String(oid());
    await byFilter({ type: 'uploaded', tags: `${tagA}, ` });
    const filter = UploadedImage.find.mock.calls[0][0];
    expect(filter.tags).toEqual({ $in: [tagA] });
    expect(filter.$or).toBeUndefined();
  });

  test('검색어가 태그 이름과 맞으면 그 태그의 id 로 찾는다 (정규식을 tags 에 걸지 않는다)', async () => {
    const tagId = oid();
    Tag.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: tagId }] }) });
    await byFilter({ type: 'uploaded', search: 'cat' });
    expect(Tag.find).toHaveBeenCalledWith({ userId: me, name: { $regex: 'cat', $options: 'i' } });
    expect(UploadedImage.find.mock.calls[0][0].$or).toEqual([
      { originalName: { $regex: 'cat', $options: 'i' } },
      { tags: { $in: [tagId] } },
    ]);
  });

  test('검색어의 정규식 기호는 글자 그대로 찾는다 — `.*` 로 전부를 잡지 못한다', async () => {
    await byFilter({ type: 'video', search: '.*' });
    expect(GeneratedVideo.find.mock.calls[0][0].$or[0].originalName.$regex).toBe('\\.\\*');
  });

  test('맞는 것이 없으면 0건 — 아무것도 지우지 않는다', async () => {
    const res = await byFilter({ type: 'generated', search: 'cat' });
    expect(res.body.data).toEqual({ deleted: 0, failed: 0, errors: [] });
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete-by-filter — 지우는 것', () => {
  test('찾은 문서와 그 파일만 지운다', async () => {
    const a = { _id: oid(), userId: me, path: '/a.png', tags: [] };
    const b = { _id: oid(), userId: me, path: '/b.png', tags: [] };
    seed(GeneratedImage, [a, b]);
    const res = await byFilter({ type: 'generated', search: 'cat' });
    expect(res.body.data.deleted).toBe(2);
    expect(deletedIds(GeneratedImage).sort()).toEqual([String(a._id), String(b._id)].sort());
    expect(deleteFile.mock.calls.map(([p]) => p).sort()).toEqual(['/a.png', '/b.png']);
    expect(UploadedImage.deleteMany).not.toHaveBeenCalled();
    expect(GeneratedVideo.deleteMany).not.toHaveBeenCalled();
  });

  test('남의 문서는 조건에 맞아도 지우지 않는다', async () => {
    const mine = { _id: oid(), userId: me, path: '/mine.png', tags: [] };
    const theirs = { _id: oid(), userId: oid(), path: '/theirs.png', tags: [] };
    seed(GeneratedImage, [mine, theirs]);
    await byFilter({ type: 'generated', search: 'cat' });
    expect(deletedIds(GeneratedImage)).toEqual([String(mine._id)]);
    expect(deleteFile).not.toHaveBeenCalledWith('/theirs.png');
  });

  test.each([
    ['옵션을 켜지 않으면 작업 기록은 남긴다', undefined, false],
    ['deleteJob: false 여도 남긴다', false, false],
    ['deleteJob: true 면 그 콘텐츠의 작업 기록만 지운다', true, true],
  ])('%s', async (_n, deleteJob, expectJobDelete) => {
    const jobId = oid();
    seed(GeneratedImage, [
      { _id: oid(), userId: me, path: '/a.png', tags: [], jobId },
      { _id: oid(), userId: me, path: '/b.png', tags: [] }, // 작업 기록이 없는 콘텐츠
    ]);
    await byFilter({ type: 'generated', search: 'cat', ...(deleteJob === undefined ? {} : { deleteJob }) });
    if (expectJobDelete) expect(ImageGenerationJob.deleteMany).toHaveBeenCalledWith({ _id: { $in: [jobId] } });
    else expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('업로드 이미지는 deleteJob 을 켜도 작업 기록을 지우지 않는다', async () => {
    seed(UploadedImage, [{ _id: oid(), userId: me, path: '/u.png', tags: [] }]);
    await byFilter({ type: 'uploaded', search: 'cat', deleteJob: true });
    expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('실행 중인 작업이 쓰는 업로드 이미지는 남기고 사유를 돌려준다', async () => {
    const activeJob = oid();
    const doneJob = oid();
    const inUse = { _id: oid(), userId: me, path: '/in-use.png', tags: [], isReferenced: true, referencedBy: [{ jobId: activeJob }] };
    const wasUsed = { _id: oid(), userId: me, path: '/was-used.png', tags: [], isReferenced: true, referencedBy: [{ jobId: doneJob }] };
    const free = { _id: oid(), userId: me, path: '/free.png', tags: [] };
    seed(UploadedImage, [inUse, wasUsed, free]);
    activeJobs([activeJob]);
    const res = await byFilter({ type: 'uploaded', search: 'cat' });
    expect(ImageGenerationJob.find.mock.calls[0][0].status).toEqual({ $in: ['pending', 'processing'] });
    expect(deletedIds(UploadedImage).sort()).toEqual([String(wasUsed._id), String(free._id)].sort());
    expect(deleteFile).not.toHaveBeenCalledWith('/in-use.png');
    expect(res.body.data).toMatchObject({ deleted: 2, failed: 1 });
    expect(res.body.data.errors).toEqual([{ id: String(inUse._id), reason: 'Referenced by active job' }]);
  });

  test('지운 콘텐츠에 붙어 있던 태그의 사용 횟수를 그만큼 줄인다', async () => {
    const t1 = oid();
    const t2 = oid();
    seed(GeneratedImage, [
      { _id: oid(), userId: me, path: '/a.png', tags: [t1, t2] },
      { _id: oid(), userId: me, path: '/b.png', tags: [t1] },
    ]);
    await byFilter({ type: 'generated', search: 'cat' });
    expect(Tag.updateOne).toHaveBeenCalledWith({ _id: String(t1) }, { $inc: { usageCount: -2 } });
    expect(Tag.updateOne).toHaveBeenCalledWith({ _id: String(t2) }, { $inc: { usageCount: -1 } });
  });

  test('남긴 업로드 이미지의 태그는 줄이지 않는다', async () => {
    const t1 = oid();
    const activeJob = oid();
    seed(UploadedImage, [
      { _id: oid(), userId: me, path: '/in-use.png', tags: [t1], isReferenced: true, referencedBy: [{ jobId: activeJob }] },
      { _id: oid(), userId: me, path: '/free.png', tags: [t1] },
    ]);
    activeJobs([activeJob]);
    await byFilter({ type: 'uploaded', search: 'cat' });
    expect(Tag.updateOne.mock.calls).toEqual([[{ _id: String(t1) }, { $inc: { usageCount: -1 } }]]);
  });

  test('찾는 중에 오류가 나면 아무것도 지우지 않는다', async () => {
    GeneratedImage.find.mockImplementation(() => { throw new Error('db down'); });
    const res = await byFilter({ type: 'generated', search: 'cat' });
    expect(res.status).toBe(500);
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete — 고른 항목 삭제', () => {
  test.each([
    ['항목이 없다', {}],
    ['빈 목록', { items: [] }],
  ])('%s → 400, 지우지 않는다', async (_n, body) => {
    const res = await bySelection(body);
    expect(res.status).toBe(400);
    expectNothingDeleted();
  });

  test('고른 id 만 지운다 — 같은 종류의 다른 내 콘텐츠는 남는다', async () => {
    const picked = { _id: oid(), userId: me, path: '/picked.png', tags: [] };
    const other = { _id: oid(), userId: me, path: '/other.png', tags: [] };
    seed(GeneratedImage, [picked, other]);
    const res = await bySelection({ items: [{ id: String(picked._id), type: 'generated' }] });
    expect(res.body.data).toMatchObject({ deleted: 1, failed: 0 });
    expect(deletedIds(GeneratedImage)).toEqual([String(picked._id)]);
    expect(deleteFile.mock.calls).toEqual([['/picked.png']]);
  });

  test.each(['uploaded', 'generated', 'video'])('%s: 남의 id 를 보내면 지우지 않고 실패로 돌려준다', async (type) => {
    const theirs = { _id: oid(), userId: oid(), path: '/theirs.png', tags: [] };
    seed(MEDIA[type], [theirs]);
    const res = await bySelection({ items: [{ id: String(theirs._id), type }] });
    expect(String(MEDIA[type].find.mock.calls[0][0].userId)).toBe(String(me));
    expect(res.body.data).toMatchObject({ deleted: 0, failed: 1 });
    expect(res.body.data.errors).toEqual([{ id: String(theirs._id), reason: 'Access denied or not found' }]);
    expectNothingDeleted();
  });

  test('내 것과 남의 것을 섞어 보내면 내 것만 지운다', async () => {
    const mine = { _id: oid(), userId: me, path: '/mine.mp4', tags: [] };
    const theirs = { _id: oid(), userId: oid(), path: '/theirs.mp4', tags: [] };
    seed(GeneratedVideo, [mine, theirs]);
    const res = await bySelection({ items: [mine, theirs].map((d) => ({ id: String(d._id), type: 'video' })) });
    expect(deletedIds(GeneratedVideo)).toEqual([String(mine._id)]);
    expect(deleteFile.mock.calls).toEqual([['/mine.mp4']]);
    expect(res.body.data).toMatchObject({ deleted: 1, failed: 1 });
  });

  test('종류를 틀리게 보낸 id 는 그 종류에서 찾지 못해 지워지지 않는다', async () => {
    const image = { _id: oid(), userId: me, path: '/img.png', tags: [] };
    seed(GeneratedImage, [image]);
    const res = await bySelection({ items: [{ id: String(image._id), type: 'video' }] });
    expect(res.body.data).toMatchObject({ deleted: 0, failed: 1 });
    expectNothingDeleted();
  });

  test('모르는 종류의 항목은 건드리지 않는다', async () => {
    const res = await bySelection({ items: [{ id: String(oid()), type: 'audio' }] });
    expect(res.body.data.deleted).toBe(0);
    for (const M of ALL) expect(M.find).not.toHaveBeenCalled();
    expectNothingDeleted();
  });

  test.each([
    ['옵션을 켜지 않으면 작업 기록은 남긴다', undefined, false],
    ['deleteJob: true 면 고른 콘텐츠의 작업 기록만 지운다', true, true],
  ])('%s', async (_n, deleteJob, expectJobDelete) => {
    const jobId = oid();
    const otherJob = oid();
    const picked = { _id: oid(), userId: me, path: '/p.png', tags: [], jobId };
    const notPicked = { _id: oid(), userId: me, path: '/n.png', tags: [], jobId: otherJob };
    seed(GeneratedImage, [picked, notPicked]);
    await bySelection({ items: [{ id: String(picked._id), type: 'generated' }], ...(deleteJob ? { deleteJob } : {}) });
    if (expectJobDelete) expect(ImageGenerationJob.deleteMany).toHaveBeenCalledWith({ _id: { $in: [jobId] } });
    else expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('실행 중인 작업이 쓰는 업로드 이미지는 남긴다', async () => {
    const activeJob = oid();
    const inUse = { _id: oid(), userId: me, path: '/in-use.png', tags: [], isReferenced: true, referencedBy: [{ jobId: activeJob }] };
    const free = { _id: oid(), userId: me, path: '/free.png', tags: [] };
    seed(UploadedImage, [inUse, free]);
    activeJobs([activeJob]);
    const res = await bySelection({ items: [inUse, free].map((d) => ({ id: String(d._id), type: 'uploaded' })) });
    expect(deletedIds(UploadedImage)).toEqual([String(free._id)]);
    expect(deleteFile.mock.calls).toEqual([['/free.png']]);
    expect(res.body.data.errors).toEqual([{ id: String(inUse._id), reason: 'Referenced by active job' }]);
  });

  test('태그 사용 횟수는 실제로 지운 것만큼만 줄인다 — 남긴 것의 태그는 그대로', async () => {
    const t1 = oid();
    const activeJob = oid();
    const inUse = { _id: oid(), userId: me, path: '/in-use.png', tags: [t1], isReferenced: true, referencedBy: [{ jobId: activeJob }] };
    const free = { _id: oid(), userId: me, path: '/free.png', tags: [t1] };
    seed(UploadedImage, [inUse, free]);
    activeJobs([activeJob]);
    await bySelection({ items: [inUse, free].map((d) => ({ id: String(d._id), type: 'uploaded' })) });
    expect(Tag.updateOne.mock.calls).toEqual([[{ _id: String(t1) }, { $inc: { usageCount: -1 } }]]);
  });
});
