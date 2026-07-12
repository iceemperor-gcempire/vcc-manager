import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Box, CircularProgress, Alert } from '@mui/material';
import toast from 'react-hot-toast';
import { workboardAPI } from '../../services/api';
import { WorkboardEditor } from '../../components/admin/WorkboardManagement';
import { invalidateWorkboardQueries } from '../../utils/queryInvalidation';

// #437 Phase A — 기존 WorkboardDetailDialog 를 페이지 안에 그대로 렌더 (asPage prop).
// 데이터 fetch / update mutation / unsaved 경고는 본 페이지가 소유.
function WorkboardEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({ queryKey: ['adminWorkboard', id], queryFn: () => workboardAPI.getByIdAdmin(id), enabled: !!id, staleTime: 0 });

  const workboard = data?.data?.workboard;

  // unsaved 경고: WorkboardDetailDialog 내부 react-hook-form 의 dirty 신호를 외부로 끌어올려야
  // 정밀하게 동작 (false-positive 회피). Phase B 에서 dirty lift + useBlocker 로 처리.

  const updateMutation = useMutation({ mutationFn: (updateData) => workboardAPI.update(id, updateData),
      onSuccess: () => {
        toast.success('작업판이 수정되었습니다');
        invalidateWorkboardQueries(queryClient);
        navigate('/admin/workboards');
      },
      onError: (err) => {
        toast.error('수정 실패: ' + (err?.message || ''));
      } });

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !workboard) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">작업판을 불러올 수 없습니다.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      <WorkboardEditor
        workboard={workboard}
        onCancel={() => navigate('/admin/workboards')}
        onSave={(updateData) => updateMutation.mutate(updateData)}
      />
    </Container>
  );
}

export default WorkboardEditorPage;
