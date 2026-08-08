// 프롬프트 가이드 크기 표시 (#766).
//
// 가이드는 연결된 작업판의 프롬프트 생성 요청마다 시스템 프롬프트로 실린다.
// 작업판당 여러 개를 연결할 수 있어(promptGuideIds 배열) 합산 길이가 곧 호출 비용이므로,
// 관리자가 연결 시점에 규모를 가늠할 수 있어야 한다.

// 대략적인 토큰 환산 계수. 한국어·영어가 섞인 가이드 문서 기준의 경험값이며
// 모델 토크나이저마다 달라 정확한 값이 아니다 — "규모 감" 용도로만 쓴다.
const CHARS_PER_TOKEN = 3.5;

/** 문자 수 → 대략 토큰 수 */
export function estimateTokens(charCount) {
  if (!charCount || charCount < 0) return 0;
  return Math.round(charCount / CHARS_PER_TOKEN);
}

function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

/**
 * "41.4K자 · 약 11.8K 토큰" 형태의 표시 문자열.
 * 토큰 수는 추정값이므로 "약" 을 붙여 확정값처럼 읽히지 않게 한다.
 */
export function formatGuideSize(charCount) {
  const chars = charCount || 0;
  if (chars === 0) return '0자';
  return `${formatCount(chars)}자 · 약 ${formatCount(estimateTokens(chars))} 토큰`;
}
