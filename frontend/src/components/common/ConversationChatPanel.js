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
import { conversationAPI, textAPI, imageAPI } from '../../services/api';
import { useStreamingPrompt } from '../../hooks/useStreamingPrompt';
import ImageUploadField from './ImageUploadField';
import ChatBubble from './chat/ChatBubble';

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
  const [attachImages, setAttachImages] = useState([]); // 비전 첨부 (#519)
  const imageField = (workboard.additionalInputFields || []).find((f) => f.type === 'image');

  // 스트리밍 중 자동 스크롤
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [streamingText, pendingUserMsg]);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || isStreaming) return;
    setPendingUserMsg(trimmed);
    setNewMessage('');

    // 비전 첨부 이미지 업로드 (#519) — image 필드가 있을 때만
    let attachedImageIds = [];
    if (imageField && attachImages.length > 0) {
      try {
        for (const img of attachImages) {
          if (img.file) {
            const fd = new FormData();
            fd.append('image', img.file);
            fd.append('imageType', 'reference');
            const resp = await imageAPI.upload(fd);
            attachedImageIds.push(resp.data.image._id);
          } else if (img._id) {
            attachedImageIds.push(img._id);
          }
        }
      } catch (err) {
        toast.error('이미지 업로드 실패: ' + (err.response?.data?.message || err.message));
        setPendingUserMsg(null);
        return;
      }
    }

    streamSend(
      {
        workboardId: workboard._id,
        conversationId,
        inputData: { userPrompt: trimmed, ...(attachedImageIds.length && imageField ? { [imageField.name]: attachedImageIds } : {}) },
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
    setAttachImages([]);
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
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
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
          borderRadius: 1,
        }}
      >
        <Stack spacing={3.5}>
          {messages.map((msg, idx) => (
            <ChatBubble
              key={idx}
              role={msg.role}
              content={msg.content}
              attachments={msg.attachments}
              actions={msg.role === 'assistant' && (
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
            />
          ))}
          {/* 낙관적 사용자 말풍선 + 실시간 어시스턴트 말풍선 (#490) */}
          {pendingUserMsg && <ChatBubble role="user" content={pendingUserMsg} />}
          {isStreaming && <ChatBubble role="assistant" streaming streamingText={streamingText} />}
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

      {/* 비전 이미지 첨부 (#519) — image 필드가 있을 때 턴별 첨부 */}
      {imageField && (
        <Box sx={{ mb: 1.5 }}>
          <ImageUploadField
            label={imageField.label}
            description={imageField.description || '이미지를 첨부하면 모델이 분석에 참고합니다. (비전 모델 전용)'}
            images={attachImages}
            onImagesChange={setAttachImages}
            maxImages={imageField.imageConfig?.maxImages || 4}
            disabled={isSending}
          />
        </Box>
      )}

      <form onSubmit={handleSend}>
        {/* 전송 버튼을 입력창 높이만큼 채워 상단 정렬 맞춤 (#503) */}
        <Stack direction="row" spacing={2.5} alignItems="flex-start">
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
            sx={{ minWidth: 100, height: 52 }}
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
