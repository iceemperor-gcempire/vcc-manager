import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip,
  IconButton
} from '@mui/material';
import {
  ArrowBack,
  Chat,
  ContentCopy
} from '@mui/icons-material';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workboardAPI } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';
import PromptGeneratorPanel from '../components/PromptGeneratorPanel';
import ConversationChatPanel from '../components/common/ConversationChatPanel';
import WorkboardChatPanel from '../components/common/WorkboardChatPanel';
import ProjectContextSelector from '../components/common/ProjectContextSelector';
import toast from 'react-hot-toast';
import { MONO } from '../theme';
import { BRAND_GRADIENTS } from '../utils/brandGradients';
import { ToneChip } from '../components/common/ToneChip';

function PromptGeneration() {
  const { workboardId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get('conversationId');
  const initialProjectId = searchParams.get('projectId') || '';

  // 프로젝트 컨텍스트 / 세계관 토글 (#396)
  const [projectId, setProjectId] = useState(initialProjectId);
  const [useWorldview, setUseWorldview] = useState(!!initialProjectId);

  // initialProjectId 가 바뀌면 (다른 작업판으로 이동 시) 동기화
  useEffect(() => {
    setProjectId(initialProjectId);
    setUseWorldview(!!initialProjectId);
  }, [initialProjectId, workboardId]);

  const { data: workboardData, isLoading: workboardLoading, error: workboardError } = useQuery({ queryKey: ['workboard', workboardId], queryFn: () => workboardAPI.getById(workboardId), enabled: !!workboardId });

  const workboard = workboardData?.data?.workboard;

  const handleCopyWorkboardId = async () => {
    if (!workboard?._id) return;

    try {
      await copyToClipboard(workboard._id);
      toast.success('작업판 ID를 복사했습니다.');
    } catch (error) {
      toast.error('작업판 ID 복사에 실패했습니다.');
    }
  };

  if (workboardLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress color="secondary" />
        </Box>
      </Container>
    );
  }

  if (workboardError || !workboard) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          작업판을 불러오는 중 오류가 발생했습니다.
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/prompt-workboards')}
          sx={{ mt: 2 }}
        >
          작업판 목록으로
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mb: 8 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(conversationId ? '/jobs' : '/prompt-workboards')}
        sx={{ mb: 3 }}
      >
        {conversationId ? '히스토리로' : '작업판 선택'}
      </Button>

      {/* 페이지 헤더 — 작업판 실행과 동일 패턴 (#572) */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap', mb: 5 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 2, background: BRAND_GRADIENTS[2],
          color: 'common.white', display: 'grid', placeItems: 'center', boxShadow: 2, flex: '0 0 auto',
        }}>
          <Chat fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h1">{workboard.name}</Typography>
            <ToneChip tone="info" label={conversationId ? '대화 이어가기' : '텍스트 생성'} />
          </Box>
          {workboard.description && !conversationId && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textWrap: 'pretty' }}>
              {workboard.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary' }}>
              ID: {workboard._id}
            </Typography>
            <IconButton size="small" onClick={handleCopyWorkboardId} aria-label="작업판 ID 복사">
              <ContentCopy fontSize="inherit" />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
              {workboard.serverId?.name || '서버 미설정'} · v{workboard.version || 1} · 사용횟수 {workboard.usageCount || 0}회
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 프로젝트 컨텍스트 / 세계관 토글 (#396). 멀티턴 이어가기 (conversationId 진입) 시엔 숨김 — 이미 첫 턴에 주입됨. */}
      {!conversationId && (
        <ProjectContextSelector
          projectId={projectId}
          useWorldview={useWorldview}
          onProjectChange={(v) => { setProjectId(v); if (!v) setUseWorldview(false); else setUseWorldview(true); }}
          onUseWorldviewChange={setUseWorldview}
        />
      )}

      {(() => {
        if (conversationId) {
          return <ConversationChatPanel workboard={workboard} conversationId={conversationId} />;
        }
        // #391: workboard.conversation_mode customField default 가 true 면 채팅 모드
        const conversationMode = !!(workboard.additionalInputFields || [])
          .find((f) => f.name === 'conversation_mode')?.defaultValue;
        if (conversationMode) {
          return (
            <WorkboardChatPanel
              workboard={workboard}
              projectId={projectId}
              useWorldview={useWorldview}
            />
          );
        }
        return (
          <PromptGeneratorPanel
            workboard={workboard}
            showHeader={false}
            showSystemPrompt={false}
            compact={false}
            projectId={projectId}
            useWorldview={useWorldview}
          />
        );
      })()}
    </Container>
  );
}

export default PromptGeneration;
