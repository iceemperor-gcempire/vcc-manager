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
const { buildMediaSearchOr } = require('../utils/mediaSearchFilter');

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
