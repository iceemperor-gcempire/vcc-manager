// 작업판 사용자 페이지의 customField 가시성 필터 (#199 Phase F1).
//
// Phase B 마이그레이션이 baseInputFields 의 well-known 키를 additionalInputFields 로
// 복사해 둔 결과로, 기존 작업판에서 같은 필드가 두 번 렌더링되는 회귀가 발생.
// 이 헬퍼는 dynamic loop 에서 \"legacy 데이터가 남아있는 baseInputFields 키\" 의 customField 를
// 숨겨서 회귀 해소.
//
// 신규 작업판 (template F1 갱신 후) 은 baseInputFields 가 비어 있어 필터를 통과 → customField 로 렌더.
// 기존 작업판은 baseInputFields 가 채워져 있어 customField 가 숨김 → hardcoded UI 만 보임.
// Phase F2 에서 hardcoded UI 자체 제거 후 이 필터도 불필요해짐.

const LEGACY_BASE_KEYS = Object.freeze([
  'aiModel',
  'imageSizes',
  'referenceImageMethods',
  'stylePresets',
  'upscaleMethods',
  'systemPrompt',
  'referenceImages',
  'temperature',
  'maxTokens'
]);

function hasLegacyBaseValue(baseInputFields, key) {
  const v = baseInputFields?.[key];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.length > 0;
  if (typeof v === 'number') return true;
  return Boolean(v);
}

export function filterVisibleCustomFields(workboardData) {
  const fields = workboardData?.additionalInputFields || [];
  const base = workboardData?.baseInputFields;
  return fields.filter((f) => {
    if (!f || !f.name) return false;
    if (LEGACY_BASE_KEYS.includes(f.name) && hasLegacyBaseValue(base, f.name)) {
      return false;
    }
    return true;
  });
}

export const LEGACY_BASE_FIELD_KEYS = LEGACY_BASE_KEYS;
