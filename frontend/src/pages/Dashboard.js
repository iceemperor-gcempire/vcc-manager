import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Skeleton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Add,
  PlayArrow,
  AccountTree,
  CloudUpload,
  Autorenew,
  FolderOpen,
  Image as ImageIcon,
  Dns,
  NewReleases,
  TrendingUp,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  dashboardAPI,
  projectAPI,
  imageAPI,
  serverAPI,
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import UpdateLogDialog from '../components/common/UpdateLogDialog';
import { MONO } from '../theme';
import { gradientForId } from '../utils/brandGradients';
import { relativeTime } from '../utils/relativeTime';


function dateHeroLine() {
  const now = new Date();
  const weekday = now.toLocaleDateString('ko-KR', { weekday: 'long' });
  const ampm = now.getHours() < 12 ? '오전' : '오후';
  return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}. ${weekday} · ${ampm}`;
}

// 카드 헤더 + 본문 래퍼
function SectionCard({ icon, title, count, action, onAction, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', ...sx }}>
      {title && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 3.5,
            py: 2.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {icon}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {count != null && (
            <Box
              sx={{
                fontSize: 11,
                fontFamily: MONO,
                color: 'text.secondary',
                bgcolor: 'grey.100',
                borderRadius: 999,
                px: 1,
                py: 0.25,
                ml: 0.5,
              }}
            >
              {count}
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          {action && (
            <Typography
              component="button"
              onClick={onAction}
              sx={{
                fontSize: 12,
                color: 'primary.main',
                fontWeight: 500,
                border: 0,
                bgcolor: 'transparent',
                cursor: 'pointer',
                p: 0,
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              {action}
            </Typography>
          )}
        </Box>
      )}
      {children}
    </Paper>
  );
}

// 미니 sparkline (SVG)
function MiniSparkline({ values, color }) {
  if (!values || values.length < 2) {
    return (
      <Box sx={{ height: 32, display: 'flex', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          데이터 없음
        </Typography>
      </Box>
    );
  }
  const w = 240;
  const h = 36;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline points={`${pts} ${w},${h} 0,${h}`} fill={color} opacity="0.08" />
    </svg>
  );
}

function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [updateLogOpen, setUpdateLogOpen] = useState(false);

  const { data: activeRunsRes } = useQuery({ queryKey: ['dashboardActiveRuns'], queryFn: dashboardAPI.getActivePipelineRuns, refetchInterval: config.monitoring.recentJobsInterval });
  const { data: projectsRes, isLoading: projectsLoading } = useQuery({ queryKey: ['dashboardProjects'], queryFn: () => projectAPI.getAll() });
  const { data: imagesRes, isLoading: imagesLoading } = useQuery({ queryKey: ['dashboardRecentImages'], queryFn: () => imageAPI.getGenerated({ limit: 12 }) });
  const { data: trendRes } = useQuery({ queryKey: ['dashboardImageTrend'], queryFn: () =>
    dashboardAPI.getImageTrend(7) });
  const { data: serversRes } = useQuery({ queryKey: ['dashboardServers'], queryFn: () => serverAPI.getServers(), refetchInterval: config.monitoring.queueStatusInterval });
  const { data: workboardsRes } = useQuery({ queryKey: ['dashboardWorkboardUsage'], queryFn: () =>
    dashboardAPI.getWorkboardUsage(4) });

  const activeRuns = activeRunsRes?.data?.data?.runs || [];
  const projects = (projectsRes?.data?.data?.projects || []).slice(0, 4);
  const images = imagesRes?.data?.images || [];
  const trend = trendRes?.data?.data?.trend || [];
  const trendToday = trendRes?.data?.data?.today ?? 0;
  const trendAverage = trendRes?.data?.data?.average ?? 0;
  const trendPeak = trendRes?.data?.data?.peak ?? 0;
  const servers = serversRes?.data?.data?.servers || [];
  const workboards = workboardsRes?.data?.data?.workboards || [];

  // 어제 대비 증감
  const yesterday = trend.length >= 2 ? trend[trend.length - 2].count : 0;
  let deltaPct = null;
  if (yesterday > 0) deltaPct = Math.round(((trendToday - yesterday) / yesterday) * 100);

  const userName = user?.nickname || user?.email || '사용자';

  const quickActions = [
    { label: '새 프로젝트', icon: <Add />, primary: true, to: '/projects' },
    { label: '작업판 실행', icon: <PlayArrow />, to: '/workboards' },
    { label: '파이프라인 만들기', icon: <AccountTree />, to: '/projects' },
    { label: '이미지 업로드', icon: <CloudUpload />, to: '/content' },
  ];

  return (
    <Box>
      {/* Greeting hero */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          mb: 5.5,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ flex: '1 1 360px', minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 12,
              color: 'text.secondary',
              fontFamily: MONO,
              letterSpacing: '0.04em',
              mb: 0.5,
            }}
          >
            {dateHeroLine()}
          </Typography>
          <Typography variant="h1" sx={{ mb: 0.75 }}>
            안녕하세요, {userName} 님
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ textWrap: 'pretty' }}>
            {activeRuns.length > 0 ? (
              <>
                현재{' '}
                <Box component="b" sx={{ color: 'primary.main' }}>
                  {activeRuns.length}개 파이프라인
                </Box>
                이 실행 중입니다.
              </>
            ) : (
              '실행 중인 파이프라인이 없습니다.'
            )}
            {deltaPct != null && deltaPct !== 0 && (
              <>
                {' '}어제 대비 이미지 생성량이{' '}
                <Box
                  component="b"
                  sx={{ color: deltaPct > 0 ? 'success.main' : 'error.main' }}
                >
                  {deltaPct > 0 ? '+' : ''}
                  {deltaPct}%
                </Box>{' '}
                {deltaPct > 0 ? '늘었어요.' : '줄었어요.'}
              </>
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
          {quickActions.map((q) => (
            <Button
              key={q.label}
              variant={q.primary ? 'contained' : 'outlined'}
              startIcon={q.icon}
              onClick={() => navigate(q.to)}
            >
              {q.label}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* Main two-column */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr' },
          gap: 4,
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <Stack spacing={4}>
          {/* Recent generations */}
          <SectionCard
            icon={<ImageIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
            title="최근 생성 이미지"
            action="컨텐츠 라이브러리 →"
            onAction={() => navigate('/content')}
          >
            {imagesLoading ? (
              <GridSkeleton n={6} cols={{ xs: 3, sm: 6 }} height={0} aspect />
            ) : images.length === 0 ? (
              <EmptyHint text="아직 생성된 이미지가 없습니다." />
            ) : (
              <Box
                sx={{
                  p: 3,
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(3,1fr)', sm: 'repeat(6,1fr)' },
                  gap: 1.5,
                }}
              >
                {images.slice(0, 12).map((img) => (
                  <Box
                    key={img._id}
                    onClick={() => navigate('/content')}
                    sx={{
                      position: 'relative',
                      aspectRatio: '1 / 1',
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      bgcolor: 'grey.100',
                    }}
                  >
                    <Box
                      component="img"
                      src={img.url}
                      alt=""
                      loading="lazy"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>

          {/* Running pipelines */}
          <SectionCard
            icon={
              <Autorenew
                fontSize="small"
                sx={{
                  color: 'primary.main',
                  animation: activeRuns.length ? 'spin 1.6s linear infinite' : 'none',
                  '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                }}
              />
            }
            title="실행 중 파이프라인"
            count={activeRuns.length}
          >
            {activeRuns.length === 0 ? (
              <EmptyHint text="실행 중인 파이프라인이 없습니다." />
            ) : (
              activeRuns.map((run, i) => (
                <Box
                  key={run._id}
                  onClick={() => run.projectId && navigate(`/projects/${run.projectId}`)}
                  sx={{
                    px: 3.5,
                    py: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    cursor: run.projectId ? 'pointer' : 'default',
                    borderTop: i > 0 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      flex: '0 0 auto',
                      animation: 'pulse 1.4s infinite',
                      '@keyframes pulse': { '0%,100%': { opacity: 0.45 }, '50%': { opacity: 1 } },
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {run.pipelineName}
                      </Typography>
                      {run.projectName && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          · {run.projectName}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                      <LinearProgress
                        variant="determinate"
                        value={run.progress}
                        sx={{ flex: 1, height: 4, borderRadius: 2 }}
                      />
                      <Typography
                        sx={{ fontSize: 10, fontFamily: MONO, color: 'text.secondary', minWidth: 30, textAlign: 'right' }}
                      >
                        {run.progress}%
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 11, fontFamily: MONO, color: 'text.secondary' }}>
                    {run.stepDone}/{run.stepTotal}
                  </Typography>
                </Box>
              ))
            )}
          </SectionCard>

          {/* Recent projects */}
          <SectionCard
            icon={<FolderOpen fontSize="small" sx={{ color: 'text.secondary' }} />}
            title="최근 프로젝트"
            action="모두 보기 →"
            onAction={() => navigate('/projects')}
          >
            {projectsLoading ? (
              <GridSkeleton n={4} cols={{ xs: 2, sm: 4 }} height={84} />
            ) : projects.length === 0 ? (
              <EmptyHint text="프로젝트가 없습니다. 새 프로젝트를 만들어 보세요." />
            ) : (
              <Box
                sx={{
                  p: 3.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' },
                  gap: 2.5,
                }}
              >
                {projects.map((p) => (
                  <Box
                    key={p._id}
                    onClick={() => navigate(`/projects/${p._id}`)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      p: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'all 120ms',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        background: gradientForId(String(p._id)),
                        color: 'common.white',
                        fontWeight: 700,
                        fontSize: 16,
                        display: 'grid',
                        placeItems: 'center',
                        mb: 2.5,
                        boxShadow: 1,
                      }}
                    >
                      {(p.name || '?')[0]}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {p.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} noWrap>
                      {(p.counts?.images ?? 0)}장 · {relativeTime(p.updatedAt)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>

        </Stack>

        {/* Right column */}
        <Stack spacing={4}>
          {/* Generation trend */}
          <Paper variant="outlined" sx={{ p: 3.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                주간 생성 추이
              </Typography>
              <Box sx={{ flex: 1 }} />
              {deltaPct != null && (
                <Box
                  sx={{
                    fontSize: 11,
                    fontFamily: MONO,
                    fontWeight: 600,
                    color: deltaPct >= 0 ? 'success.main' : 'error.main',
                    bgcolor: deltaPct >= 0 ? 'success.light' : 'error.light',
                    borderRadius: 1,
                    px: 0.75,
                    py: 0.25,
                  }}
                >
                  {deltaPct >= 0 ? '+' : ''}
                  {deltaPct}%
                </Box>
              )}
            </Box>
            <Box sx={{ mt: 2 }}>
              <MiniSparkline values={trend.map((t) => t.count)} color={theme.palette.secondary.main} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              {trend.map((t) => (
                <Typography
                  key={t.date}
                  sx={{ fontSize: 10, fontFamily: MONO, color: 'text.secondary' }}
                >
                  {new Date(t.date).toLocaleDateString('ko-KR', { weekday: 'short' })}
                </Typography>
              ))}
            </Box>
            <Stack direction="row" spacing={2} sx={{ mt: 2.5 }}>
              <TrendStat label="오늘" value={trendToday} />
              <TrendStat label="평균" value={trendAverage} />
              <TrendStat label="피크" value={trendPeak} />
            </Stack>
          </Paper>

          {/* Server status */}
          <SectionCard
            icon={<Dns fontSize="small" sx={{ color: 'text.secondary' }} />}
            title="서버 상태"
          >
            {servers.length === 0 ? (
              <EmptyHint text="등록된 서버가 없습니다." />
            ) : (
              servers.map((s, i) => {
                const status = s.healthCheck?.status;
                const tone =
                  status === 'healthy' ? 'success.main' : status === 'unhealthy' ? 'error.main' : 'grey.500';
                return (
                  <Box
                    key={s._id}
                    sx={{
                      px: 3.5,
                      py: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      borderTop: i > 0 ? '1px solid' : 'none',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone, flex: '0 0 auto' }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                        {s.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, fontFamily: MONO, color: 'text.secondary' }} noWrap>
                        {isAdmin && s.serverUrl ? s.serverUrl : s.serverType}
                      </Typography>
                    </Box>
                    {s.healthCheck?.responseTime != null && status === 'healthy' && (
                      <Typography sx={{ fontSize: 10, fontFamily: MONO, color: 'text.secondary' }}>
                        {s.healthCheck.responseTime}ms
                      </Typography>
                    )}
                  </Box>
                );
              })
            )}
          </SectionCard>

          {/* Top workboards */}
          <Paper variant="outlined" sx={{ p: 3.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              자주 쓰는 작업판
            </Typography>
            {workboards.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                아직 사용 기록이 없습니다.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {workboards.map((wb, i) => (
                  <Box key={wb._id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 11, fontFamily: MONO, color: 'text.secondary', width: 16 }}>
                      {i + 1}
                    </Typography>
                    <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                      {wb.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontFamily: MONO, color: 'text.secondary' }}>
                      {wb.usageCount ?? 0}회
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>

          {/* Update log access (디자인엔 없지만 진입점 보존) */}
          <Tooltip title="이번 버전에서 달라진 점 보기">
            <Button
              variant="text"
              startIcon={<NewReleases />}
              onClick={() => setUpdateLogOpen(true)}
              sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
            >
              업데이트 내역
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      <UpdateLogDialog
        open={updateLogOpen}
        onClose={() => setUpdateLogOpen(false)}
        majorVersion={config.version.major}
      />
    </Box>
  );
}

function TrendStat({ label, value }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

function EmptyHint({ text }) {
  return (
    <Box sx={{ px: 3.5, py: 4, textAlign: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  );
}

function GridSkeleton({ n, cols, height, aspect }) {
  return (
    <Box
      sx={{
        p: 3.5,
        display: 'grid',
        gridTemplateColumns: { xs: `repeat(${cols.xs},1fr)`, sm: `repeat(${cols.sm},1fr)` },
        gap: 2,
      }}
    >
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          sx={aspect ? { width: '100%', aspectRatio: '1 / 1' } : { width: '100%', height }}
        />
      ))}
    </Box>
  );
}

export default Dashboard;
