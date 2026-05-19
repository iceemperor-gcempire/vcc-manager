import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  IconButton,
  Collapse,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Send,
  Person as PersonIcon,
  SmartToy as AssistantIcon,
  Settings as SystemIcon,
  BookmarkAdd as BookmarkAddIcon,
  Tune as TuneIcon,
  ExpandLess,
  ExpandMore,
  LockOutlined as LockIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { jobAPI, conversationAPI, textAPI } from '../../services/api';
import MetadataFieldInput from './MetadataFieldInput';

// 텍스트 작업판의 멀티턴 대화 모드 패널 (#391).
// PromptGeneration 페이지에서 workboard.conversation_mode = true 일 때 PromptGeneratorPanel 대신 렌더.
// 매번 새 대화로 시작. 첫 메시지 전송 전엔 설정 (model / temperature / system_prompt 등) 편집 가능,
// 전송 후엔 lock + collapse.
function WorkboardChatPanel({ workboard }) {
  const [conversationId, setConversationId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const transcriptRef = useRef(null);
  const queryClient = useQueryClient();

  // admin 이 설정하는 conversation_mode 외 customField 를 settings 폼으로 노출
  const settingsFields = useMemo(
    () => (workboard.additionalInputFields || []).filter((f) => f.name !== 'conversation_mode'),
    [workboard]
  );

  // 폼 — defaultValues 는 customField defaultValue 사용
  const formDefaults = useMemo(() => {
    const d = {};
    settingsFields.forEach((f) => { d[f.name] = f.defaultValue ?? ''; });
    return d;
  }, [settingsFields]);

  const { control, getValues, reset } = useForm({ defaultValues: formDefaults });

  useEffect(() => { reset(formDefaults); }, [formDefaults, reset]);

  // 대화 시작 후 messages 동기화용 — 시작 전엔 비활성
  const { data: convData } = useQuery(
    ['conversation', conversationId],
    () => conversationAPI.getById(conversationId),
    { enabled: !!conversationId }
  );
  const conversation = convData?.data?.data;
  const messages = conversation?.messages || [];

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sendMutation = useMutation(
    ({ text, settings, cid }) => jobAPI.createPromptJob({
      workboardId: workboard._id,
      conversationId: cid || undefined,
      inputData: { ...settings, userPrompt: text },
    }),
    {
      onSuccess: (response) => {
        const cid = response.data?.conversationId;
        if (cid && !conversationId) {
          setConversationId(cid);
          setSettingsOpen(false);
        }
        setNewMessage('');
        queryClient.invalidateQueries(['conversation', cid || conversationId]);
        queryClient.invalidateQueries('conversations');
      },
      onError: (err) => {
        toast.error('전송 실패: ' + (err.response?.data?.message || err.message));
        if (conversationId) {
          queryClient.invalidateQueries(['conversation', conversationId]);
        }
      },
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

  const handleSend = (e) => {
    e?.preventDefault?.();
    const trimmed = newMessage.trim();
    if (!trimmed) return;
    sendMutation.mutate({ text: trimmed, settings: getValues(), cid: conversationId });
  };

  const isSending = sendMutation.isLoading;
  const isLocked = !!conversationId; // 첫 전송 후 lock

  const renderSettingField = (field) => {
    const locked = isLocked;
    if (field.type === 'string') {
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: formField }) => (
            <TextField
              {...formField}
              fullWidth
              size="small"
              label={field.label}
              placeholder={field.placeholder}
              multiline={field.name.includes('prompt')}
              rows={field.name.includes('prompt') ? 2 : 1}
              disabled={locked}
              helperText={field.description}
            />
          )}
        />
      );
    }
    if (field.type === 'number') {
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: formField }) => (
            <TextField
              {...formField}
              fullWidth
              size="small"
              type="number"
              label={field.label}
              disabled={locked}
              helperText={field.description}
            />
          )}
        />
      );
    }
    if (field.type === 'boolean') {
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: formField }) => (
            <FormControlLabel
              control={<Switch checked={!!formField.value} onChange={(e) => formField.onChange(e.target.checked)} disabled={locked} />}
              label={field.label}
            />
          )}
        />
      );
    }
    if (field.type === 'baseModel' || field.type === 'lora') {
      return (
        <Controller
          name={field.name}
          control={control}
          render={({ field: formField }) => (
            <MetadataFieldInput
              kind={field.type === 'baseModel' ? 'model' : 'lora'}
              field={field}
              value={formField.value || ''}
              onChange={formField.onChange}
              workboardId={workboard._id}
              serverId={workboard?.serverId?._id || workboard?.serverId}
              disabled={locked}
            />
          )}
        />
      );
    }
    return null;
  };

  return (
    <Paper elevation={1} sx={{ p: { xs: 2, md: 3 } }}>
      {/* 헤더 */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip label="대화 모드" color="secondary" size="small" />
        {conversation?.model && <Chip label={conversation.model} size="small" variant="outlined" />}
        {conversation?.serverType && <Chip label={conversation.serverType} size="small" variant="outlined" />}
        {conversation?.costEstimate?.amount != null && (
          <Chip
            label={`누적 $${conversation.costEstimate.amount.toFixed(6)}`}
            size="small"
            variant="outlined"
            color="info"
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {conversation?.createdAt && (
          <Typography variant="caption" color="text.secondary">
            시작: {new Date(conversation.createdAt).toLocaleString('ko-KR')}
          </Typography>
        )}
      </Stack>

      {/* 설정 패널 — 첫 전송 후 lock */}
      {settingsFields.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, cursor: 'pointer' }}
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <TuneIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              설정 {isLocked && '(고정됨)'}
            </Typography>
            {isLocked && <LockIcon fontSize="small" color="action" />}
            {settingsOpen ? <ExpandLess /> : <ExpandMore />}
          </Box>
          <Collapse in={settingsOpen}>
            <Box sx={{ p: 2, pt: 0 }}>
              <Stack spacing={2}>
                {settingsFields.map((field) => (
                  <Box key={field.name}>{renderSettingField(field)}</Box>
                ))}
              </Stack>
              {isLocked && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  대화가 시작되어 설정은 더 이상 변경할 수 없습니다. 새 설정으로 시작하려면 작업판을 다시 여세요.
                </Alert>
              )}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/* 대화 transcript */}
      <Box
        ref={transcriptRef}
        sx={{
          minHeight: 200,
          maxHeight: 500,
          overflow: 'auto',
          mb: 2,
          p: 2,
          bgcolor: 'grey.50',
          borderRadius: 1,
        }}
      >
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            아래 입력창에 메시지를 입력해 대화를 시작하세요.
          </Typography>
        ) : (
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
          </Stack>
        )}
        {isSending && (
          <Box display="flex" justifyContent="center" mt={2}>
            <CircularProgress size={20} color="secondary" />
          </Box>
        )}
        {conversation?.status === 'failed' && conversation?.error?.message && (
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
            placeholder="메시지를 입력하세요..."
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

export default WorkboardChatPanel;
