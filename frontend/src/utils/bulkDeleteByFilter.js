/**
 * "검색 결과 전체 삭제" 요청 만들기 (#1314).
 *
 * 휴지통이 없어 되돌릴 수 없다. 그래서 화면이 보여 준 목록과 정확히 같은 조건 · 건수로만 지운다.
 * - 목록이 아직 예전 응답을 보여 주는 중(조건을 바꾼 직후)이면 삭제를 열지 않는다
 * - 확인창을 열 때의 조건과 건수를 그대로 요청에 싣는다. 서버는 건수가 다르면 지우지 않는다
 */

/**
 * 지금 목록 상태로 "전체 삭제"를 열어도 되는지와, 열 때 고정할 조건.
 * @param {{ search?: string, tags?: string, pagination?: { total?: number }, isStale?: boolean }} listState
 *   MediaGrid 가 알려 준 상태. `tags` 는 그 목록을 받아 올 때 쓴 태그 조건, `isStale` 은 조건이 바뀌어 새 응답을 기다리는 중
 * @returns {{ search: string, tags: string, total: number } | null} 열 수 없으면 null
 */
export function snapshotForBulkDelete(listState) {
  if (!listState || listState.isStale) return null;
  const search = typeof listState.search === 'string' ? listState.search : '';
  const tags = typeof listState.tags === 'string' ? listState.tags : '';
  const total = listState.pagination?.total;
  if (!search.trim() && !tags) return null;          // 조건 없이 전체를 지우는 길은 열지 않는다
  if (!Number.isInteger(total) || total <= 0) return null;
  return { search, tags, total };
}

/** 고정해 둔 조건으로 삭제 요청 본문을 만든다 */
export function buildBulkDeleteFilters(snapshot, { deleteJob = false } = {}) {
  const filters = { deleteJob: !!deleteJob, expectedCount: snapshot.total };
  if (snapshot.search) filters.search = snapshot.search;
  if (snapshot.tags) filters.tags = snapshot.tags;
  return filters;
}
