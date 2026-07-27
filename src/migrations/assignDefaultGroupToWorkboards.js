const Group = require('../models/Group');
const Workboard = require('../models/Workboard');

// #198 Phase B: allowedGroupIds 필드 자체가 없는 기존 작업판에 기본 그룹 자동 할당.
// 마이그레이션 후 v2.0 의 권한 미들웨어 (Phase C) 가 활성화돼도 기존 사용자의
// 작업판 접근이 깨지지 않도록 보장.
//
// #740: 대상에서 `$size: 0` 을 제외했다. 빈 배열은 "admin 전용" 이라는 의도된
// 상태이며 (그룹 삭제 후 남은 그룹이 없는 경우 등), 이걸 매 기동마다 기본 그룹으로
// 채우면 admin 이 좁혀둔 노출 범위가 재시작 한 번에 되돌아간다.
// 필드 미존재 (`$exists: false`) 만이 진짜 미마이그레이션 상태다.
async function assignDefaultGroupToWorkboards() {
  try {
    const defaultGroup = await Group.findDefault();
    if (!defaultGroup) {
      console.log('[Migration] 기본 그룹 없음 — initializeDefaultGroup 이 먼저 실행돼야 함. skip.');
      return;
    }

    const result = await Workboard.updateMany(
      { allowedGroupIds: { $exists: false } },
      { $set: { allowedGroupIds: [defaultGroup._id] } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Migration] Workboard.allowedGroupIds 기본 그룹 자동 할당 (${result.modifiedCount}건)`);
    } else {
      console.log('[Migration] Workboard 기본 그룹 자동 할당 불필요 (대상 없음)');
    }
  } catch (error) {
    console.error('[Migration] Workboard 기본 그룹 할당 오류:', error);
  }
}

module.exports = assignDefaultGroupToWorkboards;
