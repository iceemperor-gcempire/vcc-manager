import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip
} from '@mui/material';
import { Chat, Check } from '@mui/icons-material';
import { useQuery } from 'react-query';
import { workboardAPI } from '../services/api';
import PromptGeneratorPanel from './PromptGeneratorPanel';

function PromptWorkboardSelectDialog({ open, onClose, onSelect }) {
  const { data, isLoading } = useQuery(
    ['promptWorkboards'],
    () => workboardAPI.getAll({ apiFormat: 'OpenAI Compatible', limit: 50 }),
    { enabled: open }
  );

  const workboards = data?.data?.workboards || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Chat color="secondary" />
          <Typography variant="h6">프롬프트 작업판 선택</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress color="secondary" />
          </Box>
        ) : workboards.length === 0 ? (
          <Alert severity="info">
            사용 가능한 프롬프트 작업판이 없습니다.
          </Alert>
        ) : (
          <List>
            {workboards.map((wb) => (
              <ListItem key={wb._id} disablePadding>
                <ListItemButton onClick={() => onSelect(wb)}>
                  <ListItemText
                    primary={wb.name}
                    secondary={wb.description}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
      </DialogActions>
    </Dialog>
  );
}

function PromptGeneratorDialog({ open, onClose, onApply }) {
  const [selectedWorkboard, setSelectedWorkboard] = useState(null);
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState(null);

  const handleWorkboardSelect = (wb) => {
    setSelectedWorkboard(wb);
    setSelectDialogOpen(false);
    setGeneratedPrompt(null);
  };

  const handleApply = () => {
    if (generatedPrompt && onApply) {
      onApply(generatedPrompt);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedWorkboard(null);
    setGeneratedPrompt(null);
    onClose();
  };

  const handleResultChange = (result) => {
    setGeneratedPrompt(result);
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: { minHeight: '70vh' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <Chat color="secondary" />
              <Typography variant="h6">AI 프롬프트 생성</Typography>
            </Box>
            {selectedWorkboard ? (
              <Chip 
                label={selectedWorkboard.name} 
                color="secondary" 
                variant="outlined"
                onDelete={() => setSelectDialogOpen(true)}
                deleteIcon={<Typography variant="caption" sx={{ px: 1 }}>변경</Typography>}
              />
            ) : null}
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {!selectedWorkboard ? (
            <Box 
              display="flex" 
              flexDirection="column" 
              alignItems="center" 
              justifyContent="center" 
              minHeight={300}
            >
              <Chat sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
              <Typography variant="body1" color="textSecondary" mb={3}>
                프롬프트 작업판을 선택해주세요
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => setSelectDialogOpen(true)}
              >
                작업판 선택
              </Button>
            </Box>
          ) : (
            <PromptGeneratorPanel
              workboard={selectedWorkboard}
              onResultChange={handleResultChange}
              showHeader={false}
              showSystemPrompt={false}
              compact={false}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>취소</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleApply}
            disabled={!generatedPrompt}
            startIcon={<Check />}
          >
            적용
          </Button>
        </DialogActions>
      </Dialog>

      <PromptWorkboardSelectDialog
        open={selectDialogOpen}
        onClose={() => setSelectDialogOpen(false)}
        onSelect={handleWorkboardSelect}
      />
    </>
  );
}

export default PromptGeneratorDialog;
export { PromptGeneratorDialog, PromptWorkboardSelectDialog };
