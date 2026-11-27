/**
 * 내 콘텐츠 검색 조건 (#1314).
 *
 * 미디어 문서의 `tags` 는 태그 문서의 id 배열이다. 검색어를 `tags` 에 정규식으로 그대로 걸면
 * mongoose 가 정규식을 ObjectId 로 바꾸려다 실패한다. 그래서 이름이 검색어와 맞는 내 태그의 id 를
 * 먼저 찾고, 그 id 로 거른다.
 */
const Tag = require('../models/Tag');
const { escapeRegex } = require('./escapeRegex');

/**
 * @param {*} userId
 * @param {string} search 검색어 (빈 값이면 null 을 돌려준다)
 * @param {{ tags?: boolean, prompt?: boolean }} [opts] 태그 이름 · 생성 프롬프트도 찾을지
 * @returns {Promise<object[]|null>} `$or` 에 넣을 조건 목록
 */
async function buildMediaSearchOr(userId, search, { tags = false, prompt = false } = {}) {
  if (typeof search !== 'string' || !search) return null;
  const pattern = escapeRegex(search);
  const or = [{ originalName: { $regex: pattern, $options: 'i' } }];
  if (tags) {
    const matched = await Tag.find({ userId, name: { $regex: pattern, $options: 'i' } }).select('_id').lean();
    if (matched.length) or.push({ tags: { $in: matched.map((t) => t._id) } });
  }
  if (prompt) or.push({ 'generationParams.prompt': { $regex: pattern, $options: 'i' } });
  return or;
}

module.exports = { buildMediaSearchOr };
