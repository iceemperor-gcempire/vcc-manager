import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Chip
} from '@mui/material';
import { useQuery } from 'react-query';
import { adminAPI, jobAPI } from '../../services/api';
import config from '../../config';

function SystemStats() {
  const { data: stats, isLoading: statsLoading } = useQuery(
    'adminStatsDetailed',
    adminAPI.getStats
  );

  const { data: recentJobs, isLoading: jobsLoading } = useQuery(
    'adminAllJobs',
    () => adminAPI.getJobs({ limit: 20 })
  );

  const { data: queueStats, isLoading: queueLoading } = useQuery(
    'queueStatsDetailed',
    jobAPI.getQueueStats,
    { refetchInterval: config.monitoring.queueStatusInterval }
  );

  if (statsLoading || jobsLoading || queueLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  const systemStats = stats?.data || {};
  const jobs = recentJobs?.data?.jobs || [];
  const queue = queueStats?.data?.stats || {};

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'info';
      case 'failed': return 'error';
      case 'cancelled': return 'default';
      default: return 'warning';
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        시스템 통계
      </Typography>

      <Grid container spacing={3}>
        {/* 사용자 통계 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                사용자 통계
              </Typography>
              
              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">전체 사용자</Typography>
                  <Typography variant="body2">{systemStats.users?.total || 0}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">활성 사용자</Typography>
                  <Typography variant="body2">{systemStats.users?.active || 0}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.users?.total > 0 ? (systemStats.users.active / systemStats.users.total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                  color="success"
                />
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">관리자</Typography>
                  <Typography variant="body2">{systemStats.users?.admins || 0}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.users?.total > 0 ? (systemStats.users.admins / systemStats.users.total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                  color="secondary"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 작업 통계 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                작업 통계
              </Typography>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">전체 작업</Typography>
                  <Typography variant="body2">{systemStats.jobs?.total || 0}</Typography>
                </Box>
              </Box>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">완료된 작업</Typography>
                  <Typography variant="body2">{systemStats.jobs?.completed || 0}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.jobs?.total > 0 ? (systemStats.jobs.completed / systemStats.jobs.total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                  color="success"
                />
              </Box>

              <Box mb={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">실패한 작업</Typography>
                  <Typography variant="body2">{systemStats.jobs?.failed || 0}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.jobs?.total > 0 ? (systemStats.jobs.failed / systemStats.jobs.total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                  color="error"
                />
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">처리 중인 작업</Typography>
                  <Typography variant="body2">{systemStats.jobs?.processing || 0}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemStats.jobs?.total > 0 ? (systemStats.jobs.processing / systemStats.jobs.total) * 100 : 0}
                  sx={{ height: 8, borderRadius: 4 }}
                  color="info"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 저장소 통계 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                저장소 통계
              </Typography>

              <Box mb={3}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  총 이미지 수
                </Typography>
                <Typography variant="h4">
                  {systemStats.images?.total || 0}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  사용 중인 저장 공간
                </Typography>
                <Typography variant="h5">
                  {formatBytes(systemStats.images?.totalSize || 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 큐 상태 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                현재 큐 상태
              </Typography>

              <Grid container spacing={2}>
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
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {queue.completed || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      완료됨
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error.main">
                      {queue.failed || 0}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      실패함
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 최근 작업 목록 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                최근 작업 목록
              </Typography>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>사용자</TableCell>
                      <TableCell>프롬프트</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>생성 시간</TableCell>
                      <TableCell>완료 시간</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job._id}>
                        <TableCell>
                          {job.userId?.nickname || '익명'}
                        </TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography variant="body2" noWrap>
                            {job.inputData?.prompt?.substring(0, 50) || '프롬프트 없음'}
                            {job.inputData?.prompt?.length > 50 && '...'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={job.status}
                            color={getStatusColor(job.status)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(job.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default SystemStats;