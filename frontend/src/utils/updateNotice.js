// 버전 업데이트 공지 (#999) — 화면 판단만. 어떤 섹션을 보여줄지는 백엔드(GET /api/updatelog/notice)가 정한다.

export function noticeTitle(sections) {
  if (!sections?.length) return '';
  if (sections.length === 1) return `v${sections[0].version} 업데이트`;
  return `업데이트 ${sections.length}건 (v${sections[sections.length - 1].version} → v${sections[0].version})`;
}

// "기존 사용자가 할 일" 이 하나라도 있으면 맨 위에 알린다
export function needsActionAlert(sections) {
  return Boolean(sections?.some((s) => s.hasActionItems));
}
