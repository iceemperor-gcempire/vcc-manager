// 작업 소요 시간 표시 (#879). JobHistoryPanel 의 JobCard 안에 있던 것을 승격 —
// 작업 히스토리 페이지(pages/JobHistory.js) 에도 같은 표기가 필요해졌다.
// 두 화면이 서로 다른 표기를 갖지 않도록 여기 하나만 쓴다.
//
// @param {number|null|undefined} ms — 밀리초 (ImageGenerationJob.actualTime)
// @returns {string} '-' | '45초' | '1분 32초' | '1시간 2분'
export function formatDuration(ms) {
  if (!ms || ms < 0) return '-';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
  return `${seconds}초`;
}

export default formatDuration;
