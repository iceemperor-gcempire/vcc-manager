import React, { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Stack,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  TextField,
  Switch,
  FormControlLabel,
  Autocomplete,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowUpward,
  ArrowDownward,
  FormatListNumbered as SequenceIcon,
  Description as DocIcon,
  Search as SearchIcon,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sequenceAPI, sequenceDocAPI, workboardAPI, groupAPI } from '../../services/api';
import PageHeader from '../../components/common/PageHeader';
import ToneChip from '../../components/common/ToneChip';
import { useConfirm } from '../../components/common/ConfirmDialog';
import { StepInputsForm } from '../../components/common/PipelinePanel';
import { MONO } from '../../theme';
import { relativeTime } from '../../utils/relativeTime';
import { formatGuideSize } from '../../utils/guideSize';
import {
  buildSequencePayload, toEditorState, newEditorStep, moveItem, stepGroupGaps,
} from '../../utils/sequenceRuns';

// 작업 절차 관리 (#952, Epic #951).
// 작업 절차는 소유자가 없는 운영자 자산이다 — 접근은 그룹, 실행은 참조라 고치면 다음 실행부터
// 모든 사용자에게 반영된다. 단계 작업판 접근은 작업 절차와 따로 판정되므로(#802), 작업 절차를 연
// 그룹에 작업판이 열려 있지 않으면 그 그룹 사용자는 실행이 막힌다 — 목록과 편집기에서 미리 보여준다.

const OUTPUT_LABEL = { text: '텍스트', image: '이미지', video: '영상', audio: '오디오' };

function groupLabel(groups, id) {
  const g = groups.find((x) => x._id === id);
  return g ? `${g.name}${g.isDefault ? ' (기본)' : ''}` : `삭제된 그룹 (${String(id).slice(-6)})`;
}

function showWarnings(res) {
  const warnings = res?.data?.data?.warnings || [];
  if (warnings.length > 0) toast(warnings.join('\n'), { icon: '⚠️', duration: 8000 });
}

// ── 작업 절차 목록 ────────────────────────────────────────────────

function coverageText(c) {
  const where = `${c.stepIndex + 1}단계${c.workboardName ? ` ${c.workboardName}` : ''}`;
  if (c.missing) return `${where}: 작업판이 삭제됨`;
  const parts = [];
  if (c.inactive) parts.push('작업판이 비활성');
  if (c.missingGroups?.length) {
    parts.push(`${c.missingGroups.map((g) => g.name || '삭제된 그룹').join(', ')} 그룹에 작업판이 열려 있지 않음`);
  }
  return `${where}: ${parts.join(' · ')}`;
}

function SequenceRow({ sequence, onEdit, onDelete }) {
  const groups = (sequence.allowedGroupIds || []).filter((g) => g && typeof g === 'object');
  const steps = sequence.steps || [];
  const path = steps.map((s) => s.workboard?.name || '(삭제된 작업판)').join(' → ') || '단계 없음';
  const coverage = sequence.coverage || [];
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
            <Typography variant="subtitle2">{sequence.name}</Typography>
            <ToneChip tone="neutral" label={`${steps.length}단계`} />
            {!sequence.isActive && <ToneChip tone="neutral" label="비활성" />}
            {groups.length === 0
              ? <ToneChip tone="warning" label="admin 전용" />
              : groups.map((g) => <ToneChip key={g._id} tone="accent" label={g.name} />)}
          </Stack>
          {sequence.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{sequence.description}</Typography>
          )}
          <Typography variant="caption" noWrap title={path} sx={{ fontFamily: MONO, color: 'text.tertiary', display: 'block' }}>
            {path} · {relativeTime(sequence.updatedAt)} 수정
          </Typography>
          {coverage.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {coverage.map((c) => <Box key={c.stepIndex}>{coverageText(c)}</Box>)}
            </Alert>
          )}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="편집">
            <IconButton aria-label="작업 절차 편집" onClick={onEdit}><EditIcon /></IconButton>
          </Tooltip>
          <Tooltip title="삭제">
            <IconButton aria-label="작업 절차 삭제" onClick={onDelete}><DeleteIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

function SequenceList({ onCreate, onEdit }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sequences', 'manage'],
    queryFn: () => sequenceAPI.list({ view: 'manage' }),
  });
  const sequences = data?.data?.data?.sequences || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => sequenceAPI.delete(id),
    onSuccess: () => {
      toast.success('작업 절차가 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'),
  });

  const handleDelete = async (sequence) => {
    if (await confirm({
      title: `"${sequence.name}" 작업 절차를 삭제하시겠습니까?`,
      description: '사용자의 실행 기록은 남습니다. 잠시 막아두려면 삭제 대신 편집에서 비활성으로 바꾸세요.',
      danger: true,
      confirmLabel: '삭제',
    })) {
      deleteMutation.mutate(sequence._id);
    }
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (isError) return <Alert severity="error">작업 절차 목록을 불러오지 못했습니다.</Alert>;
  if (sequences.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
        <SequenceIcon sx={{ fontSize: 40, color: 'text.tertiary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          등록된 작업 절차가 없습니다.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>새 작업 절차</Button>
      </Paper>
    );
  }
  return (
    <Stack spacing={1.5}>
      {sequences.map((s) => (
        <SequenceRow key={s._id} sequence={s} onEdit={() => onEdit(s._id)} onDelete={() => handleDelete(s)} />
      ))}
    </Stack>
  );
}

// ── 편집기 ────────────────────────────────────────────────────────

function WorkboardPickerDialog({ open, onClose, onPick }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), 250);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching } = useQuery({
    queryKey: ['sequenceWorkboardPicker', search],
    queryFn: () => workboardAPI.getAll({ search: search || undefined, limit: 50, includeInactive: 'true', includeAll: 'true' }),
    enabled: open,
    staleTime: 30_000,
  });
  const workboards = data?.data?.workboards || data?.data?.data?.workboards || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>단계 추가 — 작업판 선택</DialogTitle>
      <DialogContent dividers>
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder="작업판 이름으로 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: isFetching ? <CircularProgress size={16} /> : null,
          }}
        />
        {workboards.length === 0 && !isFetching ? (
          <Alert severity="info">찾는 작업판이 없습니다.</Alert>
        ) : (
          <Stack spacing={1}>
            {workboards.map((wb) => (
              <Box
                key={wb._id}
                onClick={() => onPick(wb)}
                sx={{
                  p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }} noWrap>{wb.name}</Typography>
                  {wb.outputFormat && <ToneChip tone="info" label={OUTPUT_LABEL[wb.outputFormat] || wb.outputFormat} />}
                  {wb.isActive === false && <ToneChip tone="warning" label="비활성" />}
                </Stack>
                {wb.serverId?.name && (
                  <Typography variant="caption" color="text.secondary">{wb.serverId.name}</Typography>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

function SequenceStepCard({ step, index, total, docs, groups, allowedGroupIds, onChange, onMove, onRemove }) {
  const [inputsOpen, setInputsOpen] = useState(false);
  const listed = step.workboard;
  // 목록·검색 응답에는 입력 필드 정의가 빠져 있을 수 있다 — 사전 입력을 열 때만 전체를 가져온다
  const needsFull = inputsOpen && listed?._id && !Array.isArray(listed.additionalInputFields);
  const { data: fullData } = useQuery({
    queryKey: ['sequenceStepWorkboard', listed?._id],
    queryFn: () => workboardAPI.getById(listed._id),
    enabled: !!needsFull,
    staleTime: 60_000,
  });
  const workboard = needsFull ? (fullData?.data?.workboard || null) : listed;
  const isText = listed?.outputFormat === 'text';
  const presetCount = Object.values(step.inputs || {}).filter((v) => v !== '' && v != null).length;
  const gaps = stepGroupGaps(listed, allowedGroupIds);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText',
            display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, fontFamily: MONO, flexShrink: 0,
          }}
        >
          {index + 1}
        </Box>
        <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {listed?.name || '(삭제된 작업판)'}
        </Typography>
        {listed?.outputFormat && <ToneChip tone="info" label={OUTPUT_LABEL[listed.outputFormat] || listed.outputFormat} />}
        {listed?.isActive === false && <ToneChip tone="warning" label="비활성" />}
        <IconButton aria-label="위로 이동" onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowUpward fontSize="small" />
        </IconButton>
        <IconButton aria-label="아래로 이동" onClick={() => onMove(1)} disabled={index === total - 1}>
          <ArrowDownward fontSize="small" />
        </IconButton>
        <IconButton aria-label="단계 삭제" color="error" onClick={onRemove}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack spacing={1.5} sx={{ px: 2, py: 1.5 }}>
        {gaps.length > 0 && (
          <Alert severity="warning">
            {gaps.map((id) => groupLabel(groups, id)).join(', ')} 그룹에는 이 작업판이 열려 있지 않아 실행이 막힙니다.
          </Alert>
        )}
        {index > 0 && (
          <FormControlLabel
            control={<Switch size="small" checked={step.autoInject !== false} onChange={(e) => onChange({ autoInject: e.target.checked })} />}
            label={<Typography variant="body2">앞 단계 결과를 이 단계 입력으로 넘기기</Typography>}
          />
        )}
        <TextField
          size="small"
          fullWidth
          multiline
          maxRows={3}
          placeholder="사용자에게 보일 단계 설명 (선택)"
          value={step.note || ''}
          onChange={(e) => onChange({ note: e.target.value })}
          inputProps={{ maxLength: 500 }}
        />
        {isText && (
          <>
            <Autocomplete
              multiple
              size="small"
              options={docs.map((d) => d._id)}
              value={step.contextDocIds || []}
              onChange={(_, value) => onChange({ contextDocIds: value })}
              getOptionLabel={(id) => docs.find((d) => d._id === id)?.title || '(삭제된 문서)'}
              renderInput={(params) => (
                <TextField {...params} label="컨텍스트 문서" placeholder={docs.length ? '문서 선택' : '문서 탭에서 먼저 추가하세요'} />
              )}
            />
            <TextField
              select
              size="small"
              label="시스템 프롬프트 문서"
              value={step.systemPromptDocId || ''}
              onChange={(e) => onChange({ systemPromptDocId: e.target.value || null })}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText="고르면 작업판의 시스템 프롬프트 대신 쓰입니다"
            >
              <option value="">— 작업판 시스템 프롬프트 사용 —</option>
              {docs.map((d) => <option key={d._id} value={d._id}>{d.title}</option>)}
            </TextField>
          </>
        )}
        <Box>
          <Button size="small" onClick={() => setInputsOpen((v) => !v)} endIcon={inputsOpen ? <ExpandLess /> : <ExpandMore />}>
            사전 입력{presetCount > 0 ? ` (${presetCount})` : ''}
          </Button>
          {inputsOpen && (
            <Box sx={{ mt: 1.5 }}>
              {workboard ? (
                <StepInputsForm workboard={workboard} values={step.inputs || {}} onChange={(inputs) => onChange({ inputs })} />
              ) : (
                <CircularProgress size={20} />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {index === 0
                  ? '첫 단계의 프롬프트는 실행할 때 사용자가 입력한 값으로 바뀝니다.'
                  : '앞 단계 결과 넘기기가 켜져 있으면 프롬프트·이미지 입력은 실행 때 앞 단계 결과로 바뀝니다.'}
                {' '}이미지 같은 파일 입력은 저장되지 않습니다.
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function SequenceEditor({ sequenceId, onClose }) {
  const isNew = !sequenceId;
  const queryClient = useQueryClient();
  const { data: detailData, isLoading, isError } = useQuery({
    queryKey: ['sequence', 'manage', sequenceId],
    queryFn: () => sequenceAPI.get(sequenceId, { view: 'manage' }),
    enabled: !isNew,
  });
  const { data: groupsData } = useQuery({ queryKey: ['groups'], queryFn: () => groupAPI.getAll() });
  const { data: docsData } = useQuery({ queryKey: ['sequenceDocs'], queryFn: () => sequenceDocAPI.list() });
  const groups = groupsData?.data?.data?.groups || [];
  const docs = docsData?.data?.data?.docs || [];

  const [form, setForm] = useState(() => toEditorState(null));
  const [loadedId, setLoadedId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const loaded = detailData?.data?.data?.sequence;
  // 한 번만 채운다 — 창 포커스 재조회가 편집 중인 값을 덮지 않게
  useEffect(() => {
    if (loaded && loadedId !== loaded._id) {
      setForm(toEditorState(loaded));
      setLoadedId(loaded._id);
    }
  }, [loaded, loadedId]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const updateStep = (idx, patch) => setForm((f) => ({ ...f, steps: f.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));

  const saveMutation = useMutation({
    mutationFn: (payload) => (isNew ? sequenceAPI.create(payload) : sequenceAPI.update(sequenceId, payload)),
    onSuccess: (res) => {
      toast.success('저장되었습니다.');
      showWarnings(res);
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      queryClient.invalidateQueries({ queryKey: ['sequence'] });
      queryClient.invalidateQueries({ queryKey: ['sequenceDocs'] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || '저장 실패'),
  });

  const handleSave = () => {
    if (!form.name.trim()) return toast.error('이름을 입력해 주세요.');
    if (form.steps.length === 0) return toast.error('단계를 하나 이상 추가해 주세요.');
    return saveMutation.mutate(buildSequencePayload(form));
  };

  if (!isNew && isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!isNew && isError) {
    return (
      <Alert severity="error" action={<Button onClick={onClose}>목록으로</Button>}>
        작업 절차를 불러오지 못했습니다.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
            {isNew ? '새 작업 절차' : '작업 절차 편집'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            작업판을 위에서 아래로 실행합니다. 앞 단계 결과는 다음 단계의 프롬프트·이미지 입력으로 넘어갑니다.
            저장하면 다음 실행부터 모든 사용자에게 반영됩니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button onClick={onClose}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending}>저장</Button>
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 300px' }, gap: 3, alignItems: 'start' }}>
        <Stack spacing={2}>
          <TextField label="이름" value={form.name} onChange={(e) => set('name', e.target.value)} inputProps={{ maxLength: 100 }} fullWidth />
          <TextField
            label="설명 (선택)"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            inputProps={{ maxLength: 2000 }}
            multiline
            minRows={2}
            fullWidth
          />
          <Box sx={{ display: 'flex', alignItems: 'center', pt: 1 }}>
            <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>단계 ({form.steps.length})</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setPickerOpen(true)}>단계 추가</Button>
          </Box>
          {form.steps.length === 0 ? (
            <Alert severity="info">"단계 추가" 로 실행할 작업판을 순서대로 넣으세요.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {form.steps.map((step, idx) => (
                <SequenceStepCard
                  key={step.clientKey}
                  step={step}
                  index={idx}
                  total={form.steps.length}
                  docs={docs}
                  groups={groups}
                  allowedGroupIds={form.allowedGroupIds}
                  onChange={(patch) => updateStep(idx, patch)}
                  onMove={(delta) => setForm((f) => ({ ...f, steps: moveItem(f.steps, idx, idx + delta) }))}
                  onRemove={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }))}
                />
              ))}
            </Stack>
          )}
        </Stack>

        <Paper variant="outlined" sx={{ p: 2.5, position: { md: 'sticky' }, top: { md: 12 } }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>상태</Typography>
          <FormControlLabel
            control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />}
            label={form.isActive ? '활성' : '비활성 — 사용자에게 보이지 않음'}
          />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>접근 그룹</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            비워두면 admin 만 볼 수 있습니다. 단계 작업판의 접근은 작업판마다 따로 판정됩니다.
          </Typography>
          <Autocomplete
            multiple
            size="small"
            options={groups.map((g) => g._id)}
            value={form.allowedGroupIds}
            onChange={(_, value) => set('allowedGroupIds', value)}
            getOptionLabel={(id) => groupLabel(groups, id)}
            renderInput={(params) => (
              <TextField {...params} placeholder={groups.length === 0 ? '그룹 없음 — 그룹 관리에서 먼저 생성' : '그룹 선택'} />
            )}
          />
        </Paper>
      </Box>

      <WorkboardPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(wb) => {
          setForm((f) => ({ ...f, steps: [...f.steps, newEditorStep(wb)] }));
          setPickerOpen(false);
        }}
      />
    </Box>
  );
}

// ── 문서 ──────────────────────────────────────────────────────────

function DocFormDialog({ open, docId, onClose, onSave, saving }) {
  const [form, setForm] = useState({ title: '', description: '', content: '' });
  const { data, isLoading } = useQuery({
    queryKey: ['sequenceDoc', docId],
    queryFn: () => sequenceDocAPI.get(docId),
    enabled: open && !!docId,
  });

  useEffect(() => {
    if (!open) return;
    if (!docId) {
      setForm({ title: '', description: '', content: '' });
      return;
    }
    const doc = data?.data?.data?.doc;
    if (doc) setForm({ title: doc.title || '', description: doc.description || '', content: doc.content || '' });
  }, [open, docId, data]);

  const usedBy = data?.data?.data?.doc?.usedBy || [];
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = () => {
    if (!form.title.trim()) return toast.error('제목은 필수입니다.');
    if (!form.content.trim()) return toast.error('본문은 필수입니다.');
    return onSave({ title: form.title.trim(), description: form.description.trim(), content: form.content });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{docId ? '문서 편집' : '새 문서'}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {usedBy.length > 0 && (
              <Alert severity="info">
                작업 절차 {usedBy.length}개가 이 문서를 씁니다 — {usedBy.map((s) => s.name).join(', ')}. 저장하면 다음 실행부터 모두 반영됩니다.
              </Alert>
            )}
            <TextField label="제목" value={form.title} onChange={set('title')} fullWidth size="small" autoFocus />
            <TextField label="설명" value={form.description} onChange={set('description')} fullWidth size="small" multiline rows={2} />
            <Divider />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">본문</Typography>
                <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary' }}>
                  {formatGuideSize(form.content.length)}
                </Typography>
              </Stack>
              <TextField
                value={form.content}
                onChange={set('content')}
                fullWidth
                multiline
                rows={14}
                placeholder="LLM 단계에 넣을 배경 설명이나 작업 지침"
                InputProps={{ sx: { fontFamily: MONO, fontSize: 12.5 } }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                실행자에게는 본문이 보이지 않고 LLM 요청에만 실립니다. 길이가 곧 비용입니다.
              </Typography>
            </Box>
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

function SequenceDocSection() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const { data, isLoading, isError } = useQuery({ queryKey: ['sequenceDocs'], queryFn: () => sequenceDocAPI.list() });
  const docs = data?.data?.data?.docs || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sequenceDocs'] });
    queryClient.invalidateQueries({ queryKey: ['sequenceDoc'] });
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const saveMutation = useMutation({
    mutationFn: (payload) => (editingId ? sequenceDocAPI.update(editingId, payload) : sequenceDocAPI.create(payload)),
    onSuccess: () => { toast.success('저장되었습니다.'); invalidate(); closeForm(); },
    onError: (err) => toast.error(err.response?.data?.message || '저장 실패'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => sequenceDocAPI.delete(id),
    onSuccess: () => { toast.success('문서가 삭제되었습니다.'); invalidate(); },
    onError: (err) => {
      // 쓰는 작업 절차가 있으면 막힌다 — 어디서 쓰는지 보여줘야 조치할 수 있다
      const linked = err.response?.data?.data?.linkedSequences;
      if (linked?.length) {
        toast.error(`${err.response.data.message}\n${linked.map((s) => `· ${s.name}`).join('\n')}`, { duration: 8000 });
      } else {
        toast.error(err.response?.data?.message || '삭제 실패');
      }
    },
  });

  const handleDelete = async (doc) => {
    if (await confirm({
      title: `"${doc.title}" 문서를 삭제하시겠습니까?`,
      description: '작업 절차가 쓰고 있으면 삭제되지 않습니다. 먼저 단계에서 빼세요.',
      danger: true,
      confirmLabel: '삭제',
    })) {
      deleteMutation.mutate(doc._id);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 240 }}>
          작업 절차의 LLM 단계에 넣는 문서입니다. 특정 사용자 소유가 아니라서, 고치면 이 문서를 쓰는 모든 작업 절차에 반영됩니다.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditingId(null); setFormOpen(true); }}>
          새 문서
        </Button>
      </Box>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">문서 목록을 불러오지 못했습니다.</Alert>}
      {!isLoading && !isError && docs.length === 0 && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
          <DocIcon sx={{ fontSize: 40, color: 'text.tertiary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">등록된 문서가 없습니다.</Typography>
        </Paper>
      )}

      <Stack spacing={1.5}>
        {docs.map((doc) => (
          <Paper key={doc._id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="flex-start" spacing={2}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
                  <Typography variant="subtitle2">{doc.title}</Typography>
                  {doc.usedBy.length > 0
                    ? <ToneChip tone="accent" label={`작업 절차 ${doc.usedBy.length}개에서 사용`} />
                    : <ToneChip tone="neutral" label="사용처 없음" />}
                </Stack>
                {doc.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{doc.description}</Typography>
                )}
                <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary', display: 'block' }}>
                  {formatGuideSize(doc.contentLength)} · {relativeTime(doc.updatedAt)} 수정
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="문서 편집">
                  <IconButton aria-label="문서 편집" onClick={() => { setEditingId(doc._id); setFormOpen(true); }}>
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="문서 삭제">
                  <IconButton aria-label="문서 삭제" onClick={() => handleDelete(doc)}>
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <DocFormDialog
        open={formOpen}
        docId={editingId}
        onClose={closeForm}
        onSave={(payload) => saveMutation.mutate(payload)}
        saving={saveMutation.isPending}
      />
    </Box>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────

function SequenceManagementPage() {
  const [tab, setTab] = useState('sequences');
  const [editing, setEditing] = useState(null); // null = 목록, 'new' = 생성, id = 편집

  if (editing) {
    return (
      <Container maxWidth="lg" sx={{ mb: 8 }}>
        <SequenceEditor sequenceId={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mb: 8 }}>
      <PageHeader
        title="작업 절차 관리"
        description="작업판을 정해진 순서로 묶어 그룹에 제공합니다. 고친 내용은 다음 실행부터 모든 사용자에게 반영됩니다."
        actions={tab === 'sequences' ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>새 작업 절차</Button>
        ) : null}
      />
      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 3 }}>
        <Tab value="sequences" label="작업 절차" />
        <Tab value="docs" label="문서" />
      </Tabs>
      {tab === 'sequences'
        ? <SequenceList onCreate={() => setEditing('new')} onEdit={(id) => setEditing(id)} />
        : <SequenceDocSection />}
    </Container>
  );
}

export default SequenceManagementPage;
