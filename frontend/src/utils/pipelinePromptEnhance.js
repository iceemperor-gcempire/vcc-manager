// 파이프라인 단계의 "AI 프롬프트로 먼저 늘려 쓰기" (#1212) — 편집기에서 쓰는 순수 함수.
//
// 저장 모양의 판정(정리·검사)은 백엔드 src/utils/promptEnhance.js 가 맡는다. 여기는 화면 상태와
// 요청 본문 사이를 옮기는 일만 한다 — 같은 규칙을 양쪽에 두지 않는다.

const idOf = (v) => (v && typeof v === 'object' ? v._id : v) || '';

/** 이미지·영상 단계인가 — 늘려 쓰기는 이 단계에서만 켤 수 있다 */
export function isImageOrVideoStep(step) {
  const f = step?.workboard?.outputFormat;
  return f === 'image' || f === 'video';
}

/** 이 단계가 LLM 을 부르는가 — 텍스트 단계이거나, 늘려 쓰기를 켠 이미지·영상 단계. 단계 문서는 이때만 쓰인다 */
export function stepUsesLlm(step) {
  if (step?.workboard?.outputFormat === 'text') return true;
  return isImageOrVideoStep(step) && step?.promptEnhance?.enabled === true;
}

/** 불러온 정의(텍스트 판이 populate 됨) → 편집기 상태. 설정이 없으면 undefined */
export function fromLoadedPromptEnhance(pe) {
  if (!pe) return undefined;
  const board = pe.workboardId && typeof pe.workboardId === 'object' ? pe.workboardId : null;
  return {
    enabled: pe.enabled === true,
    workboardId: idOf(pe.workboardId) || undefined,
    workboard: board || undefined,
    inputs: pe.inputs && typeof pe.inputs === 'object' ? pe.inputs : {},
    includeImages: pe.includeImages !== false,
  };
}

/** 편집기 상태 → 저장 요청 본문. 이미지·영상 단계가 아니거나 아무것도 정하지 않았으면 undefined */
export function toPromptEnhancePayload(step) {
  const pe = step?.promptEnhance;
  if (!pe || !isImageOrVideoStep(step)) return undefined;
  const workboardId = idOf(pe.workboardId) || undefined;
  if (!pe.enabled && !workboardId) return undefined;
  return {
    enabled: pe.enabled === true,
    workboardId,
    inputs: pe.inputs || {},
    includeImages: pe.includeImages !== false,
  };
}

/** 켰는데 텍스트 판을 고르지 않은 단계 번호 (1부터) */
export function stepsMissingEnhancer(steps) {
  return (steps || [])
    .map((s, i) => (isImageOrVideoStep(s) && s?.promptEnhance?.enabled && !idOf(s.promptEnhance.workboardId) ? i + 1 : null))
    .filter((n) => n !== null);
}
