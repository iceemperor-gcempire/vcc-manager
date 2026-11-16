// 파이프라인 단계의 "AI 프롬프트로 먼저 늘려 쓰기" (#1212).
//
// 이미지·영상 단계가 생성 전에 텍스트 판으로 프롬프트를 늘려 쓴다. 생성 화면의 AI 프롬프트 생성(#1109)과
// 같은 합성이다 — 텍스트 판은 어느 LLM 으로 쓸지, 단계의 판(promptGeneratorInstructions)은 어떤 형식으로
// 쓸지를 정한다. 저장(routes/pipelines)·가져오기(routes/projects)·실행(pipelineRunService)이 이 모듈의
// 판정을 함께 쓴다 — 각자 판정하면 한쪽만 고쳐지는 사고가 난다 (#794/#802).

// 요청 문장 없이 이미지만 있을 때 LLM 에 보내는 요청. 빈 user 메시지는 모델마다 반응이 제각각이다.
const IMAGE_ONLY_REQUEST = '요청 문장 없이 이미지만 주어졌다. 첨부한 이미지를 바탕으로, 지침에 맞는 프롬프트를 써라.';

/**
 * 요청 본문의 promptEnhance 를 저장할 모양으로 정리한다.
 * 꺼져 있어도 고른 텍스트 판·입력은 남긴다 (껐다 켜도 다시 고르지 않게).
 * @returns {Object|undefined} 아무것도 정하지 않았으면 undefined
 */
function normalizePromptEnhance(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const enabled = raw.enabled === true;
  const wb = raw.workboardId;
  const workboardId = (wb && typeof wb === 'object' && wb._id) ? wb._id : (wb || undefined);
  if (!enabled && !workboardId) return undefined;
  const inputs = raw.inputs && typeof raw.inputs === 'object' && !Array.isArray(raw.inputs) ? raw.inputs : {};
  return {
    enabled,
    workboardId: workboardId || undefined,
    inputs,
    includeImages: raw.includeImages !== false,
  };
}

/** 실행 때 늘려 쓰기를 할 단계인가 — 켜져 있고 텍스트 판이 정해져 있어야 한다 */
function isPromptEnhanceOn(step) {
  return !!(step?.promptEnhance?.enabled && step.promptEnhance.workboardId);
}

/**
 * 단계 판과 텍스트 판의 조합 검사 — 저장 검사와 실행 직전 검사가 같은 규칙을 쓴다.
 * @param {Object} args
 * @param {Object} args.stepWorkboard 단계 판 (outputFormat)
 * @param {Object} [args.enhancerWorkboard] 늘려 쓸 텍스트 판. 없으면 찾지 못한 것
 * @param {number} args.stepNumber 1부터 세는 단계 번호 (메시지용)
 * @returns {string|null} 문제가 있으면 사용자에게 보일 메시지
 */
function findPromptEnhanceProblem({ stepWorkboard, enhancerWorkboard, stepNumber }) {
  if (stepWorkboard?.outputFormat === 'text') {
    return `${stepNumber}단계: 텍스트 단계에는 AI 프롬프트 늘려 쓰기를 켤 수 없습니다`;
  }
  if (!enhancerWorkboard) {
    return `${stepNumber}단계: AI 프롬프트에 쓸 텍스트 판을 찾을 수 없습니다`;
  }
  if (enhancerWorkboard.outputFormat !== 'text') {
    return `${stepNumber}단계: AI 프롬프트에는 텍스트 판만 쓸 수 있습니다 (${enhancerWorkboard.name})`;
  }
  return null;
}

module.exports = {
  IMAGE_ONLY_REQUEST,
  normalizePromptEnhance,
  isPromptEnhanceOn,
  findPromptEnhanceProblem,
};
