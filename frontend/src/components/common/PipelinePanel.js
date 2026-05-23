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
import { pipelineAPI, pipelineRunAPI, projectAPI, jobAPI, tagAPI, textAPI, workboardAPI } from '../../services/api';

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

  // 전체 작업판 목록 — 단계 picker 가 프로젝트 미가입 작업판도 보여줘야 함 (#407).
  const { data: wbData } = useQuery(
    ['allWorkboards'],
    () => workboardAPI.getAll(),
  );
  const allWorkboards = wbData?.data?.workboards || wbData?.data?.data?.workboards || [];

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
          {allWorkboards.length === 0 ? (
            <Alert severity="info">
              사용 가능한 작업판이 없습니다.
            </Alert>
          ) : (
            <Stack spacing={1}>
              {allWorkboards.map((wb) => (
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
// 파이프라인 실행 (백엔드 오케스트레이션, #407).
// "시작" → POST run → runId 받음 → polling 으로 상태 갱신. 페이지 떠나도 백엔드는 계속 실행.
function PipelineRunner({ projectId, pipelineId, onClose }) {
  const queryClient = useQueryClient();
  const { data: pipelineData, isLoading } = useQuery(
    ['pipeline', projectId, pipelineId],
    () => pipelineAPI.get(projectId, pipelineId),
    { enabled: !!pipelineId }
  );
  const pipeline = pipelineData?.data?.data?.pipeline;

  const [initialPrompt, setInitialPrompt] = useState('');
  const [runId, setRunId] = useState(null);

  // 활성 run 의 상태 polling
  const { data: runData } = useQuery(
    ['pipelineRun', projectId, runId],
    () => pipelineRunAPI.get(projectId, runId),
    {
      enabled: !!runId,
      refetchInterval: (data) => {
        const run = data?.data?.data?.run;
        if (!run) return 3000;
        if (run.status === 'pending' || run.status === 'running') return 2000;
        return false; // 종료된 run 은 더 이상 polling 안 함
      },
    }
  );
  const run = runData?.data?.data?.run;

  const startMutation = useMutation(
    (payload) => pipelineRunAPI.start(projectId, payload),
    {
      onSuccess: (response) => {
        const newRunId = response.data?.data?.run?._id;
        if (newRunId) {
          setRunId(newRunId);
          queryClient.invalidateQueries(['pipelineRuns', projectId]);
        }
      },
      onError: (err) => toast.error(err.response?.data?.message || '시작 실패'),
    }
  );

  const retryMutation = useMutation(
    ({ fromStep }) => pipelineRunAPI.retry(projectId, runId, { fromStep }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pipelineRun', projectId, runId]);
        queryClient.invalidateQueries(['pipelineRuns', projectId]);
        toast.success('재시작 요청됨');
      },
      onError: (err) => toast.error(err.response?.data?.message || '재시작 실패'),
    }
  );

  const handleStart = () => {
    if (!initialPrompt.trim()) {
      toast.error('첫 단계의 입력 프롬프트를 입력해 주세요.');
      return;
    }
    startMutation.mutate({ pipelineId, initialPrompt });
  };

  if (isLoading || !pipeline) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  const isActive = run && (run.status === 'pending' || run.status === 'running');
  const isCompleted = run && run.status === 'completed';
  const isFailed = run && run.status === 'failed';
  const firstFailedIdx = run ? (run.steps || []).findIndex((s) => s.status === 'failed') : -1;

  return (
    <Box sx={{ mt: 2 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <Typography variant="h6">{pipeline.name} 실행</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>닫기</Button>
      </Box>

      <Stack spacing={2}>
        <Alert severity="info">
          첫 단계의 입력 프롬프트를 입력하고 "시작" 을 누르세요.
          실행은 백엔드 백그라운드에서 진행되므로 페이지를 떠나도 계속됩니다 — 파이프라인 히스토리 탭에서 결과 / 재실행 가능.
          {' 각 LLM 단계는 빌더에서 연결한 사전 컨텍스트 / 시스템 프롬프트 문서를 사용합니다.'}
        </Alert>

        <TextField
          size="small"
          label="초기 입력 프롬프트"
          value={initialPrompt}
          onChange={(e) => setInitialPrompt(e.target.value)}
          multiline
          minRows={2}
          fullWidth
          disabled={isActive || !!runId}
        />

        <Box display="flex" gap={1}>
          {!runId && (
            <Button
              variant="contained"
              color="success"
              startIcon={startMutation.isLoading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart}
              disabled={startMutation.isLoading || !initialPrompt.trim()}
            >
              시작
            </Button>
          )}
          {runId && isFailed && firstFailedIdx >= 0 && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<PlayArrowIcon />}
              onClick={() => retryMutation.mutate({ fromStep: firstFailedIdx })}
              disabled={retryMutation.isLoading}
            >
              {firstFailedIdx + 1}단계부터 재시작
            </Button>
          )}
          {runId && isCompleted && (
            <Button
              variant="outlined"
              onClick={() => { setRunId(null); setInitialPrompt(''); }}
            >
              새 실행
            </Button>
          )}
          {runId && (
            <Chip
              label={run?.status === 'pending' ? '대기' : run?.status === 'running' ? '진행 중' : run?.status === 'completed' ? '완료' : run?.status === 'failed' ? '실패' : run?.status}
              color={run?.status === 'completed' ? 'success' : run?.status === 'failed' ? 'error' : 'default'}
            />
          )}
        </Box>

        {run && (
          <Stepper activeStep={(run.steps || []).findIndex((s) => s.status === 'running')} orientation="vertical">
            {(pipeline.steps || []).map((step, idx) => {
              const runStep = run.steps?.[idx] || { status: 'pending' };
              return (
                <Step key={idx} active expanded={runStep.status !== 'pending'}>
                  <StepLabel
                    icon={
                      runStep.status === 'completed' ? <CheckCircleIcon color="success" />
                      : runStep.status === 'failed' ? <ErrorIcon color="error" />
                      : runStep.status === 'running' ? <CircularProgress size={20} />
                      : runStep.status === 'skipped' ? <StopIcon color="disabled" />
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
                    {runStep.status === 'completed' && runStep.output && (
                      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                          결과 ({runStep.output.type})
                        </Typography>
                        {runStep.output.type === 'text' && (
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                            {runStep.output.value}
                          </Typography>
                        )}
                        {runStep.output.type === 'image' && (
                          <Typography variant="caption" color="text.secondary">
                            이미지 {runStep.output.imageIds?.length || 0}개 생성됨
                          </Typography>
                        )}
                      </Paper>
                    )}
                    {runStep.status === 'failed' && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        {runStep.error?.message || '실패'}
                      </Alert>
                    )}
                    {runStep.status === 'skipped' && (
                      <Typography variant="caption" color="text.secondary">건너뜀</Typography>
                    )}
                  </StepContent>
                </Step>
              );
            })}
          </Stepper>
        )}
      </Stack>
    </Box>
  );
}

// 파이프라인 히스토리 패널 (#407). 프로젝트 상세 탭에서 사용.
export function PipelineHistoryPanel({ projectId }) {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState(null);

  const { data, isLoading } = useQuery(
    ['pipelineRuns', projectId],
    () => pipelineRunAPI.list(projectId, { limit: 50 }),
    { refetchInterval: 5000 }
  );
  const runs = data?.data?.data?.runs || [];

  const { data: detailData } = useQuery(
    ['pipelineRun', projectId, selectedRunId],
    () => pipelineRunAPI.get(projectId, selectedRunId),
    {
      enabled: !!selectedRunId,
      refetchInterval: (data) => {
        const run = data?.data?.data?.run;
        if (!run) return 3000;
        return (run.status === 'pending' || run.status === 'running') ? 2000 : false;
      },
    }
  );
  const detail = detailData?.data?.data?.run;

  const retryMutation = useMutation(
    ({ runId, fromStep }) => pipelineRunAPI.retry(projectId, runId, { fromStep }),
    {
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries(['pipelineRuns', projectId]);
        queryClient.invalidateQueries(['pipelineRun', projectId, vars.runId]);
        toast.success('재시작 요청됨');
      },
      onError: (err) => toast.error(err.response?.data?.message || '재시작 실패'),
    }
  );

  const deleteMutation = useMutation(
    (id) => pipelineRunAPI.delete(projectId, id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pipelineRuns', projectId]);
        if (selectedRunId) setSelectedRunId(null);
        toast.success('삭제되었습니다.');
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'),
    }
  );

  if (selectedRunId && detail) {
    const firstFailedIdx = (detail.steps || []).findIndex((s) => s.status === 'failed');
    return (
      <Box sx={{ mt: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Button onClick={() => setSelectedRunId(null)}>← 목록</Button>
          <Typography variant="h6">{detail.pipelineId?.name || '(파이프라인)'}</Typography>
          <Chip
            label={detail.status === 'pending' ? '대기' : detail.status === 'running' ? '진행 중' : detail.status === 'completed' ? '완료' : detail.status === 'failed' ? '실패' : detail.status}
            color={detail.status === 'completed' ? 'success' : detail.status === 'failed' ? 'error' : 'default'}
          />
          <Box sx={{ flexGrow: 1 }} />
          {detail.status === 'failed' && firstFailedIdx >= 0 && (
            <Button
              variant="contained"
              color="warning"
              startIcon={<PlayArrowIcon />}
              onClick={() => retryMutation.mutate({ runId: selectedRunId, fromStep: firstFailedIdx })}
              disabled={retryMutation.isLoading}
            >
              {firstFailedIdx + 1}단계부터 재시작
            </Button>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {detail.startedAt ? `시작: ${new Date(detail.startedAt).toLocaleString('ko-KR')}` : ''}
          {detail.completedAt ? ` · 종료: ${new Date(detail.completedAt).toLocaleString('ko-KR')}` : ''}
          {detail.triggerCount > 1 ? ` · 재시도 ${detail.triggerCount - 1}회` : ''}
        </Typography>
        {detail.initialPrompt && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'grey.50' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              초기 프롬프트
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {detail.initialPrompt}
            </Typography>
          </Paper>
        )}
        <Stepper activeStep={(detail.steps || []).findIndex((s) => s.status === 'running')} orientation="vertical">
          {(detail.steps || []).map((runStep, idx) => (
            <Step key={idx} active expanded>
              <StepLabel
                icon={
                  runStep.status === 'completed' ? <CheckCircleIcon color="success" />
                  : runStep.status === 'failed' ? <ErrorIcon color="error" />
                  : runStep.status === 'running' ? <CircularProgress size={20} />
                  : runStep.status === 'skipped' ? <StopIcon color="disabled" />
                  : <Chip label={idx + 1} size="small" />
                }
              >
                <Typography variant="subtitle2">
                  {runStep.workboardId?.name || '(작업판)'}
                </Typography>
                {runStep.workboardId?.outputFormat && (
                  <Typography variant="caption" color="text.secondary">
                    출력: {runStep.workboardId.outputFormat}
                  </Typography>
                )}
              </StepLabel>
              <StepContent>
                {runStep.status === 'completed' && runStep.output && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      결과 ({runStep.output.type})
                    </Typography>
                    {runStep.output.type === 'text' && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                        {runStep.output.value}
                      </Typography>
                    )}
                    {runStep.output.type === 'image' && (
                      <Typography variant="caption" color="text.secondary">
                        이미지 {runStep.output.imageIds?.length || 0}개 생성됨
                      </Typography>
                    )}
                  </Paper>
                )}
                {runStep.status === 'failed' && (
                  <Alert severity="error">{runStep.error?.message || '실패'}</Alert>
                )}
                {runStep.status === 'skipped' && (
                  <Typography variant="caption" color="text.secondary">건너뜀</Typography>
                )}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : runs.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            아직 실행 기록이 없습니다. 파이프라인 탭에서 "실행" 으로 시작하세요.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {runs.map((r) => (
            <Card key={r._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Box display="flex" alignItems="center" gap={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {r.pipelineId?.name || '(파이프라인)'}
                  </Typography>
                  <Chip
                    label={r.status === 'pending' ? '대기' : r.status === 'running' ? '진행 중' : r.status === 'completed' ? '완료' : r.status === 'failed' ? '실패' : r.status}
                    size="small"
                    color={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'error' : r.status === 'running' ? 'primary' : 'default'}
                  />
                  {r.triggerCount > 1 && (
                    <Chip label={`재시도 ${r.triggerCount - 1}회`} size="small" variant="outlined" />
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(r.createdAt).toLocaleString('ko-KR')}
                  </Typography>
                </Box>
                {r.initialPrompt && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {r.initialPrompt}
                  </Typography>
                )}
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                  {(r.steps || []).map((s, idx) => (
                    <Chip
                      key={idx}
                      label={idx + 1}
                      size="small"
                      color={
                        s.status === 'completed' ? 'success'
                        : s.status === 'failed' ? 'error'
                        : s.status === 'running' ? 'primary'
                        : s.status === 'skipped' ? 'default'
                        : 'default'
                      }
                      variant={s.status === 'pending' ? 'outlined' : 'filled'}
                      sx={{ height: 22, minWidth: 22 }}
                    />
                  ))}
                </Stack>
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={() => setSelectedRunId(r._id)}>상세</Button>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    if (window.confirm('이 실행 기록을 삭제하시겠어요?')) deleteMutation.mutate(r._id);
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

export default PipelinePanel;
