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
  Divider,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Send,
  Person as PersonIcon,
  SmartToy as AssistantIcon,
  Settings as SystemIcon,
  BookmarkAdd as BookmarkAddIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { conversationAPI, textAPI } from '../../services/api';
import { useStreamingPrompt } from '../../hooks/useStreamingPrompt';

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

  const saveMessageMutation = useMutation(
    ({ conversationJobId: cid, messageIndex }) => textAPI.createGenerated({ conversationJobId: cid, messageIndex }),
    {
      onSuccess: () => {
        toast.success('생성된 텍스트로 저장되었습니다.');
        queryClient.invalidateQueries('generatedTexts');
      },
      onError: (err) => toast.error(err.response?.data?.message || '저장 실패'),
    }
  );

  // 스트리밍 전송 (#490)
  const { send: streamSend, streamingText, isStreaming } = useStreamingPrompt();
  const [pendingUserMsg, setPendingUserMsg] = useState(null);

  // 스트리밍 중 자동 스크롤
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [streamingText, pendingUserMsg]);

  const handleSend = (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || isStreaming) return;
    setPendingUserMsg(trimmed);
    setNewMessage('');
    streamSend(
      {
        workboardId: workboard._id,
        conversationId,
        inputData: { userPrompt: trimmed },
      },
      {
        onDone: () => {
          setPendingUserMsg(null);
          queryClient.invalidateQueries(['conversation', conversationId]);
          queryClient.invalidateQueries('conversations');
        },
        onError: (err) => {
          toast.error('전송 실패: ' + (err.message || '알 수 없는 오류'));
          setPendingUserMsg(null);
          queryClient.invalidateQueries(['conversation', conversationId]);
        },
      }
    );
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

  const isSending = isStreaming;

  return (
    <Paper elevation={1} sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip label="대화 이어가기" color="secondary" />
        {conversation.model && <Chip label={conversation.model} variant="outlined" />}
        {conversation.serverType && <Chip label={conversation.serverType} variant="outlined" />}
        {conversation.costEstimate?.amount != null && (
          <Chip
            label={`누적 $${conversation.costEstimate.amount.toFixed(6)}`}
            variant="outlined"
            color="info"
          />
        )}
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
              {msg.role === 'assistant' && (
                <Tooltip title="이 응답을 텍스트 컨텐츠로 저장">
                  <IconButton
                    size="small"
                    onClick={() => saveMessageMutation.mutate({ conversationJobId: conversationId, messageIndex: idx })}
                    disabled={saveMessageMutation.isLoading}
                  >
                    <BookmarkAddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
          {/* 낙관적 사용자 말풍선 + 실시간 어시스턴트 말풍선 (#490) */}
          {pendingUserMsg && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ pt: 0.5 }}><PersonIcon fontSize="small" color="primary" /></Box>
              <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  user
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.25 }}>
                  {pendingUserMsg}
                </Typography>
              </Box>
            </Box>
          )}
          {isStreaming && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Box sx={{ pt: 0.5 }}><AssistantIcon fontSize="small" color="action" /></Box>
              <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  assistant
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.25 }}>
                  {streamingText}
                  {!streamingText && <CircularProgress size={14} color="secondary" sx={{ ml: 0.5 }} />}
                  {streamingText && <Box component="span" sx={{ opacity: 0.5 }}>▍</Box>}
                </Typography>
              </Box>
            </Box>
          )}
        </Stack>
        {conversation.status === 'processing' && !isStreaming && (
          <Alert severity="info" sx={{ mt: 2 }}>
            이 대화는 다른 곳에서 생성 중입니다. 완료되면 새로고침해 주세요.
          </Alert>
        )}
        {conversation.status === 'failed' && conversation.error?.message && (
          <Alert severity="error" sx={{ mt: 2 }}>
            마지막 시도 실패: {conversation.error.message}
          </Alert>
        )}
      </Box>

      <form onSubmit={handleSend}>
        {/* 전송 버튼을 입력창 높이만큼 채워 상단 정렬 맞춤 (#503) */}
        <Stack direction="row" spacing={3} alignItems="flex-start">
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
          />
          <Button
            type="submit"
            variant="contained"
            color="secondary"
            disabled={isSending || !newMessage.trim()}
            startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <Send />}
            // 입력창(size small, 2행)과 외곽 높이 정확히 맞춤 + elevation 제거 (#503)
            disableElevation
            sx={{ minWidth: 100, height: 55 }}
          >
            전송
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          ⌘/Ctrl + Enter 로 전송
        </Typography>
      </form>
    </Paper>
  );
}

export default ConversationChatPanel;
