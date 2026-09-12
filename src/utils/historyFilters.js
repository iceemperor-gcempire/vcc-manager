// 사용자 작업 히스토리 목록 필터 (#952).
//
// 작업 절차 실행의 단계로 만들어진 작업은 일반 작업 히스토리에 넣지 않는다. 작업 절차 실행 기록
// 안에서 단계별로 보여주므로, 여기서 빼지 않으면 같은 결과가 두 곳에 겹쳐 뜬다.
// 사용자 히스토리 목록(전역 /jobs/my · /conversations/my, 프로젝트 /:id/jobs · /:id/conversations)이
// 모두 이 함수를 거친다 — 한 곳이라도 빠지면 그 화면에만 겹침이 남는다 (historyFilters.test 가 가드).
//
// 개인 파이프라인의 단계 작업은 표시가 없어 그대로 보인다 — 개인 파이프라인 분리 때 정리한다.

/**
 * @param {Object} filter 기존 mongo 필터
 * @returns {Object} 작업 절차 단계 작업을 뺀 필터 (sequenceRunId 가 없거나 null 인 것만)
 */
function excludeSequenceStepJobs(filter = {}) {
  return { ...filter, sequenceRunId: null };
}

module.exports = { excludeSequenceStepJobs };
