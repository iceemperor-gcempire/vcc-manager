/**
 * "조건에 맞는 것 전체 삭제" 요청 만들기 (#1314).
 *
 * 휴지통이 없어 되돌릴 수 없다. 그래서 화면이 본 목록과 정확히 같은 대상만 지운다.
 * - 조건(검색어 · 태그)이 있는 목록 응답에는 "이 조건에 맞는 전체"의 지문(pagination.digest)이 온다
 * - 확인창을 열 때 종류 · 조건 · 건수 · 그 지문을 고정하고, 삭제 요청은 그것으로만 만든다
 * - 서버는 지금 대상의 지문이 다르면(한 건이라도 빠지거나 들어왔으면) 지우지 않는다
 * - 목록이 아직 예전 응답을 보여 주는 중(조건을 바꾼 직후)이면 삭제를 열지 않는다
 */

/** 서버의 일괄 삭제가 받는 종류 (`POST /api/images/bulk-delete*`) */
export const BULK_DELETE_TYPES = ['uploaded', 'generated', 'video'];

/**
 * 지금 목록 상태로 "전체 삭제"를 열어도 되는지와, 열 때 고정할 대상.
 * @param {string} type 지금 탭의 콘텐츠 종류
 * @param {{ search?: string, tags?: string, pagination?: { total?: number, digest?: string }, isStale?: boolean }} listState
 *   MediaGrid 가 알려 준 상태. `tags` 는 그 목록을 받아 올 때 쓴 태그 조건, `isStale` 은 조건이 바뀌어 새 응답을 기다리는 중
 * @returns {{ type: string, search: string, tags: string, count: number, digest: string } | null} 열 수 없으면 null
 */
export function snapshotForBulkDelete(type, listState) {
  if (!BULK_DELETE_TYPES.includes(type)) return null;
  if (!listState || listState.isStale) return null;
  const search = typeof listState.search === 'string' ? listState.search : '';
  const tags = typeof listState.tags === 'string' ? listState.tags : '';
  const count = listState.pagination?.total;
  const digest = listState.pagination?.digest;
  if (!search.trim() && !tags) return null;                 // 조건 없이 전체를 지우는 길은 열지 않는다
  if (!Number.isInteger(count) || count <= 0) return null;
  if (typeof digest !== 'string' || !digest) return null;   // 목록이 대상 지문을 주지 않았으면 지울 대상을 모른다
  return { type, search, tags, count, digest };
}

/** 고정해 둔 대상으로 삭제 요청 본문을 만든다 — 화면의 지금 상태는 읽지 않는다 */
export function buildBulkDeleteFilters(snapshot, { deleteJob = false } = {}) {
  const body = { deleteJob: deleteJob === true, expectedDigest: snapshot.digest };
  if (snapshot.search) body.search = snapshot.search;
  if (snapshot.tags) body.tags = snapshot.tags;
  return body;
}

/** 확인창에 적을 조건 설명 */
export function describeCondition(condition) {
  if (!condition) return '';
  const parts = [];
  if (condition.search.trim()) parts.push(`검색어 "${condition.search}"`);
  if (condition.tags) parts.push(`태그 ${condition.tags.split(',').length}개`);
  return parts.join(' · ');
}
