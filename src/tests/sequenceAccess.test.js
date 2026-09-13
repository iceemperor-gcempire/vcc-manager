/**
 * 작업 절차 접근 판정 (#952) — 작업판과 같은 그룹 축, 비활성은 admin 만.
 */
const {
  userHasSequenceAccess,
  buildSequenceAccessFilter,
  userHasWorkboardAccess,
} = require('../middleware/auth');

const admin = { _id: 'admin', isAdmin: true, groupIds: [] };
const member = { _id: 'u1', isAdmin: false, groupIds: ['g1'] };
const stranger = { _id: 'u2', isAdmin: false, groupIds: ['g9'] };
const loner = { _id: 'u3', isAdmin: false, groupIds: [] };

describe('userHasSequenceAccess', () => {
  const open = { allowedGroupIds: ['g1'], isActive: true };

  test('그룹 교집합이 있으면 허용, 없으면 거부', () => {
    expect(userHasSequenceAccess(member, open)).toBe(true);
    expect(userHasSequenceAccess(stranger, open)).toBe(false);
    expect(userHasSequenceAccess(loner, open)).toBe(false);
  });

  test('빈 allowedGroupIds 는 admin 전용', () => {
    const adminOnly = { allowedGroupIds: [], isActive: true };
    expect(userHasSequenceAccess(member, adminOnly)).toBe(false);
    expect(userHasSequenceAccess(admin, adminOnly)).toBe(true);
  });

  test('비활성은 그룹이 맞아도 거부, admin 은 허용', () => {
    const inactive = { allowedGroupIds: ['g1'], isActive: false };
    expect(userHasSequenceAccess(member, inactive)).toBe(false);
    expect(userHasSequenceAccess(admin, inactive)).toBe(true);
  });

  test('ObjectId 처럼 문자열화되는 값도 비교', () => {
    const oid = { toString: () => 'g1' };
    expect(userHasSequenceAccess({ groupIds: [oid] }, { allowedGroupIds: [{ toString: () => 'g1' }] })).toBe(true);
  });

  test('user·sequence 누락 → 거부', () => {
    expect(userHasSequenceAccess(null, open)).toBe(false);
    expect(userHasSequenceAccess(member, null)).toBe(false);
  });

  test('작업 절차 접근이 작업판 접근을 열지 않는다 (#802) — 판정은 서로 독립', () => {
    const sequence = { allowedGroupIds: ['g1'], isActive: true };
    const workboard = { allowedGroupIds: ['g2'] };
    expect(userHasSequenceAccess(member, sequence)).toBe(true);
    expect(userHasWorkboardAccess(member, workboard)).toBe(false);
  });
});

describe('buildSequenceAccessFilter', () => {
  test('admin 은 조건 없음 (비활성 포함)', () => {
    expect(buildSequenceAccessFilter(admin)).toEqual({});
  });

  test('일반 사용자는 활성 + 그룹 교집합', () => {
    expect(buildSequenceAccessFilter(member)).toEqual({ isActive: true, allowedGroupIds: { $in: ['g1'] } });
  });

  test('그룹 없음·비로그인 → 전부 차단', () => {
    expect(buildSequenceAccessFilter(loner)).toEqual({ _id: null });
    expect(buildSequenceAccessFilter(null)).toEqual({ _id: null });
  });
});
