import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Button
} from '@mui/material';
import {
  CloudUpload,
  History,
  ViewModule,
  NewReleases
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { jobAPI } from '../services/api';
import config from '../config';
import UpdateLogDialog from '../components/common/UpdateLogDialog';


function Dashboard() {
  const navigate = useNavigate();
  const [updateLogOpen, setUpdateLogOpen] = useState(false);

  const { data: recentJobs, isLoading: jobsLoading } = useQuery(
    'recentJobs',
    () => jobAPI.getMy({ limit: 10 }),
    { refetchInterval: config.monitoring.recentJobsInterval }
  );

  const { data: queueStats, isLoading: queueLoading } = useQuery(
    'queueStats',
    jobAPI.getQueueStats,
    { refetchInterval: config.monitoring.queueStatusInterval }
  );

  if (jobsLoading || queueLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const jobs = recentJobs?.data?.jobs || [];
  const queue = queueStats?.data?.stats || {};
  
  // 내 작업 중 대기/처리 중인 것들 계산
  const myPendingJobs = jobs.filter(job => job.status === 'pending').length;
  const myProcessingJobs = jobs.filter(job => job.status === 'processing').length;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        대시보드
      </Typography>
      
      <Grid container spacing={3}>
        {/* 서버 전체 작업 상태 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                서버 전체 작업 상태
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {queue.waiting || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      대기 중
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {queue.active || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      처리 중
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 내 작업 상태 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                내 작업 상태
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {myPendingJobs}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      대기 중
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="info.main">
                      {myProcessingJobs}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      처리 중
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 빠른 액션 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                빠른 액션
              </Typography>
              <Box 
                display="flex" 
                flexDirection={{ xs: 'column', sm: 'row' }} 
                gap={2}
                justifyContent="center"
              >
                <Button
                  variant="contained"
                  startIcon={<ViewModule />}
                  onClick={() => navigate('/workboards')}
                  size="large"
                  sx={{ minWidth: 200 }}
                >
                  새 이미지 생성하기
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => navigate('/images')}
                  size="large"
                  sx={{ minWidth: 200 }}
                >
                  이미지 업로드하기
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<History />}
                  onClick={() => navigate('/jobs')}
                  size="large"
                  sx={{ minWidth: 200 }}
                >
                  작업 히스토리 보기
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<NewReleases />}
                  onClick={() => setUpdateLogOpen(true)}
                  size="large"
                  sx={{ minWidth: 200 }}
                >
                  업데이트 내역 보기
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <UpdateLogDialog
        open={updateLogOpen}
        onClose={() => setUpdateLogOpen(false)}
        majorVersion={config.version.major}
      />
    </Container>
  );
}

export default Dashboard;