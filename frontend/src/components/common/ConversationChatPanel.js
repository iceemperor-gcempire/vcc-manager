import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Divider
} from '@mui/material';
import {
  Send,
  Person as PersonIcon,
  SmartToy as AssistantIcon,
  Settings as SystemIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { conversationAPI, jobAPI } from '../../services/api';

// 멀티턴 대화 모드 패널 (#375).
// `conversationId` 가 주어졌을 때 PromptGeneration 페이지에서 PromptGeneratorPanel 대신 렌더.
// 이전 messages 를 상단에 누적 표시, 하단의 입력창으로 다음 메시지 append.
function ConversationChatPanel({ workboard, conversationId }) {
  const [newMessage, setNewMessage] = useState('');
  const transcriptRef = useRef(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    ['conversation', conversationId],
    () => conversationAPI.getById(conversationId),
    { enabled: !!conversationId }
  );

  const conversation = data?.data?.data;
  const messages = conversation?.messages || [];

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sendMutation = useMutation(
    async (text) => {
      return jobAPI.createPromptJob({
        workboardId: workboard._id,
        conversationId,
        inputData: { userPrompt: text },
      });
    },
    {
      onSuccess: () => {
        setNewMessage('');
        queryClient.invalidateQueries(['conversation', conversationId]);
        queryClient.invalidateQueries('conversations');
      },
      onError: (err) => {
        toast.error('전송 실패: ' + (err.response?.data?.message || err.message));
        // 실패 시에도 서버 측 conversation 은 failed 상태로 마킹돼 있으므로 refetch
        queryClient.invalidateQueries(['conversation', conversationId]);
      },
    }
  );

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    sendMutation.mutate(trimmed);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }
  if (error) {
    return <Alert severity="error">대화를 불러오지 못했습니다: {error.message}</Alert>;
  }
  if (!conversation) {
    return <Alert severity="warning">대화를 찾을 수 없습니다.</Alert>;
  }

  const isSending = sendMutation.isLoading;

  return (
    <Paper elevation={1} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip label="대화 이어가기" color="secondary" size="small" />
        {conversation.model && <Chip label={conversation.model} size="small" variant="outlined" />}
        {conversation.serverType && <Chip label={conversation.serverType} size="small" variant="outlined" />}
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" color="text.secondary">
          시작: {new Date(conversation.createdAt).toLocaleString('ko-KR')}
        </Typography>
      </Stack>

      <Box
        ref={transcriptRef}
        sx={{
          maxHeight: 500,
          overflow: 'auto',
          mb: 2,
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
        }}
      >
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {messages.map((msg, idx) => (
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
            </Box>
          ))}
        </Stack>
        {isSending && (
          <Box display="flex" justifyContent="center" mt={2}>
            <CircularProgress size={20} color="secondary" />
          </Box>
        )}
        {conversation.status === 'failed' && conversation.error?.message && (
          <Alert severity="error" sx={{ mt: 2 }}>
            마지막 시도 실패: {conversation.error.message}
          </Alert>
        )}
      </Box>

      <form onSubmit={handleSend}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder="이어서 질문하거나 지시를 입력하세요..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSend(e);
              }
            }}
            helperText="⌘/Ctrl + Enter 로 전송"
          />
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={isSending || !newMessage.trim()}
            startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <Send />}
            sx={{ minWidth: 100, height: 56 }}
          >
            전송
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

export default ConversationChatPanel;
