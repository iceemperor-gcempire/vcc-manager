import React, { useState } from 'react';
import { copyToClipboard } from '../utils/clipboard';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { promptDataAPI } from '../services/api';
import PromptDataPanel from '../components/common/PromptDataPanel';
import PromptDataFormDialog from '../components/common/PromptDataFormDialog';
import WorkboardSelectDialog from '../components/common/WorkboardSelectDialog';
import PageHeader from '../components/common/PageHeader';

function PromptDataList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromptData, setEditingPromptData] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [workboardSelectOpen, setWorkboardSelectOpen] = useState(false);
  const [selectedPromptData, setSelectedPromptData] = useState(null);

  const createMutation = useMutation({ mutationFn: promptDataAPI.create,
    onSuccess: () => {
      toast.success('프롬프트 데이터가 생성되었습니다');
      queryClient.invalidateQueries({ queryKey: ['promptDataList'] });
      setFormOpen(false);
    },
    onError: () => toast.error('프롬프트 데이터 생성 실패') });

  const updateMutation = useMutation({ mutationFn: ({ id, data }) => promptDataAPI.update(id, data),
      onSuccess: () => {
        toast.success('프롬프트 데이터가 수정되었습니다');
        queryClient.invalidateQueries({ queryKey: ['promptDataList'] });
        setFormOpen(false);
        setEditingPromptData(null);
      },
      onError: () => toast.error('프롬프트 데이터 수정 실패') });

  const deleteMutation = useMutation({ mutationFn: promptDataAPI.delete,
    onSuccess: () => {
      toast.success('프롬프트 데이터가 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: ['promptDataList'] });
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    },
    onError: () => toast.error('프롬프트 데이터 삭제 실패') });

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
      // 프롬프트 데이터로 새로 생성 — 히스토리 계속하기가 아니라 base_model 복원 대상이 없다 (#792)
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
    copyToClipboard(promptData.prompt);
    toast.success('프롬프트가 클립보드에 복사되었습니다');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <PageHeader
        title="프롬프트 데이터"
        description="자주 쓰는 프롬프트를 저장해 두고 작업판 실행에서 불러옵니다."
        actions={
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
        }
      />

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
