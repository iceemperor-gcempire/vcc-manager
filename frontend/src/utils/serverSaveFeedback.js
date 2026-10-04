// 서버 추가·수정 결과 알림 (#1013).
// 백엔드는 저장한 뒤 연결 확인까지 마치고 응답한다. 연결 확인이 실패해도 저장은 된 상태라,
// "성공" 한 줄로 끝내면 주소가 틀린 걸 알 수 없다 — 실패면 저장 사실과 사유를 함께 알린다.

export const SERVER_SAVING_LABEL = '저장하고 연결 확인 중…';

/**
 * healthCheck 는 응답의 data.healthCheck — 이번 요청에서 연결을 확인했을 때만 온다.
 * (서버 문서에 저장된 예전 결과를 보면 이름만 바꾼 수정에도 지난 실패를 다시 알리게 된다)
 *
 * @param {{ isEdit: boolean, healthCheck?: { status?: string, errorMessage?: string|null } | null }} args
 * @returns {{ tone: 'success' | 'warning', message: string }}
 */
export function serverSaveFeedback({ isEdit, healthCheck }) {
  const saved = isEdit ? '서버를 수정했습니다.' : '서버를 추가했습니다.';
  if (healthCheck?.status !== 'unhealthy') return { tone: 'success', message: saved };

  const reason = healthCheck.errorMessage ? ` (${healthCheck.errorMessage})` : '';
  return {
    tone: 'warning',
    message: `${saved} 다만 연결 확인에 실패했어요${reason}. 주소와 API 키를 확인해 주세요.`,
  };
}
