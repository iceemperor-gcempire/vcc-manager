import React, { useState, useEffect } from 'react';
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
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Search,
  PlayArrow,
  Info,
  TrendingUp,
  Computer
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { workboardAPI, userAPI, projectAPI } from '../services/api';
import toast from 'react-hot-toast';


function WorkboardCard({ workboard, projectId }) {
  const navigate = useNavigate();
  const [infoOpen, setInfoOpen] = useState(false);

  const isComfyUI = workboard.apiFormat === 'ComfyUI';
  const projectQuery = projectId ? `?projectId=${projectId}` : '';

  const handleSelect = () => {
    // 히스토리에서 온 데이터가 있는지 확인
    const continueJobData = localStorage.getItem('continueJobData');
    if (continueJobData) {
      try {
        const parsedData = JSON.parse(continueJobData);
        if (parsedData.fromJobHistory) {
          const updatedData = {
            workboardId: workboard._id,
            inputData: parsedData.inputData,
            workboard: workboard
          };
          localStorage.setItem('continueJobData', JSON.stringify(updatedData));
          toast.success('작업 히스토리 데이터와 작업판이 연결되었습니다');
        }
      } catch (error) {
        console.warn('Failed to parse continue job data:', error);
      }
    }

    if (isComfyUI) {
      navigate(`/generate/${workboard._id}${projectQuery}`);
    } else {
      navigate(`/prompt-generate/${workboard._id}${projectQuery}`);
    }
  };

  const handleInfo = () => {
    setInfoOpen(true);
  };

  const handleInfoClose = () => {
    setInfoOpen(false);
  };

  const getOutputFormatLabel = (format) => {
    switch (format) {
      case 'image': return '이미지';
      case 'video': return '비디오';
      case 'text': return '텍스트';
      default: return format;
    }
  };

  const getApiFormatLabel = (format) => {
    switch (format) {
      case 'ComfyUI': return 'ComfyUI API';
      case 'OpenAI Compatible': return 'OpenAI Compatible API';
      default: return format;
    }
  };

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography variant="h6" gutterBottom>
            {workboard.name}
          </Typography>

          {workboard.description && (
            <Typography variant="body2" color="textSecondary" paragraph>
              {workboard.description}
            </Typography>
          )}

          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Computer fontSize="small" />
            <Typography variant="caption" color="textSecondary">
              {workboard.serverId?.name || (workboard.serverUrl ? new URL(workboard.serverUrl).hostname : '서버 정보 없음')}
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <TrendingUp fontSize="small" />
            <Typography variant="caption" color="textSecondary">
              사용횟수: {workboard.usageCount || 0}회
            </Typography>
          </Box>

          <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
            <Chip
              label={getOutputFormatLabel(workboard.outputFormat || 'image')}
              size="small"
              color={workboard.outputFormat === 'text' ? 'secondary' : workboard.outputFormat === 'video' ? 'warning' : 'primary'}
            />
            <Chip
              label={getApiFormatLabel(workboard.apiFormat || 'ComfyUI')}
              size="small"
              variant="outlined"
            />
          </Box>

          <Box display="flex" flexWrap="wrap" gap={1}>
            {workboard.baseInputFields?.aiModel?.slice(0, 3).map((model, index) => (
              <Chip
                key={index}
                label={model.key}
                size="small"
                variant="outlined"
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
            color={isComfyUI ? 'primary' : 'secondary'}
            onClick={handleSelect}
            startIcon={<PlayArrow />}
            sx={{ ml: 'auto' }}
          >
            선택하기
          </Button>
        </CardActions>
      </Card>

      {/* 상세정보 다이얼로그 */}
      <Dialog open={infoOpen} onClose={handleInfoClose} maxWidth="md" fullWidth>
        <DialogTitle>{workboard.name}</DialogTitle>
        <DialogContent>
          <DialogContentText paragraph>
            {workboard.description || '설명이 없습니다.'}
          </DialogContentText>

          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            <Chip
              label={getOutputFormatLabel(workboard.outputFormat || 'image')}
              size="small"
              color={workboard.outputFormat === 'text' ? 'secondary' : workboard.outputFormat === 'video' ? 'warning' : 'primary'}
            />
            <Chip
              label={getApiFormatLabel(workboard.apiFormat || 'ComfyUI')}
              size="small"
              variant="outlined"
            />
          </Box>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            지원 AI 모델
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {workboard.baseInputFields?.aiModel?.map((model, index) => (
              <Chip
                key={index}
                label={`${model.key}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>

          {isComfyUI && workboard.baseInputFields?.imageSizes?.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                지원 이미지 크기
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {workboard.baseInputFields.imageSizes.map((size, index) => (
                  <Chip
                    key={index}
                    label={size.key}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </>
          )}

          {isComfyUI && workboard.baseInputFields?.referenceImageMethods?.length > 0 && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                참고 이미지 사용 방식
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {workboard.baseInputFields.referenceImageMethods.map((method, index) => (
                  <Chip
                    key={index}
                    label={method.key}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                ))}
              </Box>
            </>
          )}

          {!isComfyUI && workboard.baseInputFields?.systemPrompt && (
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
          <Button
            onClick={handleSelect}
            variant="contained"
            color={isComfyUI ? 'primary' : 'secondary'}
            startIcon={<PlayArrow />}
          >
            선택하기
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Workboards() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [outputFormat, setOutputFormat] = useState(
    () => localStorage.getItem('workboardFilter_outputFormat') || ''
  );
  const [apiFormat, setApiFormat] = useState(
    () => localStorage.getItem('workboardFilter_apiFormat') || ''
  );

  // 프로젝트 컨텍스트
  const { data: projectData } = useQuery(
    ['project', projectId],
    () => projectAPI.getById(projectId),
    { enabled: !!projectId }
  );
  const projectContext = projectData?.data?.data?.project;

  const { data: profileData } = useQuery(
    'userProfile',
    () => userAPI.getProfile(),
    { staleTime: 5 * 60 * 1000 }
  );

  useEffect(() => {
    const prefs = profileData?.data?.user?.preferences;
    if (!prefs) return;

    if (prefs.resetWorkboardOutputFormat) {
      setOutputFormat('');
      localStorage.removeItem('workboardFilter_outputFormat');
    }
    if (prefs.resetWorkboardApiFormat) {
      setApiFormat('');
      localStorage.removeItem('workboardFilter_apiFormat');
    }
  }, [profileData]);

  const queryParams = { search, page, limit: 12 };
  if (outputFormat) queryParams.outputFormat = outputFormat;
  if (apiFormat) queryParams.apiFormat = apiFormat;

  const { data, isLoading, error } = useQuery(
    ['workboards', queryParams],
    () => workboardAPI.getAll(queryParams),
    { keepPreviousData: true }
  );

  const workboards = data?.data?.workboards || [];
  const pagination = data?.data?.pagination || {};

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handleOutputFormatChange = (event) => {
    const value = event.target.value;
    setOutputFormat(value);
    setPage(1);
    if (value) {
      localStorage.setItem('workboardFilter_outputFormat', value);
    } else {
      localStorage.removeItem('workboardFilter_outputFormat');
    }
  };

  const handleApiFormatChange = (event) => {
    const value = event.target.value;
    setApiFormat(value);
    setPage(1);
    if (value) {
      localStorage.setItem('workboardFilter_apiFormat', value);
    } else {
      localStorage.removeItem('workboardFilter_apiFormat');
    }
  };

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Alert severity="error">
          작업판을 불러오는 중 오류가 발생했습니다: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          작업판 선택
        </Typography>
        <Typography variant="body1" color="textSecondary" gutterBottom>
          사용할 작업판을 선택하세요. 각 작업판은 서로 다른 AI 모델과 설정을 제공합니다.
        </Typography>
        {projectContext && (
          <Chip
            label={`프로젝트: ${projectContext.name}`}
            color="primary"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        )}
      </Box>

      {/* 검색 및 필터 */}
      <Box mb={4} display="flex" gap={2} flexWrap="wrap" alignItems="center">
        <TextField
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
          sx={{ minWidth: 300, flex: 1, maxWidth: 500 }}
        />
        <FormControl sx={{ minWidth: 150 }} size="small">
          <InputLabel>출력 형식</InputLabel>
          <Select
            value={outputFormat}
            onChange={handleOutputFormatChange}
            label="출력 형식"
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="image">이미지</MenuItem>
            <MenuItem value="video">비디오</MenuItem>
            <MenuItem value="text">텍스트</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }} size="small">
          <InputLabel>AI API 형식</InputLabel>
          <Select
            value={apiFormat}
            onChange={handleApiFormatChange}
            label="AI API 형식"
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="ComfyUI">ComfyUI API</MenuItem>
            <MenuItem value="OpenAI Compatible">OpenAI Compatible API</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* 작업판 목록 */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      ) : workboards.length === 0 ? (
        <Alert severity="info">
          {search || outputFormat || apiFormat ? '검색 결과가 없습니다.' : '사용 가능한 작업판이 없습니다.'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {workboards.map((workboard) => (
              <Grid item xs={12} sm={6} md={4} key={workboard._id}>
                <WorkboardCard workboard={workboard} projectId={projectId} />
              </Grid>
            ))}
          </Grid>

          {/* 페이지네이션 */}
          {pagination.pages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Box display="flex" gap={1}>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "contained" : "outlined"}
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

export default Workboards;
