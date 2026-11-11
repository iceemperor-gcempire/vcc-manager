/**
 * 작업판의 베이스 모델 칸 (#1088).
 *
 * v2 에서 내장 입력(baseInputFields)이 없어지고 모델은 additionalInputFields 의 `type: 'baseModel'` 칸이 됐다.
 * MCP 도구가 계속 옛 필드를 읽어서 get_workboard 의 모델 목록이 늘 비었고, generate 의 aiModel 은 칸에
 * 들어가지 않아 필수 칸 검사에서 막혔다. 칸은 백엔드와 같은 규칙으로 찾는다 — 첫 번째 `type: 'baseModel'` 칸
 * (src/utils/customFieldHelpers.js 의 getFieldByRole), 없으면 이름이 `base_model` 인 칸 (같은 파일의 well-known 이름).
 * 텍스트 판 입력(textInput.js)도 이 함수를 쓴다.
 */

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
const isEmpty = (v) => v === undefined || v === null || v === '';

/** 판의 베이스 모델 칸. 없으면 null (유틸리티 판 등) */
export function findBaseModelField(wb) {
  const fields = (wb?.additionalInputFields || []).filter(Boolean);
  return fields.find((f) => f.type === 'baseModel') || fields.find((f) => f.name === 'base_model') || null;
}

/**
 * get_workboard 에 보일 베이스 모델 안내. 칸이 없으면 null.
 * 모델 노출 정책이 whitelist 인 판은 그 목록이 곧 고를 수 있는 모델이라 options 로 보인다.
 * 폴더 제한(#1086)은 서버가 실행할 때 검사한다. 모델 종류 제한은 Civitai 정보로만 거르므로 안내용이다.
 */
export function describeBaseModel(wb) {
  const field = findBaseModelField(wb);
  if (!field) return null;
  // select 칸(d-ice-all 의 provider 등)은 그 선택지가, whitelist 정책이면 그 목록이 고를 수 있는 값이다
  let options = null;
  if (field.type === 'select') options = (field.options || []).map((o) => o.value);
  else if (wb.modelExposurePolicy === 'whitelist') options = wb.modelWhitelist || [];
  return {
    field: field.name,
    required: Boolean(field.required),
    default: isEmpty(valueOf(field.defaultValue)) ? null : valueOf(field.defaultValue),
    ...(options ? { options } : {}),
    allowedFolders: wb.allowedModelFolders || [],
    allowedModelTypes: wb.allowedModelTypes || [],
  };
}

// select 칸이면 표시 이름(key)이나 값(value)으로 선택지를 찾아 {key, value} 로. 못 찾거나 select 가 아니면 받은 값 그대로
function toFieldValue(field, input) {
  if (field.type !== 'select') return input;
  const raw = valueOf(input);
  const option = (field.options || []).find((o) => o.key === raw || o.value === raw);
  return option ? { key: option.key, value: option.value } : input;
}

const sameModel = (field, a, b) => valueOf(toFieldValue(field, a)) === valueOf(toFieldValue(field, b));

/**
 * generate·continue_job 의 aiModel 을 판의 베이스 모델 칸에 넣는다.
 *
 * - 칸이 있는 판: additionalParams 에 그 칸 값이 이미 있으면 그대로 둔다(칸에 직접 넣던 호출을 깨지 않는다).
 *   없으면 aiModel, 그것도 없으면 칸 기본값. top-level aiModel 은 보내지 않는다 — 백엔드가 칸 값을 쓰고
 *   top-level 값은 칸 기본값에 덮인다 (#1174)
 * - 칸이 없는 판: aiModel 을 top-level 로 그대로 넘긴다. 칸 없이 aiModel 을 읽는 판이 있다(d-ice-all 의 provider)
 *
 * @returns {{ additionalParams: object, aiModel: any, warnings: string[] }}
 */
export function applyBaseModel(wb, additionalParams = {}, aiModel) {
  const field = findBaseModelField(wb);
  if (!field) {
    return { additionalParams, aiModel, warnings: [] };
  }

  const params = { ...additionalParams };
  const warnings = [];
  const explicit = params[field.name];
  if (!isEmpty(explicit)) {
    if (!isEmpty(aiModel) && !sameModel(field, explicit, aiModel)) {
      warnings.push(`aiModel "${aiModel}" was ignored — additionalParams.${field.name} "${valueOf(explicit)}" is used.`);
    }
  } else if (!isEmpty(aiModel)) {
    params[field.name] = toFieldValue(field, aiModel);
  } else if (!isEmpty(valueOf(field.defaultValue))) {
    params[field.name] = toFieldValue(field, field.defaultValue);
  }
  return { additionalParams: params, aiModel: undefined, warnings };
}
