// Provider 별 토큰 단가표 + 비용 산출 (#364).
// admin billing API 없이도 자체 측정 가능한 비용 추정.
// 단가는 \$/1M tokens 단위. 갱신 시 PRICING_VERSION 도 함께 올려야 과거 저장된
// 추정치가 \"어느 시점의 단가로 계산됐는지\" 추적 가능.

// 가격표는 2026-05 기준. 출처: https://developers.openai.com/api/docs/pricing
const PRICING_VERSION = '2026-05';

// 단위: USD per 1,000,000 tokens
const OPENAI_IMAGE_PRICING = {
  // gpt-image-1: 공식 페이지에서 제거됨. legacy 추정값 유지 (deprecated)
  'gpt-image-1': {
    input_text: 5,
    input_image: 10,
    output: 40,
  },
  'gpt-image-1-mini': {
    input_text: 2,
    input_image: 2.5,
    input_image_cached: 0.25,
    output: 8,
  },
  'gpt-image-1.5': {
    input_text: 5,
    input_image: 8,
    input_image_cached: 2,
    output: 32,
  },
  'gpt-image-2': {
    input_text: 5,
    input_image: 8,
    input_image_cached: 2,
    output: 30,
  },
};

const PER_TOKEN = 1 / 1_000_000;

/**
 * OpenAI 이미지 생성 응답의 usage 로부터 비용 (USD) 추정 (#364).
 * @param {string} model — 모델 id (예: 'gpt-image-1.5')
 * @param {Object} usage — OpenAI 응답의 usage 객체
 *   { input_tokens, input_tokens_details: { text_tokens, image_tokens }, output_tokens, total_tokens }
 * @returns {{ amount: number, currency: string, pricingVersion: string, breakdown: object } | null}
 *   매핑된 단가가 없으면 null.
 */
function computeOpenAIImageCost(model, usage) {
  if (!usage || typeof usage !== 'object') return null;
  const rates = OPENAI_IMAGE_PRICING[model];
  if (!rates) return null;

  const inputText = Number(usage.input_tokens_details?.text_tokens) || 0;
  const inputImage = Number(usage.input_tokens_details?.image_tokens) || 0;
  const output = Number(usage.output_tokens) || 0;

  const costText = inputText * rates.input_text * PER_TOKEN;
  const costImage = inputImage * rates.input_image * PER_TOKEN;
  const costOutput = output * rates.output * PER_TOKEN;
  const amount = +(costText + costImage + costOutput).toFixed(6);

  return {
    amount,
    currency: 'USD',
    pricingVersion: PRICING_VERSION,
    breakdown: {
      inputText: +costText.toFixed(6),
      inputImage: +costImage.toFixed(6),
      output: +costOutput.toFixed(6),
    },
  };
}

// Gemini 이미지 생성 모델 단가 (2026-05).
// 출처: https://ai.google.dev/gemini-api/docs/pricing
// 단위: USD per 1M tokens. output 은 per-image 가격을 모델별 평균 토큰량으로
// 환산한 추정. \"candidatesTokenCount\" 가 실제 출력 토큰량이므로 그대로 곱하면 \$/image 와 거의 일치.
// imagen-* 는 per-image 정액 — 토큰 기반 추정 대상 아님 (별도 처리 필요, Phase 2 외).
const GEMINI_IMAGE_PRICING = {
  'gemini-2.5-flash-image': {
    input_text: 0.30,
    input_image: 0.30,
    output: 30,
  },
  'gemini-2.5-flash-image-preview': {
    input_text: 0.30,
    input_image: 0.30,
    output: 30,
  },
  'gemini-3-pro-image-preview': {
    input_text: 2.00,
    input_image: 2.00,
    output: 120,
  },
  'gemini-3.1-flash-image-preview': {
    input_text: 0.50,
    input_image: 0.50,
    output: 40,
  },
};

/**
 * Gemini 이미지 생성 응답 usageMetadata → 비용 추정 (#367).
 * @param {string} model — 모델 id (예: 'gemini-3-pro-image-preview')
 * @param {Object} usage — \`response.usageMetadata\` 또는 정규화된 객체
 *   { promptTokenCount, candidatesTokenCount, totalTokenCount, cachedContentTokenCount }
 * @returns {{ amount, currency, pricingVersion, breakdown } | null}
 */
function computeGeminiImageCost(model, usage) {
  if (!usage || typeof usage !== 'object') return null;
  const rates = GEMINI_IMAGE_PRICING[model];
  if (!rates) return null;

  // Gemini 는 usageMetadata 가 prompt / candidates / total 만 노출. 입력 텍스트/이미지
  // 구분은 응답에 없어 input 전부에 input_image 단가 적용 (text == image 단가라 동일).
  const promptTokens = Number(usage.promptTokenCount ?? usage.promptTokens) || 0;
  const outputTokens = Number(usage.candidatesTokenCount ?? usage.candidatesTokens) || 0;

  const costInput = promptTokens * rates.input_image * PER_TOKEN;
  const costOutput = outputTokens * rates.output * PER_TOKEN;
  const amount = +(costInput + costOutput).toFixed(6);

  return {
    amount,
    currency: 'USD',
    pricingVersion: PRICING_VERSION,
    breakdown: {
      inputText: 0,  // Gemini 응답은 text/image 입력 구분 안 됨
      inputImage: +costInput.toFixed(6),
      output: +costOutput.toFixed(6),
    },
  };
}

module.exports = {
  PRICING_VERSION,
  OPENAI_IMAGE_PRICING,
  GEMINI_IMAGE_PRICING,
  computeOpenAIImageCost,
  computeGeminiImageCost,
};
