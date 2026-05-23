import React, { useState, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Settings as SettingsIcon,
  ArrowUpward,
  ArrowDownward,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import MetadataFieldInput from './MetadataFieldInput';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { pipelineAPI, projectAPI, jobAPI, tagAPI, textAPI } from '../../services/api';

// 프로젝트 종속 작업판 파이프라인 (#397).
// 단계: 목록 → 빌더 → 실행. 모두 한 패널에서.
function PipelinePanel({ projectId }) {
  const [view, setView] = useState('list'); // list | builder | runner
  const [editingPipelineId, setEditingPipelineId] = useState(null);
  const [runningPipelineId, setRunningPipelineId] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    ['pipelines', projectId],
    () => pipelineAPI.list(projectId),
    { enabled: !!projectId }
  );
  const pipelines = data?.data?.data?.pipelines || [];

  const deleteMutation = useMutation(
    (pid) => pipelineAPI.delete(projectId, pid),
    {
      onSuccess: () => {
        toast.success('파이프라인이 삭제되었습니다.');
        queryClient.invalidateQueries(['pipelines', projectId]);
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'),
    }
  );

  if (view === 'builder') {
    return (
      <PipelineBuilder
        projectId={projectId}
        pipelineId={editingPipelineId}
        onClose={() => { setView('list'); setEditingPipelineId(null); }}
      />
    );
  }
  if (view === 'runner') {
    return (
      <PipelineRunner
        projectId={projectId}
        pipelineId={runningPipelineId}
        onClose={() => { setView('list'); setRunningPipelineId(null); }}
      />
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" color="text.secondary">
          작업판 A → B → C 직선 실행. 단계의 출력 타입이 다음 단계의 입력 타입과 일치하면 자동 주입됩니다.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => { setEditingPipelineId(null); setView('builder'); }}
        >
          새 파이프라인
        </Button>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : pipelines.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            등록된 파이프라인이 없습니다. "새 파이프라인" 으로 작성하세요.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {pipelines.map((p) => (
            <Card key={p._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Box display="flex" alignItems="center" gap={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                  <Chip label={`${p.steps?.length || 0}단계`} size="small" variant="outlined" />
                  {/* #401: useWorldview chip 제거 — 단계별 문서 연결로 표현 */}
                </Box>
                {p.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {p.description}
                  </Typography>
                )}
                {/* 단계 미리보기 — 작업판 이름 + description (작업판/단계). 모바일에선 description 숨김. */}
                <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                  {(p.steps || []).map((s, idx) => (
                    <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <Chip
                        label={idx + 1}
                        size="small"
                        color={s.workboardId?.isActive === false ? 'warning' : 'primary'}
                        sx={{ height: 22, minWidth: 22, '& .MuiChip-label': { px: 1 } }}
                      />
                      <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
                          {s.workboardId?.name || '(삭제됨)'}
                        </Typography>
                        {s.workboardId?.description && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: { xs: 'none', sm: '-webkit-box' },
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {s.workboardId.description}
                          </Typography>
                        )}
                        {s.note && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}
                          >
                            {s.note}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  color="success"
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => { setRunningPipelineId(p._id); setView('runner'); }}
                  disabled={(p.steps || []).length === 0}
                >
                  실행
                </Button>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => { setEditingPipelineId(p._id); setView('builder'); }}
                >
                  편집
                </Button>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    if (window.confirm(`"${p.name}" 파이프라인을 삭제하시겠습니까?`)) {
                      deleteMutation.mutate(p._id);
                    }
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}

// 파이프라인 빌더 — 단계 목록 편집 (#397)
function PipelineBuilder({ projectId, pipelineId, onClose }) {
  const isNew = !pipelineId;
  const queryClient = useQueryClient();

  const { data: pipelineData, isLoading } = useQuery(
    ['pipeline', projectId, pipelineId],
    () => pipelineAPI.get(projectId, pipelineId),
    { enabled: !!pipelineId }
  );
  const loaded = pipelineData?.data?.data?.pipeline;

  // 프로젝트의 작업판 목록 (단계 선택용)
  const { data: wbData } = useQuery(
    ['projectWorkboards', projectId],
    () => projectAPI.getWorkboards(projectId),
  );
  const projectWorkboards = wbData?.data?.data?.workboards || [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inputsDialogStepIdx, setInputsDialogStepIdx] = useState(-1);
  const [docsDialogStepIdx, setDocsDialogStepIdx] = useState(-1);

  // 로드 시 폼 초기화
  React.useEffect(() => {
    if (loaded) {
      setName(loaded.name || '');
      setDescription(loaded.description || '');
      setSteps((loaded.steps || []).map((s) => ({
        workboardId: s.workboardId?._id || s.workboardId,
        workboard: s.workboardId, // populated
        autoInject: s.autoInject !== false,
        inputs: s.inputs || {},
        contextDocIds: Array.isArray(s.contextDocIds) ? s.contextDocIds.map((d) => d._id || d) : [],
        systemPromptDocId: s.systemPromptDocId?._id || s.systemPromptDocId || null,
        note: s.note || '',
      })));
    }
  }, [loaded]);

  const saveMutation = useMutation(
    (payload) => isNew
      ? pipelineAPI.create(projectId, payload)
      : pipelineAPI.update(projectId, pipelineId, payload),
    {
      onSuccess: () => {
        toast.success('저장되었습니다.');
        // list + single 모두 invalidate — 재진입 시 stale cache 방지
        queryClient.invalidateQueries(['pipelines', projectId]);
        if (pipelineId) {
          queryClient.invalidateQueries(['pipeline', projectId, pipelineId]);
        }
        onClose();
      },
      onError: (err) => toast.error(err.response?.data?.message || '저장 실패'),
    }
  );

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }
    if (steps.length === 0) {
      toast.error('최소 하나 이상의 단계가 필요합니다.');
      return;
    }
    saveMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      steps: steps.map((s) => ({
        workboardId: s.workboardId,
        autoInject: s.autoInject,
        inputs: s.inputs || {},
        contextDocIds: s.contextDocIds || [],
        systemPromptDocId: s.systemPromptDocId || undefined,
        note: s.note,
      })),
    });
  };

  const moveStep = (idx, delta) => {
    const next = [...steps];
    const to = idx + delta;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setSteps(next);
  };

  const removeStep = (idx) => {
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const addStep = (wb) => {
    setSteps([...steps, { workboardId: wb._id, workboard: wb, autoInject: true, inputs: {}, note: '' }]);
    setPickerOpen(false);
  };

  const updateStepInputs = (idx, inputs) => {
    const next = [...steps];
    next[idx] = { ...next[idx], inputs };
    setSteps(next);
  };

  if (isLoading && pipelineId) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <Typography variant="h6">{isNew ? '새 파이프라인' : '파이프라인 편집'}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={handleSave} disabled={saveMutation.isLoading}>저장</Button>
      </Box>

      <Stack spacing={2}>
        <TextField
          size="small"
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          inputProps={{ maxLength: 100 }}
          fullWidth
        />
        <TextField
          size="small"
          label="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          inputProps={{ maxLength: 500 }}
          multiline
          minRows={2}
          fullWidth
        />
        {/* useWorldview 토글 제거 (#401) — 단계별 문서 선택으로 대체 */}

        <Box>
          <Box display="flex" alignItems="center" mb={1}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>단계 ({steps.length})</Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              variant="outlined"
              onClick={() => setPickerOpen(true)}
            >
              단계 추가
            </Button>
          </Box>
          {steps.length === 0 ? (
            <Alert severity="info">
              "단계 추가" 로 프로젝트 소속 작업판을 순서대로 등록하세요.
              먼저 프로젝트의 "작업판" 탭에서 사용할 작업판들을 추가해 두어야 합니다.
            </Alert>
          ) : (
            <Stack spacing={1}>
              {steps.map((s, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip label={idx + 1} size="small" color="primary" />
                    <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                      <Typography variant="subtitle2" noWrap>
                        {s.workboard?.name || '(이름 불러오는 중)'}
                      </Typography>
                      {s.workboard?.description && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                          {s.workboard.description}
                        </Typography>
                      )}
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                        {s.workboard?.outputFormat && (
                          <Chip label={`out: ${s.workboard.outputFormat}`} size="small" variant="outlined" />
                        )}
                      </Stack>
                    </Box>
                    {idx > 0 && (
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={s.autoInject !== false}
                            onChange={(e) => {
                              const next = [...steps];
                              next[idx] = { ...s, autoInject: e.target.checked };
                              setSteps(next);
                            }}
                          />
                        }
                        label={<Typography variant="caption">이전 결과 자동 주입</Typography>}
                      />
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      onClick={() => setInputsDialogStepIdx(idx)}
                    >
                      입력 설정
                      {Object.keys(s.inputs || {}).filter((k) => s.inputs[k] !== '' && s.inputs[k] != null).length > 0 && (
                        <Chip label={Object.keys(s.inputs).filter((k) => s.inputs[k] !== '' && s.inputs[k] != null).length} size="small" sx={{ ml: 0.5, height: 18 }} />
                      )}
                    </Button>
                    {/* 단계별 문서 연결 (#401) — LLM 단계만 의미 있지만 UI 는 모든 단계에 노출 (간소화) */}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setDocsDialogStepIdx(idx)}
                    >
                      문서
                      {((s.contextDocIds?.length || 0) + (s.systemPromptDocId ? 1 : 0)) > 0 && (
                        <Chip
                          label={(s.contextDocIds?.length || 0) + (s.systemPromptDocId ? 1 : 0)}
                          size="small"
                          sx={{ ml: 0.5, height: 18 }}
                        />
                      )}
                    </Button>
                    <IconButton size="small" disabled={idx === 0} onClick={() => moveStep(idx, -1)}>
                      <ArrowUpward fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={idx === steps.length - 1} onClick={() => moveStep(idx, 1)}>
                      <ArrowDownward fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => removeStep(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  {/* 단계별 메모 — 이 단계의 작업판 역할 / 사용자 가이드용 (#397 후속) */}
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="이 단계에 대한 설명 / 메모 (선택)"
                    value={s.note || ''}
                    onChange={(e) => {
                      const next = [...steps];
                      next[idx] = { ...s, note: e.target.value };
                      setSteps(next);
                    }}
                    multiline
                    maxRows={3}
                    inputProps={{ maxLength: 500 }}
                    sx={{ mt: 1 }}
                  />
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>

      {/* 단계별 사전 입력 설정 다이얼로그 */}
      <StepInputsDialog
        open={inputsDialogStepIdx >= 0}
        step={inputsDialogStepIdx >= 0 ? steps[inputsDialogStepIdx] : null}
        onClose={() => setInputsDialogStepIdx(-1)}
        onSave={(inputs) => {
          updateStepInputs(inputsDialogStepIdx, inputs);
          setInputsDialogStepIdx(-1);
        }}
      />

      {/* 단계별 문서 연결 (사전 컨텍스트 / 시스템 프롬프트) 다이얼로그 (#401) */}
      <StepDocsDialog
        open={docsDialogStepIdx >= 0}
        projectId={projectId}
        step={docsDialogStepIdx >= 0 ? steps[docsDialogStepIdx] : null}
        onClose={() => setDocsDialogStepIdx(-1)}
        onSave={({ contextDocIds, systemPromptDocId }) => {
          const next = [...steps];
          next[docsDialogStepIdx] = { ...next[docsDialogStepIdx], contextDocIds, systemPromptDocId };
          setSteps(next);
          setDocsDialogStepIdx(-1);
        }}
      />

      {/* 단계 추가 picker — 프로젝트 소속 작업판만 */}
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>단계 추가 - 작업판 선택</DialogTitle>
        <DialogContent dividers>
          {projectWorkboards.length === 0 ? (
            <Alert severity="info">
              프로젝트에 등록된 작업판이 없습니다. 먼저 "작업판" 탭에서 추가해 주세요.
            </Alert>
          ) : (
            <Stack spacing={1}>
              {projectWorkboards.map((wb) => (
                <Box
                  key={wb._id}
                  onClick={() => addStep(wb)}
                  sx={{
                    p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }
                  }}
                >
                  <Typography variant="subtitle2">{wb.name}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    {wb.outputFormat && <Chip label={wb.outputFormat} size="small" variant="outlined" />}
                    {wb.serverId?.name && <Chip label={wb.serverId.name} size="small" variant="outlined" />}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPickerOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 파이프라인 단계의 사전 입력 설정 다이얼로그 (#397 후속).
// 작업판의 customField 들을 렌더링해 admin 이 미리 값을 채울 수 있게 함.
// 자동 주입 대상 (prompt/userPrompt, image 입력) 도 여기서 미리 설정 가능하나,
// 자동 주입이 ON 이면 runtime 에 덮어쓰임.
function StepInputsDialog({ open, step, onClose, onSave }) {
  const wb = step?.workboard;
  const [values, setValues] = useState({});

  React.useEffect(() => {
    if (step) {
      setValues(step.inputs || {});
    }
  }, [step]);

  if (!wb) return null;

  // conversation_mode 같은 admin-only customField 는 사전 입력에서 숨김
  const fields = (wb.additionalInputFields || []).filter((f) => f.name !== 'conversation_mode');

  const updateValue = (name, v) => setValues({ ...values, [name]: v });

  const renderField = (field) => {
    const value = values[field.name] ?? field.defaultValue ?? '';

    if (field.type === 'string') {
      return (
        <TextField
          size="small"
          fullWidth
          label={field.label}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => updateValue(field.name, e.target.value)}
          multiline={field.name.includes('prompt')}
          rows={field.name.includes('prompt') ? 2 : 1}
          helperText={field.description}
        />
      );
    }
    if (field.type === 'number') {
      return (
        <TextField
          size="small"
          fullWidth
          type="number"
          label={field.label}
          value={value}
          onChange={(e) => updateValue(field.name, e.target.value)}
          helperText={field.description}
        />
      );
    }
    if (field.type === 'boolean') {
      return (
        <FormControlLabel
          control={<Switch checked={!!value} onChange={(e) => updateValue(field.name, e.target.checked)} />}
          label={field.label}
        />
      );
    }
    if (field.type === 'select') {
      // native select 사용 시 label 이 placeholder 와 겹쳐 보이는 문제 해결 위해 InputLabelProps.shrink 고정
      return (
        <TextField
          size="small"
          fullWidth
          select
          label={field.label}
          value={value || ''}
          onChange={(e) => updateValue(field.name, e.target.value)}
          SelectProps={{ native: true }}
          InputLabelProps={{ shrink: true }}
          helperText={field.description}
        >
          <option value="">— 선택 없음 —</option>
          {(field.options || []).map((opt, i) => (
            <option key={i} value={opt.value}>{opt.key || opt.value}</option>
          ))}
        </TextField>
      );
    }
    if (field.type === 'baseModel' || field.type === 'lora') {
      return (
        <MetadataFieldInput
          kind={field.type === 'baseModel' ? 'model' : 'lora'}
          field={field}
          value={value || ''}
          onChange={(v) => updateValue(field.name, v)}
          workboardId={wb._id}
          serverId={wb?.serverId?._id || wb?.serverId}
        />
      );
    }
    if (field.type === 'image') {
      return (
        <Alert severity="info">
          이미지 필드 (`{field.name}`) — 자동 주입 또는 단계 실행 시 입력. 사전 설정 미지원.
        </Alert>
      );
    }
    return null;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        단계 입력 설정
        {wb.name && <Typography variant="caption" color="text.secondary" display="block">{wb.name}</Typography>}
      </DialogTitle>
      <DialogContent dividers>
        {fields.length === 0 ? (
          <Alert severity="info">설정 가능한 입력 필드가 없습니다.</Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              여기서 설정한 값은 단계 실행 시 자동으로 채워집니다.
              <strong> "이전 결과 자동 주입"</strong> 이 켜진 단계에선 prompt 등 매칭 필드는 이전 단계 결과로 덮어쓰임됩니다.
            </Alert>
            {fields.map((field) => (
              <Box key={field.name}>{renderField(field)}</Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={() => onSave(values)}>저장</Button>
      </DialogActions>
    </Dialog>
  );
}

// 단계별 문서 연결 다이얼로그 (#401).
// 사전 컨텍스트 문서 (다중) + 시스템 프롬프트 문서 (단일) 를 프로젝트의 문서 중 선택.
// 문서 수정 시 다음 실행부터 자동 반영.
function StepDocsDialog({ open, projectId, step, onClose, onSave }) {
  const [contextDocIds, setContextDocIds] = useState([]);
  const [systemPromptDocId, setSystemPromptDocId] = useState(null);

  // 빌트인 태그 (세계관 / 시스템 프롬프트)
  const { data: wvTagData } = useQuery('worldviewTag', () => tagAPI.getWorldview(), { staleTime: 60_000 });
  const { data: spTagData } = useQuery('systemPromptTag', () => tagAPI.getSystemPrompt(), { staleTime: 60_000 });
  const worldviewTag = wvTagData?.data?.tag;
  const systemPromptTag = spTagData?.data?.tag;

  // 프로젝트 정보 (project tagId 필요)
  const { data: projectData } = useQuery(
    ['project', projectId],
    () => projectAPI.getById(projectId),
    { enabled: !!projectId }
  );
  const projectTagId = projectData?.data?.data?.project?.tagId?._id || projectData?.data?.data?.project?.tagId;

  // 프로젝트의 세계관 / 시스템 프롬프트 문서 목록 조회
  const { data: contextDocsData } = useQuery(
    ['projectContextDocs', projectId, projectTagId, worldviewTag?._id],
    () => textAPI.getUploaded({ tags: [projectTagId, worldviewTag._id].join(','), limit: 100 }),
    { enabled: !!(projectTagId && worldviewTag?._id && open) }
  );
  const contextDocs = contextDocsData?.data?.data?.items || [];

  const { data: spDocsData } = useQuery(
    ['projectSystemPromptDocs', projectId, projectTagId, systemPromptTag?._id],
    () => textAPI.getUploaded({ tags: [projectTagId, systemPromptTag._id].join(','), limit: 100 }),
    { enabled: !!(projectTagId && systemPromptTag?._id && open) }
  );
  const spDocs = spDocsData?.data?.data?.items || [];

  React.useEffect(() => {
    if (step) {
      setContextDocIds(step.contextDocIds || []);
      setSystemPromptDocId(step.systemPromptDocId || null);
    }
  }, [step]);

  if (!step) return null;

  const isLlmStep = step.workboard?.outputFormat === 'text';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        단계 문서 연결
        {step.workboard?.name && <Typography variant="caption" color="text.secondary" display="block">{step.workboard.name}</Typography>}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {!isLlmStep && (
            <Alert severity="info">
              이미지 / 영상 작업판 단계입니다. 문서 연결은 LLM 호출에만 적용되므로 현재 단계에는 영향 없습니다.
              (저장은 가능하지만 실행에 사용되지 않습니다)
            </Alert>
          )}

          {/* 사전 컨텍스트 문서 (다중) */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              사전 컨텍스트 문서 (다중 선택)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              system 메시지의 [배경 / 사전 컨텍스트] 섹션으로 concat 주입됩니다.
            </Typography>
            {contextDocs.length === 0 ? (
              <Alert severity="warning" variant="outlined" size="small">
                이 프로젝트에 세계관 문서가 없습니다. 프로젝트의 세계관 탭에서 추가하세요.
              </Alert>
            ) : (
              <Stack spacing={0.5}>
                {contextDocs.map((doc) => {
                  const selected = contextDocIds.includes(doc._id);
                  return (
                    <Box
                      key={doc._id}
                      onClick={() => {
                        if (selected) setContextDocIds(contextDocIds.filter((id) => id !== doc._id));
                        else setContextDocIds([...contextDocIds, doc._id]);
                      }}
                      sx={{
                        p: 1, border: 1, borderRadius: 1, cursor: 'pointer',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? 'action.selected' : 'background.paper',
                        '&:hover': { borderColor: 'primary.main' }
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={selected ? '선택' : ''}
                          size="small"
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          sx={{ minWidth: 50 }}
                        />
                        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                            {doc.title || '(제목 없음)'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {(doc.content || '').slice(0, 80)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>

          {/* 시스템 프롬프트 문서 (단일) */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              시스템 프롬프트 문서 (단일 선택)
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              system 메시지의 [작업 지침] 으로 사용됩니다. 작업판의 system_prompt customField 보다 우선합니다.
            </Typography>
            <TextField
              size="small"
              fullWidth
              select
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              label="시스템 프롬프트"
              value={systemPromptDocId || ''}
              onChange={(e) => setSystemPromptDocId(e.target.value || null)}
            >
              <option value="">— 선택 없음 (작업판 system_prompt 사용) —</option>
              {spDocs.map((doc) => (
                <option key={doc._id} value={doc._id}>
                  {doc.title || '(제목 없음)'}
                </option>
              ))}
            </TextField>
            {spDocs.length === 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                시스템 프롬프트 문서가 없습니다. 프로젝트의 세계관 탭 → "시스템 프롬프트" chip 으로 전환해 작성하세요.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={() => onSave({ contextDocIds, systemPromptDocId })}>저장</Button>
      </DialogActions>
    </Dialog>
  );
}

// 파이프라인 실행 (클라이언트 측 순차 오케스트레이션, #397)
function PipelineRunner({ projectId, pipelineId, onClose }) {
  const { data: pipelineData, isLoading } = useQuery(
    ['pipeline', projectId, pipelineId],
    () => pipelineAPI.get(projectId, pipelineId),
    { enabled: !!pipelineId }
  );
  const pipeline = pipelineData?.data?.data?.pipeline;
  // 프로젝트 tagId — 모든 단계에서 생성되는 작업 / 컨텐츠에 자동 부여 (#397 후속)
  const { data: projectData } = useQuery(
    ['project', projectId],
    () => projectAPI.getById(projectId),
    { enabled: !!projectId }
  );
  const projectTagId = projectData?.data?.data?.project?.tagId?._id || projectData?.data?.data?.project?.tagId;

  // 단계별 상태 / 결과
  // status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  const [stepStates, setStepStates] = useState([]);
  const [running, setRunning] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');

  React.useEffect(() => {
    if (pipeline) {
      setStepStates((pipeline.steps || []).map(() => ({ status: 'pending', output: null, error: null })));
    }
  }, [pipeline]);

  // 단계 입력 빌드 (#397 후속):
  // 1. step.inputs 의 사전 입력값으로 시작
  // 2. 자동 주입 — 첫 단계는 initialPrompt, 그 외 단계는 prevOutput 으로 prompt/image 필드 덮어씀
  const buildStepInput = (workboard, prevOutput, stepInputs, stepIdx) => {
    const inputData = { ...(stepInputs || {}) };

    // userPrompt 는 LLM 작업판의 텍스트 입력 키. 사전 입력에 없으면 기본 빈 문자열.
    if (inputData.userPrompt == null) inputData.userPrompt = '';

    if (stepIdx === 0) {
      // 첫 단계 — 사용자 초기 프롬프트로 텍스트 필드 덮어쓰기
      inputData.userPrompt = initialPrompt;
      const promptField = (workboard.additionalInputFields || []).find(
        (f) => f.name === 'prompt' || f.name === 'userPrompt'
      );
      if (promptField) inputData[promptField.name] = initialPrompt;
    } else if (prevOutput) {
      if (prevOutput.type === 'text') {
        inputData.userPrompt = prevOutput.value;
        const promptField = (workboard.additionalInputFields || []).find(
          (f) => f.name === 'prompt' || f.name === 'userPrompt'
        );
        if (promptField) inputData[promptField.name] = prevOutput.value;
      } else if (prevOutput.type === 'image' && prevOutput.imageIds?.length > 0) {
        const imgField = (workboard.additionalInputFields || []).find((f) => f.type === 'image');
        if (imgField) {
          inputData[imgField.name] = prevOutput.imageIds.map((id) => ({ imageId: id }));
        }
      }
    }
    return inputData;
  };

  const runStep = async (stepIdx, prevOutput) => {
    const step = pipeline.steps[stepIdx];
    const wb = step.workboardId;
    if (!wb || wb.isActive === false) {
      throw new Error(`작업판이 비활성 또는 삭제됨`);
    }
    const inputData = buildStepInput(wb, prevOutput, step.inputs, stepIdx);

    if (wb.outputFormat === 'text') {
      // 텍스트 작업판 — prompt-generate. 단계별 doc IDs 전달 (#401):
      //   - contextDocIds: 사전 컨텍스트 문서들 → [배경 / 사전 컨텍스트] 섹션
      //   - systemPromptDocId: 시스템 프롬프트 문서 → [작업 지침] 섹션 (작업판 system_prompt 보다 우선)
      // projectId 는 모든 단계에 전달 — 백엔드가 ConversationJob.tags 에 프로젝트 태그 자동 주입.
      const response = await jobAPI.createPromptJob({
        workboardId: wb._id,
        projectId: projectId || undefined,
        contextDocIds: step.contextDocIds || [],
        systemPromptDocId: step.systemPromptDocId || undefined,
        inputData,
      });
      return { type: 'text', value: response.data.result, conversationId: response.data.conversationId };
    } else {
      // 이미지 / 영상 — 기존 /api/jobs/generate. 결과 폴링 필요.
      // 프로젝트 태그를 inputData.tags 에 주입 — ImageGenerationJob / GeneratedImage 모두에 전파됨.
      const mergedTags = Array.isArray(inputData.tags) ? [...inputData.tags] : [];
      if (projectTagId && !mergedTags.some((t) => String(t) === String(projectTagId))) {
        mergedTags.push(projectTagId);
      }
      const createResp = await jobAPI.create({
        workboardId: wb._id,
        prompt: inputData.userPrompt || '',
        ...inputData,
        tags: mergedTags,
      });
      const jobId = createResp.data.job?.id;
      if (!jobId) throw new Error('작업 ID 를 받지 못했습니다');

      // 폴링 — 최대 5분 (60회 × 5초). 첫 MVP 단순 구현.
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const jobResp = await jobAPI.getById(jobId);
        const job = jobResp.data.job;
        if (job.status === 'completed') {
          if (wb.outputFormat === 'image') {
            const imageIds = (job.resultImages || []).map((img) => img._id);
            return { type: 'image', imageIds, jobId };
          }
          return { type: wb.outputFormat, jobId };
        }
        if (job.status === 'failed') {
          throw new Error(job.errorMessage || '작업 실패');
        }
      }
      throw new Error('작업이 시간 내 완료되지 않음 (5분 초과)');
    }
  };

  const handleRun = async () => {
    if (!pipeline || pipeline.steps.length === 0) return;
    if (!initialPrompt.trim()) {
      toast.error('첫 단계의 입력 프롬프트를 입력해 주세요.');
      return;
    }
    setRunning(true);
    let prevOutput = null;
    const newStates = pipeline.steps.map(() => ({ status: 'pending', output: null, error: null }));
    setStepStates(newStates);

    for (let i = 0; i < pipeline.steps.length; i++) {
      newStates[i] = { ...newStates[i], status: 'running' };
      setStepStates([...newStates]);
      try {
        const stepAutoInject = i === 0 ? false : (pipeline.steps[i].autoInject !== false);
        const inputPrev = stepAutoInject ? prevOutput : null;
        const result = await runStep(i, inputPrev);
        newStates[i] = { status: 'done', output: result, error: null };
        setStepStates([...newStates]);
        prevOutput = result;
      } catch (err) {
        newStates[i] = { status: 'failed', output: null, error: err.response?.data?.message || err.message };
        setStepStates([...newStates]);
        // 나머지 단계는 skipped
        for (let j = i + 1; j < pipeline.steps.length; j++) {
          newStates[j] = { ...newStates[j], status: 'skipped' };
        }
        setStepStates([...newStates]);
        toast.error(`${i + 1}단계 실패: ${err.message}`);
        break;
      }
    }
    setRunning(false);
  };

  if (isLoading || !pipeline) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <Typography variant="h6">{pipeline.name} 실행</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={running}>닫기</Button>
      </Box>

      <Stack spacing={2}>
        <Alert severity="info">
          첫 단계의 입력 프롬프트를 입력하고 "시작" 을 누르세요. 각 단계가 순차로 실행되며,
          이전 단계의 결과가 다음 단계의 입력에 자동으로 매핑됩니다.
          {' 각 LLM 단계는 빌더에서 연결한 사전 컨텍스트 / 시스템 프롬프트 문서를 사용합니다.'}
          {' '}이 페이지를 떠나면 실행이 중단됩니다.
        </Alert>

        <TextField
          size="small"
          label="초기 입력 프롬프트"
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          disabled={running}
        />

        <Box>
          <Button
            variant="contained"
            color="success"
            startIcon={running ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleRun}
            disabled={running || !initialPrompt.trim()}
          >
            {running ? '실행 중...' : '시작'}
          </Button>
        </Box>

        <Stepper activeStep={stepStates.findIndex((s) => s.status === 'running')} orientation="vertical">
          {(pipeline.steps || []).map((step, idx) => {
            const state = stepStates[idx] || { status: 'pending' };
            return (
              <Step key={idx} active expanded={state.status !== 'pending'}>
                <StepLabel
                  icon={
                    state.status === 'done' ? <CheckCircleIcon color="success" />
                    : state.status === 'failed' ? <ErrorIcon color="error" />
                    : state.status === 'running' ? <CircularProgress size={20} />
                    : state.status === 'skipped' ? <StopIcon color="disabled" />
                    : <Chip label={idx + 1} size="small" />
                  }
                >
                  <Typography variant="subtitle2">
                    {step.workboardId?.name || '(작업판)'}
                  </Typography>
                  {step.workboardId?.description && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'pre-wrap' }}>
                      {step.workboardId.description}
                    </Typography>
                  )}
                  {step.workboardId?.outputFormat && (
                    <Typography variant="caption" color="text.secondary">
                      출력: {step.workboardId.outputFormat}
                    </Typography>
                  )}
                </StepLabel>
                <StepContent>
                  {step.note && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                      {step.note}
                    </Typography>
                  )}
                  {state.status === 'done' && state.output && (
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        결과 ({state.output.type})
                      </Typography>
                      {state.output.type === 'text' && (
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                          {state.output.value}
                        </Typography>
                      )}
                      {state.output.type === 'image' && (
                        <Typography variant="caption" color="text.secondary">
                          이미지 {state.output.imageIds?.length || 0}개 생성됨
                        </Typography>
                      )}
                    </Paper>
                  )}
                  {state.status === 'failed' && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                      {state.error}
                    </Alert>
                  )}
                  {state.status === 'skipped' && (
                    <Typography variant="caption" color="text.secondary">건너뜀</Typography>
                  )}
                </StepContent>
              </Step>
            );
          })}
        </Stepper>
      </Stack>
    </Box>
  );
}

export default PipelinePanel;
