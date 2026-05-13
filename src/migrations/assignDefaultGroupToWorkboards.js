const Group = require('../models/Group');
const Workboard = require('../models/Workboard');

// #198 Phase B: allowedGroupIds 가 비어있는 기존 작업판 전부에 기본 그룹 자동 할당.
// 마이그레이션 후 v2.0 의 권한 미들웨어 (Phase C) 가 활성화돼도 기존 사용자의
// 작업판 접근이 깨지지 않도록 보장.
async function assignDefaultGroupToWorkboards() {
  try {
    const defaultGroup = await Group.findDefault();
    if (!defaultGroup) {
      console.log('[Migration] 기본 그룹 없음 — initializeDefaultGroup 이 먼저 실행돼야 함. skip.');
      return;
    }

    const result = await Workboard.updateMany(
      {
        $or: [
          { allowedGroupIds: { $exists: false } },
          { allowedGroupIds: { $size: 0 } }
        ]
      },
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
