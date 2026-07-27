const migration = require('../migrations/repairDanglingGroupRefs');
const { computeRepairedGroupIds, computeRepairedUserGroupIds } = migration;

const DEFAULT = 'default000000000000000d';
const VALID_A = 'aaaa00000000000000000a';
const VALID_B = 'bbbb00000000000000000b';
const GONE_1 = 'dead00000000000000001d';
const GONE_2 = 'dead00000000000000002d';

const validIds = new Set([DEFAULT, VALID_A, VALID_B]);

describe('repairDanglingGroupRefs — computeRepairedGroupIds (#740)', () => {
  test('마이그레이션 함수 export', () => {
    expect(typeof migration).toBe('function');
  });

  describe('복구 불필요 (멱등)', () => {
    test('모든 참조가 유효하면 null', () => {
      expect(computeRepairedGroupIds([VALID_A, VALID_B], validIds, DEFAULT)).toBeNull();
    });

    test('기본 그룹만 있어도 null', () => {
      expect(computeRepairedGroupIds([DEFAULT], validIds, DEFAULT)).toBeNull();
    });

    test('빈 배열 (admin 전용) 은 건드리지 않는다', () => {
      expect(computeRepairedGroupIds([], validIds, DEFAULT)).toBeNull();
    });
  });

  describe('dangling 참조 복구', () => {
    test('dangling 단독 → 기본 그룹으로 치환', () => {
      const r = computeRepairedGroupIds([GONE_1], validIds, DEFAULT);
      expect(r.dangling).toEqual([GONE_1]);
      expect(r.next).toEqual([DEFAULT]);
    });

    test('유효 참조는 보존하고 기본 그룹을 추가', () => {
      const r = computeRepairedGroupIds([VALID_A, GONE_1], validIds, DEFAULT);
      expect(r.dangling).toEqual([GONE_1]);
      expect(r.next).toEqual([VALID_A, DEFAULT]);
    });

    test('dangling 여러 개여도 기본 그룹 하나로 합쳐진다', () => {
      const r = computeRepairedGroupIds([GONE_1, GONE_2], validIds, DEFAULT);
      expect(r.dangling).toEqual([GONE_1, GONE_2]);
      expect(r.next).toEqual([DEFAULT]);
    });

    test('이미 기본 그룹을 가진 경우 중복 추가하지 않는다', () => {
      const r = computeRepairedGroupIds([DEFAULT, GONE_1], validIds, DEFAULT);
      expect(r.next).toEqual([DEFAULT]);
    });

    test('복구 결과는 항상 비어있지 않다 — 접근이 admin 전용으로 좁혀지지 않음', () => {
      for (const input of [[GONE_1], [GONE_1, GONE_2], [VALID_B, GONE_1]]) {
        const r = computeRepairedGroupIds(input, validIds, DEFAULT);
        expect(r.next.length).toBeGreaterThan(0);
      }
    });
  });

  test('복구 후 재실행하면 null (멱등)', () => {
    const first = computeRepairedGroupIds([VALID_A, GONE_1], validIds, DEFAULT);
    expect(computeRepairedGroupIds(first.next, validIds, DEFAULT)).toBeNull();
  });
});

describe('repairDanglingGroupRefs — computeRepairedUserGroupIds (#743)', () => {
  describe('복구 불필요 (멱등)', () => {
    test('모든 참조가 유효하면 null', () => {
      expect(computeRepairedUserGroupIds([DEFAULT, VALID_A], validIds, DEFAULT)).toBeNull();
    });

    test('빈 배열은 건드리지 않는다', () => {
      expect(computeRepairedUserGroupIds([], validIds, DEFAULT)).toBeNull();
    });
  });

  describe('dangling 참조 정리', () => {
    test('기본 그룹을 함께 가진 경우 dangling 만 제거 — 소속 변화 없음', () => {
      const r = computeRepairedUserGroupIds([DEFAULT, GONE_1], validIds, DEFAULT);
      expect(r.dangling).toEqual([GONE_1]);
      expect(r.next).toEqual([DEFAULT]);
    });

    test('유효 그룹이 기본이 아니어도 그대로 보존 — 기본 그룹을 덧붙이지 않는다', () => {
      const r = computeRepairedUserGroupIds([VALID_A, VALID_B, GONE_1], validIds, DEFAULT);
      expect(r.next).toEqual([VALID_A, VALID_B]);
      expect(r.next).not.toContain(DEFAULT);
    });

    test('전부 dangling 이면 무소속 대신 기본 그룹 부여', () => {
      const r = computeRepairedUserGroupIds([GONE_1, GONE_2], validIds, DEFAULT);
      expect(r.dangling).toEqual([GONE_1, GONE_2]);
      expect(r.next).toEqual([DEFAULT]);
    });

    test('결과는 항상 비어있지 않다 — 무소속이 되지 않음', () => {
      for (const input of [[GONE_1], [GONE_1, GONE_2], [VALID_B, GONE_1]]) {
        expect(computeRepairedUserGroupIds(input, validIds, DEFAULT).next.length).toBeGreaterThan(0);
      }
    });
  });

  test('정리 후 재실행하면 null (멱등)', () => {
    const first = computeRepairedUserGroupIds([DEFAULT, GONE_1], validIds, DEFAULT);
    expect(computeRepairedUserGroupIds(first.next, validIds, DEFAULT)).toBeNull();
  });

  test('작업판 규칙과 달리 기본 그룹을 강제 추가하지 않는다', () => {
    const wb = computeRepairedGroupIds([VALID_A, GONE_1], validIds, DEFAULT);
    const user = computeRepairedUserGroupIds([VALID_A, GONE_1], validIds, DEFAULT);
    expect(wb.next).toContain(DEFAULT);
    expect(user.next).not.toContain(DEFAULT);
  });
});
