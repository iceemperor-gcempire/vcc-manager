// '계속하기' / '다른 작업판으로 이어가기' 페이로드 생성 (#792).
//
// 이 페이로드는 localStorage('continueJobData') 를 거쳐 ImageGeneration 이 소비한다.
// 진입점이 두 곳(JobHistoryPanel · pages/JobHistory)이고 각자 객체를 직접 조립하다가,
// #762 수정이 한쪽에만 적용되어 같은 버그가 다른 경로에 남았다. 계약을 여기 한 곳에 모은다.
//
// 소비 측 계약 (ImageGeneration.js):
//   sameWorkboard    같은 작업판 계속하기 여부. true 면 히스토리의 base_model 을 작업판
//                    기본값보다 우선 복원한다 (#762)
//   prevOutputFormat 이전 작업의 출력 타입. 크로스에서 출력 타입이 다르면 base_model
//                    prefill 을 건너뛴다 (#673)

const KEY = 'continueJobData';

// 결과물이 비디오면 'video', 아니면 'image' (#673)
function outputFormatOf(job) {
  return job?.resultVideos?.length ? 'video' : 'image';
}

/**
 * 같은 작업판에서 계속하기.
 * 히스토리에 남은 모델은 이 작업판에서 실제로 선택됐던 유효값이므로 기본값보다 우선한다.
 */
export function buildSameWorkboardContinue({ workboardId, workboard, job }) {
  return {
    workboardId,
    workboard,
    inputData: job.inputData,
    prevOutputFormat: outputFormatOf(job),
    sameWorkboard: true,
  };
}

/**
 * 다른 작업판으로 이어가기 (크로스).
 * 이전 모델이 새 작업판에서 유효하다는 보장이 없으므로 #673 안전 조건을 그대로 둔다.
 */
export function buildCrossWorkboardContinue({ workboard, job, lastGeneratedMedia }) {
  return {
    workboardId: workboard._id,
    workboard,
    inputData: job.inputData,
    lastGeneratedMedia,
    prevOutputFormat: outputFormatOf(job),
    sameWorkboard: false,
  };
}

/**
 * 작업판을 특정하지 못해 선택 페이지로 보낼 때의 최소 페이로드.
 * base_model 복원 판단에 쓰이는 필드가 없으므로 sameWorkboard 도 없다.
 */
export function buildWorkboardPickerContinue(job) {
  return { inputData: job.inputData, fromJobHistory: true };
}

export function storeContinueJobData(payload) {
  localStorage.setItem(KEY, JSON.stringify(payload));
}
