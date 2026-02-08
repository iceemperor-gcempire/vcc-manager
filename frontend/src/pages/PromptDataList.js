import React, { useState } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { promptDataAPI } from '../services/api';
import PromptDataPanel from '../components/common/PromptDataPanel';
import PromptDataFormDialog from '../components/common/PromptDataFormDialog';
import WorkboardSelectDialog from '../components/common/WorkboardSelectDialog';

function PromptDataList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromptData, setEditingPromptData] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [workboardSelectOpen, setWorkboardSelectOpen] = useState(false);
  const [selectedPromptData, setSelectedPromptData] = useState(null);

  const createMutation = useMutation(promptDataAPI.create, {
    onSuccess: () => {
      toast.success('프롬프트 데이터가 생성되었습니다');
      queryClient.invalidateQueries('promptDataList');
      setFormOpen(false);
    },
    onError: () => toast.error('프롬프트 데이터 생성 실패')
  });

  const updateMutation = useMutation(
    ({ id, data }) => promptDataAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('프롬프트 데이터가 수정되었습니다');
        queryClient.invalidateQueries('promptDataList');
        setFormOpen(false);
        setEditingPromptData(null);
      },
      onError: () => toast.error('프롬프트 데이터 수정 실패')
    }
  );

  const deleteMutation = useMutation(promptDataAPI.delete, {
    onSuccess: () => {
      toast.success('프롬프트 데이터가 삭제되었습니다');
      queryClient.invalidateQueries('promptDataList');
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    },
    onError: () => toast.error('프롬프트 데이터 삭제 실패')
  });

  const handleSave = (data) => {
    if (editingPromptData) {
      updateMutation.mutate({ id: editingPromptData._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (promptData) => {
    setEditingPromptData(promptData);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const handleQuickGenerate = (promptData) => {
    setSelectedPromptData(promptData);
    setWorkboardSelectOpen(true);
  };

  const handleWorkboardSelect = (workboard) => {
    if (selectedPromptData) {
      localStorage.setItem('continueJobData', JSON.stringify({
        workboardId: workboard._id,
        inputData: {
          prompt: selectedPromptData.prompt,
          negativePrompt: selectedPromptData.negativePrompt,
          seed: selectedPromptData.seed
        }
      }));
      promptDataAPI.use(selectedPromptData._id);
      navigate(`/generate/${workboard._id}`);
    }
    setWorkboardSelectOpen(false);
  };

  const handleCopyPrompt = (promptData) => {
    navigator.clipboard.writeText(promptData.prompt);
    toast.success('프롬프트가 클립보드에 복사되었습니다');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">프롬프트 데이터</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingPromptData(null);
            setFormOpen(true);
          }}
        >
          새 프롬프트
        </Button>
      </Box>

      <PromptDataPanel
        fetchFn={promptDataAPI.getAll}
        queryKey="promptDataList"
        pageSize={12}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onQuickGenerate={handleQuickGenerate}
        onCopyPrompt={handleCopyPrompt}
        showCreateButton={false}
      />

      <PromptDataFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingPromptData(null);
        }}
        promptData={editingPromptData}
        onSave={handleSave}
      />

      <WorkboardSelectDialog
        open={workboardSelectOpen}
        onClose={() => setWorkboardSelectOpen(false)}
        onSelect={handleWorkboardSelect}
      />

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>프롬프트 데이터 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 프롬프트 데이터를 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button
            onClick={() => deleteMutation.mutate(deletingId)}
            color="error"
            variant="contained"
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default PromptDataList;
