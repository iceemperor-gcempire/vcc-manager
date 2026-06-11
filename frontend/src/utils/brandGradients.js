// 브랜드 그라데이션 — 디자인 핸드오프 팔레트 기반. 단일 소스 (#542).
// 과거 페이지별 사본(6종 vs 5종)이 달라 같은 id 가 화면마다 다른 색이 되던 문제를 통합.
export const BRAND_GRADIENTS = [
  'linear-gradient(135deg, #7B4DD8 0%, #5B5BD6 50%, #2F77E4 100%)',
  'linear-gradient(135deg, #2F77E4 0%, #4E8EE8 100%)',
  'linear-gradient(135deg, #BE7415 0%, #D69021 100%)',
  'linear-gradient(135deg, #1F9D55 0%, #2EBA6B 100%)',
  'linear-gradient(135deg, #D5383E 0%, #BE7415 100%)',
  'linear-gradient(135deg, #5B616E 0%, #8A8F9A 100%)',
];

// id(문자열) 해시로 결정적 선택 — 모든 화면에서 동일 id = 동일 그라데이션 보장
export function gradientForId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BRAND_GRADIENTS[h % BRAND_GRADIENTS.length];
}
