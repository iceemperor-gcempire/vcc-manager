/**
 * 내 콘텐츠 검색 조건 (#1314).
 *
 * `tags` 는 태그 id 배열이라 검색어 정규식을 그대로 걸면 CastError 가 난다 — 이름이 맞는 태그의 id 로 거른다.
 * 모델 스키마를 실제로 써서 조건이 캐스팅을 통과하는지까지 본다 (DB 연결 없이 `Query#cast`).
 */
const mongoose = require('mongoose');

jest.mock('../models/Tag', () => ({ find: jest.fn() }));
const Tag = require('../models/Tag');
const GeneratedImage = require('../models/GeneratedImage');
const UploadedImage = require('../models/UploadedImage');
const { buildMediaSearchOr, buildMediaListFilter, parseTagIds } = require('../utils/mediaSearchFilter');
const GeneratedVideo = require('../models/GeneratedVideo');

const userId = new mongoose.Types.ObjectId();
const tagFind = (docs) => Tag.find.mockReturnValue({ select: () => ({ lean: async () => docs }) });

beforeEach(() => jest.clearAllMocks());

describe('buildMediaSearchOr', () => {
  test('검색어가 없으면 null — 태그를 찾지도 않는다', async () => {
    expect(await buildMediaSearchOr(userId, '', { tags: true })).toBeNull();
    expect(await buildMediaSearchOr(userId, undefined, { tags: true })).toBeNull();
    expect(Tag.find).not.toHaveBeenCalled();
  });

  test('문자열이 아닌 검색어(같은 이름의 쿼리 여러 개)는 무시한다', async () => {
    expect(await buildMediaSearchOr(userId, ['a', 'b'], { tags: true })).toBeNull();
  });

  test('이름이 맞는 내 태그의 id 로 거른다 — 정규식을 tags 에 걸지 않는다', async () => {
    const tagId = new mongoose.Types.ObjectId();
    tagFind([{ _id: tagId }]);
    const or = await buildMediaSearchOr(userId, 'cat', { tags: true, prompt: true });
    expect(Tag.find).toHaveBeenCalledWith({ userId, name: { $regex: 'cat', $options: 'i' } });
    expect(or).toEqual([
      { originalName: { $regex: 'cat', $options: 'i' } },
      { tags: { $in: [tagId] } },
      { 'generationParams.prompt': { $regex: 'cat', $options: 'i' } },
    ]);
  });

  test('맞는 태그가 없으면 tags 조건을 넣지 않는다', async () => {
    tagFind([]);
    const or = await buildMediaSearchOr(userId, 'cat', { tags: true });
    expect(or).toEqual([{ originalName: { $regex: 'cat', $options: 'i' } }]);
  });

  test('정규식 기호는 글자 그대로 찾는다', async () => {
    tagFind([]);
    const or = await buildMediaSearchOr(userId, 'a(b', { tags: true });
    expect(or[0].originalName.$regex).toBe('a\\(b');
  });

  test('tags·prompt 를 켜지 않으면 이름만 찾는다', async () => {
    const or = await buildMediaSearchOr(userId, 'cat');
    expect(or).toEqual([{ originalName: { $regex: 'cat', $options: 'i' } }]);
    expect(Tag.find).not.toHaveBeenCalled();
  });
});

describe('조건이 실제 스키마의 캐스팅을 통과한다', () => {
  test.each([['GeneratedImage', GeneratedImage], ['UploadedImage', UploadedImage]])('%s', async (_name, Model) => {
    tagFind([{ _id: new mongoose.Types.ObjectId() }]);
    const or = await buildMediaSearchOr(userId, 'cat', { tags: true, prompt: true });
    expect(() => Model.find({ userId, $or: or }).cast(Model)).not.toThrow();
  });

  test('예전 조건(정규식을 tags 에)은 캐스팅에서 실패한다 — 이 테스트가 잡는 결함', () => {
    const broken = { userId, $or: [{ tags: { $in: [/cat/i] } }] };
    expect(() => GeneratedImage.find(broken).cast(GeneratedImage)).toThrow(/Cast to ObjectId failed/);
  });
});

describe('parseTagIds', () => {
  const a = String(new mongoose.Types.ObjectId());
  const b = String(new mongoose.Types.ObjectId());
  test('쉼표로 나누고 빈 조각은 버린다', () => {
    expect(parseTagIds(`${a}, ${b},, `)).toEqual({ ids: [a, b], invalid: [] });
  });
  test('id 형식이 아닌 조각은 invalid 로 돌려준다 — 12자 문자열도 id 로 치지 않는다', () => {
    expect(parseTagIds(`${a},nope,aaaaaaaaaaaa`)).toEqual({ ids: [a], invalid: ['nope', 'aaaaaaaaaaaa'] });
  });
  test.each([[''], [' , '], [undefined], [null], [['x']], [{ $ne: null }]])('%p → 태그 없음', (v) => {
    expect(parseTagIds(v)).toEqual({ ids: [], invalid: [] });
  });
});

describe('buildMediaListFilter — 목록과 일괄 삭제가 함께 쓰는 조건', () => {
  const tagId = String(new mongoose.Types.ObjectId());
  beforeEach(() => tagFind([]));

  test.each(['uploaded', 'generated', 'video', 'audio', 'uploadedVideo', 'uploadedAudio'])('%s: 조건이 없어도 userId 는 늘 들어간다', async (type) => {
    expect(await buildMediaListFilter(type, userId)).toEqual({ userId });
  });

  test('검색어와 태그는 함께(AND) 걸린다', async () => {
    const f = await buildMediaListFilter('generated', userId, { search: 'cat', tags: tagId });
    expect(f.userId).toBe(userId);
    expect(f.tags).toEqual({ $in: [tagId] });
    expect(f.$or).toHaveLength(2);
  });

  test.each([
    ['uploaded', false], ['generated', true], ['video', true], ['audio', true], ['uploadedVideo', false], ['uploadedAudio', false],
  ])('%s: 이름과 내 태그 이름으로 찾고, 프롬프트는 생성물만 (%p)', async (type, prompt) => {
    const matched = new mongoose.Types.ObjectId();
    tagFind([{ _id: matched }]);
    const f = await buildMediaListFilter(type, userId, { search: 'cat', tags: tagId });
    expect(Tag.find).toHaveBeenCalledWith({ userId, name: { $regex: 'cat', $options: 'i' } });
    expect(f.tags).toEqual({ $in: [tagId] });
    expect(f.$or).toEqual([
      { originalName: { $regex: 'cat', $options: 'i' } },
      { tags: { $in: [matched] } },
      ...(prompt ? [{ 'generationParams.prompt': { $regex: 'cat', $options: 'i' } }] : []),
    ]);
  });

  test('모르는 종류는 조건을 만들지 않고 던진다 (소유자만 걸린 넓은 조건이 나가지 않는다)', async () => {
    await expect(buildMediaListFilter('text', userId, { search: 'cat' })).rejects.toThrow('모르는 콘텐츠 종류');
  });

  test('쉼표뿐인 태그는 조건을 만들지 않는다 (빈 $in 으로 바뀌지 않는다)', async () => {
    expect(await buildMediaListFilter('uploaded', userId, { tags: ' , ' })).toEqual({ userId });
  });

  test.each([['GeneratedImage', GeneratedImage, 'generated'], ['UploadedImage', UploadedImage, 'uploaded'], ['GeneratedVideo', GeneratedVideo, 'video']])(
    '%s: 만든 조건이 실제 스키마의 캐스팅을 통과한다', async (_n, Model, type) => {
      tagFind([{ _id: new mongoose.Types.ObjectId() }]);
      const f = await buildMediaListFilter(type, userId, { search: 'cat', tags: tagId });
      expect(() => Model.find(f).cast(Model)).not.toThrow();
    });
});
