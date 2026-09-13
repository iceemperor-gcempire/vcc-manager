// 실행 기록의 단계와 정의(파이프라인·작업 절차)의 단계가 아직 같은지 (#952).
//
// 실행 기록은 만들 때 정의의 단계별 작업판을 복사해 두고, 실행기는 입력·문서를 정의에서 읽는다.
// 그 사이 정의가 바뀌면(단계 추가·삭제·작업판 교체) 한 단계 안에서 옛 작업판과 다른 작업판용
// 입력·문서가 섞인다. 참조 실행이라 정의 수정은 막지 않고 새 실행부터 반영되므로,
// 어긋난 옛 실행(대기 중이던 실행·재시도)은 멈춘다.

const idOf = (v) => String(v && typeof v === 'object' && v._id ? v._id : v);

/**
 * @param {Array} definitionSteps 정의의 단계 (workboardId 포함)
 * @param {Array} runSteps 실행 기록의 단계 (workboardId 포함)
 * @returns {{ stepIndex: number, reason: 'workboard'|'count' } | null} 어긋난 첫 지점
 */
function findDefinitionMismatch(definitionSteps, runSteps) {
  const def = definitionSteps || [];
  const run = runSteps || [];
  const common = Math.min(def.length, run.length);
  for (let i = 0; i < common; i++) {
    if (idOf(def[i].workboardId) !== idOf(run[i].workboardId)) {
      return { stepIndex: i, reason: 'workboard' };
    }
    // 작업 절차는 단계 _id 도 비교한다 — 실행 입력이 단계 id 로 저장되기 때문이다 (#953).
    // 파이프라인 단계는 _id 가 없어 이 비교를 건너뛴다.
    if (run[i].stepId && def[i]._id && idOf(def[i]._id) !== idOf(run[i].stepId)) {
      return { stepIndex: i, reason: 'step' };
    }
  }
  if (def.length !== run.length) return { stepIndex: common, reason: 'count' };
  return null;
}

module.exports = { findDefinitionMismatch, idOf };
