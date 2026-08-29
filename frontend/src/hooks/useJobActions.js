import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { jobAPI, userAPI } from '../services/api';
import { useConfirm } from '../components/common/ConfirmDialog';

// 작업(job) 공통 액션 — 재시도 / 취소 / 삭제 (#728).
//
// 히스토리는 두 화면에 서로 다른 레이아웃으로 존재한다:
//   - pages/JobHistory.js            전역 통합 피드 (사이드바 → 작업 히스토리)
//   - components/common/JobHistoryPanel.js  프로젝트 상세용 패널
// 레이아웃은 다르지만 **동작은 같아야 한다**. 예전에는 각자 구현해서 전역 피드에만
// 재시도가 빠져 있었다 (실패를 가장 먼저 만나는 화면에 복구 경로가 없었음).
// 액션을 여기로 모아 한쪽에만 기능이 붙는 사고를 구조적으로 막는다.
//
// invalidateKeys: 액션 성공 후 무효화할 쿼리 키 배열 (화면마다 다름)

const asKeyArray = (keys) =>
  (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map((k) => (Array.isArray(k) ? k : [k]));

export function useJobActions({ invalidateKeys }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const { data: profileData } = useQuery({ queryKey: ['userProfile'], queryFn: () => userAPI.getProfile() });
  const preferences = profileData?.data?.user?.preferences || {};

  const invalidate = () => {
    asKeyArray(invalidateKeys).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  const retryMutation = useMutation({
    mutationFn: jobAPI.retry,
    onSuccess: () => { toast.success('작업을 재시도합니다'); invalidate(); },
    onError: (error) => toast.error('재시도 실패: ' + (error.response?.data?.message || error.message)),
  });

  const cancelMutation = useMutation({
    mutationFn: jobAPI.cancel,
    onSuccess: () => { toast.success('작업이 취소되었습니다'); invalidate(); },
    onError: (error) => toast.error('취소 실패: ' + (error.response?.data?.message || error.message)),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, deleteContent }) => jobAPI.delete(id, deleteContent),
    onSuccess: (response) => {
      const { deletedImagesCount = 0, deletedVideosCount = 0 } = response.data || {};
      if (deletedImagesCount > 0 || deletedVideosCount > 0) {
        toast.success(`작업과 ${deletedImagesCount}개 이미지, ${deletedVideosCount}개 동영상이 삭제되었습니다`);
        queryClient.invalidateQueries({ queryKey: ['generatedImages'] });
        queryClient.invalidateQueries({ queryKey: ['generatedVideos'] });
      } else {
        toast.success('작업이 삭제되었습니다');
      }
      invalidate();
    },
    onError: (error) => toast.error('삭제 실패: ' + (error.response?.data?.message || error.message)),
  });

  // 작업 메모 (#879) — 다이얼로그(JobMemoDialog)는 화면이 띄우고, 저장은 여기로 모은다.
  const memoMutation = useMutation({
    mutationFn: ({ id, memo }) => jobAPI.updateMemo(id, memo),
    onSuccess: () => { toast.success('메모가 저장되었습니다'); invalidate(); },
    onError: (error) => toast.error('메모 저장 실패: ' + (error.response?.data?.message || error.message)),
  });
  const saveMemo = (job, memo) => memoMutation.mutateAsync({ id: job._id, memo });

  const retry = async (job) => {
    const ok = await confirm({
      title: '작업을 재시도하시겠습니까?',
      description: '같은 입력값으로 작업을 큐에 다시 넣습니다.',
      confirmLabel: '재시도',
    });
    if (ok) retryMutation.mutate(job._id);
  };

  const cancel = async (job) => {
    const ok = await confirm({
      title: '작업을 취소하시겠습니까?',
      description: '진행 중이던 외부 API 호출까지 즉시 중단됩니다.',
      confirmLabel: '작업 취소',
      cancelLabel: '계속 진행',
    });
    if (ok) cancelMutation.mutate(job._id);
  };

  // 콘텐츠 동반 삭제는 사용자 설정(deleteContentWithHistory)에 따라 분기.
  // 동반 삭제일 때만 되돌릴 수 없으므로 danger 는 그 경우에만 붙인다.
  const remove = async (job) => {
    const contentCount = (job.resultImages?.length || 0) + (job.resultVideos?.length || 0);
    const withContent = !!preferences.deleteContentWithHistory && contentCount > 0;

    const ok = await confirm(
      withContent
        ? {
            title: '작업과 콘텐츠를 함께 삭제하시겠습니까?',
            description: `연관된 ${contentCount}개의 콘텐츠(이미지/동영상)도 같이 삭제됩니다.`,
            danger: true,
            confirmLabel: '모두 삭제',
          }
        : {
            title: '작업 히스토리를 삭제하시겠습니까?',
            description: '생성된 이미지/동영상은 보존됩니다.',
            confirmLabel: '삭제',
          }
    );
    if (ok) deleteMutation.mutate({ id: job._id, deleteContent: withContent });
  };

  return {
    retry,
    cancel,
    remove,
    saveMemo,
    isSavingMemo: memoMutation.isPending,
    preferences,
    isPending: retryMutation.isPending || cancelMutation.isPending || deleteMutation.isPending,
  };
}

export default useJobActions;
