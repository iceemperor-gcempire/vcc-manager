/**
 * 계속하기 작업판 검증 (#808)
 *
 * JobHistoryPanel 과 pages/JobHistory 가 같은 검증을 각자 하고 있었고, 문구와 순서가
 * 미묘하게 달랐다. 훅으로 합치면서 판정 규칙을 여기 고정한다.
 */
import { extractWorkboardId, checkWorkboardUsable } from './useContinueJob';

const VALID = '6a7c42b40a94566eb3c3e842';

describe('작업판 ID 추출 (#808)', () => {
  test('문자열 그대로', () => {
    expect(extractWorkboardId({ workboardId: VALID })).toBe(VALID);
  });

  test('populate 된 객체는 _id 또는 id', () => {
    expect(extractWorkboardId({ workboardId: { _id: VALID } })).toBe(VALID);
    expect(extractWorkboardId({ workboardId: { id: VALID } })).toBe(VALID);
  });

  test('없으면 null', () => {
    expect(extractWorkboardId({})).toBeNull();
    expect(extractWorkboardId(null)).toBeNull();
  });
});

describe('작업판 사용 가능 판정 (#808)', () => {
  const active = { _id: VALID, isActive: true };

  test('활성 작업판이면 통과', () => {
    expect(checkWorkboardUsable(VALID, active)).toEqual({ ok: true });
  });

  test.each([
    ['id 없음', null, active, 'missingId'],
    ['문자열 "undefined"', 'undefined', active, 'missingId'],
    ['문자열 "null"', 'null', active, 'missingId'],
    ['ObjectId 형식 아님', 'not-an-id', active, 'invalidId'],
    ['작업판 없음', VALID, null, 'notFound'],
    ['비활성 작업판', VALID, { _id: VALID, isActive: false }, 'inactive'],
  ])('%s → 거부', (_label, id, wb, reason) => {
    const v = checkWorkboardUsable(id, wb);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe(reason);
    expect(v.message).toMatch(/작업판 선택 페이지로 이동/);
  });

  test('거부 사유마다 문구가 다르다 — 사용자가 원인을 구분할 수 있어야 한다', () => {
    const messages = [
      checkWorkboardUsable(null, active).message,
      checkWorkboardUsable('bad', active).message,
      checkWorkboardUsable(VALID, null).message,
      checkWorkboardUsable(VALID, { isActive: false }).message,
    ];
    expect(new Set(messages).size).toBe(messages.length);
  });
});
