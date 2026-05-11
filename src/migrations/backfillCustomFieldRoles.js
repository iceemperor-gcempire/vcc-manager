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
    const workboards = await Workboard.find({});
    let migratedCount = 0;
    let roleAssignedCount = 0;
    let appendedCount = 0;

    for (const wb of workboards) {
      const base = wb.baseInputFields || {};
      const existing = wb.additionalInputFields || [];
      const existingRoles = new Set(existing.filter((f) => f && f.role).map((f) => f.role));
      const existingByName = new Map(existing.filter((f) => f && f.name).map((f) => [f.name, f]));
      let dirty = false;

      for (const [legacyKey, role] of Object.entries(LEGACY_BASE_FIELD_TO_ROLE)) {
        if (existingRoles.has(role)) continue;  // 이미 마이그레이션 됨
        if (!Object.prototype.hasOwnProperty.call(base, legacyKey)) continue;

        const legacyValue = base[legacyKey];

        // 같은 name 이 있지만 role 이 없는 경우 — role 만 부여
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

        // 새 entry 생성
        const entry = buildEntryFromLegacy(legacyKey, legacyValue);
        if (!entry) continue;
        // 빈 옵션 배열은 의미 없으므로 skip (select 타입 한정)
        if (entry.type === 'select' && (!entry.options || entry.options.length === 0)) continue;
        // 빈 문자열 systemPrompt 도 skip (사용자가 채우지 않은 케이스)
        if (entry.type === 'string' && (entry.defaultValue === undefined || entry.defaultValue === '')) continue;

        wb.additionalInputFields.push(entry);
        existingRoles.add(role);
        appendedCount += 1;
        dirty = true;
      }

      if (dirty) {
        wb.markModified('additionalInputFields');
        await wb.save();
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
