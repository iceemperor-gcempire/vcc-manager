// 작업판 즐겨찾기 (#1216) — 목록·생성 화면의 별 버튼과 대시보드 "즐겨찾기 작업판" 칸이 같이 쓴다.

/** GET /api/workboards/favorites 응답(axios) → 즐겨찾기 판 id 의 Set (문자열) */
export function favoriteIdsFrom(response) {
  const ids = response?.data?.data?.favoriteIds;
  return new Set(Array.isArray(ids) ? ids.map(String) : []);
}

/** 같은 응답 → 대시보드에 그릴 판 목록 (즐겨찾기한 순서) */
export function favoriteWorkboardsFrom(response) {
  const list = response?.data?.data?.workboards;
  return Array.isArray(list) ? list : [];
}

/**
 * 작업판을 여는 경로 — 텍스트 판은 프롬프트 생성 화면, 나머지는 생성 화면.
 * 작업판 목록(카탈로그)과 대시보드가 같은 규칙을 쓴다.
 */
export function workboardRunPath(workboard, projectId) {
  const id = workboard?._id;
  const base = (workboard?.outputFormat || 'image') === 'text' ? '/prompt-generate' : '/generate';
  const query = projectId ? `?projectId=${projectId}` : '';
  return `${base}/${id}${query}`;
}

/** 토글 결과 알림 문구 */
export function favoriteToggleMessage(isFavorite) {
  return isFavorite ? '즐겨찾기에 추가했습니다' : '즐겨찾기에서 뺐습니다';
}
