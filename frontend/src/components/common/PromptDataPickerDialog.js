import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from '@mui/material';
import PromptDataPanel from './PromptDataPanel';
import { projectAPI } from '../../services/api';

// PipelineBuilder step 의 사전 입력에서 PromptData 를 골라 prefill 하기 위한 picker (#431).
// 데이터 소스: projectAPI.getPromptData — 현재 프로젝트에 매핑된 PromptData 만.
function PromptDataPickerDialog({ open, onClose, projectId, onSelect }) {
  if (!projectId) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>프롬프트 데이터 선택</DialogTitle>
      <DialogContent dividers>
        <Box mb={1.5}>
          <Typography variant="body2" color="text.secondary">
            선택한 프롬프트의 prompt / negativePrompt / seed 값이 단계의 입력으로 채워집니다.
            작업판에 해당 customField 가 없으면 무시됩니다.
          </Typography>
        </Box>
        <PromptDataPanel
          fetchFn={(params) => projectAPI.getPromptData(projectId, params)}
          queryKey={`pickerProjectPromptData-${projectId}`}
          showSearch
          showCreateButton={false}
          pageSize={12}
          onSelect={(item) => {
            onSelect(item);
            onClose();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default PromptDataPickerDialog;
