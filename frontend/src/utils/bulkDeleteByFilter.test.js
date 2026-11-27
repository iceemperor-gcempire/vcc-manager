import { describe, test, expect } from 'vitest';
import {
  conditionForBulkDelete, conditionBody, sameCondition, snapshotFromPreview, buildBulkDeleteFilters, describeCondition,
} from './bulkDeleteByFilter';

const state = (over = {}) => ({ search: 'cat', tags: '', pagination: { total: 5 }, isStale: false, ...over });

describe('conditionForBulkDelete — 전체 삭제를 열어도 되는가 (#1314)', () => {
  test('검색 결과가 있으면 종류와 조건을 고정한다', () => {
    expect(conditionForBulkDelete('generated', state())).toEqual({ type: 'generated', search: 'cat', tags: '' });
  });

  test('태그로만 좁힌 목록도 연다', () => {
    expect(conditionForBulkDelete('video', state({ search: '', tags: 'a,b' }))).toEqual({ type: 'video', search: '', tags: 'a,b' });
  });

  test.each([
    ['조건을 바꿔 새 목록을 기다리는 중', 'generated', state({ isStale: true })],
    ['조건이 없다', 'generated', state({ search: '' })],
    ['검색어가 공백뿐이다', 'generated', state({ search: '   ' })],
    ['결과가 0건', 'generated', state({ pagination: { total: 0 } })],
    ['건수를 모른다', 'generated', state({ pagination: {} })],
    ['건수가 숫자가 아니다', 'generated', state({ pagination: { total: '5' } })],
    ['상태가 없다', 'generated', undefined],
    ['일괄 삭제가 없는 종류 (음악)', 'audio', state()],
    ['일괄 삭제가 없는 종류 (업로드 음악)', 'uploadedAudio', state()],
  ])('%s → 열지 않는다', (_n, type, s) => {
    expect(conditionForBulkDelete(type, s)).toBeNull();
  });
});

describe('snapshotFromPreview — 서버가 확인해 준 대상만 연다', () => {
  const cond = { type: 'generated', search: 'cat', tags: 'a' };
  test('건수와 지문을 조건에 붙인다', () => {
    expect(snapshotFromPreview(cond, { count: 3, digest: 'abc' })).toEqual({ ...cond, count: 3, digest: 'abc' });
  });
  test.each([
    ['대상이 0건', { count: 0, digest: 'abc' }],
    ['지문이 없다', { count: 3 }],
    ['건수가 없다', { digest: 'abc' }],
    ['응답이 없다', undefined],
  ])('%s → 열지 않는다', (_n, preview) => {
    expect(snapshotFromPreview(cond, preview)).toBeNull();
  });
});

describe('snapshotFromPreview — 화면 목록의 건수와 견준다', () => {
  const cond = { type: 'generated', search: 'cat', tags: '' };
  test('건수가 같으면 연다', () => {
    expect(snapshotFromPreview(cond, { count: 3, digest: 'abc' }, { listedTotal: 3 })).toEqual({ ...cond, count: 3, digest: 'abc' });
  });
  test.each([[2], [4], [0]])('목록은 %p건이라고 보여 줬는데 대상은 3건 → 열지 않는다', (listedTotal) => {
    expect(snapshotFromPreview(cond, { count: 3, digest: 'abc' }, { listedTotal })).toBeNull();
  });
});

describe('sameCondition', () => {
  const a = { type: 'generated', search: 'cat', tags: 'x' };
  test('종류 · 검색어 · 태그가 모두 같아야 같다', () => {
    expect(sameCondition(a, { ...a })).toBe(true);
    expect(sameCondition(a, { ...a, type: 'video' })).toBe(false);
    expect(sameCondition(a, { ...a, search: 'ca' })).toBe(false);
    expect(sameCondition(a, { ...a, tags: '' })).toBe(false);
    expect(sameCondition(a, null)).toBe(false);
    expect(sameCondition(null, null)).toBe(false);
  });
});

describe('buildBulkDeleteFilters — 고정한 대상 그대로 보낸다', () => {
  const snap = { type: 'generated', search: 'cat', tags: 'a,b', count: 5, digest: 'abc' };
  test('조건과 지문을 싣는다 — 종류 · 건수는 본문 조건에 넣지 않는다', () => {
    expect(buildBulkDeleteFilters(snap, { deleteJob: true }))
      .toEqual({ search: 'cat', tags: 'a,b', deleteJob: true, expectedDigest: 'abc' });
  });
  test('빈 조건은 싣지 않는다', () => {
    expect(conditionBody({ type: 'video', search: '', tags: 'a' })).toEqual({ tags: 'a' });
    expect(conditionBody({ type: 'video', search: 'cat', tags: '' })).toEqual({ search: 'cat' });
  });
  test.each([[undefined, false], [false, false], ['false', false], ['true', false], [1, false], [true, true]])(
    'deleteJob %p → %p (참일 때만 켠다)', (given, sent) => {
      expect(buildBulkDeleteFilters(snap, { deleteJob: given }).deleteJob).toBe(sent);
    });
});

describe('describeCondition', () => {
  test('조건을 그대로 적는다', () => {
    expect(describeCondition({ search: 'cat', tags: 'a,b' })).toBe('검색어 "cat" · 태그 2개');
    expect(describeCondition({ search: '', tags: 'a' })).toBe('태그 1개');
    expect(describeCondition(null)).toBe('');
  });
});
