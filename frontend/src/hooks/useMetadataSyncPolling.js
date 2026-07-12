import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// 메타데이터 동기화 상태 2초 폴링 — MetadataPickerModal / MetadataManagementBody 공용 (#697).
// syncing 이 true 인 동안 adapter.getStatus 를 폴링하고, 종료 상태(completed/failed/idle)에서
// syncing 을 내리며 완료 토스트 + onCompleted(목록 재조회) 를 호출한다.
//
// adapter / onCompleted 는 ref 로 들고 있어 의존성 변화로 폴링이 재시작되지 않는다
// (기존 양쪽 구현 모두 syncing/serverId 외 의존성은 사실상 고정이었음).
export default function useMetadataSyncPolling({
  adapter,
  serverId,
  syncing,
  setSyncing,
  setSyncStatus,
  onCompleted,
}) {
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  useEffect(() => {
    if (!syncing || !serverId) return undefined;
    const interval = setInterval(async () => {
      try {
        const response = await adapterRef.current.getStatus(serverId);
        const status = response.data.data;
        setSyncStatus(status);
        if (['completed', 'failed', 'idle'].includes(status.status)) {
          setSyncing(false);
          if (status.status === 'completed') {
            toast.success(`${adapterRef.current.label} 동기화가 완료되었습니다.`);
            if (onCompletedRef.current) onCompletedRef.current();
          } else if (status.status === 'failed') {
            toast.error(`동기화 실패: ${status.errorMessage || '알 수 없는 오류'}`);
          }
        }
      } catch (err) {
        console.error('Failed to get sync status:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
    // adapter/onCompleted 는 ref 경유 — 의도적으로 의존성 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing, serverId, setSyncing, setSyncStatus]);
}

// 서버 선택/모달 open 시 진행 중이던 동기화를 이어받기 — 양쪽 공용 초기 상태 확인 (#697).
export async function checkInitialSyncStatus(adapter, serverId, { setSyncStatus, setSyncing }) {
  try {
    const response = await adapter.getStatus(serverId);
    const status = response.data.data;
    setSyncStatus(status);
    if (status.status === 'fetching') setSyncing(true);
  } catch (err) {
    console.error(err);
  }
}
