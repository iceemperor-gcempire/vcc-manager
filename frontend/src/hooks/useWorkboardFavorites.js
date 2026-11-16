import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workboardAPI } from '../services/api';
import { favoriteIdsFrom, favoriteWorkboardsFrom, favoriteToggleMessage } from '../utils/workboardFavorites';

// 작업판 즐겨찾기 (#1216). 목록 카드·생성 화면 헤더·대시보드가 같은 쿼리 키를 나눠 쓴다 —
// 어디서 별을 눌러도 다른 화면이 같은 캐시를 다시 받는다.
export const WORKBOARD_FAVORITES_KEY = ['workboardFavorites'];

export function useWorkboardFavorites({ enabled = true } = {}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: WORKBOARD_FAVORITES_KEY,
    queryFn: workboardAPI.getFavorites,
    staleTime: 30 * 1000,
    enabled,
  });
  const ids = useMemo(() => favoriteIdsFrom(data), [data]);
  const workboards = useMemo(() => favoriteWorkboardsFrom(data), [data]);

  const mutation = useMutation({
    mutationFn: (id) => workboardAPI.toggleFavorite(id),
    onSuccess: (res) => {
      toast.success(favoriteToggleMessage(!!res?.data?.data?.isFavorite));
      queryClient.invalidateQueries({ queryKey: WORKBOARD_FAVORITES_KEY });
    },
    onError: (error) => toast.error(error.response?.data?.message || '즐겨찾기를 바꾸지 못했습니다'),
  });

  return {
    workboards,
    isLoading,
    isFavorite: (id) => ids.has(String(id)),
    toggle: (id) => mutation.mutate(id),
    // 같은 판의 별을 연달아 누르지 않게 — 요청 중인 판만 잠근다
    isPending: (id) => mutation.isPending && String(mutation.variables) === String(id),
  };
}

export default useWorkboardFavorites;
