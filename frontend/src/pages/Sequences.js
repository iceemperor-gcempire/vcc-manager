import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
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
  Alert,
  CircularProgress,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Stop as StopIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  FormatListNumbered as SequenceIcon,
  Refresh as RefreshIcon,
  SwapHoriz as SwapHorizIcon,
  Chat as ChatIcon,
  Replay as ReplayIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { sequenceAPI, sequenceRunAPI, projectAPI } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import ToneChip from '../components/common/ToneChip';
import { useConfirm } from '../components/common/ConfirmDialog';
import WorkboardSelectDialog from '../components/common/WorkboardSelectDialog';
import { StepImageThumbnails } from '../components/common/PipelinePanel';
import { FieldBody } from '../components/common/CustomFieldControl';
import { CustomImageField, CustomVideoField, CustomAudioField } from './ImageGeneration';
import { useContinueJob } from '../hooks/useContinueJob';
import { MONO } from '../theme';
import { relativeTime } from '../utils/relativeTime';
import {
  runStatusMeta, runProgress, retryStartIndex, isRunInProgress, blockedSummary,
  initialRunValues, applyRunPrefill, missingRequiredInputs, buildRunInputs, describeRunInput,
} from '../utils/sequenceRuns';

// 작업 절차 (#952) — 운영자가 정해 둔 순서대로 작업판을 이어서 실행한다.
// 실행 기록과 결과물은 실행자 개인 자산이다. 단계 결과는 일반 작업 히스토리에 뜨지 않으므로
// (같은 결과가 두 곳에 뜨지 않도록) 여기 실행 기록에서 보고, 계속하기·대화 이어가기도 여기서 한다.
// 실행 화면은 서버가 계산한 단계별 노출 입력만 그린다 — 입력 필드는 작업판 실행 화면과 같은 컴포넌트 (#953).

const DELETE_CONFIRM = {
  title: '이 실행 기록을 삭제하시겠습니까?',
  description: '단계 작업 기록도 함께 지워집니다. 만든 이미지·영상은 내 콘텐츠에 남지만, 텍스트 단계의 결과는 이 기록과 함께 사라집니다.',
  danger: true,
  confirmLabel: '삭제',
};

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

function formatDuration(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem === 0 ? `${min}분` : `${min}분 ${rem}초`;
}

function useDeleteRun(onDeleted) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId) => sequenceRunAPI.delete(runId),
    onSuccess: () => {
      toast.success('실행 기록을 삭제했습니다.');
      queryClient.invalidateQueries({ queryKey: ['sequenceRuns'] });
      if (onDeleted) onDeleted();
    },
    onError: (err) => toast.error(err.response?.data?.message || '삭제하지 못했습니다'),
  });
}

function StepNumber({ index, tone = 'primary.main' }) {
  return (
    <Box
      sx={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0, bgcolor: tone, color: 'primary.contrastText',
        display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: MONO,
      }}
    >
      {index + 1}
    </Box>
  );
}

// ── 목록 ──────────────────────────────────────────────────────────

function StepPath({ steps }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', rowGap: 1 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s._id || i}>
          <Box
            title={s.note || undefined}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.75, minWidth: 0,
              border: 1, borderColor: s.blocked ? 'warning.main' : 'divider', borderRadius: 1.5, bgcolor: 'action.hover',
            }}
          >
            <StepNumber index={i} tone={s.blocked ? 'warning.main' : 'primary.main'} />
            <Typography variant="caption" noWrap sx={{ fontWeight: 600 }}>
              {s.workboard?.name || '(삭제된 작업판)'}
            </Typography>
          </Box>
          {i < steps.length - 1 && <ArrowForwardIcon fontSize="small" sx={{ color: 'text.tertiary' }} />}
        </React.Fragment>
      ))}
    </Box>
  );
}

function SequenceCard({ sequence, onRun }) {
  const steps = sequence.steps || [];
  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{sequence.name}</Typography>
        <ToneChip tone="neutral" label={`${steps.length}단계`} />
      </Stack>
      {sequence.description && (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{sequence.description}</Typography>
      )}
      <StepPath steps={steps} />
      {!sequence.runnable && (
        <Alert severity="warning">지금은 실행할 수 없습니다 — {blockedSummary(sequence)}</Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto' }}>
        <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onRun} disabled={!sequence.runnable}>
          실행
        </Button>
      </Box>
    </Paper>
  );
}

function SequenceCatalog({ onRun }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['sequences', 'user'], queryFn: () => sequenceAPI.list() });
  const sequences = data?.data?.data?.sequences || [];

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (isError) return <Alert severity="error">작업 절차를 불러오지 못했습니다.</Alert>;
  if (sequences.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
        <SequenceIcon sx={{ fontSize: 40, color: 'text.tertiary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          사용할 수 있는 작업 절차가 없습니다. 필요한 작업 절차가 있다면 운영자에게 요청하세요.
        </Typography>
      </Paper>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
      {sequences.map((s) => <SequenceCard key={s._id} sequence={s} onRun={() => onRun(s._id)} />)}
    </Box>
  );
}

// ── 실행 ──────────────────────────────────────────────────────────

function RunFieldInput({ field, workboard, value, onChange, showMissing }) {
  const missing = showMissing && field.required && isBlank(value);
  const wb = workboard || {};
  let control;
  if (field.type === 'image') {
    control = (
      <CustomImageField
        field={field}
        value={value || []}
        onChange={onChange}
        maxImages={field.maxItems || 1}
        isComfyUI={wb.serverType === 'ComfyUI'}
      />
    );
  } else if (field.type === 'video') {
    control = <CustomVideoField field={field} value={value || []} onChange={onChange} maxVideos={field.maxItems || 1} />;
  } else if (field.type === 'audio') {
    control = <CustomAudioField field={field} value={value || []} onChange={onChange} maxAudios={field.maxItems || 1} />;
  } else {
    return (
      <FieldBody
        field={field}
        value={value}
        onChange={onChange}
        error={missing ? { message: `${field.label}을(를) 입력해주세요` } : undefined}
        serverId={wb.serverId}
        workboardId={wb._id}
        allowedModelTypes={wb.allowedModelTypes}
      />
    );
  }
  return (
    <Box>
      {control}
      {missing && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {field.label}을(를) 첨부해주세요
        </Typography>
      )}
    </Box>
  );
}

function StepInputCard({ step, index, values, onChange, showMissing }) {
  const fields = step.fields || [];
  const exposed = fields.filter((f) => f.mode === 'exposed');
  const inherited = fields.filter((f) => f.mode === 'previous');
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <StepNumber index={index} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>{step.workboard?.name || '(삭제된 작업판)'}</Typography>
          {step.note && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
              {step.note}
            </Typography>
          )}
        </Box>
        {step.lockedCount > 0 && (
          <Tooltip title="작업 절차를 만든 사람이 정해 둔 설정입니다">
            <Box component="span"><ToneChip tone="neutral" label={`고정 설정 ${step.lockedCount}개`} /></Box>
          </Tooltip>
        )}
      </Box>
      <Stack spacing={2.5} sx={{ p: 2 }}>
        {inherited.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">앞 단계 결과를 받습니다</Typography>
            {inherited.map((f) => <ToneChip key={f.name} tone="info" label={f.label} />)}
          </Box>
        )}
        {exposed.length === 0 && inherited.length === 0 && (
          <Typography variant="caption" color="text.secondary">이 단계는 입력할 것이 없습니다.</Typography>
        )}
        {exposed.map((f) => (
          <RunFieldInput
            key={f.name}
            field={f}
            workboard={step.workboard}
            value={values?.[f.name]}
            onChange={(v) => onChange(f.name, v)}
            showMissing={showMissing}
          />
        ))}
      </Stack>
    </Paper>
  );
}

function SequenceRunner({ sequenceId, prefill, onClose, onStarted }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sequence', sequenceId],
    queryFn: () => sequenceAPI.get(sequenceId),
  });
  const sequence = data?.data?.data?.sequence;
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectAPI.getAll({ limit: 200 }),
    staleTime: 60_000,
  });
  const projects = projectsData?.data?.data?.projects || projectsData?.data?.projects || [];

  const [values, setValues] = useState(null);
  const [targetProjectId, setTargetProjectId] = useState('');
  const [showMissing, setShowMissing] = useState(false);

  // 서버가 준 기본값으로 한 번만 채운다 — 다시 불러와도 입력 중인 값을 덮지 않게
  useEffect(() => {
    if (!sequence || values !== null) return;
    const initial = initialRunValues(sequence.steps);
    setValues(prefill ? applyRunPrefill(initial, sequence.steps, prefill) : initial);
  }, [sequence, values, prefill]);

  const startMutation = useMutation({
    mutationFn: () => sequenceRunAPI.start({
      sequenceId,
      inputs: buildRunInputs(sequence.steps, values),
      ...(targetProjectId ? { targetProjectId } : {}),
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['sequenceRuns'] });
      toast.success('실행을 시작했습니다.');
      onStarted(res.data?.data?.run?._id);
    },
    onError: (err) => toast.error(err.response?.data?.message || '시작하지 못했습니다', { duration: 6000 }),
  });

  if (isLoading || (sequence && values === null)) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (isError || !sequence) {
    return (
      <Alert severity="error" action={<Button onClick={onClose}>목록으로</Button>}>
        작업 절차를 찾을 수 없거나 더 이상 실행할 수 없습니다.
      </Alert>
    );
  }

  const steps = sequence.steps || [];
  const missing = missingRequiredInputs(steps, values);
  const setStepValue = (stepId, name, value) => setValues((prev) => ({
    ...prev,
    [stepId]: { ...(prev[stepId] || {}), [name]: value },
  }));
  const handleStart = () => {
    if (missing.length > 0) {
      setShowMissing(true);
      toast.error('입력하지 않은 항목이 있습니다');
      return;
    }
    startMutation.mutate();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>{sequence.name}</Typography>
          {sequence.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>{sequence.description}</Typography>
          )}
        </Box>
        <Button startIcon={<ArrowBackIcon />} onClick={onClose}>목록</Button>
      </Box>

      <Stack spacing={2.5} sx={{ maxWidth: 880 }}>
        <StepPath steps={steps} />
        {!sequence.runnable && (
          <Alert severity="warning">지금은 실행할 수 없습니다 — {blockedSummary(sequence)}. 운영자에게 문의하세요.</Alert>
        )}
        {steps.map((step, i) => (
          <StepInputCard
            key={step._id || i}
            step={step}
            index={i}
            values={values[step._id]}
            onChange={(name, value) => setStepValue(step._id, name, value)}
            showMissing={showMissing}
          />
        ))}
        {showMissing && missing.length > 0 && (
          <Alert severity="warning">
            입력하지 않은 항목이 있습니다 — {missing.map((m) => `${m.stepIndex + 1}단계 ${m.label}`).join(', ')}
          </Alert>
        )}
        {projects.length > 0 && (
          <TextField
            select
            size="small"
            fullWidth
            label="결과를 담을 프로젝트 (선택)"
            value={targetProjectId}
            onChange={(e) => setTargetProjectId(e.target.value)}
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            helperText="고르면 만든 이미지와 대화에 그 프로젝트 태그가 붙습니다"
          >
            <option value="">프로젝트에 넣지 않음</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </TextField>
        )}
        <Alert severity="info">
          실행은 서버에서 이어서 진행되므로 페이지를 떠나도 됩니다. 단계 결과는 실행 기록에 모이고, 일반 작업 히스토리에는 뜨지 않습니다.
        </Alert>
        <Box>
          <Button
            variant="contained"
            size="large"
            startIcon={startMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleStart}
            disabled={!sequence.runnable || startMutation.isPending}
          >
            실행
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}

// ── 실행 기록 ─────────────────────────────────────────────────────

function StepDots({ steps }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
      {(steps || []).map((s, idx) => {
        const color = s.status === 'completed' ? 'success.main'
          : s.status === 'failed' ? 'error.main'
            : s.status === 'running' ? 'info.main' : null;
        return (
          <Box
            key={idx}
            title={s.workboardId?.name}
            sx={{
              width: 22, height: 22, borderRadius: '50%', border: 1,
              borderColor: color || 'divider', bgcolor: color || 'transparent', color: color ? 'common.white' : 'text.secondary',
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: MONO,
            }}
          >
            {s.status === 'completed' ? <CheckCircleIcon sx={{ fontSize: 12 }} /> : idx + 1}
          </Box>
        );
      })}
    </Box>
  );
}

function RunCard({ run, onSelect, onDelete }) {
  const status = runStatusMeta(run.status);
  const progress = runProgress(run);
  const inProgress = isRunInProgress(run);
  return (
    <Card variant="outlined" onClick={onSelect} sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
      <CardContent sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{run.sequenceName || '(작업 절차)'}</Typography>
          <ToneChip tone={status.tone} label={status.label} />
          {run.triggerCount > 1 && <ToneChip tone="neutral" label={`재시도 ${run.triggerCount - 1}회`} />}
          {run.targetProjectId?.name && <ToneChip tone="accent" label={run.targetProjectId.name} />}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
            {relativeTime(run.createdAt)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" noWrap title={run.initialPrompt} sx={{ flex: 1, minWidth: 0 }}>
            {run.initialPrompt || '(입력 없음)'}
          </Typography>
          <StepDots steps={run.steps} />
          {inProgress && (
            <Box sx={{ width: 80, flexShrink: 0 }}>
              <LinearProgress variant="determinate" value={progress.pct} sx={{ height: 4, borderRadius: 1 }} />
            </Box>
          )}
          <Tooltip title={inProgress ? '진행 중인 실행은 삭제할 수 없습니다' : '실행 기록 삭제'}>
            <span onClick={(e) => e.stopPropagation()}>
              <IconButton aria-label="실행 기록 삭제" color="error" disabled={inProgress} onClick={onDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
}

function RunList({ onSelect }) {
  const confirm = useConfirm();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sequenceRuns', 'list'],
    queryFn: () => sequenceRunAPI.list({ limit: 50 }),
    // 진행 중인 실행이 있을 때만 갱신
    refetchInterval: (query) => ((query.state.data?.data?.data?.runs || []).some(isRunInProgress) ? 3000 : false),
  });
  const runs = data?.data?.data?.runs || [];
  const deleteMutation = useDeleteRun();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (isError) return <Alert severity="error">실행 기록을 불러오지 못했습니다.</Alert>;
  if (runs.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          아직 실행 기록이 없습니다. "작업 절차" 탭에서 실행하세요.
        </Typography>
      </Paper>
    );
  }
  return (
    <Stack spacing={1.5}>
      {runs.map((run) => (
        <RunCard
          key={run._id}
          run={run}
          onSelect={() => onSelect(run._id)}
          onDelete={async () => {
            if (await confirm(DELETE_CONFIRM)) deleteMutation.mutate(run._id);
          }}
        />
      ))}
    </Stack>
  );
}

// 실행 입력 — 실행자가 넣은 값. 옛 실행 기록(입력 노출 전)은 첫 단계 프롬프트만 있다
function RunInputsSummary({ run, labels }) {
  const rows = [];
  (run.steps || []).forEach((step, stepIndex) => {
    const stepId = step.stepId ? String(step.stepId) : null;
    const provided = stepId ? run.runInputs?.[stepId] : null;
    if (!provided) return;
    Object.entries(provided).forEach(([name, value]) => {
      const meta = labels?.[stepId]?.[name] || { label: name };
      rows.push({ key: `${stepId}-${name}`, stepIndex, label: meta.label, text: describeRunInput(value, meta.type) });
    });
  });

  if (rows.length === 0) {
    if (!run.initialPrompt) return null;
    return (
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>첫 단계 입력</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{run.initialPrompt}</Typography>
      </Paper>
    );
  }
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>실행 입력</Typography>
      <Stack spacing={1}>
        {rows.map((r) => (
          <Box key={r.key} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, minWidth: 120 }}>
              {r.stepIndex + 1}단계 · {r.label}
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: 0, flex: 1 }}>
              {r.text}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function RunStepList({ run, onContinue, onCross, onTextContinue }) {
  const steps = run.steps || [];
  return (
    <Stepper activeStep={steps.findIndex((s) => s.status === 'running')} orientation="vertical">
      {steps.map((step, idx) => {
        const job = step.imageGenerationJobId && typeof step.imageGenerationJobId === 'object' ? step.imageGenerationJobId : null;
        const conversation = step.conversationJobId && typeof step.conversationJobId === 'object' ? step.conversationJobId : null;
        const images = job?.resultImages || [];
        const videos = job?.resultVideos || [];
        return (
          <Step key={idx} active expanded={step.status !== 'pending'}>
            <StepLabel
              icon={
                step.status === 'completed' ? <CheckCircleIcon color="success" />
                  : step.status === 'failed' ? <ErrorIcon color="error" />
                    : step.status === 'running' ? <CircularProgress size={20} />
                      : step.status === 'skipped' ? <StopIcon color="disabled" />
                        : <Box component="span" sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>{idx + 1}</Box>
              }
            >
              <Typography variant="subtitle2">{step.workboardId?.name || '(삭제된 작업판)'}</Typography>
              {step.startedAt && step.completedAt && (
                <Typography variant="caption" color="text.secondary">
                  {formatDuration(step.startedAt, step.completedAt)}
                </Typography>
              )}
            </StepLabel>
            <StepContent>
              {step.status === 'completed' && step.output && (
                <Paper
                  variant="outlined"
                  sx={{
                    overflow: 'hidden',
                    borderColor: (t) => alpha(t.palette.success.main, 0.35),
                    bgcolor: (t) => alpha(t.palette.success.main, 0.06),
                  }}
                >
                  <Box sx={{ p: 1.5 }}>
                    {step.output.type === 'text' && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto', lineHeight: 1.65 }}>
                        {step.output.value}
                      </Typography>
                    )}
                    {step.output.type === 'image' && (images.length > 0 || videos.length === 0) && (
                      <StepImageThumbnails runStep={step} viewerTitle="작업 절차 결과" />
                    )}
                    {videos.length > 0 && (
                      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: images.length > 0 ? 1 : 0 }}>
                        {videos.map((v) => (
                          <Box key={v._id} component="video" src={v.url} controls preload="metadata" sx={{ width: 240, maxWidth: '100%', borderRadius: 1 }} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                  {(job || conversation) && (
                    <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1, borderTop: '1px dashed', borderColor: 'divider', flexWrap: 'wrap' }}>
                      {job && (
                        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => onContinue(job)}>
                          계속하기
                        </Button>
                      )}
                      {job && (
                        <Button size="small" startIcon={<SwapHorizIcon />} onClick={() => onCross(job)}>
                          다른 작업판으로
                        </Button>
                      )}
                      {conversation && (
                        <Button size="small" variant="outlined" startIcon={<ChatIcon />} onClick={() => onTextContinue(conversation)}>
                          대화 이어가기
                        </Button>
                      )}
                    </Box>
                  )}
                </Paper>
              )}
              {step.status === 'failed' && <Alert severity="error">{step.error?.message || '실패'}</Alert>}
              {step.status === 'skipped' && <Typography variant="caption" color="text.secondary">건너뜀</Typography>}
              {step.status === 'running' && <Typography variant="caption" color="text.secondary">실행 중…</Typography>}
            </StepContent>
          </Step>
        );
      })}
    </Stepper>
  );
}

function RunDetail({ runId, onBack, onRerun }) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { continueSameWorkboard, continueCrossWorkboard } = useContinueJob();
  const [crossJob, setCrossJob] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['sequenceRuns', 'detail', runId],
    queryFn: () => sequenceRunAPI.get(runId),
    refetchInterval: (query) => (isRunInProgress(query.state.data?.data?.data?.run) ? 2000 : false),
  });
  const run = data?.data?.data?.run;
  const inputLabels = data?.data?.data?.inputLabels || {};
  const available = data?.data?.data?.sequence;

  const retryMutation = useMutation({
    mutationFn: (fromStep) => sequenceRunAPI.retry(runId, { fromStep }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequenceRuns'] });
      toast.success('다시 시작했습니다.');
    },
    onError: (err) => toast.error(err.response?.data?.message || '다시 시작하지 못했습니다'),
  });
  const deleteMutation = useDeleteRun(onBack);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (isError || !run) {
    return (
      <Alert severity="error" action={<Button onClick={onBack}>목록으로</Button>}>
        실행 기록을 찾을 수 없습니다.
      </Alert>
    );
  }

  const status = runStatusMeta(run.status);
  const progress = runProgress(run);
  const inProgress = isRunInProgress(run);
  const retryFrom = retryStartIndex(run);
  const meta = [
    run.startedAt && `시작 ${new Date(run.startedAt).toLocaleString('ko-KR')}`,
    run.completedAt && `종료 ${new Date(run.completedAt).toLocaleString('ko-KR')}`,
    run.startedAt && run.completedAt && `소요 ${formatDuration(run.startedAt, run.completedAt)}`,
    run.triggerCount > 1 && `재시도 ${run.triggerCount - 1}회`,
    run.targetProjectId?.name && `프로젝트 ${run.targetProjectId.name}`,
  ].filter(Boolean).join(' · ');

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack}>목록</Button>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>{run.sequenceName || '(작업 절차)'}</Typography>
        <ToneChip tone={status.tone} label={status.label} />
        <Box sx={{ flex: 1 }} />
        {available && retryFrom >= 0 && (
          <Button
            variant="contained"
            color="warning"
            startIcon={<PlayArrowIcon />}
            onClick={() => retryMutation.mutate(retryFrom)}
            disabled={retryMutation.isPending}
          >
            {retryFrom + 1}단계부터 다시
          </Button>
        )}
        {available && !inProgress && (
          <Button
            startIcon={<ReplayIcon />}
            onClick={() => onRerun(run.sequenceId, { runInputs: run.runInputs, initialPrompt: run.initialPrompt })}
          >
            같은 입력으로 새로 실행
          </Button>
        )}
        <Tooltip title={inProgress ? '진행 중인 실행은 삭제할 수 없습니다' : '실행 기록 삭제'}>
          <span>
            <IconButton
              aria-label="실행 기록 삭제"
              color="error"
              disabled={inProgress || deleteMutation.isPending}
              onClick={async () => { if (await confirm(DELETE_CONFIRM)) deleteMutation.mutate(runId); }}
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {meta && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontFamily: MONO }}>{meta}</Typography>
      )}

      <Stack spacing={2} sx={{ maxWidth: 900 }}>
        {!available && (
          <Alert severity="info">이 작업 절차는 삭제됐거나 지금은 실행할 수 없습니다. 기록과 결과는 그대로 볼 수 있습니다.</Alert>
        )}
        {run.status === 'failed' && run.error?.message && <Alert severity="error">{run.error.message}</Alert>}
        {inProgress && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              {progress.done} / {progress.total} 단계
            </Typography>
            <LinearProgress variant="determinate" value={progress.pct} sx={{ flex: 1, height: 6, borderRadius: 1 }} />
          </Box>
        )}
        <RunInputsSummary run={run} labels={inputLabels} />
        <RunStepList
          run={run}
          onContinue={continueSameWorkboard}
          onCross={setCrossJob}
          onTextContinue={(conversation) => navigate(`/prompt-generate/${conversation.workboardId}?conversationId=${conversation._id}`)}
        />
      </Stack>

      <WorkboardSelectDialog
        open={!!crossJob}
        onClose={() => setCrossJob(null)}
        onSelect={(workboard) => {
          const job = crossJob;
          setCrossJob(null);
          continueCrossWorkboard(job, workboard);
        }}
      />
    </Box>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────

export default function Sequences() {
  const [params, setParams] = useSearchParams();
  const [prefill, setPrefill] = useState(null);
  const startId = params.get('start');
  const runId = params.get('run');
  const tab = params.get('tab') === 'runs' ? 'runs' : 'catalog';

  const go = (next) => setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));

  return (
    <Box>
      <PageHeader
        title="작업 절차"
        description="운영자가 정해 둔 순서대로 작업판을 이어서 실행합니다. 단계별 결과는 실행 기록에서 모아 봅니다."
      />
      {startId ? (
        <SequenceRunner
          key={startId}
          sequenceId={startId}
          prefill={prefill}
          onClose={() => { setPrefill(null); go({}); }}
          onStarted={(id) => { setPrefill(null); go({ tab: 'runs', run: id }); }}
        />
      ) : (
        <>
          <Tabs value={tab} onChange={(_, value) => go({ tab: value === 'runs' ? 'runs' : undefined })} sx={{ mb: 3 }}>
            <Tab value="catalog" label="작업 절차" />
            <Tab value="runs" label="실행 기록" />
          </Tabs>
          {tab === 'catalog' && <SequenceCatalog onRun={(id) => go({ start: id })} />}
          {tab === 'runs' && (runId ? (
            <RunDetail
              key={runId}
              runId={runId}
              onBack={() => go({ tab: 'runs' })}
              onRerun={(sequenceId, previous) => { setPrefill(previous); go({ start: sequenceId }); }}
            />
          ) : (
            <RunList onSelect={(id) => go({ tab: 'runs', run: id })} />
          ))}
        </>
      )}
    </Box>
  );
}
