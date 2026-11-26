// 작업판 칸이 허용하지 않는 값으로 들어온 실행을 막는다 (#1163).
//
// 웹 화면은 선택 칸에서 선택지만 고르게 하지만, API·MCP 호출과 예전 작업의 재시도는 화면을 거치지 않는다.
// 판 작성자가 선택지로 정한 범위(길이·스텝·해상도 등)를 그대로 넘겨 워크플로에 넣으면 실패하거나, 서버가
// 멈추는 조건에 닿는다 (#1303 — pi-H3 판의 길이를 5초로 줄였어도 API 로는 15초를 보낼 수 있었다).
//
// 여기서 보는 것은 값이 정해진 칸뿐이다.
//   select  — 선택지에 있는 값인가
//   number  — 숫자인가, 판이 정한 최솟값·최댓값 안인가
// 모델·LoRA 칸은 폴더·목록 검사가 따로 있고(modelFolderGuard · loraFolderGuard), 첨부 칸은 소유 검사가 있다.
//
// 조용히 기본값으로 바꾸지 않고 거절한다 — 요청한 것과 다른 결과가 나오면 원인을 알기 어렵다.

const { WELL_KNOWN_FIELD_NAME_TO_ROLE, FIELD_ROLES } = require('../constants/fieldRoles');
const { getFieldValueByRole } = require('../utils/customFieldHelpers');

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
const isBlank = (v) => v === undefined || v === null || v === '';
const has = (obj, key) => !!obj && Object.prototype.hasOwnProperty.call(obj, key);

// 실행기가 받는 다른 이름 — OpenAI 이미지 경로는 output_format 칸을 옛 이름 outputFormat 으로도 읽는다 (#943)
const FIELD_NAME_ALIASES = Object.freeze({ output_format: ['outputFormat'] });

// 워크플로·요청에 실제로 들어갈 값 — 실행기(queueService)와 같은 순서로 찾는다.
// 칸 값(additionalParams) → 같은 이름의 top-level 값 → 크기 칸이면 top-level imageSize 등 (#1174) → 옛 이름
// → 판 기본값. 칸을 보내지 않으면 판 기본값이 쓰이므로 기본값도 본다 — 판을 고치며 선택지에서 기본값을
// 빼 두면, 칸을 생략한 API 호출만 그 값으로 도는 일이 생긴다.
// 빈 값('' · null)을 직접 보낸 것은 여기서 보지 않는다. 작업 절차 · 파이프라인의 사전 입력에서 빈 값은
// "선택 없음" 이고, 그 처리는 예전 그대로다.
function effectiveValue(workboard, input, field) {
  const params = input.additionalParams;
  if (has(params, field.name) && params[field.name] !== undefined) return valueOf(params[field.name]);
  if (!isBlank(valueOf(input[field.name]))) return valueOf(input[field.name]);
  if (WELL_KNOWN_FIELD_NAME_TO_ROLE[field.name] === FIELD_ROLES.IMAGE_SIZE) {
    const sent = valueOf(getFieldValueByRole(workboard, input, FIELD_ROLES.IMAGE_SIZE));
    if (!isBlank(sent)) return sent;
  }
  for (const alias of (FIELD_NAME_ALIASES[field.name] || [])) {
    const sent = valueOf(has(params, alias) && !isBlank(valueOf(params[alias])) ? params[alias] : input[alias]);
    if (!isBlank(sent)) return sent;
  }
  return valueOf(field.defaultValue);
}

// 실행기는 숫자 칸을 parseFloat 로 읽는다. "0x2" · "3abc" 처럼 Number 와 parseFloat 가 다르게 읽는 글자는 받지 않는다
const NUMERIC_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

const describe = (field, value) => {
  const shown = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `지원하지 않는 값입니다: ${field.label || field.name} = ${shown.length > 80 ? `${shown.slice(0, 80)}…` : shown}`;
};

/**
 * @param {Object} workboard — additionalInputFields 를 가진 작업판
 * @param {Object} inputLike — 작업 입력 (top-level 또는 additionalParams 에 칸 값)
 * @returns {string|null} 막을 때 사용자에게 보일 메시지, 통과면 null
 */
function findFieldValueViolation(workboard, inputLike) {
  const input = inputLike || {};
  for (const field of ((workboard && workboard.additionalInputFields) || [])) {
    if (!field || (field.type !== 'select' && field.type !== 'number')) continue;
    const value = effectiveValue(workboard, input, field);
    if (isBlank(value)) continue;

    if (field.type === 'select') {
      const options = field.options || [];
      if (options.length === 0) continue; // 선택지를 정하지 않은 칸은 범위가 없다
      if (typeof value === 'object') return describe(field, value);
      // 선택지 값은 글자로 저장된다 — 숫자 4 와 "4" 는 같은 값으로 본다
      if (!options.some((o) => String(o.value) === String(value))) return describe(field, value);
      continue;
    }

    // number — queueService 는 숫자가 아닌 값을 0 으로 바꿔 넣는다. 여기서 먼저 막는다
    const n = typeof value === 'number' ? value : (typeof value === 'string' && NUMERIC_TEXT.test(value.trim()) ? Number(value) : NaN);
    if (!Number.isFinite(n)) return describe(field, value);
    const { min, max } = field.validation || {};
    if (typeof min === 'number' && n < min) return describe(field, value);
    if (typeof max === 'number' && n > max) return describe(field, value);
  }
  return null;
}

module.exports = { findFieldValueViolation };
