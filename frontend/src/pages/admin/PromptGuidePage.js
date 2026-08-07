import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Stack,
  Paper,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MenuBook as GuideIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { promptGuideAPI } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import ToneChip from '../../components/common/ToneChip';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { MONO } from '../../theme';
import { relativeTime } from '../../utils/relativeTime';
import { formatGuideSize } from '../../utils/guideSize';

// 프롬프트 가이드 관리 (#766).
// 가이드는 소유자가 없는 전역 문서 — 작업판에 연결하면 그 작업판을 볼 수 있는 모든
// 사용자에게 동일하게 적용된다. 사용자 소유 문서(세계관 등)와 성격이 다르다.

function GuideFormDialog({ open, onClose, guideId, onSave, saving }) {
  const [form, setForm] = useState({ title: '', description: '', content: '', targetModel: '', sourceUrl: '', sourceRef: '' });

  // 본문은 목록 응답에 없다 (41K 자 회피) — 편집 시에만 단건 조회로 가져온다.
  const { data, isLoading } = useQuery({
    queryKey: ['promptGuide', guideId],
    queryFn: () => promptGuideAPI.getById(guideId),
    enabled: open && !!guideId,
  });

  React.useEffect(() => {
    if (!open) return;
    if (!guideId) {
      setForm({ title: '', description: '', content: '', targetModel: '', sourceUrl: '', sourceRef: '' });
      return;
    }
    const g = data?.data?.data?.guide;
    if (g) {
      setForm({
        title: g.title || '',
        description: g.description || '',
        content: g.content || '',
        targetModel: g.targetModel || '',
        sourceUrl: g.source?.url || '',
        sourceRef: g.source?.ref || '',
      });
    }
  }, [open, guideId, data]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.title.trim()) return toast.error('제목은 필수입니다.');
    if (!form.content.trim()) return toast.error('본문은 필수입니다.');
    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      content: form.content,
      targetModel: form.targetModel.trim(),
      source: { url: form.sourceUrl.trim(), ref: form.sourceRef.trim() },
    });
  };

  const len = form.content.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{guideId ? '가이드 편집' : '새 가이드'}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="제목" value={form.title} onChange={set('title')} fullWidth size="small" autoFocus />
            <TextField
              label="대상 모델" value={form.targetModel} onChange={set('targetModel')}
              fullWidth size="small" placeholder="예: MiniMax H3"
              helperText="목록에서 구분하기 위한 표시용입니다."
            />
            <TextField label="설명" value={form.description} onChange={set('description')} fullWidth size="small" multiline rows={2} />
            <Divider />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">본문</Typography>
                <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary' }}>
                  {formatGuideSize(len)}
                </Typography>
              </Stack>
              <TextField
                value={form.content} onChange={set('content')} fullWidth multiline rows={14}
                placeholder="가이드 전문을 붙여넣으세요."
                InputProps={{ sx: { fontFamily: MONO, fontSize: 12.5 } }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                연결된 작업판의 프롬프트 생성 요청마다 시스템 프롬프트로 실립니다. 길이가 곧 비용입니다.
              </Typography>
            </Box>
            <Divider />
            <Typography variant="caption" color="text.secondary">
              출처 — 외부 문서에서 가져온 가이드라면 갱신 판단 근거로 남겨두세요.
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField label="출처 URL" value={form.sourceUrl} onChange={set('sourceUrl')} fullWidth size="small" />
              <TextField label="버전 / commit" value={form.sourceRef} onChange={set('sourceRef')} size="small" sx={{ width: 200 }} placeholder="8d8824e" />
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || isLoading}>저장</Button>
      </DialogActions>
    </Dialog>
  );
}

function PromptGuidePage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['promptGuides', 'all'],
    queryFn: () => promptGuideAPI.getAll(true),
  });
  const guides = data?.data?.data?.guides || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['promptGuides'] });
    queryClient.invalidateQueries({ queryKey: ['promptGuide'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload) => promptGuideAPI.create(payload),
    onSuccess: () => { toast.success('가이드가 생성되었습니다.'); invalidate(); setFormOpen(false); },
    onError: (err) => toast.error(err.response?.data?.message || '가이드 생성 실패'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: payload }) => promptGuideAPI.update(id, payload),
    onSuccess: () => { toast.success('가이드가 수정되었습니다.'); invalidate(); setFormOpen(false); setEditingId(null); },
    onError: (err) => toast.error(err.response?.data?.message || '가이드 수정 실패'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => promptGuideAPI.delete(id),
    onSuccess: () => { toast.success('가이드가 삭제되었습니다.'); invalidate(); },
    onError: (err) => {
      // 연결된 작업판이 있으면 백엔드가 차단한다 — 어느 작업판인지 보여줘야 조치할 수 있다.
      const linked = err.response?.data?.data?.linkedWorkboards;
      if (linked?.length) {
        toast.error(`${err.response.data.message}\n${linked.map((w) => `· ${w.name}`).join('\n')}`, { duration: 8000 });
      } else {
        toast.error(err.response?.data?.message || '가이드 삭제 실패');
      }
    },
  });

  const handleDelete = async (guide) => {
    if (await confirm({
      title: `"${guide.title}" 가이드를 삭제하시겠습니까?`,
      description: '연결된 작업판이 있으면 삭제되지 않습니다. 먼저 작업판에서 연결을 해제하세요.',
      danger: true, confirmLabel: '삭제',
    })) {
      deleteMutation.mutate(guide._id);
    }
  };

  const handleSave = (payload) => {
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  return (
    <Container maxWidth="lg" sx={{ mb: 8 }}>
      <PageHeader
        title="프롬프트 가이드"
        description="모델별 프롬프트 작성 가이드를 등록하고 작업판에 연결합니다. 연결된 작업판을 볼 수 있는 모든 사용자에게 동일하게 적용됩니다."
        actions={(
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingId(null); setFormOpen(true); }}>
            새 가이드
          </Button>
        )}
      />

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">가이드 목록을 불러오지 못했습니다.</Alert>}

      {!isLoading && !isError && guides.length === 0 && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <GuideIcon sx={{ fontSize: 40, color: 'text.tertiary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            등록된 가이드가 없습니다. "새 가이드" 로 추가하세요.
          </Typography>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {guides.map((g) => (
          <Paper key={g._id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2">{g.title}</Typography>
                  {g.targetModel && <ToneChip tone="info" label={g.targetModel} />}
                  {!g.isActive && <ToneChip tone="neutral" label="비활성" />}
                </Stack>
                {g.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{g.description}</Typography>
                )}
                <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary', display: 'block' }}>
                  {formatGuideSize(g.contentLength)} · {relativeTime(g.updatedAt)} 수정
                  {g.source?.ref ? ` · ${g.source.ref}` : ''}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="가이드 편집">
                  <IconButton aria-label="가이드 편집" onClick={() => { setEditingId(g._id); setFormOpen(true); }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="가이드 삭제">
                  <IconButton aria-label="가이드 삭제" onClick={() => handleDelete(g)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <GuideFormDialog
        open={formOpen}
        guideId={editingId}
        onClose={() => { setFormOpen(false); setEditingId(null); }}
        onSave={handleSave}
        saving={createMutation.isPending || updateMutation.isPending}
      />
    </Container>
  );
}

export default PromptGuidePage;
