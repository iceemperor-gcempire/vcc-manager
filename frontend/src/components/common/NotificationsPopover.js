import React, { useState, useMemo, useRef } from 'react';
import {
  IconButton,
  Popover,
  Box,
  Typography,
  Button,
  Chip,
  Badge,
  Divider,
} from '@mui/material';
import {
  NotificationsNone as BellIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  PlayArrow as RunningIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { alpha } from '@mui/material/styles';
import { MONO } from '../../theme';

// 휘발성 알림 popover (Phase 6).
// 영속 저장은 없음 — react-query 캐시에 있는 'pipelineRun' 데이터를 source 로 활용.
// PipelineRunner / PipelineHistoryPanel 이 백그라운드로 가져온 run 들 중 최근/활성 것을 보여줌.
// 향후 backend 의 글로벌 user activity feed 가 생기면 그쪽으로 source 전환.
export default function NotificationsPopover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  // 읽음 처리: run id 의 Set. 영속 없음 — 다이얼로그 새로고침 시 초기화.
  const [readIds, setReadIds] = useState(() => new Set());

  // react-query 캐시에서 모든 pipelineRun 단일 데이터를 긁어 옴.
  // (key 형식: ['pipelineRun', projectId, runId]) — list 키 (`pipelineRuns`) 는 배열 형태.
  const items = useMemo(() => {
    const cache = queryClient.getQueryCache();
    const collected = [];
    cache.getAll().forEach((q) => {
      const key = q.queryKey;
      if (!Array.isArray(key)) return;
      // ['pipelineRuns', projectId] — 리스트
      if (key[0] === 'pipelineRuns' && q.state.data) {
        const projectId = key[1];
        const runs = q.state.data?.data?.data?.runs || q.state.data?.data?.runs || [];
        runs.forEach((run) => collected.push({ projectId, run }));
      }
    });
    // run.updatedAt 또는 startedAt desc 정렬
    collected.sort((a, b) => {
      const ta = new Date(a.run.updatedAt || a.run.startedAt || 0).getTime();
      const tb = new Date(b.run.updatedAt || b.run.startedAt || 0).getTime();
      return tb - ta;
    });
    // 같은 run id 중복 제거
    const seen = new Set();
    return collected.filter(({ run }) => {
      if (seen.has(run._id)) return false;
      seen.add(run._id);
      return true;
    }).slice(0, 30);
  }, [queryClient, open]);

  const groups = useMemo(() => {
    const active = [];
    const earlier = [];
    items.forEach((it) => {
      const status = it.run.status;
      if (status === 'running' || status === 'pending') active.push(it);
      else earlier.push(it);
    });
    return { active, earlier };
  }, [items]);

  const unreadCount = items.filter(({ run }) => !readIds.has(run._id) && (run.status === 'running' || run.status === 'pending')).length;

  const handleClose = () => setOpen(false);
  const handleMarkAllRead = () => setReadIds(new Set(items.map((it) => it.run._id)));
  const handleClick = (it) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(it.run._id);
      return next;
    });
    navigate(`/projects/${it.projectId}`);
    handleClose();
  };

  return (
    <>
      <IconButton
        ref={anchorRef}
        color="inherit"
        onClick={() => setOpen(true)}
        title="알림"
      >
        <Badge color="error" variant="dot" invisible={unreadCount === 0}>
          <BellIcon />
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, width: 380, maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <BellIcon fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>알림</Typography>
          {unreadCount > 0 && <Chip label={`${unreadCount} new`} color="primary" />}
          <Box sx={{ flex: 1 }} />
          {items.length > 0 && (
            <Button onClick={handleMarkAllRead}>모두 읽음</Button>
          )}
        </Box>

        <Box sx={{ overflow: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
              <BellIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2">알림 없음</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                파이프라인 실행 중·완료 알림이 여기 표시됩니다.
              </Typography>
            </Box>
          ) : (
            <>
              {groups.active.length > 0 && (
                <NotifGroup label="진행 중 / 새 알림">
                  {groups.active.map((it) => (
                    <NotifRow
                      key={it.run._id}
                      run={it.run}
                      onClick={() => handleClick(it)}
                      unread={!readIds.has(it.run._id)}
                    />
                  ))}
                </NotifGroup>
              )}
              {groups.earlier.length > 0 && (
                <NotifGroup label="이전">
                  {groups.earlier.map((it) => (
                    <NotifRow
                      key={it.run._id}
                      run={it.run}
                      onClick={() => handleClick(it)}
                      unread={false}
                    />
                  ))}
                </NotifGroup>
              )}
            </>
          )}
        </Box>

        <Divider />
        <Box sx={{ px: 2, py: 1, textAlign: 'center', bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            파이프라인 실행 알림 · 영속 저장 안 됨
          </Typography>
        </Box>
      </Popover>
    </>
  );
}

function NotifGroup({ label, children }) {
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          px: 2,
          pt: 1.5,
          pb: 0.5,
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function NotifRow({ run, onClick, unread }) {
  const status = run.status;
  const tone = status === 'completed' ? 'success'
    : status === 'failed' ? 'error'
    : status === 'running' || status === 'pending' ? 'info'
    : 'default';
  const Icon = status === 'completed' ? CheckIcon
    : status === 'failed' ? ErrorIcon
    : status === 'pending' ? PendingIcon
    : RunningIcon;
  const time = run.updatedAt || run.startedAt;
  const title = run.status === 'completed' ? '파이프라인 완료'
    : run.status === 'failed' ? '파이프라인 실패'
    : run.status === 'running' ? '파이프라인 실행 중'
    : '파이프라인 대기';

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        px: 2,
        py: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        bgcolor: unread ? (t) => alpha(t.palette.primary.main, 0.04) : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          bgcolor: (t) => tone === 'default'
            ? alpha(t.palette.grey[500], 0.12)
            : alpha(t.palette[tone].main, 0.12),
          color: tone === 'default' ? 'grey.700' : `${tone}.main`,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, textWrap: 'pretty' }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.secondary', flexShrink: 0 }}>
            {formatRelative(time)}
          </Typography>
        </Box>
        {run.steps && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {run.steps.filter((s) => s.status === 'completed').length} / {run.steps.length} 단계
          </Typography>
        )}
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.75, color: 'primary.main', fontSize: 11, fontWeight: 500 }}>
          상세 보기 <OpenInNewIcon sx={{ fontSize: 12 }} />
        </Box>
      </Box>
    </Box>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}
