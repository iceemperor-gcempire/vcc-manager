import { describe, test, expect } from 'vitest';
import { snapshotForBulkDelete, buildBulkDeleteFilters } from './bulkDeleteByFilter';

const state = (over = {}) => ({ search: 'cat', tags: '', pagination: { total: 5 }, isStale: false, ...over });

describe('snapshotForBulkDelete — 전체 삭제를 열어도 되는가 (#1314)', () => {
  test('검색 결과가 있으면 조건과 건수를 고정한다', () => {
    expect(snapshotForBulkDelete(state())).toEqual({ search: 'cat', tags: '', total: 5 });
  });

  test('태그로만 좁힌 목록도 연다', () => {
    expect(snapshotForBulkDelete(state({ search: '', tags: 'a,b' }))).toEqual({ search: '', tags: 'a,b', total: 5 });
  });

  test('검색어와 태그를 함께 고정한다', () => {
    expect(snapshotForBulkDelete(state({ tags: 'a' }))).toEqual({ search: 'cat', tags: 'a', total: 5 });
  });

  test.each([
    ['조건을 바꿔 새 목록을 기다리는 중', state({ isStale: true })],
    ['조건이 없다', state({ search: '' })],
    ['검색어가 공백뿐이다', state({ search: '   ' })],
    ['결과가 0건', state({ pagination: { total: 0 } })],
    ['건수를 모른다', state({ pagination: {} })],
    ['건수가 숫자가 아니다', state({ pagination: { total: '5' } })],
    ['상태가 없다', undefined],
  ])('%s → 열지 않는다', (_n, s) => {
    expect(snapshotForBulkDelete(s)).toBeNull();
  });
});

describe('buildBulkDeleteFilters — 고정한 조건 그대로 보낸다', () => {
  test('검색어 · 태그 · 건수를 모두 싣는다', () => {
    expect(buildBulkDeleteFilters({ search: 'cat', tags: 'a,b', total: 5 }, { deleteJob: true }))
      .toEqual({ deleteJob: true, expectedCount: 5, search: 'cat', tags: 'a,b' });
  });

  test('deleteJob 은 늘 불리언이다', () => {
    expect(buildBulkDeleteFilters({ search: 'cat', tags: '', total: 1 }).deleteJob).toBe(false);
    expect(buildBulkDeleteFilters({ search: 'cat', tags: '', total: 1 }, { deleteJob: 'false' }).deleteJob).toBe(true);
    expect(buildBulkDeleteFilters({ search: 'cat', tags: '', total: 1 }, { deleteJob: undefined }).deleteJob).toBe(false);
  });

  test('나중에 화면의 검색어가 바뀌어도 고정한 값이 나간다', () => {
    const snap = snapshotForBulkDelete(state({ search: 'cat', tags: 'a' }));
    // 확인창이 떠 있는 동안 화면 상태가 바뀌었다고 치자 — 요청은 snap 으로만 만든다
    expect(buildBulkDeleteFilters(snap)).toEqual({ deleteJob: false, expectedCount: 5, search: 'cat', tags: 'a' });
  });
});
