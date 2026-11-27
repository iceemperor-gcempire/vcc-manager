/**
 * "조건에 맞는 것 전체 삭제" 요청 만들기 (#1314).
 *
 * 휴지통이 없어 되돌릴 수 없다. 그래서 화면이 확인한 대상과 정확히 같은 것만 지운다.
 * - 목록이 아직 예전 응답을 보여 주는 중(조건을 바꾼 직후)이면 삭제를 열지 않는다
 * - 확인창을 열 때 종류 · 조건을 고정하고, 서버에 그 조건의 대상(건수 · 지문)을 물어 확인창에 보여 준다
 * - 삭제 요청에는 고정한 종류 · 조건과 그 지문을 싣는다. 서버는 지금 대상의 지문이 다르면 지우지 않는다
 */

/** 서버의 일괄 삭제가 받는 종류 (`POST /api/images/bulk-delete*`) */
export const BULK_DELETE_TYPES = ['uploaded', 'generated', 'video'];

/**
 * 지금 목록 상태로 "전체 삭제"를 열어도 되는지와, 열 때 고정할 종류 · 조건.
 * @param {string} type 지금 탭의 콘텐츠 종류
 * @param {{ search?: string, tags?: string, pagination?: { total?: number }, isStale?: boolean }} listState
 *   MediaGrid 가 알려 준 상태. `tags` 는 그 목록을 받아 올 때 쓴 태그 조건, `isStale` 은 조건이 바뀌어 새 응답을 기다리는 중
 * @returns {{ type: string, search: string, tags: string } | null} 열 수 없으면 null
 */
export function conditionForBulkDelete(type, listState) {
  if (!BULK_DELETE_TYPES.includes(type)) return null;
  if (!listState || listState.isStale) return null;
  const search = typeof listState.search === 'string' ? listState.search : '';
  const tags = typeof listState.tags === 'string' ? listState.tags : '';
  const total = listState.pagination?.total;
  if (!search.trim() && !tags) return null;          // 조건 없이 전체를 지우는 길은 열지 않는다
  if (!Number.isInteger(total) || total <= 0) return null;
  return { type, search, tags };
}

/** 두 조건이 같은가 — 대상 확인을 기다리는 사이 화면이 바뀌었는지 볼 때 쓴다 */
export function sameCondition(a, b) {
  return !!a && !!b && a.type === b.type && a.search === b.search && a.tags === b.tags;
}

/** 고정한 조건으로 서버에 보낼 조건 본문 (확인 · 삭제 공통) */
export function conditionBody(condition) {
  const body = {};
  if (condition.search) body.search = condition.search;
  if (condition.tags) body.tags = condition.tags;
  return body;
}

/**
 * 서버가 돌려준 대상 확인 결과를 고정한 조건에 붙인다.
 * @param {{ listedTotal?: number }} [opts] 화면 목록이 보여 준 건수
 * @returns {{ type, search, tags, count: number, digest: string } | null} 응답이 이상하거나 목록과 건수가 다르면 null (삭제를 열지 않는다)
 */
export function snapshotFromPreview(condition, preview, { listedTotal } = {}) {
  const count = preview?.count;
  const digest = preview?.digest;
  if (!Number.isInteger(count) || count <= 0) return null;
  if (typeof digest !== 'string' || !digest) return null;
  // 화면 목록의 건수와 다르면 그 사이 목록이 바뀐 것이다 — 화면에 보인 것과 다른 대상을 열지 않는다
  if (listedTotal !== undefined && count !== listedTotal) return null;
  return { ...condition, count, digest };
}

/** 고정해 둔 대상으로 삭제 요청 본문을 만든다 — 화면의 지금 상태는 읽지 않는다 */
export function buildBulkDeleteFilters(snapshot, { deleteJob = false } = {}) {
  return { ...conditionBody(snapshot), deleteJob: deleteJob === true, expectedDigest: snapshot.digest };
}

/** 확인창에 적을 조건 설명 */
export function describeCondition(condition) {
  if (!condition) return '';
  const parts = [];
  if (condition.search.trim()) parts.push(`검색어 "${condition.search}"`);
  if (condition.tags) parts.push(`태그 ${condition.tags.split(',').length}개`);
  return parts.join(' · ');
}
