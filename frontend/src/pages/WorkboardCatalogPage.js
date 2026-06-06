import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Button,
  Stack,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  PlayArrow,
  ContentCopy,
  Inventory2,
  Add,
  FileUpload,
  Edit,
  FileDownload,
  ToggleOn,
  ToggleOff,
  Delete,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
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
import { WorkboardImportDialog } from '../components/admin/WorkboardManagement';
import { copyToClipboard } from '../utils/clipboard';
import { invalidateWorkboardQueries } from '../utils/queryInvalidation';
import { usePersistedState } from '../hooks/usePersistedState';

const MONO = '"JetBrains Mono","SF Mono",Menlo,monospace';

// ── 사용자: 작업판 선택(실행) ────────────────────────────────
function selectWorkboard(workboard, projectId, navigate) {
  const continueJobData = localStorage.getItem('continueJobData');
  if (continueJobData) {
    try {
      const parsed = JSON.parse(continueJobData);
      if (parsed.fromJobHistory) {
        localStorage.setItem('continueJobData', JSON.stringify({
          workboardId: workboard._id, inputData: parsed.inputData, workboard,
        }));
        toast.success('작업 히스토리 데이터와 작업판이 연결되었습니다');
      }
    } catch (e) { console.warn('Failed to parse continue job data:', e); }
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
    try { await copyToClipboard(workboard._id); toast.success('작업판 ID를 복사했습니다.'); }
    catch { toast.error('작업판 ID 복사에 실패했습니다.'); }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{workboard.name}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{workboard.description || '설명이 없습니다.'}</DialogContentText>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip size="small" label={getOutputFormatLabel(workboard.outputFormat || 'image')}
            color={workboard.outputFormat === 'text' ? 'info' : workboard.outputFormat === 'video' ? 'warning' : 'primary'} />
          <Chip size="small" label={getServerTypeLabel(workboard.serverId?.serverType) || '서버 미설정'}
            sx={{ bgcolor: getServerTypeColor(workboard.serverId?.serverType), color: 'white' }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>작업판 ID: {workboard._id}</Typography>
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

// ── 공통 페이지: admin 권한에 따라 관리 UI 표시/미표시 ───────────
// 사용자 "작업판"(admin=false)과 관리자 "작업판 관리"(admin=true)가 같은 레이아웃을 공유.
function WorkboardCatalogPage({ admin = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const projectId = admin ? null : searchParams.get('projectId');

  // 필터 영속 키 — admin/user 컨텍스트별 분리 (#510). 작업판에 들어갔다 나와도 필터 유지.
  const persistKey = `vcc.wbCatalog.${admin ? 'admin' : 'user'}`;

  // user-only
  const [detailWb, setDetailWb] = useState(null);
  // admin-only
  const [status, setStatus] = usePersistedState(`${persistKey}.status`, 'all'); // all | active | inactive
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuWb, setMenuWb] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: projectData } = useQuery(
    ['project', projectId],
    () => projectAPI.getById(projectId),
    { enabled: !!projectId }
  );
  const projectContext = projectData?.data?.data?.project;

  const { data, isLoading } = useQuery(
    ['workboardCatalog', admin],
    () => workboardAPI.getAll(admin
      ? { limit: 500, includeAll: true, includeInactive: true }
      : { limit: 500 }),
    { keepPreviousData: true }
  );
  const workboards = data?.data?.workboards || [];

  // admin: 상태(전체/게시됨/보관) 필터를 먼저 적용
  const statusCounts = {
    all: workboards.length,
    active: workboards.filter((w) => w.isActive).length,
    inactive: workboards.filter((w) => !w.isActive).length,
  };
  const baseList = !admin || status === 'all'
    ? workboards
    : workboards.filter((w) => (status === 'active' ? w.isActive : !w.isActive));

  const { q, setQ, outSel, svcSel, toggleOut, toggleSvc, clear, counts, filtered } = useWorkboardFilter(baseList, persistKey);

  // ── admin mutations ──
  // 작업판 관련 캐시 전체 무효화 (#498) — 목록/상세/실행화면/대시보드 일괄 갱신
  const invalidate = () => invalidateWorkboardQueries(queryClient);
  const deleteMutation = useMutation(workboardAPI.delete, {
    onSuccess: () => { toast.success('작업판이 삭제되었습니다'); invalidate(); },
    onError: (e) => toast.error('삭제 실패: ' + e.message),
  });
  const toggleMutation = useMutation(
    ({ id, isActive }) => (isActive ? workboardAPI.deactivate(id) : workboardAPI.activate(id)),
    {
      onSuccess: (res) => { toast.success(`작업판이 ${res.data.workboard.isActive ? '활성화' : '비활성화'}되었습니다`); invalidate(); },
      onError: (e) => toast.error('상태 변경 실패: ' + e.message),
    }
  );
  const duplicateMutation = useMutation(
    ({ id, name }) => workboardAPI.duplicate(id, { name }),
    {
      onSuccess: () => { toast.success('작업판이 복제되었습니다'); invalidate(); },
      onError: (e) => toast.error('복제 실패: ' + e.message),
    }
  );

  // ── handlers ──
  const handleSelect = (wb) => { setDetailWb(null); selectWorkboard(wb, projectId, navigate); };
  const handleEdit = (wb) => navigate(`/admin/workboards/${wb._id}/edit`);
  const handleCreate = () => navigate('/admin/workboards/new');
  const handleDelete = (wb) => {
    if (window.confirm(`"${wb.name}" 작업판을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) deleteMutation.mutate(wb._id);
  };
  const handleToggle = (wb) => {
    const action = wb.isActive ? '비활성화' : '활성화';
    if (window.confirm(`"${wb.name}" 작업판을 ${action}하시겠습니까?`)) toggleMutation.mutate({ id: wb._id, isActive: wb.isActive });
  };
  const handleDuplicate = (wb) => {
    const name = prompt('복제할 작업판의 이름을 입력하세요:', `${wb.name} (복제)`);
    if (name) duplicateMutation.mutate({ id: wb._id, name });
  };
  const handleExport = async (wb) => {
    try {
      const res = await workboardAPI.export(wb._id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${wb.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_backup.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('작업판을 내보냈습니다.');
    } catch (e) { console.error('Export error:', e); }
  };

  return (
    <Box>
      {/* 헤더 — admin 일 때만 관리 버튼 노출 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap', mb: 4 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h1">{admin ? '작업판 관리' : '작업판'}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ textWrap: 'pretty', mt: 0.5 }}>
            {admin
              ? '작업판 정의 · 출력 형식 · 접근 권한 · 서버 매핑을 관리합니다.'
              : '한 번의 호출로 실행하는 단위. 파이프라인의 단계로도 사용됩니다.'}
          </Typography>
          {projectContext && (
            <Chip label={`프로젝트: ${projectContext.name}`} color="primary" variant="outlined" size="small" sx={{ mt: 1 }} />
          )}
        </Box>
        {admin && (
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Button variant="outlined" startIcon={<FileUpload />} onClick={() => setImportOpen(true)}>가져오기</Button>
            <Button variant="contained" startIcon={<Add />} onClick={handleCreate}>새 작업판</Button>
          </Box>
        )}
      </Box>

      {/* 상태 필터 — admin 전용 축 */}
      {admin && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 3, overflowX: 'auto', pb: 0.5 }}>
          {[
            { k: 'all', l: '전체', c: statusCounts.all },
            { k: 'active', l: '게시됨', c: statusCounts.active },
            { k: 'inactive', l: '보관', c: statusCounts.inactive },
          ].map((s) => (
            <Button
              key={s.k}
              onClick={() => setStatus(s.k)}
              variant={status === s.k ? 'contained' : 'outlined'}
              color={status === s.k ? 'primary' : 'inherit'}
              sx={{ flex: '0 0 auto', color: status === s.k ? undefined : 'text.secondary' }}
            >
              {s.l}<Box component="span" sx={{ ml: 0.75, fontFamily: MONO, fontSize: 11, opacity: 0.8 }}>{s.c}</Box>
            </Button>
          ))}
        </Stack>
      )}

      {/* 공유 2축 필터 */}
      <WorkboardFilters
        q={q} setQ={setQ}
        outSel={outSel} toggleOut={toggleOut}
        svcSel={svcSel} toggleSvc={toggleSvc}
        counts={counts} total={baseList.length} shown={filtered.length}
        onClear={clear}
      />

      {/* 공유 카드 그리드 */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
          <Inventory2 sx={{ fontSize: 32, color: 'text.disabled', mb: 1.5 }} />
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>조건에 맞는 작업판이 없습니다</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: admin ? 2 : 0 }}>
            {workboards.length === 0
              ? (admin ? '새 작업판을 만들어 보세요.' : '사용 가능한 작업판이 없습니다.')
              : '필터를 줄이거나 초기화해 보세요.'}
          </Typography>
          {admin && <Button variant="contained" size="small" startIcon={<Add />} onClick={handleCreate}>새 작업판</Button>}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fill, minmax(300px, 1fr))' }, gap: 3 }}>
          {filtered.map((wb) => (
            <WorkboardCard
              key={wb._id}
              wb={wb}
              admin={admin}
              onClick={admin ? undefined : () => handleSelect(wb)}
              onInfo={admin ? undefined : (w) => setDetailWb(w)}
              onEdit={admin ? handleEdit : undefined}
              onMenu={admin ? (e, w) => { setMenuAnchor(e.currentTarget); setMenuWb(w); } : undefined}
              groupNames={admin ? (wb.allowedGroupIds || []).map((g) => (typeof g === 'object' ? g.name : null)).filter(Boolean) : undefined}
            />
          ))}
        </Box>
      )}

      {/* 사용자 상세 다이얼로그 */}
      {!admin && (
        <WorkboardDetailDialog workboard={detailWb} open={!!detailWb} onClose={() => setDetailWb(null)} onSelect={handleSelect} />
      )}

      {/* 관리자 메뉴 + 가져오기 */}
      {admin && (
        <>
          <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
            <MenuItem onClick={() => { handleEdit(menuWb); setMenuAnchor(null); }}><Edit sx={{ mr: 1 }} fontSize="small" />편집</MenuItem>
            <MenuItem onClick={() => { handleDuplicate(menuWb); setMenuAnchor(null); }}><ContentCopy sx={{ mr: 1 }} fontSize="small" />복제</MenuItem>
            <MenuItem onClick={() => { handleExport(menuWb); setMenuAnchor(null); }}><FileDownload sx={{ mr: 1 }} fontSize="small" />내보내기</MenuItem>
            <MenuItem onClick={() => { handleToggle(menuWb); setMenuAnchor(null); }} sx={{ color: menuWb?.isActive ? 'warning.main' : 'success.main' }}>
              {menuWb?.isActive ? <><ToggleOff sx={{ mr: 1 }} fontSize="small" />비활성화</> : <><ToggleOn sx={{ mr: 1 }} fontSize="small" />활성화</>}
            </MenuItem>
            <MenuItem onClick={() => { handleDelete(menuWb); setMenuAnchor(null); }} sx={{ color: 'error.main' }}><Delete sx={{ mr: 1 }} fontSize="small" />삭제</MenuItem>
          </Menu>
          <WorkboardImportDialog open={importOpen} onClose={() => setImportOpen(false)} onSuccess={invalidate} />
        </>
      )}
    </Box>
  );
}

export default WorkboardCatalogPage;
