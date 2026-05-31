import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
} from '@mui/material';
import { PlayArrow, ContentCopy, Inventory2 } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { workboardAPI, projectAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  getServerTypeLabel,
  getServerTypeColor,
  getOutputFormatLabel,
} from '../templates/capabilities';
import {
  WorkboardFilters,
  WorkboardCard,
  useWorkboardFilter,
} from '../components/common/WorkboardCatalog';

function selectWorkboard(workboard, projectId, navigate) {
  // 히스토리에서 온 데이터가 있으면 작업판과 연결
  const continueJobData = localStorage.getItem('continueJobData');
  if (continueJobData) {
    try {
      const parsed = JSON.parse(continueJobData);
      if (parsed.fromJobHistory) {
        localStorage.setItem('continueJobData', JSON.stringify({
          workboardId: workboard._id,
          inputData: parsed.inputData,
          workboard,
        }));
        toast.success('작업 히스토리 데이터와 작업판이 연결되었습니다');
      }
    } catch (e) {
      console.warn('Failed to parse continue job data:', e);
    }
  }
  const projectQuery = projectId ? `?projectId=${projectId}` : '';
  if ((workboard.outputFormat || 'image') === 'text') {
    navigate(`/prompt-generate/${workboard._id}${projectQuery}`);
  } else {
    navigate(`/generate/${workboard._id}${projectQuery}`);
  }
}

function WorkboardDetailDialog({ workboard, open, onClose, onSelect }) {
  if (!workboard) return null;
  const copyId = async () => {
    try { await navigator.clipboard.writeText(workboard._id); toast.success('작업판 ID를 복사했습니다.'); }
    catch { toast.error('작업판 ID 복사에 실패했습니다.'); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{workboard.name}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{workboard.description || '설명이 없습니다.'}</DialogContentText>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip size="small"
            label={getOutputFormatLabel(workboard.outputFormat || 'image')}
            color={workboard.outputFormat === 'text' ? 'info' : workboard.outputFormat === 'video' ? 'warning' : 'primary'} />
          <Chip size="small" label={getServerTypeLabel(workboard.serverId?.serverType) || '서버 미설정'}
            sx={{ bgcolor: getServerTypeColor(workboard.serverId?.serverType), color: 'white' }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            작업판 ID: {workboard._id}
          </Typography>
          <IconButton size="small" onClick={copyId}><ContentCopy fontSize="inherit" /></IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">서버: {workboard.serverId?.name || '미설정'}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">생성자: {workboard.createdBy?.nickname || '알 수 없음'}</Typography>
        <Typography variant="caption" color="text.secondary" display="block">버전: v{workboard.version || 1}</Typography>
        {workboard.createdAt && (
          <Typography variant="caption" color="text.secondary" display="block">생성일: {new Date(workboard.createdAt).toLocaleDateString()}</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
        <Button variant="contained" startIcon={<PlayArrow />} onClick={() => onSelect(workboard)}>선택하기</Button>
      </DialogActions>
    </Dialog>
  );
}

function Workboards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [detailWb, setDetailWb] = useState(null);

  const { data: projectData } = useQuery(
    ['project', projectId],
    () => projectAPI.getById(projectId),
    { enabled: !!projectId }
  );
  const projectContext = projectData?.data?.data?.project;

  const { data, isLoading, error } = useQuery(
    'workboardsCatalog',
    () => workboardAPI.getAll({ limit: 500 }),
    { keepPreviousData: true }
  );
  const workboards = data?.data?.workboards || [];

  const { q, setQ, outSel, svcSel, toggleOut, toggleSvc, clear, counts, filtered } = useWorkboardFilter(workboards);

  const handleSelect = (wb) => { setDetailWb(null); selectWorkboard(wb, projectId, navigate); };

  if (error) {
    return <Box sx={{ maxWidth: 1100, mx: 'auto' }}><Alert severity="error">작업판을 불러오는 중 오류가 발생했습니다: {error.message}</Alert></Box>;
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h1">작업판</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ textWrap: 'pretty', mt: 0.5 }}>
          한 번의 호출로 실행하는 단위. 파이프라인의 단계로도 사용됩니다.
        </Typography>
        {projectContext && (
          <Chip label={`프로젝트: ${projectContext.name}`} color="primary" variant="outlined" size="small" sx={{ mt: 1 }} />
        )}
      </Box>

      <WorkboardFilters
        q={q} setQ={setQ}
        outSel={outSel} toggleOut={toggleOut}
        svcSel={svcSel} toggleSvc={toggleSvc}
        counts={counts} total={workboards.length} shown={filtered.length}
        onClear={clear}
      />

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed' }}>
          <Inventory2 sx={{ fontSize: 32, color: 'text.disabled', mb: 1.5 }} />
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>조건에 맞는 작업판이 없습니다</Typography>
          <Typography variant="body2" color="text.secondary">
            {workboards.length === 0 ? '사용 가능한 작업판이 없습니다.' : '필터를 줄이거나 초기화해 보세요.'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(300px, 1fr))' }, gap: 1.5 }}>
          {filtered.map((wb) => (
            <WorkboardCard
              key={wb._id}
              wb={wb}
              onClick={() => handleSelect(wb)}
              onInfo={(w) => setDetailWb(w)}
            />
          ))}
        </Box>
      )}

      <WorkboardDetailDialog
        workboard={detailWb}
        open={!!detailWb}
        onClose={() => setDetailWb(null)}
        onSelect={handleSelect}
      />
    </Box>
  );
}

export default Workboards;
