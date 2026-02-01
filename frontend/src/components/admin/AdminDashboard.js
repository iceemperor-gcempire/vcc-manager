import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  LinearProgress,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  People,
  ViewModule,
  Image,
  Queue,
  Refresh,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { adminAPI, jobAPI } from '../../services/api';
import config from '../../config';

function StatCard({ title, value, subtitle, icon, color = 'primary' }) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary">
                {subtitle}
              </Typography>
            )}
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

function AdminDashboard() {
  const { data: stats, isLoading: statsLoading, refetch } = useQuery(
    'adminStats',
    adminAPI.getStats
  );

  const { data: queueStats, isLoading: queueLoading } = useQuery(
    'queueStatsAdmin',
    jobAPI.getQueueStats,
    { refetchInterval: config.monitoring.queueStatusInterval }
  );

  if (statsLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  const systemStats = stats?.data || {};
  const queue = queueStats?.data?.stats || {};

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">시스템 개요</Typography>
        <IconButton onClick={() => refetch()}>
          <Refresh />
        </IconButton>
      </Box>

      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="전체 사용자"
            value={systemStats.users?.total || 0}
            subtitle={`활성: ${systemStats.users?.active || 0}명`}
            icon={<People color="primary" />}
            color="primary"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="작업판"
            value={systemStats.workboards?.total || 0}
            subtitle={`활성: ${systemStats.workboards?.active || 0}개`}
            icon={<ViewModule color="secondary" />}
            color="secondary"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="전체 작업"
            value={systemStats.jobs?.total || 0}
            subtitle={`완료: ${systemStats.jobs?.completed || 0}개`}
            icon={<Queue color="info" />}
            color="info"
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="생성된 이미지"
            value={systemStats.images?.total || 0}
            subtitle={`${(systemStats.images?.totalSize / (1024 * 1024 * 1024) || 0).toFixed(1)} GB`}
            icon={<Image color="success" />}
            color="success"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* 작업 큐 상태 */}
        <Grid item xs={12} md={8} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                작업 큐 상태
              </Typography>
              
              {queueLoading ? (
                <CircularProgress size={24} />
              ) : (
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">대기중</Typography>
                    <Typography variant="body2">{queue.waiting || 0}</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={queue.waiting > 0 ? Math.min((queue.waiting / 10) * 100, 100) : 0}
                    sx={{ mb: 2, height: 8, borderRadius: 4 }}
                  />
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">처리중</Typography>
                    <Typography variant="body2">{queue.active || 0}</Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={queue.active > 0 ? Math.min((queue.active / 5) * 100, 100) : 0}
                    sx={{ mb: 2, height: 8, borderRadius: 4 }}
                    color="secondary"
                  />

                  <Grid container spacing={2} mt={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        완료: {queue.completed || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="error">
                        실패: {queue.failed || 0}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 시스템 알림 */}
        <Grid item xs={12}>
          <Box display="flex" flexDirection="column" gap={2}>
            {queue.failed > 0 && (
              <Alert severity="warning" icon={<ErrorIcon />}>
                {queue.failed}개의 작업이 실패했습니다. 시스템 상태를 확인해주세요.
              </Alert>
            )}
            
            {queue.waiting > 20 && (
              <Alert severity="info">
                대기 중인 작업이 {queue.waiting}개입니다. 처리 용량을 확인해주세요.
              </Alert>
            )}
            
            {systemStats.images?.totalSize > 10 * 1024 * 1024 * 1024 && (
              <Alert severity="warning">
                저장된 이미지 용량이 {(systemStats.images.totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB입니다. 
                디스크 공간을 확인해주세요.
              </Alert>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AdminDashboard;