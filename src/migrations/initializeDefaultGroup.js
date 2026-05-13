const Group = require('../models/Group');
const User = require('../models/User');

// #198 Phase A: 기본 그룹 (isDefault: true) 1개 자동 생성 + 모든 비-admin 사용자에게
// 그룹 자동 추가. 이후 신규 가입은 routes/auth.js 의 signup 핸들러가 자동 가입 처리.
//
// 멱등 (idempotent) — 이미 기본 그룹이 있으면 skip. 사용자 groupIds 도 이미 default 가
// 포함돼있으면 skip.
async function initializeDefaultGroup() {
  try {
    // 1. 기본 그룹 확인 / 생성
    let defaultGroup = await Group.findDefault();
    if (!defaultGroup) {
      defaultGroup = await Group.create({
        name: '기본',
        description: '신규 사용자가 자동으로 가입되는 기본 그룹. 마이그레이션 시점의 모든 작업판도 이 그룹에 자동 할당됨.',
        permissions: [],
        isDefault: true,
        createdBy: null
      });
      console.log(`[Migration] 기본 그룹 생성 (id: ${defaultGroup._id})`);
    } else {
      console.log(`[Migration] 기본 그룹 이미 존재 (id: ${defaultGroup._id})`);
    }

    // 2. 비-admin 사용자에게 기본 그룹 자동 추가 (groupIds 에 없으면)
    const result = await User.updateMany(
      {
        isAdmin: { $ne: true },
        groupIds: { $ne: defaultGroup._id }
      },
      { $addToSet: { groupIds: defaultGroup._id } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Migration] 기본 그룹에 사용자 ${result.modifiedCount}명 자동 가입`);
    } else {
      console.log('[Migration] 기본 그룹 사용자 가입 추가 불필요');
    }
  } catch (error) {
    console.error('[Migration] 기본 그룹 초기화 오류:', error);
  }
}

module.exports = initializeDefaultGroup;
