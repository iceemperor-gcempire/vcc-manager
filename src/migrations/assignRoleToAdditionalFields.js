const Workboard = require('../models/Workboard');
const { WELL_KNOWN_FIELD_NAME_TO_ROLE } = require('../constants/fieldRoles');

// #199 Phase C: additionalInputFields 의 well-known 이름을 가진 항목에 role 부여.
//
// Phase B 는 baseInputFields 의 well-known 키를 마이그레이션했지만, additionalInputFields 에
// 처음부터 정의된 prompt / negativePrompt / seed / aiModel 등은 role 이 없는 상태.
// 이 마이그레이션은 그런 entry 에 role 을 부여해 Phase C 의 서비스 코드 (role 기반 lookup) 가
// 모든 기존 작업판에서 정상 동작하게 한다.
//
// 멱등 — 같은 role 이 이미 있거나 entry 에 role 이 이미 있으면 skip.

async function assignRoleToAdditionalFields() {
  try {
    const workboards = await Workboard.find({});
    let workboardCount = 0;
    let assignedCount = 0;

    for (const wb of workboards) {
      const fields = wb.additionalInputFields || [];
      if (fields.length === 0) continue;

      const occupiedRoles = new Set(fields.filter((f) => f && f.role).map((f) => f.role));
      let dirty = false;

      for (const field of fields) {
        if (!field || !field.name) continue;
        if (field.role) continue;  // already has role

        const targetRole = WELL_KNOWN_FIELD_NAME_TO_ROLE[field.name];
        if (!targetRole) continue;
        if (occupiedRoles.has(targetRole)) continue;  // 다른 entry 가 이미 이 role 점유

        field.role = targetRole;
        occupiedRoles.add(targetRole);
        assignedCount += 1;
        dirty = true;
      }

      if (dirty) {
        wb.markModified('additionalInputFields');
        await wb.save();
        workboardCount += 1;
      }
    }

    if (workboardCount > 0) {
      console.log(`[Migration] additionalInputFields role 부여 — 작업판 ${workboardCount}건, ${assignedCount}개 필드`);
    } else {
      console.log('[Migration] additionalInputFields role 부여 불필요 (모두 최신)');
    }
  } catch (error) {
    console.error('[Migration] additionalInputFields role 부여 오류:', error);
  }
}

module.exports = assignRoleToAdditionalFields;
