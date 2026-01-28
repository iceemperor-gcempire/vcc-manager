import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Search,
  PlayArrow,
  Info,
  TrendingUp,
  Computer,
  Chat
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { workboardAPI } from '../services/api';

function PromptWorkboardCard({ workboard }) {
  const navigate = useNavigate();
  const [infoOpen, setInfoOpen] = useState(false);

  const handleSelect = () => {
    navigate(`/prompt-generate/${workboard._id}`);
  };

  const handleInfo = () => {
    setInfoOpen(true);
  };

  const handleInfoClose = () => {
    setInfoOpen(false);
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Chat color="secondary" />
            <Typography variant="h6">
              {workboard.name}
            </Typography>
          </Box>

          {workboard.description && (
            <Typography variant="body2" color="textSecondary" paragraph>
              {workboard.description}
            </Typography>
          )}

          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Computer fontSize="small" />
            <Typography variant="caption" color="textSecondary">
              {workboard.serverId?.name || '서버 정보 없음'}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <TrendingUp fontSize="small" />
            <Typography variant="caption" color="textSecondary">
              사용횟수: {workboard.usageCount || 0}회
            </Typography>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={1}>
            {workboard.baseInputFields?.aiModel?.slice(0, 3).map((model, index) => (
              <Chip
                key={index}
                label={model.key}
                size="small"
                variant="outlined"
                color="secondary"
                sx={{ maxWidth: '100%' }}
              />
            ))}
            {workboard.baseInputFields?.aiModel?.length > 3 && (
              <Chip
                label={`+${workboard.baseInputFields.aiModel.length - 3}개`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </CardContent>

        <CardActions>
          <Button
            size="small"
            onClick={handleInfo}
            startIcon={<Info />}
          >
            상세정보
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={handleSelect}
            startIcon={<PlayArrow />}
            sx={{ ml: 'auto' }}
          >
            선택하기
          </Button>
        </CardActions>
      </Card>

      <Dialog open={infoOpen} onClose={handleInfoClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Chat color="secondary" />
            {workboard.name}
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            {workboard.description || '설명이 없습니다.'}
          </DialogContentText>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            지원 AI 모델
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {workboard.baseInputFields?.aiModel?.map((model, index) => (
              <Chip
                key={index}
                label={`${model.key}`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            ))}
          </Box>

          {workboard.baseInputFields?.systemPrompt && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                시스템 프롬프트
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ 
                whiteSpace: 'pre-wrap', 
                backgroundColor: '#f5f5f5', 
                p: 2, 
                borderRadius: 1,
                maxHeight: 200,
                overflow: 'auto'
              }}>
                {workboard.baseInputFields.systemPrompt}
              </Typography>
            </>
          )}

          {workboard.baseInputFields?.referenceImages?.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                참고 이미지 타입
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {workboard.baseInputFields.referenceImages.map((ref, index) => (
                  <Chip
                    key={index}
                    label={ref.key}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                ))}
              </Box>
            </>
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="textSecondary">
              생성자: {workboard.createdBy?.nickname || '알 수 없음'}
            </Typography>
            <br />
            <Typography variant="caption" color="textSecondary">
              버전: {workboard.version || 1}
            </Typography>
            <br />
            <Typography variant="caption" color="textSecondary">
              생성일: {new Date(workboard.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleInfoClose}>닫기</Button>
          <Button onClick={handleSelect} variant="contained" color="secondary" startIcon={<PlayArrow />}>
            선택하기
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function PromptWorkboards() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(
    ['promptWorkboards', { search, page }],
    () => workboardAPI.getAll({ search, page, limit: 12, workboardType: 'prompt' }),
    { keepPreviousData: true }
  );

  const workboards = data?.data?.workboards || [];
  const pagination = data?.data?.pagination || {};

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">
          프롬프트 작업판을 불러오는 중 오류가 발생했습니다: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Chat color="secondary" fontSize="large" />
          <Typography variant="h4">
            프롬프트 작업판
          </Typography>
        </Box>
        <Typography variant="body1" color="textSecondary" gutterBottom>
          AI를 활용하여 프롬프트를 생성할 작업판을 선택하세요. 각 작업판은 서로 다른 AI 모델과 시스템 프롬프트를 제공합니다.
        </Typography>
      </Box>

      <Box mb={4}>
        <TextField
          fullWidth
          placeholder="작업판 이름이나 설명으로 검색..."
          value={search}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 500 }}
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress color="secondary" />
        </Box>
      ) : workboards.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : '사용 가능한 프롬프트 작업판이 없습니다. 관리자에게 문의하세요.'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {workboards.map((workboard) => (
              <Grid item xs={12} sm={6} md={4} key={workboard._id}>
                <PromptWorkboardCard workboard={workboard} />
              </Grid>
            ))}
          </Grid>

          {pagination.pages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Box display="flex" gap={1}>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "contained" : "outlined"}
                    color="secondary"
                    onClick={() => setPage(pageNum)}
                    size="small"
                  >
                    {pageNum}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}

export default PromptWorkboards;
