// 작업판 customFields 헬퍼 (#199 Phase A)
//
// 서비스 코드 (queueService, gptImageService 등) 가 작업판의 필드 이름에 직접 의존하지 않고
// role 기반으로 필드를 찾을 수 있게 해주는 read-only 헬퍼들.
// Phase C 에서 서비스 코드가 이 헬퍼로 마이그레이션됨.

const { WELL_KNOWN_FIELD_NAME_TO_ROLE, FIELD_ROLES } = require('../constants/fieldRoles');

// 특수 type → 의미적 role 매핑 (#199 Phase D).
// admin 이 type 으로 baseModel / lora 를 선택하면 별도 role 지정 없이도 service 코드가 해당 의미로 인식.
const FIELD_TYPE_TO_ROLE = Object.freeze({
  baseModel: FIELD_ROLES.MODEL,
  lora: FIELD_ROLES.LORA
});

/**
 * 작업판에서 특정 role 을 가진 첫 번째 필드 메타데이터를 반환.
 * 같은 role 의 필드가 여러 개일 경우 첫 번째 매치만 반환 (소프트 컨벤션).
 *
 * @param {Object} workboard — Workboard document or POJO
 * @param {string} role — FIELD_ROLES 의 값
 * @returns {Object|null} field schema or null
 */
function getFieldByRole(workboard, role) {
  if (!workboard || !role) return null;
  const fields = workboard.additionalInputFields || [];
  // 1) 명시적 role
  const byRole = fields.find((f) => f && f.role === role);
  if (byRole) return byRole;
  // 2) 특수 type 이 같은 role 을 의미하는 경우 (예: type=baseModel → role=model)
  return fields.find((f) => f && FIELD_TYPE_TO_ROLE[f.type] === role) || null;
}

/**
 * 작업판의 입력값 (inputData) 에서 특정 role 에 해당하는 값을 추출.
 * 1) additionalInputFields 에서 role 매치되는 필드 이름으로 inputData 조회
 * 2) 매치 실패 시 legacy baseInputFields well-known 키를 fallback 으로 조회
 *
 * Phase B 마이그레이션 후 모든 작업판에 role 이 부여되면 fallback 은 dead-code.
 * Phase F 에서 baseInputFields 자체 제거 시 fallback 도 함께 제거됨.
 *
 * @param {Object} workboard — Workboard document or POJO
 * @param {Object} inputData — 사용자가 제출한 입력값 (job.inputData)
 * @param {string} role — FIELD_ROLES 의 값
 * @returns {*} 값 또는 undefined
 */
function getFieldValueByRole(workboard, inputData, role) {
  if (!workboard || !inputData || !role) return undefined;

  const field = getFieldByRole(workboard, role);
  if (field && field.name) {
    // Top-level path (legacy hardcoded UI: inputData.aiModel 등)
    if (Object.prototype.hasOwnProperty.call(inputData, field.name)) {
      return inputData[field.name];
    }
    // additionalParams 네임스페이스 (사용자 페이지 동적 필드 loop 의 저장 위치)
    if (inputData.additionalParams && Object.prototype.hasOwnProperty.call(inputData.additionalParams, field.name)) {
      return inputData.additionalParams[field.name];
    }
  }

  // Well-known name fallback — additionalInputFields entry 에 role 이 없거나 부분 마이그레이션 상태 대비.
  // 또한 prompt / negativePrompt / seed 처럼 v1.x 에서 additionalInputFields 가 있지만 role 이 부여되지 않은 케이스.
  for (const [knownName, mappedRole] of Object.entries(WELL_KNOWN_FIELD_NAME_TO_ROLE)) {
    if (mappedRole === role && Object.prototype.hasOwnProperty.call(inputData, knownName)) {
      return inputData[knownName];
    }
  }
  return undefined;
}

/**
 * 작업판의 customFields 를 role 별로 인덱싱한 맵 반환.
 * 같은 role 의 중복 필드가 있으면 첫 번째만 채택 (마지막 매치 무시).
 *
 * @param {Object} workboard
 * @returns {Object<string, Object>} role → field
 */
function indexFieldsByRole(workboard) {
  const fields = (workboard && workboard.additionalInputFields) || [];
  const map = {};
  for (const f of fields) {
    if (f && f.role && !map[f.role]) {
      map[f.role] = f;
    }
  }
  return map;
}

module.exports = {
  getFieldByRole,
  getFieldValueByRole,
  indexFieldsByRole
};
