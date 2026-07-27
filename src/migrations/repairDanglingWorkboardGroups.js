const Group = require('../models/Group');
const Workboard = require('../models/Workboard');

// #740: 작업판의 dangling 접근 그룹 참조 (이미 삭제된 Group 의 ObjectId) 를
// 현재 기본 그룹으로 치환한다.
//
// 배경 — 구 기본 그룹이 groups 컬렉션에서 사라진 뒤, initializeDefaultGroup 이
// 새 기본 그룹을 만들고 사용자에게 $addToSet 했지만, assignDefaultGroupToWorkboards
// 는 "비어있는" 작업판만 채우므로 구 ID 를 가진 작업판은 방치됐다. 접근 판정이
// ID 교집합이라 구 ID 를 아직 가진 사용자에게만 보이는 유령 권한이 됐다.
//
// 멱등 — dangling 참조가 없으면 아무것도 하지 않는다.
async function repairDanglingWorkboardGroups() {
  try {
    const defaultGroup = await Group.findDefault();
    if (!defaultGroup) {
      console.log('[Migration] 기본 그룹 없음 — initializeDefaultGroup 이 먼저 실행돼야 함. skip.');
      return 0;
    }

    const validIds = new Set(
      (await Group.find({}, { _id: 1 }).lean()).map((g) => String(g._id))
    );

    const workboards = await Workboard.find(
      { allowedGroupIds: { $exists: true, $ne: [] } },
      { name: 1, allowedGroupIds: 1 }
    ).lean();

    let repaired = 0;
    for (const wb of workboards) {
      const ids = (wb.allowedGroupIds || []).map(String);
      const dangling = ids.filter((id) => !validIds.has(id));
      if (dangling.length === 0) continue;

      // 유효 참조는 보존하고, dangling 자리에 기본 그룹을 넣는다 (중복 제거).
      const next = [...new Set([...ids.filter((id) => validIds.has(id)), String(defaultGroup._id)])];

      await Workboard.updateOne({ _id: wb._id }, { $set: { allowedGroupIds: next } });
      repaired += 1;
      console.log(
        `[Migration] "${wb.name}" 접근 그룹 복구 — 삭제된 참조 ${dangling.length}개 → 기본 그룹`
      );
    }

    if (repaired > 0) {
      console.log(`[Migration] 작업판 dangling 접근 그룹 복구 (${repaired}건)`);
    }
    return repaired;
  } catch (error) {
    console.error('[Migration] 작업판 dangling 접근 그룹 복구 오류:', error);
    return 0;
  }
}

module.exports = repairDanglingWorkboardGroups;
