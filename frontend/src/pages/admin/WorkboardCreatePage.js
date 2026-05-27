import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import { Container } from '@mui/material';
import toast from 'react-hot-toast';
import { workboardAPI } from '../../services/api';
import { getWorkboardTemplate } from '../../templates';
import { WorkboardCreateDialog } from '../../components/admin/WorkboardManagement';

// #437 Phase A — WorkboardCreateDialog 를 페이지로. 생성 성공 시 편집 페이지로 이동.
function WorkboardCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    workboardAPI.create,
    {
      onSuccess: (response) => {
        toast.success('작업판이 생성되었습니다');
        queryClient.invalidateQueries('adminWorkboards');
        const newId = response?.data?.workboard?._id;
        if (newId) {
          navigate(`/admin/workboards/${newId}/edit`, { replace: true });
        } else {
          navigate('/admin/workboards', { replace: true });
        }
      },
      onError: (err) => {
        toast.error('생성 실패: ' + (err?.message || ''));
      }
    }
  );

  const handleSave = (data) => {
    const serverType = data.serverType || 'ComfyUI';
    const outputFormat = data.outputFormat || 'image';
    const template = getWorkboardTemplate(serverType, outputFormat);
    const { serverType: _omit, ...rest } = data;
    const workboardData = {
      ...rest,
      outputFormat,
      ...template,
    };
    createMutation.mutate(workboardData);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 2, mb: 4 }}>
      <WorkboardCreateDialog
        asPage
        onCancel={() => navigate('/admin/workboards')}
        onSave={handleSave}
      />
    </Container>
  );
}

export default WorkboardCreatePage;
