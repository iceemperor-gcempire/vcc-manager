const Group = require('../models/Group');
const Workboard = require('../models/Workboard');
const User = require('../models/User');

// #740 / #743: 이미 삭제된 Group 의 ObjectId 를 가리키는 참조를 복구한다.
//
// 배경 — 구 기본 그룹이 groups 컬렉션에서 사라진 뒤, initializeDefaultGroup 이
// 새 기본 그룹을 만들고 사용자에게 $addToSet 했지만, assignDefaultGroupToWorkboards
// 는 "비어있는" 작업판만 채우므로 구 ID 를 가진 작업판은 방치됐다. 접근 판정이
// ID 교집합이라 구 ID 를 아직 가진 사용자에게만 보이는 유령 권한이 됐다.
//
// 작업판과 사용자는 복구 규칙이 다르다:
// - 작업판: dangling 자리에 기본 그룹을 넣는다. 빈 배열이 되면 admin 전용이 되어
//   기존 사용자의 접근이 끊기기 때문 (#740).
// - 사용자: dangling 을 제거하기만 한다. 이미 기본 그룹을 함께 가진 경우가 대부분이라
//   접근이 바뀌지 않는다. 단 제거 결과가 빈 배열이면 어느 작업판에도 접근할 수 없게
//   되므로 그때만 기본 그룹을 부여한다.

/**
 * 작업판의 allowedGroupIds 복구 결과를 계산한다 (순수 함수 — 테스트 대상).
 * @param {string[]} ids — 현재 allowedGroupIds (문자열)
 * @param {Set<string>} validIds — 실존하는 Group id 집합
 * @param {string} defaultId — 현재 기본 그룹 id
 * @returns {{ dangling: string[], next: string[] } | null} 복구 불필요 시 null
 */
function computeRepairedGroupIds(ids, validIds, defaultId) {
  const dangling = ids.filter((id) => !validIds.has(id));
  if (dangling.length === 0) return null;
  // 유효 참조는 보존하고, dangling 자리에 기본 그룹을 넣는다 (중복 제거).
  const next = [...new Set([...ids.filter((id) => validIds.has(id)), defaultId])];
  return { dangling, next };
}

/**
 * 사용자의 groupIds 복구 결과를 계산한다 (순수 함수 — 테스트 대상).
 * @param {string[]} ids — 현재 groupIds (문자열)
 * @param {Set<string>} validIds — 실존하는 Group id 집합
 * @param {string} defaultId — 현재 기본 그룹 id
 * @returns {{ dangling: string[], next: string[] } | null} 복구 불필요 시 null
 */
function computeRepairedUserGroupIds(ids, validIds, defaultId) {
  const dangling = ids.filter((id) => !validIds.has(id));
  if (dangling.length === 0) return null;
  const kept = ids.filter((id) => validIds.has(id));
  // 전부 dangling 이었다면 무소속이 되어 어느 작업판도 못 보므로 기본 그룹을 부여.
  const next = kept.length > 0 ? kept : [defaultId];
  return { dangling, next };
}

// 멱등 — dangling 참조가 없으면 아무것도 하지 않는다.
async function repairDanglingGroupRefs() {
  try {
    const defaultGroup = await Group.findDefault();
    if (!defaultGroup) {
      console.log('[Migration] 기본 그룹 없음 — initializeDefaultGroup 이 먼저 실행돼야 함. skip.');
      return { workboards: 0, users: 0 };
    }
    const defaultId = String(defaultGroup._id);

    const validIds = new Set(
      (await Group.find({}, { _id: 1 }).lean()).map((g) => String(g._id))
    );

    // 1) 작업판 (#740)
    const workboards = await Workboard.find(
      { allowedGroupIds: { $exists: true, $ne: [] } },
      { name: 1, allowedGroupIds: 1 }
    ).lean();

    let wbRepaired = 0;
    for (const wb of workboards) {
      const ids = (wb.allowedGroupIds || []).map(String);
      const repair = computeRepairedGroupIds(ids, validIds, defaultId);
      if (!repair) continue;

      await Workboard.updateOne({ _id: wb._id }, { $set: { allowedGroupIds: repair.next } });
      wbRepaired += 1;
      console.log(
        `[Migration] "${wb.name}" 접근 그룹 복구 — 삭제된 참조 ${repair.dangling.length}개 → 기본 그룹`
      );
    }

    // 2) 사용자 (#743) — 백업/복원이 이 잔재를 계속 실어 나르므로 함께 정리
    const users = await User.find(
      { groupIds: { $exists: true, $ne: [] } },
      { groupIds: 1 }
    ).lean();

    let userRepaired = 0;
    for (const u of users) {
      const ids = (u.groupIds || []).map(String);
      const repair = computeRepairedUserGroupIds(ids, validIds, defaultId);
      if (!repair) continue;

      await User.updateOne({ _id: u._id }, { $set: { groupIds: repair.next } });
      userRepaired += 1;
    }

    if (wbRepaired > 0) {
      console.log(`[Migration] 작업판 dangling 접근 그룹 복구 (${wbRepaired}건)`);
    }
    if (userRepaired > 0) {
      console.log(`[Migration] 사용자 dangling 그룹 참조 정리 (${userRepaired}명)`);
    }
    return { workboards: wbRepaired, users: userRepaired };
  } catch (error) {
    console.error('[Migration] dangling 그룹 참조 복구 오류:', error);
    return { workboards: 0, users: 0 };
  }
}

module.exports = repairDanglingGroupRefs;
module.exports.computeRepairedGroupIds = computeRepairedGroupIds;
module.exports.computeRepairedUserGroupIds = computeRepairedUserGroupIds;
