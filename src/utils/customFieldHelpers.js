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
  // F4: role 스키마 필드 제거 — 특수 type 매핑 또는 well-known name fallback 으로 추론
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
    if (mappedRole !== role) continue;
    if (Object.prototype.hasOwnProperty.call(inputData, knownName)) {
      return inputData[knownName];
    }
    if (inputData.additionalParams && Object.prototype.hasOwnProperty.call(inputData.additionalParams, knownName)) {
      return inputData.additionalParams[knownName];
    }
  }
  return undefined;
}

const isBlank = (v) => v === undefined || v === null || v === '';

/**
 * 이 작업이 실행할 베이스 모델 (#1174). 모델 칸 값이 먼저이고, 비었으면 요청의 top-level `aiModel`.
 *
 * `getFieldValueByRole` 은 `aiModel` 을 칸 이름으로 인식하지 않는다 (0d72b24 snake_case 단일화). 그것과 별개로
 * `POST /jobs/generate` 의 top-level `aiModel` 은 그 판의 모델 칸 값으로 받는다 (docs/API.md). 그동안 폴더 검사만
 * `aiModel` 을 보고 워크플로 주입은 칸 기본값을 써서, 검사한 모델과 실행한 모델이 달랐다.
 * 폴더 검사·워크플로 주입·작업 기록이 모두 이 함수를 쓴다.
 *
 * @param {Object} workboard
 * @param {Object} inputData — 작업 입력 (top-level 또는 additionalParams)
 * @returns {*} 값 ({key, value} 객체일 수 있음) 또는 undefined
 */
function getModelValue(workboard, inputData) {
  const fromField = getFieldValueByRole(workboard, inputData, FIELD_ROLES.MODEL);
  if (!isBlank(fromField)) return fromField;
  const fromTopLevel = inputData ? inputData.aiModel : undefined;
  return isBlank(fromTopLevel) ? fromField : fromTopLevel;
}

/** 크기를 보내지 않았고 판에도 크기 기본값이 없을 때 쓰는 크기 (#1221) */
const DEFAULT_IMAGE_SIZE = '1024x1024';

/**
 * 이 작업의 이미지·영상 크기 (#1221). 요청에 온 크기 칸 값이 먼저이고, 비었으면 판의 크기 칸 기본값이다.
 *
 * `getFieldValueByRole` 은 요청에 들어온 값만 본다. 웹 화면은 모든 칸을 보내고 MCP 도 빈 칸을 판 기본값으로
 * 채워 보내지만, REST 를 직접 부르면 크기가 빠질 수 있다. 그때 ComfyUI 경로가 512x512 로 떨어져
 * 크기 기본이 1344x768 인 H3 영상 판도 512x512 로 만들었다. 둘 다 없으면 undefined —
 * 호출부가 자기 경로의 기본값(ComfyUI 는 DEFAULT_IMAGE_SIZE)을 정한다.
 *
 * @param {Object} workboard
 * @param {Object} inputData — 작업 입력 (top-level 또는 additionalParams)
 * @returns {*} 값 ({key, value} 객체일 수 있음) 또는 undefined
 */
function getImageSizeValue(workboard, inputData) {
  const sent = getFieldValueByRole(workboard, inputData, FIELD_ROLES.IMAGE_SIZE);
  if (!isBlank(sent)) return sent;
  const fields = (workboard && workboard.additionalInputFields) || [];
  const field = fields.find((f) => f && WELL_KNOWN_FIELD_NAME_TO_ROLE[f.name] === FIELD_ROLES.IMAGE_SIZE);
  return field && !isBlank(field.defaultValue) ? field.defaultValue : undefined;
}

/**
 * 이 작업의 부정 프롬프트 (#1262). 요청에 온 값이 먼저이고 — **빈 문자열도 값이다** (사용자가 칸을 비운 것) —
 * 아예 보내지 않았을 때만 판의 기본 부정 프롬프트(`defaultNegativePrompt`)를 쓴다.
 *
 * 웹 화면은 부정 프롬프트 칸을 늘 보내므로(비우면 '') 화면에서 비운 값이 기본값으로 되돌아가지 않는다.
 * REST·MCP 가 부정 프롬프트를 생략하면 판 작성자가 정한 기본값으로 돈다 — 예전에 워크플로 문자열에
 * 박혀 있던 품질 부정 태그가 하던 일이다.
 *
 * @param {Object} workboard
 * @param {Object} inputData — 작업 입력 (top-level 또는 additionalParams)
 * @returns {string|undefined}
 */
function getNegativePromptValue(workboard, inputData) {
  const sent = getFieldValueByRole(workboard, inputData, FIELD_ROLES.NEGATIVE_PROMPT);
  if (sent !== undefined && sent !== null) return sent;
  const fallback = workboard && workboard.defaultNegativePrompt;
  return isBlank(fallback) ? undefined : fallback;
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
    const role = f && FIELD_TYPE_TO_ROLE[f.type];
    if (role && !map[role]) {
      map[role] = f;
    }
  }
  return map;
}

module.exports = {
  DEFAULT_IMAGE_SIZE,
  getFieldByRole,
  getFieldValueByRole,
  getImageSizeValue,
  getModelValue,
  getNegativePromptValue,
  indexFieldsByRole
};
