// 작업 히스토리 항목 표시 로직 (#805 · #808).
//
// HistoryRow 안에 인라인으로 있던 부제 계산을 뺐다. 그 코드는 image/video/text 를 거른 뒤
// **나머지를 파이프라인으로 가정**하고 `item.stepStatuses.length` 를 읽었는데, 오디오 축이
// 생기며 type 'audio' 가 그리로 떨어져 `undefined.length` 로 목록 전체가 렌더 실패했다.
//
// 새 미디어 타입이 늘어도 화면이 죽지 않아야 한다 — 그것을 테스트로 고정하려고 분리했다.

/** 클릭 시 뷰어가 열리는 미디어 항목 타입 */
export const MEDIA_ITEM_TYPES = ['image', 'video', 'audio'];

/**
 * 계속하기 · 다른 작업 버튼을 보일지 (#1215).
 *
 * 미디어 작업이면 상태와 관계없이 보인다. 실패한 작업도 입력값(프롬프트·이미지·설정)을
 * 불러와 고쳐 다시 돌리거나 다른 작업판으로 옮길 수 있어야 한다. 이어가기 흐름
 * (`useContinueJob`)은 결과 미디어가 없는 작업도 받는다. 작업판 화면의 히스토리 패널은
 * 이미 완료·실패 둘 다 보여 주고 있었다.
 */
export function canContinueHistoryItem(item) {
  return !!item && MEDIA_ITEM_TYPES.includes(item.type);
}

const seconds = (v) => (v != null ? `${Math.round(v)}초` : '');

/**
 * 히스토리 행의 부제 문자열.
 *
 * 알 수 없는 타입이 들어와도 **던지지 않는다.** 표시가 빈약해질 뿐이며,
 * 목록 전체가 사라지는 것보다 낫다.
 */
export function buildHistorySubtitle(item) {
  if (!item) return '';
  const parts = (() => {
    switch (item.type) {
      case 'image':
        return [item.projectName, item.model, item.res, item.count ? `${item.count}장` : ''];
      case 'video':
        return [item.projectName, item.model, item.res, seconds(item.duration)];
      case 'audio':
        return [item.projectName, item.model, seconds(item.duration)];
      case 'text':
        return [item.model, item.tokens != null ? `${item.tokens.toLocaleString()} 토큰` : ''];
      case 'pipeline':
        return [item.projectName, item.stepStatuses?.length ? `${item.stepStatuses.length}단계` : '', item.input];
      default:
        // 새 타입이 추가됐는데 여기 반영이 안 된 경우 — 최소한의 정보만 보여주고 넘어간다
        return [item.projectName, item.model];
    }
  })();
  return parts.filter(Boolean).join(' · ');
}
