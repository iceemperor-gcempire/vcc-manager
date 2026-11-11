/**
 * 작업판 입력 칸의 기본값 채우기 (#1088) — generate·continue_job 이 필수 칸 검사 전에 부른다.
 *
 * 웹 생성 화면은 판을 열 때 모든 칸을 기본값으로 미리 채운다 (frontend/src/pages/ImageGeneration.js —
 * select 는 기본값, 없으면 첫 선택지). 백엔드도 실행할 때 빈 칸에 기본값을 넣는다. MCP 만 기본값 없이 필수 칸을
 * 검사해서, 크기·업스케일 같은 필수 칸이 있는 판은 호출자가 모든 칸을 직접 적지 않으면 막혔다.
 * 같은 규칙으로 채워 보내면 작업 기록(계속하기·재시도)에도 실제로 쓴 값이 남는다.
 *
 * 첨부 칸(이미지·영상·오디오)은 기본값이 없으므로 건드리지 않는다.
 */

import { ATTACHMENT_FIELD_TYPES } from '../constants/serverTypes.js';

const valueOf = (v) => (v && typeof v === 'object' && v.value !== undefined ? v.value : v);
const isEmpty = (v) => v === undefined || v === null || v === '';

/**
 * @param {{ additionalInputFields?: object[] }} wb
 * @param {Record<string, unknown>} additionalParams 호출자가 준 값 (select 는 이미 {key, value} 로 바뀐 상태)
 * @returns {{ additionalParams: Record<string, unknown>, filled: string[] }} 새 객체와 기본값으로 채운 칸 이름
 */
export function fillFieldDefaults(wb, additionalParams = {}) {
  const params = { ...additionalParams };
  const filled = [];
  for (const field of (wb?.additionalInputFields || []).filter(Boolean)) {
    if (ATTACHMENT_FIELD_TYPES.includes(field.type)) continue;
    if (!isEmpty(params[field.name])) continue;

    if (field.type === 'select' && field.options?.length > 0) {
      const want = valueOf(field.defaultValue);
      const option = (!isEmpty(want) && field.options.find((o) => o.value === want || o.key === want))
        || field.options[0];
      params[field.name] = { key: option.key, value: option.value };
      filled.push(field.name);
    } else if (!isEmpty(valueOf(field.defaultValue))) {
      params[field.name] = field.defaultValue;
      filled.push(field.name);
    }
  }
  return { additionalParams: params, filled };
}
