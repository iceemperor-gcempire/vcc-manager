import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Search,
  PlayArrow,
  SwapHoriz,
  Refresh,
  ArrowForward,
  MoreVert,
  Info,
  Save,
  Delete,
  AccountTree,
  Subject,
  CheckCircle,
  Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  jobAPI,
  conversationAPI,
  dashboardAPI,
  workboardAPI,
  promptDataAPI,
  userAPI,
} from '../services/api';
import config from '../config';
import ImageViewerDialog from '../components/common/ImageViewerDialog';
import VideoViewerDialog from '../components/common/VideoViewerDialog';
import WorkboardSelectDialog from '../components/common/WorkboardSelectDialog';
import { SavePromptDialog, JobDetailDialog } from '../components/common/JobHistoryPanel';
import { ToneChip, TagChip } from '../components/common/WorkboardCatalog';

const MONO = '"JetBrains Mono","SF Mono",Menlo,monospace';
const TYPE_LABEL = { pipeline: '파이프라인', image: '이미지', video: '영상', text: '텍스트' };

// ---- 상태 매핑 ----------------------------------------------------------
function mapStatus(s) {
  switch (s) {
    case 'completed': return 'done';
    case 'processing':
    case 'running': return 'running';
    case 'failed': return 'error';
    case 'pending': return 'queued';
    case 'cancelled': return 'cancelled';
    default: return 'done';
  }
}
const STATUS_CFG = {
  done: { tone: 'success', label: '완료' },
  running: { tone: 'info', label: '실행 중' },
  error: { tone: 'error', label: '실패' },
  queued: { tone: 'neutral', label: '대기' },
  cancelled: { tone: 'neutral', label: '취소' },
};
function StatusChip({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.done;
  return <ToneChip tone={cfg.tone} label={cfg.label} />;
}

// ---- 필드 추출 ----------------------------------------------------------
function extractModel(aiModel) {
  if (typeof aiModel === 'object' && aiModel?.key) {
    return aiModel.key === 'UserSelected'
      ? aiModel.value?.split(/[/\\]/).pop() || 'UserSelected'
      : aiModel.key;
  }
  return aiModel || '';
}
function extractSize(job) {
  const sz = job.inputData?.imageSize;
  if (typeof sz === 'object' && sz?.key) return sz.key;
  if (sz) return sz;
  const first = job.resultImages?.[0]?.metadata || job.resultVideos?.[0]?.metadata;
  if (first?.width && first?.height) return `${first.width}×${first.height}`;
  return '';
}
function projectFromTags(tags = []) {
  const t = tags.find((x) => typeof x === 'object' && x.name);
  return t?.name || '';
}
function relativeTime(time) {
  const diff = Date.now() - time.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  return `${String(time.getFullYear()).slice(2)}. ${time.getMonth() + 1}. ${time.getDate()}.`;
}

// ---- 정규화 -------------------------------------------------------------
function jobToItem(job) {
  const isVideo = (job.resultVideos?.length || 0) > 0;
  const type = isVideo ? 'video' : 'image';
  const results = isVideo ? job.resultVideos : job.resultImages;
  return {
    id: job._id,
    kind: 'job',
    type,
    time: new Date(job.createdAt),
    title: job.workboardId?.name || (isVideo ? '영상 생성' : '이미지 생성'),
    projectName: projectFromTags(job.inputData?.tags),
    model: extractModel(job.inputData?.aiModel),
    res: extractSize(job),
    count: results?.length || 0,
    duration: isVideo ? results?.[0]?.metadata?.duration : null,
    status: mapStatus(job.status),
    thumb: results?.[0]?.url || null,
    results: results || [],
    isVideo,
    raw: job,
  };
}
function convToItem(conv) {
  const lastA = [...(conv.messages || [])].reverse().find((m) => m.role === 'assistant');
  return {
    id: conv._id,
    kind: 'conv',
    type: 'text',
    time: new Date(conv.createdAt),
    title: conv.workboardId?.name || '텍스트 생성',
    projectName: '',
    model: conv.model || '',
    tokens: conv.usage?.totalTokens,
    preview: lastA?.content || '',
    status: mapStatus(conv.status),
    workboardId: conv.workboardId?._id || null,
    raw: conv,
  };
}
function runToItem(run) {
  return {
    id: run._id,
    kind: 'run',
    type: 'pipeline',
    time: new Date(run.createdAt),
    title: run.pipelineName,
    projectName: run.projectName,
    projectId: run.projectId,
    stepStatuses: run.stepStatuses || [],
    progress: run.progress,
    input: run.initialPrompt,
    status: mapStatus(run.status),
    raw: run,
  };
}

// ---- 좌측 비주얼 --------------------------------------------------------
function RowVisual({ item }) {
  const size = 56;
  if (item.type === 'image' || item.type === 'video') {
    return (
      <Box sx={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
        <Box
          sx={{
            width: size, height: size, borderRadius: 2, overflow: 'hidden',
            bgcolor: 'grey.100', display: 'grid', placeItems: 'center',
          }}
        >
          {item.thumb ? (
            <Box component="img" src={item.thumb} alt="" loading="lazy"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Subject fontSize="small" sx={{ color: 'grey.500' }} />
          )}
        </Box>
        {item.type === 'video' && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
            <PlayArrow />
          </Box>
        )}
        {item.type === 'image' && item.count > 1 && (
          <Box sx={{ position: 'absolute', bottom: 3, right: 3, fontSize: 9, fontFamily: MONO, color: '#fff', bgcolor: 'rgba(0,0,0,0.55)', px: 0.5, borderRadius: 0.5 }}>
            ×{item.count}
          </Box>
        )}
        {item.type === 'video' && item.duration != null && (
          <Box sx={{ position: 'absolute', bottom: 3, right: 3, fontSize: 9, fontFamily: MONO, color: '#fff', bgcolor: 'rgba(0,0,0,0.55)', px: 0.5, borderRadius: 0.5 }}>
            {Math.round(item.duration)}초
          </Box>
        )}
      </Box>
    );
  }
  const icon = item.type === 'pipeline' ? <AccountTree /> : <Subject />;
  return (
    <Box sx={{
      width: size, height: size, borderRadius: 2, flex: '0 0 auto',
      bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(118,118,224,0.18)' : 'rgba(91,91,214,0.10)',
      color: 'primary.main', display: 'grid', placeItems: 'center',
    }}>
      {icon}
    </Box>
  );
}

function StepDots({ statuses }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {statuses.slice(0, 10).map((s, j) => {
        const done = s === 'completed' || s === 'skipped';
        const failed = s === 'failed';
        const running = s === 'running';
        const bg = done ? 'success.main' : failed ? 'error.main' : running ? 'info.main' : 'grey.200';
        const fg = done || failed || running ? '#fff' : 'text.secondary';
        return (
          <Box key={j} sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: bg, color: fg, display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, fontFamily: MONO }}>
            {done ? <CheckCircle sx={{ fontSize: 12 }} /> : j + 1}
          </Box>
        );
      })}
    </Box>
  );
}

// ---- 한 행 --------------------------------------------------------------
function HistoryRow({ item, onOpenMedia, onMenu, onContinue, onCross, onTextContinue, onTextDetail, onPipelineDetail }) {
  const sub =
    item.type === 'image' ? [item.projectName, item.model, item.res, item.count ? `${item.count}장` : '']
      : item.type === 'video' ? [item.projectName, item.model, item.res, item.duration != null ? `${Math.round(item.duration)}초` : '']
      : item.type === 'text' ? [item.model, item.tokens != null ? `${item.tokens.toLocaleString()} 토큰` : '']
      : [item.projectName, item.stepStatuses.length ? `${item.stepStatuses.length}단계` : '', item.input];
  const subStr = sub.filter(Boolean).join(' · ');
  const clickable = item.type === 'image' || item.type === 'video';

  return (
    <Paper
      variant="outlined"
      onClick={clickable ? () => onOpenMedia(item) : undefined}
      sx={{
        p: { xs: 2.5, sm: '12px 14px' },
        cursor: clickable ? 'pointer' : 'default',
        transition: 'border-color 120ms, background 120ms',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <Box sx={{ display: 'flex', gap: { xs: 2.5, sm: 3.5 }, alignItems: 'flex-start' }}>
        <RowVisual item={item} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {item.title}
            </Typography>
            <TagChip label={TYPE_LABEL[item.type]} />
            <StatusChip status={item.status} />
          </Box>

          {subStr && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }} noWrap>
              {subStr}
            </Typography>
          )}

          {/* 텍스트 미리보기 */}
          {item.type === 'text' && item.preview && (
            <Typography
              variant="body2"
              sx={{
                mt: 1, fontSize: 12, lineHeight: 1.55, color: 'text.secondary',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                bgcolor: 'grey.100', borderRadius: 1.5, p: 1.25,
              }}
            >
              {item.preview}
            </Typography>
          )}

          {/* 파이프라인 단계 dots + 진행률 */}
          {item.type === 'pipeline' && item.stepStatuses.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <StepDots statuses={item.stepStatuses} />
              {item.status === 'running' && (
                <Box sx={{ width: 90 }}>
                  <LinearProgress variant="determinate" value={item.progress || 0} sx={{ height: 4, borderRadius: 2 }} />
                </Box>
              )}
            </Box>
          )}

          {/* 액션 */}
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1.25, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
            {(item.type === 'image' || item.type === 'video') && item.status !== 'error' && (
              <>
                <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={() => onContinue(item.raw)}>
                  계속하기
                </Button>
                <Button size="small" variant="outlined" startIcon={<ArrowForward />} onClick={() => onCross(item.raw)}>
                  다른 작업
                </Button>
              </>
            )}
            {item.type === 'text' && item.workboardId && item.status !== 'error' && (
              <Button size="small" variant="outlined" startIcon={<PlayArrow />} onClick={() => onTextContinue(item)}>
                이어가기
              </Button>
            )}
          </Box>
        </Box>

        {/* 우측 메타 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flex: '0 0 auto' }}
          onClick={(e) => e.stopPropagation()}>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontFamily: MONO, whiteSpace: 'nowrap' }}>
            {relativeTime(item.time)}
          </Typography>
          {item.type === 'pipeline' && item.projectId && (
            <Typography component="button" onClick={() => onPipelineDetail(item)}
              sx={{ fontSize: 12, color: 'primary.main', fontWeight: 500, border: 0, bgcolor: 'transparent', cursor: 'pointer', p: 0 }}>
              상세 →
            </Typography>
          )}
          {item.type === 'text' && (
            <Typography component="button" onClick={() => onTextDetail(item)}
              sx={{ fontSize: 12, color: 'primary.main', fontWeight: 500, border: 0, bgcolor: 'transparent', cursor: 'pointer', p: 0 }}>
              전문 보기 →
            </Typography>
          )}
          {(item.type === 'image' || item.type === 'video') && (
            <IconButton size="small" onClick={(e) => onMenu(e, item)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

// ---- 페이지 -------------------------------------------------------------
function JobHistory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 세그먼트/검색은 URL query 에 보관 — 계속하기/다른 작업 등으로 이동 후
  // 뒤로가기로 돌아와도 선택이 유지됨 (#458). replace 로 히스토리 오염 방지.
  const [searchParams, setSearchParams] = useSearchParams();
  const seg = searchParams.get('seg') || 'all';
  const search = searchParams.get('q') || '';
  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val);
    else p.delete(key);
    setSearchParams(p, { replace: true });
  };
  const setSeg = (v) => setParam('seg', v === 'all' ? '' : v);
  const setSearch = (v) => setParam('q', v);

  const [limit, setLimit] = useState(20);

  // 데이터
  const { data: jobsRes, isLoading: jobsLoading } = useQuery(
    ['historyJobs', limit],
    () => jobAPI.getMy({ limit }),
    { refetchInterval: config.monitoring.recentJobsInterval, keepPreviousData: true }
  );
  const { data: convsRes, isLoading: convsLoading } = useQuery(
    ['historyConvs', limit],
    () => conversationAPI.getMy({ limit }),
    { keepPreviousData: true }
  );
  const { data: runsRes, isLoading: runsLoading } = useQuery(
    ['historyRuns', limit],
    () => dashboardAPI.getAllPipelineRuns({ limit }),
    { refetchInterval: config.monitoring.recentJobsInterval, keepPreviousData: true }
  );

  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile());
  const userPreferences = profileData?.data?.user?.preferences || {};

  const loading = jobsLoading || convsLoading || runsLoading;

  const items = useMemo(() => {
    const jobs = (jobsRes?.data?.jobs || []).map(jobToItem);
    const convs = (convsRes?.data?.data?.conversations || []).map(convToItem);
    const runs = (runsRes?.data?.data?.runs || []).map(runToItem);
    return [...jobs, ...convs, ...runs].sort((a, b) => b.time - a.time);
  }, [jobsRes, convsRes, runsRes]);

  const counts = useMemo(() => ({
    all: items.length,
    pipeline: items.filter((i) => i.type === 'pipeline').length,
    image: items.filter((i) => i.type === 'image').length,
    video: items.filter((i) => i.type === 'video').length,
    text: items.filter((i) => i.type === 'text').length,
  }), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => seg === 'all' || i.type === seg)
      .filter((i) => {
        if (!q) return true;
        return [i.title, i.projectName, i.model, i.preview, i.input]
          .filter(Boolean).join(' ').toLowerCase().includes(q);
      });
  }, [items, seg, search]);

  // ---- 메뉴 / 다이얼로그 상태 ----
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuJob, setMenuJob] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saveJob, setSaveJob] = useState(null);
  const [crossJob, setCrossJob] = useState(null);
  const [imgViewer, setImgViewer] = useState({ open: false, items: [], index: 0 });
  const [vidViewer, setVidViewer] = useState({ open: false, items: [], index: 0 });
  const [textDetail, setTextDetail] = useState(null);

  // ---- mutations ----
  const deleteMutation = useMutation(
    ({ id, deleteContent }) => jobAPI.delete(id, deleteContent),
    {
      onSuccess: (response) => {
        const { deletedImagesCount = 0, deletedVideosCount = 0 } = response.data || {};
        if (deletedImagesCount > 0 || deletedVideosCount > 0) {
          toast.success(`작업과 ${deletedImagesCount}개 이미지, ${deletedVideosCount}개 동영상이 삭제되었습니다`);
          queryClient.invalidateQueries('generatedImages');
          queryClient.invalidateQueries('videos');
        } else {
          toast.success('작업이 삭제되었습니다');
        }
        queryClient.invalidateQueries('historyJobs');
      },
      onError: (error) => toast.error('삭제 실패: ' + error.message),
    }
  );
  const savePromptMutation = useMutation(promptDataAPI.create, {
    onSuccess: () => { toast.success('프롬프트 데이터가 저장되었습니다'); setSaveJob(null); },
    onError: (error) => toast.error('프롬프트 저장 실패: ' + (error.response?.data?.message || error.message)),
  });

  // ---- handlers ----
  const openMedia = (item) => {
    if (item.isVideo) setVidViewer({ open: true, items: item.results, index: 0 });
    else setImgViewer({ open: true, items: item.results, index: 0 });
  };

  const handleMenu = (e, item) => { setMenuAnchor(e.currentTarget); setMenuJob(item.raw); };
  const closeMenu = () => { setMenuAnchor(null); setMenuJob(null); };

  const handleViewDetail = async (job) => {
    closeMenu();
    setDetailJob(job);
    setDetailOpen(true);
    try {
      const response = await jobAPI.getById(job._id);
      if (response.data?.job) setDetailJob(response.data.job);
    } catch (err) {
      console.error('상세 조회 실패:', err);
    }
  };

  const handleDelete = (job) => {
    closeMenu();
    const hasContent = (job.resultImages?.length > 0) || (job.resultVideos?.length > 0);
    if (userPreferences.deleteContentWithHistory && hasContent) {
      const n = (job.resultImages?.length || 0) + (job.resultVideos?.length || 0);
      if (window.confirm(`작업과 연관된 ${n}개의 컨텐츠(이미지/동영상)도 함께 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
        deleteMutation.mutate({ id: job._id, deleteContent: true });
      }
    } else if (window.confirm('작업 히스토리를 삭제하시겠습니까?\n\n생성된 이미지/동영상은 보존됩니다.')) {
      deleteMutation.mutate({ id: job._id, deleteContent: false });
    }
  };

  const handleContinue = async (job) => {
    try {
      let workboardId = typeof job.workboardId === 'string' ? job.workboardId : (job.workboardId?._id || job.workboardId?.id);
      const fallback = () => {
        localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
        navigate('/workboards');
      };
      if (!workboardId || !/^[0-9a-fA-F]{24}$/.test(workboardId)) { toast.error('작업판 정보를 찾을 수 없습니다. 작업판 선택 페이지로 이동합니다.'); return fallback(); }
      const wbRes = await workboardAPI.getById(workboardId);
      const workboard = wbRes.data?.workboard;
      if (!workboard || !workboard.isActive) { toast.error('작업판을 사용할 수 없습니다. 작업판 선택 페이지로 이동합니다.'); return fallback(); }
      localStorage.setItem('continueJobData', JSON.stringify({ workboardId, inputData: job.inputData, workboard }));
      navigate(`/generate/${workboardId}`);
      toast.success('작업 설정을 불러왔습니다');
    } catch (error) {
      toast.error('작업을 계속할 수 없습니다. 작업판 선택 페이지로 이동합니다.');
      localStorage.setItem('continueJobData', JSON.stringify({ inputData: job.inputData, fromJobHistory: true }));
      navigate('/workboards');
    }
  };

  const handleWorkboardSelected = (workboard) => {
    if (!crossJob) return;
    const job = crossJob;
    const lastImage = job.resultImages?.length ? job.resultImages[job.resultImages.length - 1] : null;
    const lastVideo = job.resultVideos?.length ? job.resultVideos[job.resultVideos.length - 1] : null;
    localStorage.setItem('continueJobData', JSON.stringify({
      workboardId: workboard._id, inputData: job.inputData, workboard,
      lastGeneratedMedia: { image: lastImage, video: lastVideo },
    }));
    setCrossJob(null);
    navigate(`/generate/${workboard._id}`);
    toast.success('작업판이 선택되었습니다. 설정을 매칭합니다.');
  };

  const handleTextContinue = (item) => {
    navigate(`/prompt-generate/${item.workboardId}?conversationId=${item.id}`);
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      {/* 헤더 */}
      <Box sx={{ mb: 4.5 }}>
        <Typography variant="h1">작업 히스토리</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ textWrap: 'pretty', mt: 0.5 }}>
          파이프라인 · 이미지 · 영상 · 텍스트 생성 기록을 한 곳에서. 최신순.
        </Typography>
      </Box>

      {/* 검색 */}
      <TextField
        size="small"
        placeholder="히스토리 검색…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3.5, maxWidth: { sm: 360 }, width: '100%' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
      />

      {/* 세그먼트 */}
      <Stack direction="row" spacing={1} sx={{ mb: 4.5, overflowX: 'auto', pb: 0.5 }}>
        {[
          { k: 'all', l: '전체' },
          { k: 'pipeline', l: '파이프라인' },
          { k: 'image', l: '이미지' },
          { k: 'video', l: '영상' },
          { k: 'text', l: '텍스트' },
        ].map((s) => (
          <Button
            key={s.k}
            onClick={() => setSeg(s.k)}
            variant={seg === s.k ? 'contained' : 'text'}
            color={seg === s.k ? 'primary' : 'inherit'}
            sx={{ flex: '0 0 auto', color: seg === s.k ? undefined : 'text.secondary' }}
          >
            {s.l}
            <Box component="span" sx={{ ml: 0.75, fontFamily: MONO, fontSize: 11, opacity: 0.8 }}>
              {counts[s.k]}
            </Box>
          </Button>
        ))}
      </Stack>

      {/* 피드 */}
      {loading && items.length === 0 ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : visible.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {search ? '검색 결과가 없습니다.' : '아직 작업 기록이 없습니다.'}
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {visible.map((item) => (
            <HistoryRow
              key={`${item.kind}-${item.id}`}
              item={item}
              onOpenMedia={openMedia}
              onMenu={handleMenu}
              onContinue={handleContinue}
              onCross={(job) => setCrossJob(job)}
              onTextContinue={handleTextContinue}
              onTextDetail={(it) => setTextDetail(it)}
              onPipelineDetail={(it) => navigate(`/projects/${it.projectId}`)}
            />
          ))}
        </Stack>
      )}

      {/* 더 보기 */}
      {!loading && visible.length > 0 && items.length >= limit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button variant="outlined" onClick={() => setLimit((l) => l + 20)}>더 보기</Button>
        </Box>
      )}

      {/* 이미지/영상 행 오버플로우 메뉴 */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuItem onClick={() => menuJob && handleViewDetail(menuJob)}>
          <Info fontSize="small" sx={{ mr: 1 }} /> 상세
        </MenuItem>
        {menuJob && ['completed', 'failed'].includes(menuJob.status) && (
          <MenuItem onClick={() => { const j = menuJob; closeMenu(); setSaveJob(j); }}>
            <Save fontSize="small" sx={{ mr: 1 }} /> 프롬프트 저장
          </MenuItem>
        )}
        <MenuItem onClick={() => menuJob && handleDelete(menuJob)} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} /> 삭제
        </MenuItem>
      </Menu>

      {/* 다이얼로그 */}
      <JobDetailDialog
        job={detailJob}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onImageView={(its, idx, isVideo) => isVideo ? setVidViewer({ open: true, items: its, index: idx }) : setImgViewer({ open: true, items: its, index: idx })}
      />
      <ImageViewerDialog
        images={imgViewer.items}
        selectedIndex={imgViewer.index}
        open={imgViewer.open}
        onClose={() => setImgViewer((v) => ({ ...v, open: false }))}
        title="생성된 이미지"
      />
      <VideoViewerDialog
        videos={vidViewer.items}
        selectedIndex={vidViewer.index}
        open={vidViewer.open}
        onClose={() => setVidViewer((v) => ({ ...v, open: false }))}
        title="생성된 동영상"
      />
      <SavePromptDialog
        open={!!saveJob}
        onClose={() => setSaveJob(null)}
        job={saveJob}
        onSave={(data) => savePromptMutation.mutate(data)}
      />
      <WorkboardSelectDialog
        open={!!crossJob}
        onClose={() => setCrossJob(null)}
        onSelect={handleWorkboardSelected}
      />

      {/* 텍스트 전문 보기 */}
      <Dialog open={!!textDetail} onClose={() => setTextDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">{textDetail?.title}</Typography>
            <IconButton onClick={() => setTextDetail(null)}><Close /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {textDetail && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {textDetail.model && <Chip size="small" variant="outlined" label={textDetail.model} />}
                {textDetail.tokens != null && <Chip size="small" variant="outlined" label={`${textDetail.tokens.toLocaleString()} 토큰`} />}
                <StatusChip status={textDetail.status} />
              </Stack>
              {(textDetail.raw?.messages || []).filter((m) => m.role !== 'system').map((m, i) => (
                <Box key={i}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {m.role === 'user' ? '질문' : '응답'}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.25 }}>
                    {m.content}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {textDetail?.workboardId && (
            <Button variant="contained" startIcon={<PlayArrow />} onClick={() => { handleTextContinue(textDetail); setTextDetail(null); }}>
              이어가기
            </Button>
          )}
          <Button onClick={() => setTextDetail(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default JobHistory;
