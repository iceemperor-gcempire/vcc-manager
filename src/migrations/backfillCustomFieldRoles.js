const Workboard = require('../models/Workboard');
const { FIELD_ROLES, LEGACY_BASE_FIELD_TO_ROLE } = require('../constants/fieldRoles');

// #199 Phase B: 기존 baseInputFields well-known 키 → additionalInputFields 의 role-부여 항목으로 마이그레이션.
//
// 동작:
// 1) Workboard 마다 baseInputFields 의 well-known 키 검사
// 2) 같은 role 이 additionalInputFields 에 이미 있으면 skip (idempotent)
// 3) 같은 name 의 entry 가 있지만 role 이 없으면 → 해당 entry 에 role 만 부여
// 4) 그 외 → baseInputFields 의 값을 풀어 새 entry 추가
//
// baseInputFields 자체는 건드리지 않음 (Phase F 에서 제거 예정). 따라서 v1.x 코드와도 호환.

// 각 legacy key → field schema 변환 헬퍼
function buildEntryFromLegacy(legacyKey, legacyValue) {
  const role = LEGACY_BASE_FIELD_TO_ROLE[legacyKey];
  if (!role) return null;

  const labels = {
    aiModel: 'AI 모델',
    imageSizes: '이미지 크기',
    referenceImageMethods: '참조 이미지 처리',
    stylePresets: '스타일 프리셋',
    upscaleMethods: '업스케일 방식',
    systemPrompt: '시스템 프롬프트',
    referenceImages: '참조 이미지',
    temperature: 'Temperature',
    maxTokens: 'Max Tokens'
  };

  // selectOption 배열 (aiModel / imageSizes / referenceImageMethods / stylePresets / upscaleMethods / referenceImages)
  if (Array.isArray(legacyValue)) {
    return {
      name: legacyKey,
      label: labels[legacyKey] || legacyKey,
      type: legacyKey === 'referenceImages' ? 'image' : 'select',
      role,
      options: legacyValue.map((opt) => ({ key: opt.key, value: opt.value })),
      required: false
    };
  }

  // number (temperature / maxTokens)
  if (typeof legacyValue === 'number') {
    return {
      name: legacyKey,
      label: labels[legacyKey] || legacyKey,
      type: 'number',
      role,
      defaultValue: legacyValue,
      required: false
    };
  }

  // string (systemPrompt)
  if (typeof legacyValue === 'string') {
    return {
      name: legacyKey,
      label: labels[legacyKey] || legacyKey,
      type: 'string',
      role,
      defaultValue: legacyValue,
      required: false
    };
  }

  return null;
}

async function backfillCustomFieldRoles() {
  try {
    // raw collection 사용 — Workboard.find() 는 mongoose strict 로 schema 에서 제거된 baseInputFields 를
    // strip 해버려 마이그레이션이 \"옮길 데이터 없음\" 으로 잘못 판단함 (v2.0.0 회귀, 데이터 손실 발생).
    // raw collection 으로 읽으면 unknown 필드도 surface 됨.
    const collection = Workboard.collection;
    const workboards = await collection.find({}).toArray();
    let migratedCount = 0;
    let roleAssignedCount = 0;
    let appendedCount = 0;

    for (const wb of workboards) {
      const base = wb.baseInputFields || {};
      const existing = wb.additionalInputFields || [];
      const existingRoles = new Set(existing.filter((f) => f && f.role).map((f) => f.role));
      const existingByName = new Map(existing.filter((f) => f && f.name).map((f) => [f.name, f]));
      let dirty = false;
      const pushList = [];

      for (const [legacyKey, role] of Object.entries(LEGACY_BASE_FIELD_TO_ROLE)) {
        if (existingRoles.has(role)) continue;
        if (!Object.prototype.hasOwnProperty.call(base, legacyKey)) continue;

        const legacyValue = base[legacyKey];

        // 같은 name 이 있지만 role 이 없는 경우 — role 만 부여 (raw update 사용)
        if (existingByName.has(legacyKey)) {
          const target = existingByName.get(legacyKey);
          if (!target.role) {
            target.role = role;
            roleAssignedCount += 1;
            dirty = true;
          }
          existingRoles.add(role);
          continue;
        }

        const entry = buildEntryFromLegacy(legacyKey, legacyValue);
        if (!entry) continue;
        if (entry.type === 'select' && (!entry.options || entry.options.length === 0)) continue;
        if (entry.type === 'string' && (entry.defaultValue === undefined || entry.defaultValue === '')) continue;

        pushList.push(entry);
        existingRoles.add(role);
        appendedCount += 1;
        dirty = true;
      }

      if (dirty) {
        // raw update — mongoose strict (스키마에 없는 role 필드) 우회
        const updateOp = {};
        if (pushList.length > 0) {
          updateOp.$push = { additionalInputFields: { $each: pushList } };
        }
        // role 부여만 있는 경우 — 전체 additionalInputFields 를 set 으로 덮어쓰기
        const hasOnlyRoleAssignment = pushList.length === 0;
        if (hasOnlyRoleAssignment) {
          updateOp.$set = { additionalInputFields: existing };
        }
        if (Object.keys(updateOp).length > 0) {
          await collection.updateOne({ _id: wb._id }, updateOp);
        }
        migratedCount += 1;
      }
    }

    if (migratedCount > 0) {
      console.log(`[Migration] Workboard customField role backfill — 작업판 ${migratedCount}건 갱신 (role 부여 ${roleAssignedCount}, 신규 추가 ${appendedCount})`);
    } else {
      console.log('[Migration] Workboard customField role backfill 불필요 (모두 최신)');
    }

    // 사용된 role 카운트 (필요시 디버깅용)
    return {
      migratedCount,
      roleAssignedCount,
      appendedCount,
      knownRoles: Object.values(FIELD_ROLES)
    };
  } catch (error) {
    console.error('[Migration] customField role backfill 오류:', error);
  }
}

module.exports = backfillCustomFieldRoles;
module.exports.buildEntryFromLegacy = buildEntryFromLegacy;
