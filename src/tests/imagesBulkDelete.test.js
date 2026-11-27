/**
 * 내 콘텐츠 일괄 삭제 — 무엇이 지워지고 무엇이 안 지워지는가 (#1314).
 *
 * 휴지통이 없어 지운 것은 되돌릴 수 없다. 그래서 삭제 경로는 "지워지는 것"만이 아니라
 * "지워지면 안 되는 것"을 경우마다 고정한다: 남의 것, 조건 밖의 것, 실행 중인 작업이 쓰는 것,
 * 옵션을 켜지 않은 작업 기록, 형식이 틀린 요청, 확인한 뒤에 바뀐 목록.
 *
 * 모델은 흉내지만 find 는 받은 조건을 문서에 실제로 적용한다 — "어떤 조건을 만들었나"가 아니라
 * "그 조건으로 무엇이 지워지나"를 본다.
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
  return { find: jest.fn(), countDocuments: jest.fn(), deleteMany: jest.fn(async () => ({})) };
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
  let out = docs;
  const q = {
    select: () => q, populate: () => q, sort: () => q,
    skip: (n) => { out = out.slice(n); return q; },
    limit: (n) => { out = out.slice(0, n); return q; },
    lean: async () => out,
    then: (ok, no) => Promise.resolve(out).then(ok, no),
  };
  return q;
};
// 조건 객체를 문서에 실제로 적용한다 — 라우트가 쓰는 모양만 (userId · _id $in · tags $in · $or[정규식|tags])
const get = (doc, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), doc);
const matchField = (doc, field, cond) => {
  const value = get(doc, field);
  if (cond && cond.$regex !== undefined) return typeof value === 'string' && new RegExp(cond.$regex, cond.$options).test(value);
  if (cond && cond.$in) {
    const want = cond.$in.map(String);
    return (Array.isArray(value) ? value : [value]).some((v) => v != null && want.includes(String(v)));
  }
  return String(value) === String(cond);
};
const matches = (doc, filter) => Object.entries(filter).every(([key, cond]) => (
  key === '$or' ? cond.some((sub) => matches(doc, sub)) : matchField(doc, key, cond)
));
/** 모델이 가진 문서 — find 가 받은 조건을 그대로 적용해 돌려준다 */
const seed = (Model, docs) => {
  Model.find.mockImplementation((filter = {}) => found(docs.filter((d) => matches(d, filter))));
  Model.countDocuments.mockImplementation(async (filter = {}) => docs.filter((d) => matches(d, filter)).length);
};
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

const byFilterRaw = (body) => request(app).post('/api/images/bulk-delete-by-filter').send(body);
const preview = (body) => request(app).post('/api/images/bulk-delete-by-filter/preview').send(body);
const DIGEST = 'a'.repeat(64); // 형식은 맞지만 어떤 대상과도 맞지 않는 지문
/** 화면처럼: 먼저 대상을 확인하고(preview), 그 지문을 실어 지운다 */
const byFilter = async (body) => {
  const { deleteJob, ...condition } = body;
  const seen = await preview(condition);
  if (seen.status !== 200) return seen;
  jest.clearAllMocks(); // 호출 기록만 지운다 — seed 한 문서는 그대로
  return byFilterRaw({ ...body, expectedDigest: seen.body.data.digest });
};
const bySelection = (body) => request(app).post('/api/images/bulk-delete').send(body);

/** 내 문서 하나. 이름에 cat 이 들어가면 검색어 'cat' 에 걸린다 */
const mine = (over = {}) => ({ _id: oid(), userId: me, originalName: 'cat.png', path: `/${oid()}.png`, tags: [], ...over });

describe('POST /api/images/bulk-delete-by-filter — 요청을 받지 않는 경우', () => {
  const tagId = String(oid());
  const CONDITION_CASES = [
    ['종류가 없다', { search: 'cat' }],
    ['모르는 종류', { type: 'audio', search: 'cat' }],
    ['search 가 배열', { type: 'generated', search: ['a', 'b'] }],
    ['search 가 객체', { type: 'generated', search: { $ne: '' } }],
    ['search 가 숫자', { type: 'generated', search: 1 }],
    ['tags 가 배열', { type: 'uploaded', tags: [tagId] }],
    ['tags 가 객체', { type: 'uploaded', search: 'cat', tags: { $ne: null } }],
    ['tags 에 id 가 아닌 값', { type: 'generated', search: 'cat', tags: `${tagId},nope` }],
    ['조건이 하나도 없다 (생성 이미지)', { type: 'generated' }],
    ['조건이 하나도 없다 (업로드 이미지)', { type: 'uploaded' }],
    ['조건이 하나도 없다 (영상)', { type: 'video' }],
    ['검색어가 빈 문자열', { type: 'generated', search: '' }],
    ['검색어가 공백뿐', { type: 'generated', search: '   ' }],
    ['태그가 쉼표 · 공백뿐', { type: 'generated', tags: ' , ' }],
    ['본문이 비었다', {}],
  ];
  test.each(CONDITION_CASES)('삭제: %s → 400, 찾지도 지우지도 않는다', async (_n, body) => {
    for (const M of ALL) seed(M, [mine(), mine()]);
    const res = await byFilterRaw({ ...body, expectedDigest: DIGEST });
    expect(res.status).toBe(400);
    for (const M of ALL) expect(M.find).not.toHaveBeenCalled();
    expectNothingDeleted();
  });

  test.each(CONDITION_CASES)('대상 확인: %s → 400', async (_n, body) => {
    for (const M of ALL) seed(M, [mine(), mine()]);
    const res = await preview(body);
    expect(res.status).toBe(400);
    for (const M of ALL) expect(M.find).not.toHaveBeenCalled();
  });

  test.each([
    ['deleteJob 이 문자열 "false"', { deleteJob: 'false', expectedDigest: DIGEST }],
    ['deleteJob 이 문자열 "true"', { deleteJob: 'true', expectedDigest: DIGEST }],
    ['deleteJob 이 숫자', { deleteJob: 1, expectedDigest: DIGEST }],
    ['지문이 없다 (대상을 확인하지 않았다)', {}],
    ['지문 대신 건수만 보냈다 (옛 요청)', { expectedCount: 2 }],
    ['지문이 숫자', { expectedDigest: 2 }],
    ['지문이 형식에 안 맞는 문자열', { expectedDigest: 'abc' }],
    ['지문이 객체', { expectedDigest: { $ne: null } }],
  ])('삭제: %s → 400, 찾지도 지우지도 않는다', async (_n, extra) => {
    for (const M of ALL) seed(M, [mine(), mine()]);
    const res = await byFilterRaw({ type: 'generated', search: 'cat', ...extra });
    expect(res.status).toBe(400);
    for (const M of ALL) expect(M.find).not.toHaveBeenCalled();
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete-by-filter/preview — 대상 확인', () => {
  test('건수와 지문을 돌려주고 아무것도 지우지 않는다', async () => {
    seed(GeneratedImage, [mine(), mine(), mine({ originalName: 'dog.png' })]);
    const res = await preview({ type: 'generated', search: 'cat' });
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
    expect(res.body.data.digest).toMatch(/^[0-9a-f]{64}$/);
    expectNothingDeleted();
    expect(Tag.updateOne).not.toHaveBeenCalled();
  });

  test('같은 대상이면 지문이 같고, 대상이 하나라도 다르면 지문이 다르다', async () => {
    const a = mine(); const b = mine(); const c = mine();
    seed(GeneratedImage, [a, b]);
    const first = (await preview({ type: 'generated', search: 'cat' })).body.data.digest;
    seed(GeneratedImage, [b, a]); // 순서만 다르다
    expect((await preview({ type: 'generated', search: 'cat' })).body.data.digest).toBe(first);
    seed(GeneratedImage, [a, c]); // 건수는 같고 한 건이 바뀌었다
    expect((await preview({ type: 'generated', search: 'cat' })).body.data.digest).not.toBe(first);
  });

  test('남의 문서는 대상에 들지 않는다', async () => {
    seed(GeneratedImage, [mine(), mine({ userId: oid() })]);
    expect((await preview({ type: 'generated', search: 'cat' })).body.data.count).toBe(1);
  });
});

describe('POST /api/images/bulk-delete-by-filter/preview — 화면에 보인 항목(seenIds)', () => {
  test('보인 항목이 모두 대상에 있으면 확인해 준다', async () => {
    const a = mine(); const b = mine();
    seed(GeneratedImage, [a, b, mine()]);
    const res = await preview({ type: 'generated', search: 'cat', seenIds: [String(a._id), String(b._id).toUpperCase()] });
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(3);
  });

  test('보인 항목 하나가 대상에 없다 (다른 세션이 그 사이 바꿨다) → 409, 지문을 주지 않는다', async () => {
    const stillThere = mine();
    const renamedAway = mine({ originalName: 'dog.png' }); // 화면에는 cat 결과로 보였지만 지금은 조건 밖
    const newcomer = mine();                               // 그 자리에 들어온 다른 항목 — 건수는 같다
    seed(GeneratedImage, [stillThere, renamedAway, newcomer]);
    const res = await preview({ type: 'generated', search: 'cat', seenIds: [String(stillThere._id), String(renamedAway._id)] });
    expect(res.status).toBe(409);
    expect(res.body.data.digest).toBeUndefined();
    expectNothingDeleted();
  });

  test('남의 항목을 보인 항목으로 보내면 409', async () => {
    const theirs = mine({ userId: oid() });
    seed(GeneratedImage, [mine(), theirs]);
    expect((await preview({ type: 'generated', search: 'cat', seenIds: [String(theirs._id)] })).status).toBe(409);
  });

  test.each([
    ['배열이 아니다', 'all'],
    ['id 가 아닌 값이 섞였다', ['nope']],
    ['객체가 섞였다', [{ $ne: null }]],
    ['너무 많다', Array.from({ length: 201 }, () => String(oid()))],
  ])('seenIds 형식: %s → 400', async (_n, seenIds) => {
    seed(GeneratedImage, [mine()]);
    const res = await preview({ type: 'generated', search: 'cat', seenIds });
    expect(res.status).toBe(400);
    expect(GeneratedImage.find).not.toHaveBeenCalled();
  });
});

describe('POST /api/images/bulk-delete-by-filter — 확인한 대상과 다르면 지우지 않는다', () => {
  const seen = async (condition) => (await preview(condition)).body.data.digest;

  test('확인한 뒤에 조건에 맞는 것이 늘었다 → 409, 아무것도 지우지 않는다', async () => {
    const a = mine();
    seed(GeneratedImage, [a]);
    const digest = await seen({ type: 'generated', search: 'cat' });
    seed(GeneratedImage, [a, mine()]);
    jest.clearAllMocks();
    const res = await byFilterRaw({ type: 'generated', search: 'cat', expectedDigest: digest });
    expect(res.status).toBe(409);
    expect(res.body.data.count).toBe(2);
    expectNothingDeleted();
  });

  test('건수는 같은데 한 건이 빠지고 다른 한 건이 들어왔다 → 409, 새로 들어온 것을 지우지 않는다', async () => {
    const a = mine();
    const newcomer = mine();
    seed(GeneratedImage, [a]);
    const digest = await seen({ type: 'generated', search: 'cat' });
    seed(GeneratedImage, [newcomer]);
    jest.clearAllMocks();
    const res = await byFilterRaw({ type: 'generated', search: 'cat', expectedDigest: digest });
    expect(res.status).toBe(409);
    expectNothingDeleted();
  });

  test('태그로 좁혀 확인한 지문으로 태그 없는 요청을 보내면 지우지 않는다 (화면 경합)', async () => {
    const tagA = oid();
    seed(GeneratedImage, [mine({ tags: [tagA] }), mine(), mine()]);
    const digest = await seen({ type: 'generated', search: 'cat', tags: String(tagA) });
    jest.clearAllMocks();
    const res = await byFilterRaw({ type: 'generated', search: 'cat', expectedDigest: digest });
    expect(res.status).toBe(409);
    expectNothingDeleted();
  });

  test('다른 종류에서 확인한 지문은 통하지 않는다 (확인 중 탭이 바뀐 요청)', async () => {
    seed(GeneratedImage, [mine()]);
    seed(GeneratedVideo, [mine(), mine()]);
    const digest = await seen({ type: 'generated', search: 'cat' });
    jest.clearAllMocks();
    const res = await byFilterRaw({ type: 'video', search: 'cat', expectedDigest: digest });
    expect(res.status).toBe(409);
    expectNothingDeleted();
  });

  test('확인한 대상 그대로면 그 대상만 지운다', async () => {
    const a = mine(); const b = mine(); const other = mine({ originalName: 'dog.png' });
    seed(GeneratedImage, [a, b, other]);
    const res = await byFilter({ type: 'generated', search: 'cat' });
    expect(res.status).toBe(200);
    expect(deletedIds(GeneratedImage).sort()).toEqual([String(a._id), String(b._id)].sort());
  });
});

describe('목록 API 와 일괄 삭제는 같은 범위를 본다', () => {
  const LIST_PATH = { uploaded: '/api/images/uploaded', generated: '/api/images/generated', video: '/api/images/videos' };
  const LIST_KEY = { uploaded: 'images', generated: 'images', video: 'videos' };
  const tagA = oid();
  const docs = () => [
    mine({ tags: [tagA] }), mine({ tags: [tagA] }), mine(),
    mine({ originalName: 'dog.png', tags: [tagA] }), mine({ originalName: 'dog.png' }),
    mine({ userId: oid(), tags: [tagA] }), // 남의 것
  ];
  const CONDITIONS = [
    ['검색어', { search: 'cat' }],
    ['태그', { tags: String(tagA) }],
    ['검색어 + 태그', { search: 'cat', tags: String(tagA) }],
    ['대문자 검색어', { search: 'CAT' }],
  ];
  describe.each(['uploaded', 'generated', 'video'])('%s', (type) => {
    test.each(CONDITIONS)('%s: 목록에 보인 것 = 확인한 대상 = 지워진 것', async (_n, condition) => {
      seed(MEDIA[type], docs());
      const list = await request(app).get(LIST_PATH[type]).query({ ...condition, limit: 50 });
      expect(list.status).toBe(200);
      const listed = list.body[LIST_KEY[type]].map((d) => String(d._id)).sort();
      expect(list.body.pagination.total).toBe(listed.length);
      expect(listed.length).toBeGreaterThan(0);

      // 목록이 준 지문 = preview 가 주는 지문
      const seen = await preview({ type, ...condition });
      expect(seen.body.data.count).toBe(listed.length);
      expect(list.body.pagination.digest).toBe(seen.body.data.digest);

      // 화면은 목록이 준 지문으로 바로 지운다
      jest.clearAllMocks();
      const res = await byFilterRaw({ type, ...condition, expectedDigest: list.body.pagination.digest });
      expect(res.status).toBe(200);
      expect(deletedIds(MEDIA[type]).sort()).toEqual(listed);
    });

    test('첫 페이지만 본 목록의 지문도 전체 대상을 묶는다 — 안 보이는 페이지의 한 건이 바뀌면 지우지 않는다', async () => {
      const tagged = Array.from({ length: 13 }, () => mine({ originalName: 'x.png', tags: [tagA] }));
      seed(MEDIA[type], tagged);
      const list = await request(app).get(LIST_PATH[type]).query({ tags: String(tagA), limit: 12, page: 1 });
      expect(list.body[LIST_KEY[type]]).toHaveLength(12);
      expect(list.body.pagination.total).toBe(13);

      // 다른 세션: 2페이지의 한 건에서 태그를 떼고, 새 한 건에 붙였다. 첫 페이지 12건과 총 13건은 그대로다
      const newcomer = mine({ originalName: 'new.png', tags: [tagA] });
      seed(MEDIA[type], [...tagged.slice(0, 12), { ...tagged[12], tags: [] }, newcomer]);
      jest.clearAllMocks();
      const res = await byFilterRaw({ type, tags: String(tagA), expectedDigest: list.body.pagination.digest });
      expect(res.status).toBe(409);
      expect(res.body.data.count).toBe(13);
      expectNothingDeleted();
    });

    test('목록 응답을 만드는 도중 대상이 바뀌어도, 보여 준 항목과 지문은 같은 시점의 것이다', async () => {
      const a = mine({ originalName: 'x.png', tags: [tagA] });
      const b = mine({ originalName: 'y.png', tags: [tagA] });
      const before = [a, { ...b, tags: [] }]; // 처음에는 A 만 태그가 붙어 있다
      const after = [{ ...a, tags: [] }, b];   // 그 사이 다른 세션이 A 에서 떼고 B 에 붙였다
      // 목록 라우트의 첫 조회가 끝난 직후에 대상이 바뀐다
      let calls = 0;
      MEDIA[type].find.mockImplementation((filter = {}) => {
        calls += 1;
        return found((calls === 1 ? before : after).filter((d) => matches(d, filter)));
      });
      MEDIA[type].countDocuments.mockImplementation(async (filter = {}) => after.filter((d) => matches(d, filter)).length);

      const list = await request(app).get(LIST_PATH[type]).query({ tags: String(tagA), limit: 12 });
      expect(list.status).toBe(200);
      // 화면에는 A 한 건이 보인다
      expect(list.body[LIST_KEY[type]].map((d) => String(d._id))).toEqual([String(a._id)]);
      expect(list.body.pagination.total).toBe(1);

      // 그 지문으로 지우려 하면, 지금 대상은 B 이므로 거절된다 — B 가 지워지지 않는다
      seed(MEDIA[type], after);
      jest.clearAllMocks();
      const res = await byFilterRaw({ type, tags: String(tagA), expectedDigest: list.body.pagination.digest });
      expect(res.status).toBe(409);
      expectNothingDeleted();
    });

    test('조건이 있는 목록은 건수를 따로 세지 않는다 (항목 · 건수 · 지문이 한 번의 조회에서 나온다)', async () => {
      seed(MEDIA[type], docs());
      const list = await request(app).get(LIST_PATH[type]).query({ search: 'cat', limit: 2, page: 2 });
      expect(MEDIA[type].countDocuments).not.toHaveBeenCalled();
      expect(list.body[LIST_KEY[type]].length).toBe(1); // cat 3건 중 2페이지
      expect(list.body.pagination).toMatchObject({ current: 2, pages: 2, total: 3 });
    });

    test('조건이 없는 목록에는 지문이 없다 — 조건 없는 일괄 삭제는 없다', async () => {
      seed(MEDIA[type], docs());
      const list = await request(app).get(LIST_PATH[type]).query({ limit: 50 });
      expect(list.status).toBe(200);
      expect(list.body.pagination.digest).toBeUndefined();
    });
  });

  test.each([
    ['search 가 여러 개 (배열로 읽힌다)', '/api/images/generated?search=a&search=b'],
    ['tags 가 여러 개', `/api/images/uploaded?tags=${tagA}&tags=${tagA}`],
    ['tags 에 id 가 아닌 값', '/api/images/videos?tags=nope'],
  ])('목록: %s → 400 (조건을 버리고 전체를 보여 주지 않는다)', async (_n, url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/images/bulk-delete-by-filter — 대상 범위', () => {
  test.each(['uploaded', 'generated', 'video'])('%s: 조건에 늘 내 userId 가 들어가고, 그 종류의 모델만 건드린다', async (type) => {
    await preview({ type, search: 'cat' });
    const filter = MEDIA[type].find.mock.calls[0][0];
    expect(String(filter.userId)).toBe(String(me));
    for (const [t, M] of Object.entries(MEDIA)) if (t !== type) expect(M.find).not.toHaveBeenCalled();
  });

  test.each(['uploaded', 'generated', 'video'])('%s: 검색어 · 태그가 둘 다 맞는 것만 지운다 — 하나만 맞는 내 것은 남는다', async (type) => {
    const tagA = oid();
    const both = mine({ tags: [tagA] });
    const searchOnly = mine();
    const tagOnly = mine({ originalName: 'dog.png', tags: [tagA] });
    const neither = mine({ originalName: 'dog.png' });
    seed(MEDIA[type], [both, searchOnly, tagOnly, neither]);
    const res = await byFilter({ type, search: 'cat', tags: String(tagA) });
    expect(res.status).toBe(200);
    expect(deletedIds(MEDIA[type])).toEqual([String(both._id)]);
    expect(deleteFile.mock.calls).toEqual([[both.path]]);
  });

  test.each(['uploaded', 'generated', 'video'])('%s: 태그만 보내면 그 태그가 붙은 것만 지운다', async (type) => {
    const tagA = oid();
    const tagged = mine({ originalName: 'dog.png', tags: [tagA] });
    seed(MEDIA[type], [tagged, mine(), mine({ tags: [oid()] })]);
    await byFilter({ type, tags: `${tagA}, ` });
    expect(deletedIds(MEDIA[type])).toEqual([String(tagged._id)]);
  });

  test('검색어만 보내면 이름이나 프롬프트가 맞는 것만 지운다', async () => {
    const byName = mine();
    const byPrompt = mine({ originalName: 'x.png', generationParams: { prompt: 'a CAT on a roof' } });
    const other = mine({ originalName: 'dog.png', generationParams: { prompt: 'a dog' } });
    seed(GeneratedImage, [byName, byPrompt, other]);
    await byFilter({ type: 'generated', search: 'cat' });
    expect(deletedIds(GeneratedImage).sort()).toEqual([String(byName._id), String(byPrompt._id)].sort());
  });

  test('검색어가 내 태그 이름과 맞으면 그 태그가 붙은 것도 대상이다 (목록과 같다)', async () => {
    const tagId = oid();
    Tag.find.mockReturnValue({ select: () => ({ lean: async () => [{ _id: tagId }] }) });
    const byTagName = mine({ originalName: 'dog.png', tags: [tagId] });
    seed(UploadedImage, [byTagName, mine({ originalName: 'dog.png' })]);
    await byFilter({ type: 'uploaded', search: 'cat' });
    expect(Tag.find).toHaveBeenCalledWith({ userId: me, name: { $regex: 'cat', $options: 'i' } });
    expect(deletedIds(UploadedImage)).toEqual([String(byTagName._id)]);
  });

  test('검색어의 정규식 기호는 글자 그대로 찾는다 — `.*` 로 전부를 잡지 못한다', async () => {
    const literal = mine({ originalName: 'a.*b.png' });
    seed(GeneratedVideo, [literal, mine(), mine({ originalName: 'dog.mp4' })]);
    await byFilter({ type: 'video', search: '.*' });
    expect(deletedIds(GeneratedVideo)).toEqual([String(literal._id)]);
  });

  test('맞는 것이 없으면 0건 — 아무것도 지우지 않는다', async () => {
    seed(GeneratedImage, [mine({ originalName: 'dog.png' })]);
    const res = await byFilter({ type: 'generated', search: 'cat' });
    expect(res.body.data).toEqual({ deleted: 0, failed: 0, errors: [] });
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete-by-filter — 지우는 것', () => {
  test('찾은 문서와 그 파일만 지운다 — 다른 종류는 건드리지 않는다', async () => {
    const a = mine();
    const b = mine();
    seed(GeneratedImage, [a, b]);
    seed(UploadedImage, [mine()]);
    seed(GeneratedVideo, [mine()]);
    const res = await byFilter({ type: 'generated', search: 'cat' });
    expect(res.body.data.deleted).toBe(2);
    expect(deletedIds(GeneratedImage).sort()).toEqual([String(a._id), String(b._id)].sort());
    expect(deleteFile.mock.calls.map(([p]) => p).sort()).toEqual([a.path, b.path].sort());
    expect(UploadedImage.deleteMany).not.toHaveBeenCalled();
    expect(GeneratedVideo.deleteMany).not.toHaveBeenCalled();
  });

  test('남의 문서는 조건에 맞아도 지우지 않는다', async () => {
    const own = mine();
    const theirs = mine({ userId: oid() });
    seed(GeneratedImage, [own, theirs]);
    await byFilter({ type: 'generated', search: 'cat' });
    expect(deletedIds(GeneratedImage)).toEqual([String(own._id)]);
    expect(deleteFile).not.toHaveBeenCalledWith(theirs.path);
  });

  test.each([
    ['옵션을 켜지 않으면 작업 기록은 남긴다', undefined, false],
    ['deleteJob: false 여도 남긴다', false, false],
    ['deleteJob: true 면 지운 콘텐츠의 작업 기록만 지운다', true, true],
  ])('%s', async (_n, deleteJob, expectJobDelete) => {
    const jobId = oid();
    const keptJob = oid();
    seed(GeneratedImage, [
      mine({ jobId }),
      mine(), // 작업 기록이 없는 콘텐츠
      mine({ originalName: 'dog.png', jobId: keptJob }), // 조건 밖 — 이 작업 기록은 어느 경우에도 남는다
    ]);
    await byFilter({ type: 'generated', search: 'cat', ...(deleteJob === undefined ? {} : { deleteJob }) });
    if (expectJobDelete) expect(ImageGenerationJob.deleteMany.mock.calls).toEqual([[{ _id: { $in: [jobId] } }]]);
    else expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('업로드 이미지는 deleteJob 을 켜도 작업 기록을 지우지 않는다', async () => {
    seed(UploadedImage, [mine({ jobId: oid() })]);
    await byFilter({ type: 'uploaded', search: 'cat', deleteJob: true });
    expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('실행 중인 작업이 쓰는 업로드 이미지는 남기고 사유를 돌려준다', async () => {
    const activeJob = oid();
    const doneJob = oid();
    const inUse = mine({ isReferenced: true, referencedBy: [{ jobId: activeJob }] });
    const wasUsed = mine({ isReferenced: true, referencedBy: [{ jobId: doneJob }] });
    const free = mine();
    seed(UploadedImage, [inUse, wasUsed, free]);
    activeJobs([activeJob]);
    const probe = await byFilter({ type: 'uploaded', search: 'cat' });
    expect(ImageGenerationJob.find.mock.calls[0][0].status).toEqual({ $in: ['pending', 'processing'] });
    expect(deletedIds(UploadedImage).sort()).toEqual([String(wasUsed._id), String(free._id)].sort());
    expect(deleteFile).not.toHaveBeenCalledWith(inUse.path);
    expect(probe.body.data).toMatchObject({ deleted: 2, failed: 1 });
    expect(probe.body.data.errors).toEqual([{ id: String(inUse._id), reason: 'Referenced by active job' }]);
  });

  test('태그 사용 횟수는 실제로 지운 것만큼만 줄인다', async () => {
    const t1 = oid();
    const t2 = oid();
    const activeJob = oid();
    seed(UploadedImage, [
      mine({ tags: [t1, t2] }),
      mine({ tags: [t1] }),
      mine({ tags: [t1], isReferenced: true, referencedBy: [{ jobId: activeJob }] }), // 남는다
      mine({ originalName: 'dog.png', tags: [t2] }), // 조건 밖
    ]);
    activeJobs([activeJob]);
    await byFilter({ type: 'uploaded', search: 'cat' });
    const calls = Tag.updateOne.mock.calls.map(([f, u]) => [f._id, u.$inc.usageCount]).sort();
    expect(calls).toEqual([[String(t1), -2], [String(t2), -1]].sort());
  });

  test('찾는 중에 오류가 나면 아무것도 지우지 않는다', async () => {
    GeneratedImage.find.mockImplementation(() => { throw new Error('db down'); });
    const res = await byFilterRaw({ type: 'generated', search: 'cat', expectedDigest: DIGEST });
    expect(res.status).toBe(500);
    expectNothingDeleted();
  });

  test('실행 중인 작업을 확인하다 오류가 나면 아무것도 지우지 않는다', async () => {
    seed(UploadedImage, [mine({ isReferenced: true, referencedBy: [{ jobId: oid() }] }), mine()]);
    const digest = (await preview({ type: 'uploaded', search: 'cat' })).body.data.digest;
    ImageGenerationJob.find.mockImplementation(() => { throw new Error('db down'); });
    const res = await byFilterRaw({ type: 'uploaded', search: 'cat', expectedDigest: digest });
    expect(res.status).toBe(500);
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete — 요청을 받지 않는 경우', () => {
  const good = () => ({ id: String(oid()), type: 'generated' });
  test.each([
    ['본문이 비었다', {}],
    ['빈 목록', { items: [] }],
    ['items 가 배열이 아니다', { items: { id: String(oid()), type: 'generated' } }],
    ['items 가 문자열', { items: 'all' }],
    ['모르는 종류가 섞였다', { items: [good(), { id: String(oid()), type: 'audio' }] }],
    ['종류가 없는 항목', { items: [good(), { id: String(oid()) }] }],
    ['id 형식이 아닌 항목', { items: [good(), { id: 'not-an-id', type: 'generated' }] }],
    ['id 가 객체인 항목', { items: [good(), { id: { $ne: null }, type: 'generated' }] }],
    ['id 가 12자 문자열 (ObjectId 로 읽힐 수 있는 꼴)', { items: [{ id: 'aaaaaaaaaaaa', type: 'generated' }] }],
    ['null 항목', { items: [good(), null] }],
    ['deleteJob 이 문자열', { items: [good()], deleteJob: 'false' }],
  ])('%s → 400, 찾지도 지우지도 않는다', async (_n, body) => {
    const res = await bySelection(body);
    expect(res.status).toBe(400);
    for (const M of ALL) expect(M.find).not.toHaveBeenCalled();
    expectNothingDeleted();
  });
});

describe('POST /api/images/bulk-delete — 고른 항목 삭제', () => {
  const pick = (type, ...docs) => docs.map((d) => ({ id: String(d._id), type }));

  test('고른 id 만 지운다 — 같은 종류의 다른 내 콘텐츠는 남는다', async () => {
    const picked = mine();
    const other = mine();
    seed(GeneratedImage, [picked, other]);
    const res = await bySelection({ items: pick('generated', picked) });
    expect(res.body.data).toMatchObject({ deleted: 1, failed: 0 });
    expect(deletedIds(GeneratedImage)).toEqual([String(picked._id)]);
    expect(deleteFile.mock.calls).toEqual([[picked.path]]);
  });

  test('세 종류를 섞어 보내면 종류마다 고른 것만 지운다', async () => {
    const u = mine(); const g = mine(); const v = mine();
    seed(UploadedImage, [u, mine()]);
    seed(GeneratedImage, [g, mine()]);
    seed(GeneratedVideo, [v, mine()]);
    const res = await bySelection({ items: [...pick('uploaded', u), ...pick('generated', g), ...pick('video', v)] });
    expect(res.body.data).toMatchObject({ deleted: 3, failed: 0 });
    expect(deletedIds(UploadedImage)).toEqual([String(u._id)]);
    expect(deletedIds(GeneratedImage)).toEqual([String(g._id)]);
    expect(deletedIds(GeneratedVideo)).toEqual([String(v._id)]);
  });

  test('대문자로 적은 id 도 같은 문서다 — 성공과 실패에 겹쳐 세지 않는다', async () => {
    const picked = mine();
    seed(GeneratedImage, [picked]);
    const res = await bySelection({ items: [{ id: String(picked._id).toUpperCase(), type: 'generated' }] });
    expect(res.body.data).toEqual({ deleted: 1, failed: 0, errors: [] });
  });

  test('같은 id 를 두 번 보내도 한 번만 센다', async () => {
    const picked = mine({ tags: [oid()] });
    seed(GeneratedImage, [picked]);
    const res = await bySelection({ items: [...pick('generated', picked), ...pick('generated', picked)] });
    expect(res.body.data).toMatchObject({ deleted: 1, failed: 0 });
    expect(Tag.updateOne).toHaveBeenCalledTimes(1);
  });

  test.each(['uploaded', 'generated', 'video'])('%s: 남의 id 를 보내면 지우지 않고 실패로 돌려준다', async (type) => {
    const theirs = mine({ userId: oid() });
    seed(MEDIA[type], [theirs]);
    const res = await bySelection({ items: pick(type, theirs) });
    expect(String(MEDIA[type].find.mock.calls[0][0].userId)).toBe(String(me));
    expect(res.body.data).toMatchObject({ deleted: 0, failed: 1 });
    expect(res.body.data.errors).toEqual([{ id: String(theirs._id), reason: 'Access denied or not found' }]);
    expectNothingDeleted();
  });

  test('내 것과 남의 것을 섞어 보내면 내 것만 지운다', async () => {
    const own = mine();
    const theirs = mine({ userId: oid() });
    seed(GeneratedVideo, [own, theirs]);
    const res = await bySelection({ items: pick('video', own, theirs) });
    expect(deletedIds(GeneratedVideo)).toEqual([String(own._id)]);
    expect(deleteFile.mock.calls).toEqual([[own.path]]);
    expect(res.body.data).toMatchObject({ deleted: 1, failed: 1 });
  });

  test('종류를 틀리게 보낸 id 는 그 종류에서 찾지 못해 지워지지 않는다', async () => {
    const image = mine();
    seed(GeneratedImage, [image]);
    const res = await bySelection({ items: pick('video', image) });
    expect(res.body.data).toMatchObject({ deleted: 0, failed: 1 });
    expectNothingDeleted();
  });

  test('뒤 종류를 찾다가 오류가 나면 앞 종류도 지우지 않는다 (찾기를 다 끝낸 뒤에 지운다)', async () => {
    const u = mine();
    seed(UploadedImage, [u]);
    GeneratedVideo.find.mockImplementation(() => { throw new Error('db down'); });
    const res = await bySelection({ items: [...pick('uploaded', u), { id: String(oid()), type: 'video' }] });
    expect(res.status).toBe(500);
    expectNothingDeleted();
  });

  test.each([
    ['옵션을 켜지 않으면 작업 기록은 남긴다', undefined, false],
    ['deleteJob: false 여도 남긴다', false, false],
    ['deleteJob: true 면 고른 콘텐츠의 작업 기록만 지운다', true, true],
  ])('%s', async (_n, deleteJob, expectJobDelete) => {
    const jobId = oid();
    const picked = mine({ jobId });
    const notPicked = mine({ jobId: oid() });
    seed(GeneratedImage, [picked, notPicked]);
    await bySelection({ items: pick('generated', picked), ...(deleteJob === undefined ? {} : { deleteJob }) });
    if (expectJobDelete) expect(ImageGenerationJob.deleteMany.mock.calls).toEqual([[{ _id: { $in: [jobId] } }]]);
    else expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('업로드 이미지는 deleteJob 을 켜도 작업 기록을 지우지 않는다', async () => {
    const u = mine({ jobId: oid() });
    seed(UploadedImage, [u]);
    await bySelection({ items: pick('uploaded', u), deleteJob: true });
    expect(ImageGenerationJob.deleteMany).not.toHaveBeenCalled();
  });

  test('실행 중인 작업이 쓰는 업로드 이미지는 남긴다', async () => {
    const activeJob = oid();
    const inUse = mine({ isReferenced: true, referencedBy: [{ jobId: activeJob }] });
    const free = mine();
    seed(UploadedImage, [inUse, free]);
    activeJobs([activeJob]);
    const res = await bySelection({ items: pick('uploaded', inUse, free) });
    expect(deletedIds(UploadedImage)).toEqual([String(free._id)]);
    expect(deleteFile.mock.calls).toEqual([[free.path]]);
    expect(res.body.data.errors).toEqual([{ id: String(inUse._id), reason: 'Referenced by active job' }]);
  });

  test('태그 사용 횟수는 실제로 지운 것만큼만 줄인다 — 남긴 것의 태그는 그대로', async () => {
    const t1 = oid();
    const activeJob = oid();
    const inUse = mine({ tags: [t1], isReferenced: true, referencedBy: [{ jobId: activeJob }] });
    const free = mine({ tags: [t1] });
    seed(UploadedImage, [inUse, free]);
    activeJobs([activeJob]);
    await bySelection({ items: pick('uploaded', inUse, free) });
    expect(Tag.updateOne.mock.calls).toEqual([[{ _id: String(t1) }, { $inc: { usageCount: -1 } }]]);
  });
});
