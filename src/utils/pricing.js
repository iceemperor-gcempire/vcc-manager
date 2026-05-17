// Provider 별 토큰 단가표 + 비용 산출 (#364).
// admin billing API 없이도 자체 측정 가능한 비용 추정.
// 단가는 \$/1M tokens 단위. 갱신 시 PRICING_VERSION 도 함께 올려야 과거 저장된
// 추정치가 \"어느 시점의 단가로 계산됐는지\" 추적 가능.

// 가격표는 2026-05 기준. provider 가 가격 변경 시 이 값과 PRICING_VERSION 갱신.
const PRICING_VERSION = '2026-05';

// 단위: USD per 1,000,000 tokens
const OPENAI_IMAGE_PRICING = {
  'gpt-image-1': {
    input_text: 5,
    input_image: 10,
    output: 40,
  },
  // gpt-image-1.5 — gpt-image-1 과 2 의 중간 정도 단가 (정확한 공식 단가 미공개 추정)
  'gpt-image-1.5': {
    input_text: 5,
    input_image: 9,
    output: 35,
  },
  'gpt-image-2': {
    input_text: 5,
    input_image: 8,
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

module.exports = {
  PRICING_VERSION,
  OPENAI_IMAGE_PRICING,
  computeOpenAIImageCost,
};
