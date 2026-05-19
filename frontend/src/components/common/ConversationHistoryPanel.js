import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider
} from '@mui/material';
import {
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  SmartToy as AssistantIcon,
  Settings as SystemIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Chat as ChatIcon, BookmarkAdd as BookmarkAddIcon } from '@mui/icons-material';
import { conversationAPI, textAPI } from '../../services/api';
import Pagination from './Pagination';

// LLM 대화 히스토리 패널 (#373).
// JobHistory 페이지의 \"텍스트\" 탭에서 사용. 카드 리스트 + 상세 다이얼로그.
function ConversationHistoryPanel() {
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery(
    ['conversations', page],
    () => conversationAPI.getMy({ page, limit: 20 }),
    { keepPreviousData: true }
  );

  const deleteMutation = useMutation(
    (id) => conversationAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('대화를 삭제했습니다.');
        queryClient.invalidateQueries('conversations');
        setDetailItem(null);
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'),
    }
  );

  const saveMessageMutation = useMutation(
    ({ conversationJobId, messageIndex }) => textAPI.createGenerated({ conversationJobId, messageIndex }),
    {
      onSuccess: () => {
        toast.success('생성된 텍스트로 저장되었습니다.');
        queryClient.invalidateQueries('generatedTexts');
      },
      onError: (err) => toast.error(err.response?.data?.message || '저장 실패'),
    }
  );

  const conversations = data?.data?.data?.conversations || [];
  const pagination = data?.data?.data?.pagination || { current: 1, pages: 0, total: 0 };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">대화 목록을 불러오지 못했습니다: {error.message}</Alert>;
  }
  if (conversations.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          아직 텍스트 대화 기록이 없습니다.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack spacing={1.5}>
        {conversations.map((conv) => {
          const lastUserMsg = [...(conv.messages || [])].reverse().find((m) => m.role === 'user');
          const lastAssistantMsg = [...(conv.messages || [])].reverse().find((m) => m.role === 'assistant');
          return (
            <Card key={conv._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Chip label={conv.workboardId?.name || '(작업판 없음)'} size="small" color="primary" variant="outlined" />
                  {conv.model && <Chip label={conv.model} size="small" variant="outlined" />}
                  {conv.serverType && <Chip label={conv.serverType} size="small" variant="outlined" />}
                  <Chip
                    label={conv.status}
                    size="small"
                    color={conv.status === 'completed' ? 'success' : conv.status === 'failed' ? 'error' : 'default'}
                    variant="outlined"
                  />
                  {(conv.messages?.filter((m) => m.role !== 'system').length || 0) > 2 && (
                    <Chip
                      label={`${conv.messages.filter((m) => m.role !== 'system').length}턴`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(conv.createdAt).toLocaleString('ko-KR')}
                  </Typography>
                </Stack>
                {lastUserMsg && (
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    <strong>Q:</strong> {lastUserMsg.content}
                  </Typography>
                )}
                {lastAssistantMsg && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    <strong>A:</strong> {lastAssistantMsg.content}
                  </Typography>
                )}
              </CardContent>
              <CardActions
                sx={{
                  pt: 0,
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  '& .MuiButton-root': { fontSize: { xs: '0.75rem', sm: '0.875rem' }, px: { xs: 1, sm: 1.5 }, minWidth: 'auto' }
                }}
              >
                <Button
                  size="small"
                  onClick={() => setDetailItem(conv)}
                  startIcon={<InfoIcon />}
                  sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                >
                  상세
                </Button>
                {conv.workboardId?._id && (
                  <Button
                    size="small"
                    color="success"
                    variant="contained"
                    onClick={() =>
                      navigate(`/prompt-generate/${conv.workboardId._id}?conversationId=${conv._id}`)
                    }
                    startIcon={<PlayArrowIcon />}
                    sx={{ '& .MuiButton-startIcon': { mx: { xs: 0, sm: '-4px' }, mr: { xs: 0.5, sm: 1 } } }}
                  >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>계속하기</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>계속</Box>
                  </Button>
                )}
                <Tooltip title="삭제">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      if (window.confirm('이 대화를 삭제하시겠어요?')) {
                        deleteMutation.mutate(conv._id);
                      }
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          );
        })}
      </Stack>

      {pagination.pages > 1 && (
        <Box mt={2} display="flex" justifyContent="center">
          <Pagination
            currentPage={pagination.current}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            onPageChange={setPage}
          />
        </Box>
      )}

      <Dialog open={!!detailItem} onClose={() => setDetailItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>대화 상세</DialogTitle>
        <DialogContent dividers>
          {detailItem && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={detailItem.workboardId?.name || '(작업판 없음)'} size="small" color="primary" variant="outlined" />
                {detailItem.model && <Chip label={detailItem.model} size="small" variant="outlined" />}
                {detailItem.serverType && <Chip label={detailItem.serverType} size="small" variant="outlined" />}
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(detailItem.createdAt).toLocaleString('ko-KR')}
                </Typography>
              </Stack>
              <Divider />
              {(detailItem.messages || []).map((msg, idx) => (
                <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ pt: 0.5 }}>
                    {msg.role === 'user' && <PersonIcon fontSize="small" color="primary" />}
                    {msg.role === 'assistant' && <AssistantIcon fontSize="small" color="action" />}
                    {msg.role === 'system' && <SystemIcon fontSize="small" color="action" />}
                  </Box>
                  <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {msg.role}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.25 }}>
                      {msg.content}
                    </Typography>
                  </Box>
                  {msg.role === 'assistant' && (
                    <Tooltip title="이 응답을 텍스트 컨텐츠로 저장">
                      <IconButton
                        size="small"
                        onClick={() => saveMessageMutation.mutate({ conversationJobId: detailItem._id, messageIndex: idx })}
                        disabled={saveMessageMutation.isLoading}
                      >
                        <BookmarkAddIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
              {detailItem.error?.message && (
                <Alert severity="error">{detailItem.error.message}</Alert>
              )}
              {detailItem.usage && (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    토큰: 입력 {detailItem.usage.promptTokens ?? 0} · 출력 {detailItem.usage.completionTokens ?? 0} (총 {detailItem.usage.totalTokens ?? 0})
                  </Typography>
                  {detailItem.costEstimate?.amount != null && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      추정 비용: ${detailItem.costEstimate.amount.toFixed(6)} {detailItem.costEstimate.currency || 'USD'}
                      {detailItem.costEstimate.pricingVersion && ` (${detailItem.costEstimate.pricingVersion})`}
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {detailItem?.workboardId?._id && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<ChatIcon />}
              onClick={() => {
                navigate(`/prompt-generate/${detailItem.workboardId._id}?conversationId=${detailItem._id}`);
              }}
            >
              이 대화 이어가기
            </Button>
          )}
          <Button onClick={() => setDetailItem(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConversationHistoryPanel;
