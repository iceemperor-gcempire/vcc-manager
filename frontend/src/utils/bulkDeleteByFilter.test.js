import { describe, test, expect } from 'vitest';
import { snapshotForBulkDelete, buildBulkDeleteFilters, describeCondition } from './bulkDeleteByFilter';

const state = (over = {}) => ({ search: 'cat', tags: '', pagination: { total: 5, digest: 'abc' }, isStale: false, ...over });

describe('snapshotForBulkDelete — 전체 삭제를 열어도 되는가 (#1314)', () => {
  test('조건이 있는 목록이면 종류 · 조건 · 건수 · 목록이 준 지문을 고정한다', () => {
    expect(snapshotForBulkDelete('generated', state())).toEqual({ type: 'generated', search: 'cat', tags: '', count: 5, digest: 'abc' });
  });

  test('태그로만 좁힌 목록도 연다', () => {
    expect(snapshotForBulkDelete('video', state({ search: '', tags: 'a,b' })))
      .toEqual({ type: 'video', search: '', tags: 'a,b', count: 5, digest: 'abc' });
  });

  test.each([
    ['조건을 바꿔 새 목록을 기다리는 중', 'generated', state({ isStale: true })],
    ['조건이 없다', 'generated', state({ search: '' })],
    ['검색어가 공백뿐이다', 'generated', state({ search: '   ' })],
    ['결과가 0건', 'generated', state({ pagination: { total: 0, digest: 'abc' } })],
    ['건수를 모른다', 'generated', state({ pagination: { digest: 'abc' } })],
    ['건수가 숫자가 아니다', 'generated', state({ pagination: { total: '5', digest: 'abc' } })],
    ['목록이 대상 지문을 주지 않았다', 'generated', state({ pagination: { total: 5 } })],
    ['지문이 문자열이 아니다', 'generated', state({ pagination: { total: 5, digest: 5 } })],
    ['상태가 없다', 'generated', undefined],
    ['일괄 삭제가 없는 종류 (음악)', 'audio', state()],
    ['일괄 삭제가 없는 종류 (업로드 음악)', 'uploadedAudio', state()],
  ])('%s → 열지 않는다', (_n, type, s) => {
    expect(snapshotForBulkDelete(type, s)).toBeNull();
  });
});

describe('buildBulkDeleteFilters — 고정한 대상 그대로 보낸다', () => {
  const snap = { type: 'generated', search: 'cat', tags: 'a,b', count: 5, digest: 'abc' };
  test('조건과 지문을 싣는다 — 종류 · 건수는 본문에 넣지 않는다', () => {
    expect(buildBulkDeleteFilters(snap, { deleteJob: true }))
      .toEqual({ search: 'cat', tags: 'a,b', deleteJob: true, expectedDigest: 'abc' });
  });
  test('빈 조건은 싣지 않는다', () => {
    expect(buildBulkDeleteFilters({ ...snap, search: '' })).toEqual({ tags: 'a,b', deleteJob: false, expectedDigest: 'abc' });
    expect(buildBulkDeleteFilters({ ...snap, tags: '' })).toEqual({ search: 'cat', deleteJob: false, expectedDigest: 'abc' });
  });
  test.each([[undefined, false], [false, false], ['false', false], ['true', false], [1, false], [true, true]])(
    'deleteJob %p → %p (참일 때만 켠다)', (given, sent) => {
      expect(buildBulkDeleteFilters(snap, { deleteJob: given }).deleteJob).toBe(sent);
    });
});

describe('describeCondition — 서버가 적용하는 조건을 그대로 적는다', () => {
  test('검색어와 태그 이름', () => {
    expect(describeCondition({ search: 'cat', tags: 'a' }, { a: '풍경' })).toBe('검색어 "cat" · 태그 "풍경"');
  });
  test('태그가 여러 개면 하나라도 붙은 것이 대상임을 밝힌다', () => {
    expect(describeCondition({ search: '', tags: 'a,b' }, { a: '풍경', b: '인물' })).toBe('태그 "풍경", "인물" 중 하나라도 붙은 것');
  });
  test('이름을 모르는 태그가 있으면 개수로 적는다', () => {
    expect(describeCondition({ search: '', tags: 'a,b' }, { a: '풍경' })).toBe('태그 2개 중 하나라도 붙은 것');
    expect(describeCondition({ search: '', tags: 'a' })).toBe('태그 1개');
  });
  test('공백뿐인 검색어도 조건이므로 그대로 보인다', () => {
    expect(describeCondition({ search: '  ', tags: 'a' }, { a: '풍경' })).toBe('검색어 "  " · 태그 "풍경"');
  });
  test('조건이 없으면 빈 문자열', () => {
    expect(describeCondition(null)).toBe('');
  });
});
