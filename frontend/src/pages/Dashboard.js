import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  LinearProgress,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Paper
} from '@mui/material';
import {
  TrendingUp,
  Image,
  CloudUpload,
  History,
  PlayArrow,
  Refresh,
  ViewModule
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { userAPI, jobAPI, imageAPI } from '../services/api';
import config from '../config';

function StatCard({ title, value, icon, color = 'primary' }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function JobStatusChip({ status }) {
  const statusConfig = {
    pending: { color: 'warning', label: '대기중' },
    processing: { color: 'info', label: '처리중' },
    completed: { color: 'success', label: '완료' },
    failed: { color: 'error', label: '실패' },
    cancelled: { color: 'default', label: '취소됨' }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
    />
  );
}

function Dashboard() {
  const navigate = useNavigate();

  const { data: userStats, isLoading: statsLoading } = useQuery(
    'userStats',
    userAPI.getStats
  );

  const { data: recentJobs, isLoading: jobsLoading, refetch: refetchJobs } = useQuery(
    'recentJobs',
    () => jobAPI.getMy({ limit: 5 }),
    { refetchInterval: config.monitoring.recentJobsInterval }
  );

  const { data: imageStats, isLoading: imagesLoading } = useQuery(
    'imageStats',
    imageAPI.getStats
  );

  const { data: queueStats, isLoading: queueLoading } = useQuery(
    'queueStats',
    jobAPI.getQueueStats,
    { refetchInterval: config.monitoring.queueStatusInterval }
  );

  if (statsLoading || jobsLoading || imagesLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const stats = userStats?.data || {};
  const jobs = recentJobs?.data?.jobs || [];
  const images = imageStats?.data || {};
  const queue = queueStats?.data?.stats || {};

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        대시보드
      </Typography>
      
      <Grid container spacing={3}>
        {/* 통계 카드들 */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="전체 작업"
            value={stats.jobs?.total || 0}
            icon={<History color="primary" />}
            color="primary"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="완료된 작업"
            value={stats.jobs?.completed || 0}
            icon={<TrendingUp color="success" />}
            color="success"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="생성된 이미지"
            value={images.generated?.count || 0}
            icon={<Image color="info" />}
            color="info"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="업로드된 이미지"
            value={images.uploaded?.count || 0}
            icon={<CloudUpload color="secondary" />}
            color="secondary"
          />
        </Grid>

        {/* 큐 상태 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                작업 큐 상태
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      대기 중
                    </Typography>
                    <Typography variant="h6">
                      {queue.waiting || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      처리 중
                    </Typography>
                    <Typography variant="h6">
                      {queue.active || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      완료됨
                    </Typography>
                    <Typography variant="h6">
                      {queue.completed || 0}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      실패함
                    </Typography>
                    <Typography variant="h6">
                      {queue.failed || 0}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 빠른 액션 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                빠른 액션
              </Typography>
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  startIcon={<ViewModule />}
                  onClick={() => navigate('/workboards')}
                  size="large"
                >
                  새 이미지 생성하기
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => navigate('/images')}
                  size="large"
                >
                  이미지 업로드하기
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<History />}
                  onClick={() => navigate('/jobs')}
                  size="large"
                >
                  작업 히스토리 보기
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 최근 작업 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  최근 작업
                </Typography>
                <IconButton onClick={() => refetchJobs()}>
                  <Refresh />
                </IconButton>
              </Box>
              
              {jobs.length === 0 ? (
                <Typography variant="body2" color="textSecondary" textAlign="center" py={4}>
                  아직 생성한 작업이 없습니다.
                </Typography>
              ) : (
                <List>
                  {jobs.map((job, index) => (
                    <ListItem key={job.id} divider={index < jobs.length - 1}>
                      <ListItemText
                        primary={job.inputData?.prompt?.substring(0, 50) + '...' || '프롬프트 없음'}
                        secondary={`${new Date(job.createdAt).toLocaleString()}`}
                      />
                      <ListItemSecondaryAction>
                        <Box display="flex" flexDirection="column" alignItems="end" gap={1}>
                          <JobStatusChip status={job.status} />
                          {job.status === 'processing' && (
                            <LinearProgress 
                              variant="determinate" 
                              value={job.progress || 0} 
                              sx={{ width: 60 }}
                            />
                          )}
                        </Box>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;