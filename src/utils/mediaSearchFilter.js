/**
 * 내 콘텐츠 목록 · 일괄 삭제가 함께 쓰는 조건 (#1314).
 *
 * 목록과 "검색 결과 전체 삭제"가 조건을 따로 만들면 화면에 보인 것과 지워지는 것이 어긋난다.
 * 그래서 둘 다 `buildMediaListFilter` 하나로 조건을 만든다.
 *
 * 미디어 문서의 `tags` 는 태그 문서의 id 배열이다. 검색어를 `tags` 에 정규식으로 그대로 걸면
 * mongoose 가 정규식을 ObjectId 로 바꾸려다 실패한다. 이름이 검색어와 맞는 내 태그의 id 를
 * 먼저 찾고, 그 id 로 거른다.
 */
const crypto = require('crypto');
const Tag = require('../models/Tag');
const { escapeRegex } = require('./escapeRegex');

/**
 * 종류마다 검색어가 닿는 곳. 이름은 늘 찾고, 내 태그 이름은 전부, 프롬프트는 생성물만.
 * 종류를 새로 넣으면 여기에 넣는다 — 목록 라우트가 이 표로 조건을 만든다 (#1321)
 */
const SEARCH_SCOPE = {
  uploaded: { tags: true },
  generated: { tags: true, prompt: true },
  video: { tags: true, prompt: true },
  audio: { tags: true, prompt: true },
  uploadedVideo: { tags: true },
  uploadedAudio: { tags: true },
};
/** 일괄 삭제(`POST /api/images/bulk-delete*`)가 받는 종류 — 목록 종류보다 좁다 */
const MEDIA_TYPES = ['uploaded', 'generated', 'video'];

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

/**
 * 쉼표로 이은 태그 id 문자열을 나눈다.
 * @returns {{ ids: string[], invalid: string[] }} `invalid` 는 id 형식이 아닌 조각
 */
function parseTagIds(tags) {
  if (typeof tags !== 'string') return { ids: [], invalid: [] };
  const parts = tags.split(',').map((t) => t.trim()).filter(Boolean);
  const ids = parts.filter(isObjectIdString).map((t) => t.toLowerCase());
  return { ids, invalid: parts.filter((t) => !isObjectIdString(t)) };
}

/** 24자 16진 문자열인가 — 12자 문자열 · 객체 · 숫자는 id 로 치지 않는다 */
function isObjectIdString(v) {
  return typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
}

/**
 * 삭제 대상 집합의 지문. 확인창이 본 대상과 지우려는 대상이 같은지 견준다 —
 * 건수만 견주면 그 사이 한 건이 빠지고 다른 한 건이 들어온 것을 놓친다.
 * @param {Array<{_id: *}>} docs
 */
function digestOfIds(docs) {
  const ids = docs.map((d) => String(d._id)).sort();
  return crypto.createHash('sha256').update(ids.join(',')).digest('hex');
}

/**
 * 목록 · 일괄 삭제 요청의 search · tags 형식 검사. 형식이 틀린 값을 "조건 없음"으로 읽지 않는다.
 * @returns {string|null} 틀렸으면 사유
 */
function validateListCondition({ search, tags }) {
  if (search !== undefined && typeof search !== 'string') return 'search 는 문자열이어야 합니다';
  if (tags !== undefined && typeof tags !== 'string') return 'tags 는 쉼표로 이은 문자열이어야 합니다';
  if (parseTagIds(tags).invalid.length) return 'tags 에 id 형식이 아닌 값이 있습니다';
  return null;
}

/**
 * 목록과 일괄 삭제가 함께 쓰는 조건.
 * @param {keyof SEARCH_SCOPE} type
 * @param {*} userId 늘 조건에 들어간다
 * @param {{ search?: string, tags?: string }} [cond]
 */
async function buildMediaListFilter(type, userId, { search = '', tags = '' } = {}) {
  if (!SEARCH_SCOPE[type]) throw new Error(`모르는 콘텐츠 종류: ${type}`);
  const filter = { userId };
  const or = await buildMediaSearchOr(userId, search, SEARCH_SCOPE[type]);
  if (or) filter.$or = or;
  const { ids } = parseTagIds(tags);
  if (ids.length) filter.tags = { $in: ids };
  return filter;
}

module.exports = {
  buildMediaSearchOr, buildMediaListFilter, parseTagIds, isObjectIdString, digestOfIds, validateListCondition, MEDIA_TYPES,
};
