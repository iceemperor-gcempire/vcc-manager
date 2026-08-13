/**
 * 프로젝트 그룹 접근 + 작업판 접근 우회 방지 (#802)
 *
 * 실제로 뚫렸던 경로를 가드한다 — 권한 없는 작업판을 프로젝트에 붙인 뒤
 * 파이프라인으로 실행하면 통과했다. 세 관문(붙이기 / 저장 / 실행) 중 하나라도
 * 열리면 우회가 되살아나므로 판정 함수 단위로 고정해 둔다.
 */
const {
  userHasProjectAccess,
  userCanManageProject,
  buildProjectAccessFilter,
  buildProjectManageFilter,
  userHasWorkboardAccess,
} = require('../middleware/auth');

const admin = { _id: 'admin', isAdmin: true, groupIds: [] };
const owner = { _id: 'u1', isAdmin: false, groupIds: ['g1'] };
const member = { _id: 'u2', isAdmin: false, groupIds: ['g1'] };
const stranger = { _id: 'u3', isAdmin: false, groupIds: ['g9'] };

const personal = { userId: 'u1', allowedGroupIds: [] };
const shared = { userId: 'u1', allowedGroupIds: ['g1'] };

describe('프로젝트 접근 (#802)', () => {
  test('빈 allowedGroupIds 는 개인 전용 — 소유자와 admin 만', () => {
    expect(userHasProjectAccess(owner, personal)).toBe(true);
    expect(userHasProjectAccess(admin, personal)).toBe(true);
    expect(userHasProjectAccess(member, personal)).toBe(false);
  });

  test('작업판과 규칙이 반대다 — 작업판의 빈 배열은 admin 전용, 프로젝트는 소유자 전용', () => {
    // 같은 빈 배열이지만 소유자가 있는 프로젝트는 소유자가 접근 가능해야 한다
    expect(userHasProjectAccess(owner, personal)).toBe(true);
    expect(userHasWorkboardAccess(owner, { allowedGroupIds: [] })).toBe(false);
  });

  test('그룹 공유 — 같은 그룹 멤버는 접근, 다른 그룹은 차단', () => {
    expect(userHasProjectAccess(member, shared)).toBe(true);
    expect(userHasProjectAccess(stranger, shared)).toBe(false);
  });

  test('공유는 읽기 + 실행까지 — 멤버는 편집/삭제/내보내기 불가', () => {
    expect(userHasProjectAccess(member, shared)).toBe(true);
    expect(userCanManageProject(member, shared)).toBe(false);
    expect(userCanManageProject(owner, shared)).toBe(true);
    expect(userCanManageProject(admin, shared)).toBe(true);
  });
});

describe('프로젝트 조회 필터 (#802)', () => {
  test('접근 필터는 내 것 + 내 그룹에 열린 것', () => {
    expect(buildProjectAccessFilter(member)).toEqual({
      $or: [{ userId: 'u2' }, { allowedGroupIds: { $in: ['g1'] } }],
    });
  });

  test('그룹이 없으면 내 것만', () => {
    const solo = { _id: 'u4', isAdmin: false, groupIds: [] };
    expect(buildProjectAccessFilter(solo)).toEqual({ $or: [{ userId: 'u4' }] });
  });

  test('관리 필터는 공유 그룹을 포함하지 않는다 — 소유자만', () => {
    expect(buildProjectManageFilter(member)).toEqual({ userId: 'u2' });
    expect(buildProjectManageFilter(admin)).toEqual({});
  });

  test('admin 은 전체', () => {
    expect(buildProjectAccessFilter(admin)).toEqual({});
  });

  test('비로그인은 차단', () => {
    expect(buildProjectAccessFilter(null)).toEqual({ _id: null });
    expect(buildProjectManageFilter(null)).toEqual({ _id: null });
  });
});

describe('프로젝트 공유가 작업판 접근을 열어주지 않는다 (#802 핵심)', () => {
  // 우회의 본질은 "프로젝트를 통과했으니 작업판도 통과" 였다.
  // 두 판정은 독립이어야 한다.
  const adminOnlyWb = { name: 'admin 전용', allowedGroupIds: [] };
  const groupWb = { name: '그룹 공개', allowedGroupIds: ['g1'] };

  test('공유 프로젝트에 접근 가능해도 admin 전용 작업판은 차단', () => {
    expect(userHasProjectAccess(member, shared)).toBe(true);
    expect(userHasWorkboardAccess(member, adminOnlyWb)).toBe(false);
  });

  test('작업판 자신의 그룹으로만 판정된다', () => {
    expect(userHasWorkboardAccess(member, groupWb)).toBe(true);
    expect(userHasWorkboardAccess(stranger, groupWb)).toBe(false);
    expect(userHasWorkboardAccess(admin, adminOnlyWb)).toBe(true);
  });
});
