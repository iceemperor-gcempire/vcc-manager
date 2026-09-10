/**
 * GPT-Image-2.5 단가 반영 (#943).
 * 스냅샷 id 로도 단가를 찾아야 한다 — 못 찾으면 비용이 조용히 null 이 된다.
 */
const { computeOpenAIImageCost } = require('../utils/pricing');

const usage = {
  input_tokens: 31,
  input_tokens_details: { text_tokens: 31, image_tokens: 0 },
  output_tokens: 205,
  total_tokens: 236,
};

describe('computeOpenAIImageCost — GPT-Image-2.5 (#943)', () => {
  test('flare / sunburst 별칭이 단가표에 있다', () => {
    for (const model of ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst']) {
      const c = computeOpenAIImageCost(model, usage);
      expect(c).not.toBeNull();
      // 출력 205토큰 × $30/1M = $0.00615, 입력 31토큰 × $5/1M = $0.000155
      expect(c.breakdown.output).toBeCloseTo(0.00615, 6);
      expect(c.breakdown.inputText).toBeCloseTo(0.000155, 6);
      expect(c.pricingVersion).toBe('2026-09');
    }
  });

  test('날짜 스냅샷 id 도 별칭 단가로 계산된다', () => {
    const alias = computeOpenAIImageCost('gpt-image-2.5-flare', usage);
    const snap = computeOpenAIImageCost('gpt-image-2.5-flare-2026-09-08', usage);
    expect(snap).not.toBeNull();
    expect(snap.amount).toBe(alias.amount);
  });

  test('gpt-image-2 스냅샷도 마찬가지 (회귀 방지)', () => {
    expect(computeOpenAIImageCost('gpt-image-2-2026-04-21', usage)).not.toBeNull();
  });

  test('모르는 모델은 여전히 null', () => {
    expect(computeOpenAIImageCost('gpt-image-9', usage)).toBeNull();
  });
});
