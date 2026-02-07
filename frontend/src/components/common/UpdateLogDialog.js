import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  CircularProgress,
  Typography,
  IconButton
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useQuery } from 'react-query';
import ReactMarkdown from 'react-markdown';
import { updatelogAPI } from '../../services/api';

function UpdateLogDialog({ open, onClose, majorVersion }) {
  const { data, isLoading, isError } = useQuery(
    ['updatelog', majorVersion],
    () => updatelogAPI.get(majorVersion),
    { enabled: open && majorVersion != null }
  );

  const content = data?.data?.data?.content;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        업데이트 내역
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        )}
        {isError && (
          <Typography color="error">
            업데이트 내역을 불러오는 데 실패했습니다.
          </Typography>
        )}
        {content && (
          <Box sx={{ '& h1': { fontSize: '1.5rem', mb: 2 }, '& h2': { fontSize: '1.25rem', mt: 3, mb: 1 }, '& li': { mb: 0.5 } }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default UpdateLogDialog;
