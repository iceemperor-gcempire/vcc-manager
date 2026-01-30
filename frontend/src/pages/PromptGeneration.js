import React from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  ArrowBack,
  Chat
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { workboardAPI } from '../services/api';
import PromptGeneratorPanel from '../components/PromptGeneratorPanel';

function PromptGeneration() {
  const { workboardId } = useParams();
  const navigate = useNavigate();

  const { data: workboardData, isLoading: workboardLoading, error: workboardError } = useQuery(
    ['workboard', workboardId],
    () => workboardAPI.getById(workboardId),
    { enabled: !!workboardId }
  );

  const workboard = workboardData?.data?.workboard;

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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/prompt-workboards')}
        >
          작업판 선택
        </Button>
        <Box display="flex" alignItems="center" gap={1}>
          <Chat color="secondary" />
          <Typography variant="h5">{workboard.name}</Typography>
        </Box>
        <Chip label="프롬프트 생성" color="secondary" size="small" />
      </Box>

      {workboard.description && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {workboard.description}
        </Alert>
      )}

      <PromptGeneratorPanel
        workboard={workboard}
        showHeader={false}
        showSystemPrompt={true}
        compact={false}
      />
    </Container>
  );
}

export default PromptGeneration;
