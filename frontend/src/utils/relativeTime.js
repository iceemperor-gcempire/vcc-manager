// 상대 시각 표기 — "방금 / N분 전 / N시간 전 / 어제 / N일 전 / yy. M. d." (#542 공용화)
// Date 객체와 ISO 문자열 모두 허용 (기존 3중복 구현의 superset).
export function relativeTime(input) {
  if (!input) return '';
  const then = input instanceof Date ? input.getTime() : new Date(input).getTime();
  if (Number.isNaN(then)) return '';
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  const d = new Date(then);
  return `${String(d.getFullYear()).slice(2)}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
