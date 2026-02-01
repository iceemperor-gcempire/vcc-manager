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
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  IconButton,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Search,
  PlayArrow,
  Info,
  TrendingUp,
  Computer,
  Edit,
  MoreVert,
  Add,
  Delete,
  Close,
  VisibilityOff
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { workboardAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';


function WorkboardCard({ workboard }) {
  const navigate = useNavigate();
  const [infoOpen, setInfoOpen] = useState(false);
  const isInactive = !workboard.isActive;

  const handleSelect = () => {
    if (isInactive) {
      toast.error('비활성화된 작업판은 사용할 수 없습니다.');
      return;
    }

    // 히스토리에서 온 데이터가 있는지 확인
    const continueJobData = localStorage.getItem('continueJobData');
    if (continueJobData) {
      try {
        const parsedData = JSON.parse(continueJobData);
        if (parsedData.fromJobHistory) {
          // 히스토리에서 온 데이터를 해당 작업판으로 연결
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

    navigate(`/generate/${workboard._id}`);
  };


  const handleInfo = () => {
    setInfoOpen(true);
  };

  const handleInfoClose = () => {
    setInfoOpen(false);
  };

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...(isInactive && {
            opacity: 0.6,
            bgcolor: 'grey.100',
            border: '1px dashed',
            borderColor: 'grey.400'
          })
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
            <Typography variant="h6" sx={{ color: isInactive ? 'text.disabled' : 'text.primary' }}>
              {workboard.name}
            </Typography>
            {isInactive && (
              <Chip
                icon={<VisibilityOff fontSize="small" />}
                label="비활성"
                size="small"
                color="default"
                sx={{ ml: 1 }}
              />
            )}
          </Box>

          {workboard.description && (
            <Typography variant="body2" color="textSecondary" paragraph>
              {workboard.description}
            </Typography>
          )}

          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Computer fontSize="small" />
            <Typography variant="caption" color="textSecondary">
              {new URL(workboard.serverUrl).hostname}
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
            onClick={handleSelect}
            startIcon={<PlayArrow />}
            disabled={isInactive}
            sx={{ ml: 'auto' }}
          >
            {isInactive ? '사용 불가' : '선택하기'}
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

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            지원 이미지 크기
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {workboard.baseInputFields?.imageSizes?.map((size, index) => (
              <Chip
                key={index}
                label={size.key}
                size="small"
                color="secondary"
                variant="outlined"
              />
            ))}
          </Box>

          {workboard.baseInputFields?.referenceImageMethods?.length > 0 && (
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
          <Button onClick={handleSelect} variant="contained" startIcon={<PlayArrow />}>
            선택하기
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Workboards() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [includeInactive, setIncludeInactive] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    ['workboards', { search, page, includeInactive }],
    () => workboardAPI.getAll({ search, page, limit: 12, includeInactive }),
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
          이미지 생성을 위해 사용할 작업판을 선택하세요. 각 작업판은 서로 다른 AI 모델과 설정을 제공합니다.
        </Typography>
      </Box>

      {/* 검색 및 필터 */}
      <Box mb={4} display="flex" flexWrap="wrap" alignItems="center" gap={2}>
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
          sx={{ maxWidth: 500, flexGrow: 1 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setPage(1);
              }}
              color="primary"
            />
          }
          label="비활성 작업판 포함"
        />
      </Box>

      {/* 작업판 목록 */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      ) : workboards.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : '사용 가능한 작업판이 없습니다.'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {workboards.map((workboard) => (
              <Grid item xs={12} sm={6} md={4} key={workboard._id}>
                <WorkboardCard
                  workboard={workboard}
                />
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