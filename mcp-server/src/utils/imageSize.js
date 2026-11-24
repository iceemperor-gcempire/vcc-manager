/**
 * 작업판의 크기 칸 (#1290).
 *
 * generate·continue_job 의 top-level `imageSize` 는 옛 내장 입력(baseInputFields.imageSizes)을 쓰던 때의 인자다.
 * 지금 판은 크기가 additionalInputFields 의 `image_size` 칸이고, 백엔드는 칸 값을 top-level 값보다 먼저 쓴다
 * (src/utils/customFieldHelpers.js 의 getFieldValueByRole — `image_size` 가 `imageSize` 보다 앞).
 * MCP 가 빈 칸을 판 기본값으로 채워 보내므로(fieldDefaults.js), top-level `imageSize` 만 준 호출은
 * 요청한 크기가 아니라 판 기본 크기로 돌았다. aiModel 과 같은 방식(baseModel.js 의 applyBaseModel)으로
 * 기본값을 채우기 전에 칸에 넣는다.
 */

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
const isEmpty = (v) => v === undefined || v === null || v === '';

// 백엔드의 well-known 칸 이름과 같은 순서 (src/constants/fieldRoles.js 의 WELL_KNOWN_FIELD_NAME_TO_ROLE)
const SIZE_FIELD_NAMES = ['image_size', 'imageSize'];

/** 판의 크기 칸. 없으면 null */
export function findImageSizeField(wb) {
  const fields = (wb?.additionalInputFields || []).filter(Boolean);
  for (const name of SIZE_FIELD_NAMES) {
    const field = fields.find((f) => f.name === name);
    if (field) return field;
  }
  return null;
}

// select 칸이면 표시 이름(key)이나 값(value)으로 선택지를 찾는다. 못 찾으면 null
function findOption(field, input) {
  if (field.type !== 'select') return null;
  const raw = valueOf(input);
  return (field.options || []).find((o) => o.key === raw || o.value === raw) || null;
}

/**
 * top-level imageSize 를 판의 크기 칸에 넣는다.
 *
 * - 칸이 있는 판: additionalParams 에 그 칸 값이 이미 있으면 그대로 둔다. 없으면 imageSize 를 넣는다.
 *   둘 다 없으면 비워 두고, 칸 기본값은 다른 칸과 함께 fillFieldDefaults 가 채운다.
 *   top-level imageSize 는 보내지 않는다 — 백엔드가 칸 값을 쓴다
 * - 칸이 없는 판: imageSize 를 top-level 로 그대로 넘긴다 (옛 내장 입력을 쓰는 판)
 *
 * @param {{ additionalInputFields?: object[] }} wb
 * @param {Record<string, unknown>} additionalParams 호출자가 준 값 (select 는 이미 {key, value} 로 바뀐 상태)
 * @param {unknown} imageSize top-level 로 받은 크기 (문자열 또는 {key, value})
 * @returns {{ additionalParams: object, imageSize: any, warnings: string[] }}
 */
export function applyImageSize(wb, additionalParams = {}, imageSize) {
  const field = findImageSizeField(wb);
  if (!field) {
    return { additionalParams, imageSize, warnings: [] };
  }

  const params = { ...additionalParams };
  const warnings = [];
  const explicit = params[field.name];
  if (!isEmpty(explicit)) {
    if (!isEmpty(imageSize)) {
      const a = findOption(field, explicit);
      const b = findOption(field, imageSize);
      const same = valueOf(a || explicit) === valueOf(b || imageSize);
      if (!same) {
        warnings.push(`imageSize "${valueOf(imageSize)}" was ignored — additionalParams.${field.name} "${valueOf(explicit)}" is used.`);
      }
    }
  } else if (!isEmpty(imageSize)) {
    const option = findOption(field, imageSize);
    if (option) {
      params[field.name] = { key: option.key, value: option.value };
    } else {
      params[field.name] = valueOf(imageSize);
      if (field.type === 'select') {
        warnings.push(`imageSize "${valueOf(imageSize)}" is not one of the ${field.name} options (see get_workboard additionalFields). It was sent as given.`);
      }
    }
  }
  return { additionalParams: params, imageSize: undefined, warnings };
}
