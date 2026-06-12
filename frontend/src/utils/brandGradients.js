// 브랜드 그라데이션 — 디자인 핸드오프 팔레트 기반. 단일 소스 (#542).
// 과거 페이지별 사본(6종 vs 5종)이 달라 같은 id 가 화면마다 다른 색이 되던 문제를 통합.
// v2 (Warm Studio / Console) 조화 세트 — 양 모드에서 성립하는 미드톤 (#554)
export const BRAND_GRADIENTS = [
  'linear-gradient(135deg, #C96A3B 0%, #E0945F 100%)',
  'linear-gradient(135deg, #7A5CC4 0%, #9B7CE0 100%)',
  'linear-gradient(135deg, #4A7DBF 0%, #7CA8E0 100%)',
  'linear-gradient(135deg, #4D8A4D 0%, #6FB06F 100%)',
  'linear-gradient(135deg, #2AA890 0%, #3DD6B8 100%)',
  'linear-gradient(135deg, #6E6557 0%, #A39A8A 100%)',
];

// id(문자열) 해시로 결정적 선택 — 모든 화면에서 동일 id = 동일 그라데이션 보장
export function gradientForId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BRAND_GRADIENTS[h % BRAND_GRADIENTS.length];
}
