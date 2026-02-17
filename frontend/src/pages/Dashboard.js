import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  CircularProgress,
  Button
} from '@mui/material';
import {
  CloudUpload,
  ViewModule,
  NewReleases,
  Image as ImageIcon,
  TextSnippet,
  History,
  Star
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { jobAPI, projectAPI } from '../services/api';
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

  const { data: favoritesData } = useQuery(
    'favoriteProjects',
    () => projectAPI.getFavorites()
  );

  const favoriteProjects = favoritesData?.data?.data?.projects || [];

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
        {/* 즐겨찾기 프로젝트 */}
        {favoriteProjects.length > 0 && (
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Star color="warning" />
              <Typography variant="h6">즐겨찾기 프로젝트</Typography>
            </Box>
            <Grid container spacing={2}>
              {favoriteProjects.map((project) => (
                <Grid item xs={12} sm={6} md={4} key={project._id}>
                  <Card>
                    <CardActionArea onClick={() => navigate(`/projects/${project._id}`)}>
                      <CardContent>
                        <Typography variant="subtitle1" noWrap gutterBottom>
                          {project.name}
                        </Typography>
                        {project.description && (
                          <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1 }}>
                            {project.description}
                          </Typography>
                        )}
                        <Box display="flex" gap={1.5}>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <ImageIcon fontSize="small" color="action" />
                            <Typography variant="body2">{project.counts?.images || 0}</Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <TextSnippet fontSize="small" color="action" />
                            <Typography variant="body2">{project.counts?.promptData || 0}</Typography>
                          </Box>
                          <Box display="flex" alignItems="center" gap={0.5}>
                            <History fontSize="small" color="action" />
                            <Typography variant="body2">{project.counts?.jobs || 0}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        )}

        {/* 빠른 액션 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                빠른 액션
              </Typography>
              <Box
                display="flex"
                flexDirection="column"
                gap={2}
                justifyContent="center"
                flexWrap="wrap"
              >
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
                  startIcon={<NewReleases />}
                  onClick={() => setUpdateLogOpen(true)}
                  size="large"
                >
                  업데이트 내역 보기
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 작업 상태 */}
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                작업 상태
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary" display="block" mb={1}>서버</Typography>
                  <Box display="flex" gap={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        {queue.waiting || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        대기 중
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {queue.active || 0}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        처리 중
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary" display="block" mb={1}>내 작업</Typography>
                  <Box display="flex" gap={3}>
                    <Box textAlign="center">
                      <Typography variant="h4" color="warning.main">
                        {myPendingJobs}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        대기 중
                      </Typography>
                    </Box>
                    <Box textAlign="center">
                      <Typography variant="h4" color="info.main">
                        {myProcessingJobs}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        처리 중
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
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