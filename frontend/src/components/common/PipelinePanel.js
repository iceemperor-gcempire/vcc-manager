import React, { useState, useMemo } from 'react';
import { alpha } from '@mui/material/styles';
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
  LinearProgress,
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
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowDownward as ArrowDownwardIconConnector,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Stop as StopIcon,
  AccountTree as PipelineIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import MetadataFieldInput from './MetadataFieldInput';
import ImageViewerDialog from './ImageViewerDialog';
import PromptDataPickerDialog from './PromptDataPickerDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { pipelineAPI, pipelineRunAPI, projectAPI, jobAPI, tagAPI, textAPI, workboardAPI, promptDataAPI } from '../../services/api';
import { MONO } from '../../theme';

// 파이프라인 step 의 이미지 결과 — 썸네일 그리드 + 클릭 시 큰 보기 (#409).
// runStep.imageGenerationJobId 가 populate 되어 있어야 함 (백엔드 단일 GET 만 populate).
// 미 populate (e.g. 진행 중인 step) 시 fallback 으로 "이미지 N개 생성됨" 텍스트만.
function StepImageThumbnails({ runStep }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);
  const images = runStep?.imageGenerationJobId?.resultImages || [];
  if (images.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        이미지 {runStep?.output?.imageIds?.length || 0}개 생성됨
      </Typography>
    );
  }
  return (
    <>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {images.map((img, idx) => (
          <Box
            key={img._id || idx}
            onClick={() => { setViewerIdx(idx); setViewerOpen(true); }}
            sx={{
              width: 72, height: 72, borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
              border: 1, borderColor: 'divider',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <Box
              component="img"
              src={img.url}
              alt={img.originalName || `이미지 ${idx + 1}`}
              loading="lazy"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        ))}
      </Stack>
      <ImageViewerDialog
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={images}
        selectedIndex={viewerIdx}
        title="파이프라인 결과"
      />
    </>
  );
}

// 프로젝트 종속 작업판 파이프라인 (#397).
// 단계: 목록 → 빌더 → 실행. 모두 한 패널에서.
function PipelinePanel({ projectId }) {
  const [view, setView] = useState('list'); // list | builder | runner
  const [editingPipelineId, setEditingPipelineId] = useState(null);
  const [runningPipelineId, setRunningPipelineId] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['pipelines', projectId], queryFn: () => pipelineAPI.list(projectId), enabled: !!projectId });
  const pipelines = data?.data?.data?.pipelines || [];

  const deleteMutation = useMutation({ mutationFn: (pid) => pipelineAPI.delete(projectId, pid),
      onSuccess: () => {
        toast.success('파이프라인이 삭제되었습니다.');
        queryClient.invalidateQueries({ queryKey: ['pipelines', projectId] });
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'), });

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, mb: 3.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
          작업판 A → B → C 직선 실행. 단계의 출력 타입이 다음 단계의 입력 타입과 일치하면 자동 주입됩니다.
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setEditingPipelineId(null); setView('builder'); }}
        >
          새 파이프라인
        </Button>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
      ) : pipelines.length === 0 ? (
        <Box
          onClick={() => { setEditingPipelineId(null); setView('builder'); }}
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
            cursor: 'pointer',
            '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' },
          }}
        >
          <AddIcon sx={{ fontSize: 28, mb: 1 }} />
          <Typography variant="body2">
            새 파이프라인을 추가해 작업판을 순서대로 실행하세요.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {pipelines.map((p) => (
            <PipelineCard
              key={p._id}
              pipeline={p}
              onRun={() => { setRunningPipelineId(p._id); setView('runner'); }}
              onEdit={() => { setEditingPipelineId(p._id); setView('builder'); }}
              onDelete={() => {
                if (window.confirm(`"${p.name}" 파이프라인을 삭제하시겠습니까?`)) {
                  deleteMutation.mutate(p._id);
                }
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

// 파이프라인 카드 (Phase 5a 후속) — mockup PipelinesTabContent 의 카드 패턴.
// 헤더: 아이콘 + 이름 + 단계 chip + 단계 path (mono) + 데스크탑 액션
// 본문: 단계 horizontal pill 행 (작업판명 위주, 간결)
function PipelineCard({ pipeline, onRun, onEdit, onDelete }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const steps = pipeline.steps || [];
  const stepNames = steps.map((s) => s.workboardId?.name || '?');
  const pathText = stepNames.length > 0 ? stepNames.join(' → ') : '단계 없음';

  return (
    <Card variant="outlined">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            color: 'primary.main',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <PipelineIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{pipeline.name}</Typography>
            <Chip label={`${steps.length}단계`} variant="outlined" />
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{
                fontFamily: MONO,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: { xs: 'none', sm: 'inline' },
                flexShrink: 1,
              }}
              title={pathText}
            >
              {pathText}
            </Typography>
          </Box>
          {pipeline.description && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {pipeline.description}
            </Typography>
          )}
        </Box>
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              onClick={onRun}
              disabled={steps.length === 0}
            >
              실행
            </Button>
            <Button startIcon={<EditIcon />} onClick={onEdit}>편집</Button>
            <IconButton color="error" onClick={onDelete} title="삭제">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* 단계 horizontal pill 행 */}
      {steps.length > 0 && (
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto' }}>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1.5,
                  bgcolor: 'action.hover',
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: s.workboardId?.isActive === false ? 'warning.main' : 'primary.main',
                    color: 'primary.contrastText',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: MONO,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', whiteSpace: 'nowrap' }}>
                    {s.workboardId?.name || '(삭제됨)'}
                  </Typography>
                  {s.workboardId?.outputFormat && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10, fontFamily: MONO }}>
                      out: {s.workboardId.outputFormat}
                    </Typography>
                  )}
                </Box>
              </Box>
              {i < steps.length - 1 && (
                <ArrowForwardIcon sx={{ color: 'text.tertiary', flexShrink: 0 }} fontSize="small" />
              )}
            </React.Fragment>
          ))}
        </Box>
      )}

      {isMobile && (
        <CardActions sx={{ pt: 0, justifyContent: 'flex-end', borderTop: 1, borderColor: 'divider' }}>
          <Button
            color="success"
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={onRun}
            disabled={steps.length === 0}
          >
            실행
          </Button>
          <Button startIcon={<EditIcon />} onClick={onEdit}>편집</Button>
          <IconButton color="error" onClick={onDelete} title="삭제">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </CardActions>
      )}
    </Card>
  );
}

// 파이프라인 빌더의 lane 레이아웃 (Phase 5d).
// 데스크탑: 가로 스크롤 lane (카드 320px 고정 너비) + 카드 사이 화살표 connector.
// 모바일: 세로 스택 (full-width) + 카드 사이 아래 방향 화살표.
function PipelineLane({ steps, setSteps, moveStep, removeStep, onOpenInputs, onOpenDocs, onAdd, selectedStepIdx = -1, onSelectStep, projectId }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'flex-start',
        gap: 0,
        overflowX: isMobile ? 'visible' : 'auto',
        // 카드 그림자가 잘리지 않도록 padding
        py: 1,
        px: isMobile ? 0 : 0.5,
      }}
    >
      {steps.map((s, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && (
            <LaneConnector
              isMobile={isMobile}
              prevOutput={steps[idx - 1].workboard?.outputFormat}
              autoInject={s.autoInject !== false}
            />
          )}
          <StepLaneCard
            step={s}
            index={idx}
            isLast={idx === steps.length - 1}
            isMobile={isMobile}
            isSelected={selectedStepIdx === idx}
            projectId={projectId}
            onSelect={() => onSelectStep && onSelectStep(selectedStepIdx === idx ? -1 : idx)}
            onOpenInputs={() => onOpenInputs(idx)}
            onOpenDocs={() => onOpenDocs(idx)}
            onMovePrev={() => moveStep(idx, -1)}
            onMoveNext={() => moveStep(idx, 1)}
            onDelete={() => removeStep(idx)}
            onChangeNote={(note) => {
              const next = [...steps];
              next[idx] = { ...steps[idx], note };
              setSteps(next);
            }}
            onChangeInputs={(inputs) => {
              const next = [...steps];
              next[idx] = { ...steps[idx], inputs };
              setSteps(next);
            }}
            onToggleAutoInject={(checked) => {
              const next = [...steps];
              next[idx] = { ...steps[idx], autoInject: checked };
              setSteps(next);
            }}
          />
        </React.Fragment>
      ))}
      <AddStepCard isMobile={isMobile} onAdd={onAdd} />
    </Box>
  );
}

function StepLaneCard({
  step,
  index,
  isLast,
  isMobile,
  isSelected,
  onSelect,
  onOpenInputs,
  onOpenDocs,
  onMovePrev,
  onMoveNext,
  onDelete,
  onChangeNote,
  onChangeInputs,
  onToggleAutoInject,
  projectId,
}) {
  const inputsCount = Object.keys(step.inputs || {}).filter((k) => step.inputs[k] !== '' && step.inputs[k] != null).length;
  const docsCount = (step.contextDocIds?.length || 0) + (step.systemPromptDocId ? 1 : 0);
  const customFieldCount = (step.workboard?.additionalInputFields || []).filter((f) => f.name !== 'conversation_mode').length;
  const isImageOrVideoStep = step.workboard?.outputFormat === 'image' || step.workboard?.outputFormat === 'video';
  // image/video step 은 customField 가 없더라도 explicit prompt/negativePrompt/seed 폼을 보여줘야 함 (#431)
  const inputFieldCount = customFieldCount + (isImageOrVideoStep ? 3 : 0);
  return (
    <Paper
      variant="outlined"
      onClick={onSelect}
      sx={{
        width: isMobile ? '100%' : 320,
        flex: isMobile ? '0 0 auto' : '0 0 320px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderWidth: isSelected ? 2 : 1,
        bgcolor: isSelected ? (t) => alpha(t.palette.primary.main, 0.04) : 'background.paper',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 120ms, background-color 120ms',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: MONO,
          }}
        >
          {index + 1}
        </Box>
        {step.workboard?.outputFormat && (
          <Chip
            label={`out: ${step.workboard.outputFormat}`}
            variant="outlined"
            sx={{ fontFamily: MONO, letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton
          onClick={(e) => { e.stopPropagation(); onMovePrev(); }}
          disabled={index === 0}
          title={isMobile ? '위로 이동' : '앞으로 이동'}
        >
          {isMobile ? <ArrowUpward fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
        <IconButton
          onClick={(e) => { e.stopPropagation(); onMoveNext(); }}
          disabled={isLast}
          title={isMobile ? '아래로 이동' : '뒤로 이동'}
        >
          {isMobile ? <ArrowDownward fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Box sx={{ px: 2, py: 1.5, flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
          {step.workboard?.name || '(이름 불러오는 중)'}
        </Typography>
        {step.workboard?.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {step.workboard.description}
          </Typography>
        )}

        {index > 0 && (
          <FormControlLabel
            sx={{ mt: 1, ml: 0 }}
            onClick={(e) => e.stopPropagation()}
            control={
              <Switch
                size="small"
                checked={step.autoInject !== false}
                onChange={(e) => onToggleAutoInject(e.target.checked)}
              />
            }
            label={<Typography variant="caption">이전 결과 자동 주입</Typography>}
          />
        )}

        <TextField
          fullWidth
          placeholder="이 단계에 대한 메모 (선택)"
          value={step.note || ''}
          onChange={(e) => onChangeNote(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          multiline
          maxRows={3}
          inputProps={{ maxLength: 500 }}
          sx={{ mt: 1.5 }}
        />
      </Box>

      {/* 인라인 expand 패널 (Phase 5d 후속 #430) — 카드 선택 시 표시 */}
      {isSelected && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{ px: 2, py: 2, borderTop: '1px dashed', borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.03) }}
        >
          {inputFieldCount > 0 ? (
            <>
              <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                사전 입력
              </Typography>
              <StepInputsForm
                workboard={step.workboard}
                values={step.inputs || {}}
                onChange={onChangeInputs}
                projectId={projectId}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, fontStyle: 'italic' }}>
                자동 주입 ON 인 경우 매칭 필드는 runtime 에 덮어쓰임됩니다.
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              이 단계는 사전 입력 필드가 없습니다.
            </Typography>
          )}
          <Box sx={{ mt: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              컨텍스트 문서
            </Typography>
            <Chip label={`${step.contextDocIds?.length || 0}개`} variant="outlined" />
            {step.systemPromptDocId && <Chip label="시스템 프롬프트 1" color="info" />}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {isMobile ? '하단 "문서" 버튼으로 편집' : '좌측 팔레트에서 문서 클릭으로 추가 / 제거'}
          </Typography>
        </Box>
      )}

      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          display: 'flex',
          gap: 1,
          px: 2,
          py: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit',
        }}
      >
        {/* 입력 설정 button: 선택 안 됐을 때만 (선택 시 form 이 인라인 노출) */}
        {!isSelected && (
          <Button
            fullWidth
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={onOpenInputs}
            sx={{ justifyContent: 'flex-start', flex: 1 }}
          >
            입력 설정
            {inputsCount > 0 && <Chip label={inputsCount} sx={{ ml: 'auto', height: 18 }} />}
          </Button>
        )}
        {/* 문서 button: 모바일 (팔레트 미사용) 에서만 — 데스크탑은 팔레트로 통일 */}
        {(isMobile || !isSelected) && (
          <Button
            fullWidth
            variant="outlined"
            onClick={onOpenDocs}
            sx={{ justifyContent: 'flex-start', flex: 1 }}
          >
            문서
            {docsCount > 0 && <Chip label={docsCount} sx={{ ml: 'auto', height: 18 }} />}
          </Button>
        )}
        {isSelected && !isMobile && (
          <Box sx={{ flex: 1, alignSelf: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              다른 카드 클릭으로 선택 해제
            </Typography>
          </Box>
        )}
        <IconButton color="error" onClick={onDelete} title="단계 삭제">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

function LaneConnector({ isMobile, prevOutput, autoInject }) {
  const ConnectorIcon = isMobile ? ArrowDownwardIconConnector : ArrowForwardIcon;
  return (
    <Box
      sx={{
        flex: isMobile ? '0 0 auto' : '0 0 80px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        py: isMobile ? 1.5 : 0,
        minHeight: isMobile ? 0 : 120,
        color: autoInject ? 'success.main' : 'text.disabled',
      }}
    >
      <ConnectorIcon fontSize="small" />
      {prevOutput && (
        <Typography
          variant="caption"
          sx={{ fontFamily: MONO, fontSize: 10, color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          {prevOutput}
        </Typography>
      )}
    </Box>
  );
}

function AddStepCard({ isMobile, onAdd }) {
  return (
    <Box
      sx={{
        ml: isMobile ? 0 : 2,
        mt: isMobile ? 2 : 0,
        width: isMobile ? '100%' : 200,
        flex: isMobile ? '0 0 auto' : '0 0 200px',
        minHeight: 120,
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 2,
        px: 2,
        cursor: 'pointer',
        color: 'text.secondary',
        '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' },
      }}
      onClick={onAdd}
    >
      <AddIcon />
      <Typography variant="body2" sx={{ fontWeight: 500 }}>새 단계 추가</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', lineHeight: 1.5 }}>
        작업판을 골라 마지막 단계 출력에 연결
      </Typography>
    </Box>
  );
}

// 컨텍스트 문서 팔레트 (Phase 5d 후속) — 좌측 사이드, 데스크탑만.
// 프로젝트의 worldview / system prompt 태그 docs 를 보여주고, 클릭으로
// 현재 선택된 단계에 add/toggle. drag-drop 라이브러리 없이 click-to-add 패턴.
function ContextDocPalette({ projectId, selectedStepIdx, selectedStep, onAddDoc }) {
  const { data: wvTagData } = useQuery({ queryKey: ['worldviewTag'], queryFn: () => tagAPI.getWorldview(), staleTime: 60_000 });
  const { data: spTagData } = useQuery({ queryKey: ['systemPromptTag'], queryFn: () => tagAPI.getSystemPrompt(), staleTime: 60_000 });
  const { data: projectData } = useQuery({ queryKey: ['project', projectId], queryFn: () => projectAPI.getById(projectId), enabled: !!projectId, staleTime: 60_000 });
  const worldviewTag = wvTagData?.data?.tag;
  const systemPromptTag = spTagData?.data?.tag;
  const projectTag = projectData?.data?.data?.project?.tagId;

  const { data: wvDocsData } = useQuery({ queryKey: ['paletteWvDocs', projectId, worldviewTag?._id], queryFn: () => textAPI.getUploaded({ tags: [projectTag?._id, worldviewTag?._id].filter(Boolean).join(','), limit: 50 }), enabled: !!projectTag && !!worldviewTag, staleTime: 60_000 });
  const { data: spDocsData } = useQuery({ queryKey: ['paletteSpDocs', projectId, systemPromptTag?._id], queryFn: () => textAPI.getUploaded({ tags: [projectTag?._id, systemPromptTag?._id].filter(Boolean).join(','), limit: 50 }), enabled: !!projectTag && !!systemPromptTag, staleTime: 60_000 });
  // 백엔드 texts 라우트는 { success, data: { items, pagination } } shape
  const wvDocs = wvDocsData?.data?.data?.items || [];
  const spDocs = spDocsData?.data?.data?.items || [];

  const ctxIds = new Set(selectedStep?.contextDocIds || []);
  const spId = selectedStep?.systemPromptDocId;
  const helpText = selectedStepIdx < 0
    ? '단계 카드를 클릭해 선택한 뒤 문서를 추가하세요.'
    : '클릭하면 선택 단계에 추가/해제.';

  return (
    <Box sx={{ position: 'sticky', top: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined">
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
            세계관 문서 ({wvDocs.length})
          </Typography>
        </Box>
        {wvDocs.length === 0 ? (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              세계관 탭에서 문서를 추가하면 여기에 표시됩니다.
            </Typography>
          </Box>
        ) : (
          <PaletteDocList docs={wvDocs} selectedIds={ctxIds} disabled={selectedStepIdx < 0} onClickDoc={(id) => onAddDoc(selectedStepIdx, id, false)} />
        )}
      </Paper>

      <Paper variant="outlined">
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
            시스템 프롬프트 ({spDocs.length})
          </Typography>
        </Box>
        {spDocs.length === 0 ? (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              세계관 탭에서 \"시스템 프롬프트\" 타입 문서를 추가하면 표시됩니다.
            </Typography>
          </Box>
        ) : (
          <PaletteDocList
            docs={spDocs}
            selectedIds={spId ? new Set([spId]) : new Set()}
            disabled={selectedStepIdx < 0}
            onClickDoc={(id) => onAddDoc(selectedStepIdx, id, true)}
            singleSelect
          />
        )}
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, lineHeight: 1.5 }}>
        {helpText}
      </Typography>
    </Box>
  );
}

function PaletteDocList({ docs, selectedIds, disabled, onClickDoc, singleSelect }) {
  return (
    <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
      {docs.map((d) => {
        const active = selectedIds.has(d._id);
        return (
          <Box
            key={d._id}
            onClick={() => !disabled && onClickDoc(d._id)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.08) : 'transparent',
              '&:hover': disabled ? {} : { bgcolor: 'action.hover' },
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: active ? 600 : 500 }}>
                {d.title || '(제목 없음)'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO, fontSize: 10, display: 'block' }}>
                {(d.content || '').length.toLocaleString()}자
              </Typography>
            </Box>
            {active && (
              <Box component="span" sx={{ fontSize: 10, color: 'primary.main', fontWeight: 700, flexShrink: 0 }}>
                {singleSelect ? '✓' : '추가됨'}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// 파이프라인 진단 strip (Phase 5d 후속) — lane 하단에 배치.
// 단계 수 + 자동 주입 / 비활성 작업판 / 메모 누락 등 사용자 인지가 도움되는 상태를 한 줄로.
// 실제 type 호환 체크는 workboard 가 inputFormat 명시 안 해서 보류 — 현재는 autoInject 토글 / 비활성 / 메모 누락만 점검.
function PipelineDiagnosticStrip({ steps }) {
  const total = steps.length;
  const inactiveCount = steps.filter((s) => s.workboard?.isActive === false).length;
  const autoOffCount = steps.slice(1).filter((s) => s.autoInject === false).length;
  const flow = steps
    .map((s) => s.workboard?.outputFormat || '?')
    .filter(Boolean);
  const summaryPath = flow.length > 0 ? flow.join(' → ') : '';

  let severity = 'info';
  let icon = <CheckCircleIcon fontSize="small" />;
  let parts = [];

  if (inactiveCount > 0) {
    severity = 'warning';
    icon = <ErrorIcon fontSize="small" />;
    parts.push(<><strong>{inactiveCount}</strong>개 단계가 비활성 작업판</>);
  } else if (autoOffCount > 0) {
    severity = 'info';
    parts.push(<><strong>{autoOffCount}</strong>개 단계는 자동 주입 꺼짐 — 사전 입력 / 메모 확인 필요</>);
  } else {
    parts.push(<><strong>{total}개 단계</strong> · 모두 자동 주입 활성</>);
  }

  const palette = severity === 'warning' ? 'warning' : 'info';

  return (
    <Box
      sx={{
        mt: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: 1,
        border: 1,
        borderColor: (t) => alpha(t.palette[palette].main, 0.4),
        bgcolor: (t) => alpha(t.palette[palette].main, 0.06),
        color: `${palette}.dark`,
        fontSize: 13,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ color: `${palette}.main`, display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {parts.map((p, i) => (
          <Typography key={i} component="span" variant="body2" sx={{ color: 'inherit' }}>
            {i > 0 && ' · '}
            {p}
          </Typography>
        ))}
      </Box>
      {summaryPath && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: MONO,
            fontSize: 11,
            color: 'text.secondary',
            flexShrink: 0,
          }}
        >
          {summaryPath}
        </Typography>
      )}
    </Box>
  );
}

// 파이프라인 빌더 — 단계 목록 편집 (#397)
function PipelineBuilder({ projectId, pipelineId, onClose }) {
  const isNew = !pipelineId;
  const queryClient = useQueryClient();

  const { data: pipelineData, isLoading } = useQuery({ queryKey: ['pipeline', projectId, pipelineId], queryFn: () => pipelineAPI.get(projectId, pipelineId), enabled: !!pipelineId });
  const loaded = pipelineData?.data?.data?.pipeline;

  // 전체 작업판 목록 — 단계 picker 가 프로젝트 미가입 작업판도 보여줘야 함 (#407).
  const { data: wbData } = useQuery({ queryKey: ['allWorkboards'], queryFn: () => workboardAPI.getAll() });
  const allWorkboards = wbData?.data?.workboards || wbData?.data?.data?.workboards || [];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inputsDialogStepIdx, setInputsDialogStepIdx] = useState(-1);
  const [docsDialogStepIdx, setDocsDialogStepIdx] = useState(-1);
  // 5d 후속 — 컨텍스트 문서 팔레트의 클릭 타겟
  const [selectedStepIdx, setSelectedStepIdx] = useState(-1);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

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

  const saveMutation = useMutation({ mutationFn: (payload) => isNew
      ? pipelineAPI.create(projectId, payload)
      : pipelineAPI.update(projectId, pipelineId, payload),
      onSuccess: () => {
        toast.success('저장되었습니다.');
        // list + single 모두 invalidate — 재진입 시 stale cache 방지
        queryClient.invalidateQueries({ queryKey: ['pipelines', projectId] });
        if (pipelineId) {
          queryClient.invalidateQueries({ queryKey: ['pipeline', projectId, pipelineId] });
        }
        onClose();
      },
      onError: (err) => toast.error(err.response?.data?.message || '저장 실패'), });

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
    if (selectedStepIdx === idx) setSelectedStepIdx(-1);
    else if (selectedStepIdx > idx) setSelectedStepIdx(selectedStepIdx - 1);
  };

  // 5d 후속 — 팔레트에서 클릭한 문서를 현재 선택 단계에 추가
  const addDocToStep = (stepIdx, docId, isSystemPrompt) => {
    if (stepIdx < 0 || stepIdx >= steps.length) {
      toast.error('먼저 단계를 선택하세요.');
      return;
    }
    const next = [...steps];
    const s = { ...next[stepIdx] };
    if (isSystemPrompt) {
      if (s.systemPromptDocId === docId) {
        s.systemPromptDocId = null;
      } else {
        s.systemPromptDocId = docId;
      }
    } else {
      const ids = new Set(s.contextDocIds || []);
      if (ids.has(docId)) ids.delete(docId);
      else ids.add(docId);
      s.contextDocIds = Array.from(ids);
    }
    next[stepIdx] = s;
    setSteps(next);
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 4, mb: 4, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box display="flex" alignItems="center" gap={1.5} sx={{ flexWrap: 'wrap' }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              {isNew ? '새 파이프라인' : '파이프라인 편집'}
            </Typography>
            <Chip label={isNew ? '신규' : '편집 중'} color="primary" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            작업판을 왼쪽에서 오른쪽으로 연결합니다. 다음 단계의 입력이 이전 출력 타입과 같으면 자동으로 주입됩니다.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
          <Button onClick={onClose}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending}>저장</Button>
        </Box>
      </Box>

      <Stack spacing={3}>
        <TextField
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          inputProps={{ maxLength: 100 }}
          fullWidth
        />
        <TextField
          label="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          inputProps={{ maxLength: 500 }}
          multiline
          minRows={2}
          fullWidth
        />

        <Box>
          <Box display="flex" alignItems="center" mb={2}>
            <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
              단계 ({steps.length})
            </Typography>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={() => setPickerOpen(true)}>
              단계 추가
            </Button>
          </Box>
          {steps.length === 0 ? (
            <Alert severity="info">
              "단계 추가" 로 프로젝트 소속 작업판을 순서대로 등록하세요.
              먼저 프로젝트의 "작업판" 탭에서 사용할 작업판들을 추가해 두어야 합니다.
            </Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, gap: 3, alignItems: 'start' }}>
              {isDesktop ? (
                <ContextDocPalette
                  projectId={projectId}
                  selectedStepIdx={selectedStepIdx}
                  selectedStep={selectedStepIdx >= 0 ? steps[selectedStepIdx] : null}
                  onAddDoc={addDocToStep}
                />
              ) : <Box />}
              <Box sx={{ minWidth: 0 }}>
                <PipelineLane
                  steps={steps}
                  setSteps={setSteps}
                  moveStep={moveStep}
                  removeStep={removeStep}
                  onOpenInputs={setInputsDialogStepIdx}
                  onOpenDocs={setDocsDialogStepIdx}
                  onAdd={() => setPickerOpen(true)}
                  selectedStepIdx={selectedStepIdx}
                  onSelectStep={setSelectedStepIdx}
                  projectId={projectId}
                />
                <PipelineDiagnosticStrip steps={steps} />
              </Box>
            </Box>
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
                    {wb.outputFormat && <Chip label={wb.outputFormat} variant="outlined" />}
                    {wb.serverId?.name && <Chip label={wb.serverId.name} variant="outlined" />}
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

// StepInputsForm — workboard customField 들을 form 으로 렌더 (Phase 5d 후속, 인라인 expand 용).
// values 는 controlled — 부모가 onChange 마다 통째로 받음. 자동 주입 매칭 필드는
// runtime 에 덮어쓰일 수 있다는 안내 alert 포함.
// projectId 가 주어지면 "프롬프트 데이터 불러오기" 버튼 노출 (#431) — 작업판 PromptData
// 연계. customField 에 prompt / negativePrompt / seed 중 하나라도 있을 때만 활성화.
function StepInputsForm({ workboard, values, onChange, projectId }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  if (!workboard) return null;
  const fields = (workboard.additionalInputFields || []).filter((f) => f.name !== 'conversation_mode');
  const updateValue = (name, v) => onChange({ ...values, [name]: v });

  // PromptData prefill 가능 여부 — 작업판 outputFormat 기준.
  // 이미지/비디오 단계는 runImageStep 이 inputData.prompt / negativePrompt / seed 를 직접 읽음
  // (customField 가 아니라 implicit key). 텍스트 단계는 inputData.userPrompt 만 의미가 있고
  // 그마저도 step 0 에서는 initialPrompt 로, 이후는 prevOutput 으로 덮어쓰이므로 비활성.
  const isImageOrVideo = workboard.outputFormat === 'image' || workboard.outputFormat === 'video';
  const canLoadPromptData = !!projectId && isImageOrVideo;

  const handlePickPromptData = (promptData) => {
    const next = { ...values };
    ['prompt', 'negativePrompt', 'seed'].forEach((k) => {
      const v = promptData[k];
      if (v !== undefined && v !== null && v !== '') {
        next[k] = v;
      }
    });
    onChange(next);
    promptDataAPI.use(promptData._id).catch(() => {});
    toast.success(`"${promptData.name}" 불러옴`);
  };

  const renderField = (field) => {
    const value = values[field.name] ?? field.defaultValue ?? '';
    if (field.type === 'string') {
      return (
        <TextField
          fullWidth label={field.label} placeholder={field.placeholder}
          value={value} onChange={(e) => updateValue(field.name, e.target.value)}
          multiline={field.name.includes('prompt')} rows={field.name.includes('prompt') ? 2 : 1}
          helperText={field.description}
        />
      );
    }
    if (field.type === 'number') {
      return (
        <TextField fullWidth type="number" label={field.label} value={value}
          onChange={(e) => updateValue(field.name, e.target.value)} helperText={field.description}
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
      return (
        <TextField
          fullWidth select label={field.label} value={value || ''}
          onChange={(e) => updateValue(field.name, e.target.value)}
          SelectProps={{ native: true }} InputLabelProps={{ shrink: true }} helperText={field.description}
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
          workboardId={workboard._id}
          serverId={workboard?.serverId?._id || workboard?.serverId}
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

  const hasNothingToShow = fields.length === 0 && !isImageOrVideo;
  if (hasNothingToShow) {
    return <Alert severity="info">설정 가능한 입력 필드가 없습니다.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {projectId && (
        <Box>
          <Button
            variant="outlined"
            onClick={() => setPickerOpen(true)}
            disabled={!canLoadPromptData}
            title={canLoadPromptData
              ? '저장된 프롬프트 데이터에서 prompt / negativePrompt / seed 값을 가져옵니다'
              : '이미지 / 영상 작업판에서만 프롬프트 데이터를 불러올 수 있습니다'}
          >
            프롬프트 데이터 불러오기
          </Button>
        </Box>
      )}
      {/* image/video step 은 prompt/negativePrompt/seed 가 runtime implicit key 라
          customField 와 별개로 명시 렌더 (#431). 첫 step 의 prompt 는 실행 시 initialPrompt 로,
          이후 step 은 autoInject ON 이면 이전 결과로 덮어쓰임. seed / negativePrompt 는 보존. */}
      {isImageOrVideo && (
        <>
          <Box>
            <TextField
              fullWidth label="prompt" multiline rows={3}
              value={values.prompt ?? ''}
              onChange={(e) => updateValue('prompt', e.target.value)}
              helperText="첫 단계는 실행 시 initialPrompt 로, 이후 단계는 자동 주입 ON 이면 이전 결과로 덮어쓰입니다"
            />
          </Box>
          <Box>
            <TextField
              fullWidth label="negativePrompt" multiline rows={2}
              value={values.negativePrompt ?? ''}
              onChange={(e) => updateValue('negativePrompt', e.target.value)}
            />
          </Box>
          <Box>
            <TextField
              fullWidth type="number" label="seed"
              value={values.seed ?? ''}
              onChange={(e) => updateValue('seed', e.target.value === '' ? '' : Number(e.target.value))}
              helperText="비우면 매 실행마다 random"
            />
          </Box>
        </>
      )}
      {fields.map((field) => (
        <Box key={field.name}>{renderField(field)}</Box>
      ))}
      <PromptDataPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={projectId}
        onSelect={handlePickPromptData}
      />
    </Stack>
  );
}

// 파이프라인 단계의 사전 입력 설정 다이얼로그 (#397 후속). 인라인 expand 도입 후
// 거의 사용 안 됨 — 호환성 위해 유지. StepInputsForm 을 내부에 사용.
function StepInputsDialog({ open, step, onClose, onSave }) {
  const wb = step?.workboard;
  const [values, setValues] = useState({});

  React.useEffect(() => {
    if (step) {
      setValues(step.inputs || {});
    }
  }, [step]);

  if (!wb) return null;

  // conversation_mode 같은 admin-only customField 는 사전 입력에서 숨김 (old fallback path)
  const fields = (wb.additionalInputFields || []).filter((f) => f.name !== 'conversation_mode');

  const updateValue = (name, v) => setValues({ ...values, [name]: v });

  // 호환성 fallback 용 — 사용자가 dialog 통해 들어왔을 때만 호출됨
  const renderField = (field) => {
    const value = values[field.name] ?? field.defaultValue ?? '';

    if (field.type === 'string') {
      return (
        <TextField
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
  const { data: wvTagData } = useQuery({ queryKey: ['worldviewTag'], queryFn: () => tagAPI.getWorldview(), staleTime: 60_000 });
  const { data: spTagData } = useQuery({ queryKey: ['systemPromptTag'], queryFn: () => tagAPI.getSystemPrompt(), staleTime: 60_000 });
  const worldviewTag = wvTagData?.data?.tag;
  const systemPromptTag = spTagData?.data?.tag;

  // 프로젝트 정보 (project tagId 필요)
  const { data: projectData } = useQuery({ queryKey: ['project', projectId], queryFn: () => projectAPI.getById(projectId), enabled: !!projectId });
  const projectTagId = projectData?.data?.data?.project?.tagId?._id || projectData?.data?.data?.project?.tagId;

  // 프로젝트의 세계관 / 시스템 프롬프트 문서 목록 조회
  const { data: contextDocsData } = useQuery({ queryKey: ['projectContextDocs', projectId, projectTagId, worldviewTag?._id], queryFn: () => textAPI.getUploaded({ tags: [projectTagId, worldviewTag._id].join(','), limit: 100 }), enabled: !!(projectTagId && worldviewTag?._id && open) });
  const contextDocs = contextDocsData?.data?.data?.items || [];

  const { data: spDocsData } = useQuery({ queryKey: ['projectSystemPromptDocs', projectId, projectTagId, systemPromptTag?._id], queryFn: () => textAPI.getUploaded({ tags: [projectTagId, systemPromptTag._id].join(','), limit: 100 }), enabled: !!(projectTagId && systemPromptTag?._id && open) });
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
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { data: pipelineData, isLoading } = useQuery({ queryKey: ['pipeline', projectId, pipelineId], queryFn: () => pipelineAPI.get(projectId, pipelineId), enabled: !!pipelineId });
  const pipeline = pipelineData?.data?.data?.pipeline;

  // 사이드 레일용 — 같은 프로젝트의 최근 run 들 (Phase 5b 후속). client 에서 same-pipeline filter.
  const { data: recentRunsData } = useQuery({ queryKey: ['pipelineRuns', projectId], queryFn: () => pipelineRunAPI.list(projectId, { limit: 20 }), enabled: !!projectId, staleTime: 30_000 });
  const recentRuns = (recentRunsData?.data?.data?.runs || [])
    .filter((r) => (r.pipelineId?._id || r.pipelineId) === pipelineId)
    .slice(0, 6);

  const [initialPrompt, setInitialPrompt] = useState('');
  const [runId, setRunId] = useState(null);

  // 활성 run 의 상태 polling
  const { data: runData } = useQuery({ queryKey: ['pipelineRun', projectId, runId], queryFn: () => pipelineRunAPI.get(projectId, runId),
      enabled: !!runId,
      // v5: refetchInterval (query) 시그니처 (#526)
      refetchInterval: (query) => {
        const run = query.state.data?.data?.data?.run;
        if (!run) return 3000;
        if (run.status === 'pending' || run.status === 'running') return 2000;
        return false; // 종료된 run 은 더 이상 polling 안 함
      }, });
  const run = runData?.data?.data?.run;

  const startMutation = useMutation({ mutationFn: (payload) => pipelineRunAPI.start(projectId, payload),
      onSuccess: (response) => {
        const newRunId = response.data?.data?.run?._id;
        if (newRunId) {
          setRunId(newRunId);
          queryClient.invalidateQueries({ queryKey: ['pipelineRuns', projectId] });
        }
      },
      onError: (err) => toast.error(err.response?.data?.message || '시작 실패'), });

  const retryMutation = useMutation({ mutationFn: ({ fromStep }) => pipelineRunAPI.retry(projectId, runId, { fromStep }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['pipelineRun', projectId, runId] });
        queryClient.invalidateQueries({ queryKey: ['pipelineRuns', projectId] });
        toast.success('재시작 요청됨');
      },
      onError: (err) => toast.error(err.response?.data?.message || '재시작 실패'), });

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

  // 실행 진행도 — 완료 단계 / 전체 단계 (Phase 5b)
  const totalSteps = (pipeline.steps || []).length;
  const completedSteps = run ? (run.steps || []).filter((s) => s.status === 'completed').length : 0;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const runStatusLabel = run?.status === 'pending' ? '대기'
    : run?.status === 'running' ? '진행 중'
    : run?.status === 'completed' ? '완료'
    : run?.status === 'failed' ? '실패' : run?.status;
  const runStatusColor = run?.status === 'completed' ? 'success'
    : run?.status === 'failed' ? 'error'
    : run?.status === 'running' || run?.status === 'pending' ? 'info' : 'default';

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 4, mb: 2.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box display="flex" alignItems="center" gap={1.5} sx={{ flexWrap: 'wrap' }}>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
              {pipeline.name}
            </Typography>
            {run && <Chip label={runStatusLabel} color={runStatusColor} />}
          </Box>
          {run && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap', fontSize: 13, color: 'text.secondary' }}>
              <span>실행 ID</span>
              <Box component="code" sx={{ px: 1, py: 0.25, bgcolor: 'action.hover', borderRadius: 0.5, fontFamily: MONO, fontSize: 12, color: 'text.primary' }}>
                {String(run._id).slice(-8)}
              </Box>
              {run.startedAt && (
                <>
                  <Box component="span" sx={{ color: 'divider' }}>·</Box>
                  <span>시작 {new Date(run.startedAt).toLocaleString('ko-KR')}</span>
                </>
              )}
            </Box>
          )}
        </Box>
        <Button onClick={onClose}>닫기</Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 280px' }, gap: 4, alignItems: 'start' }}>
        <Stack spacing={2}>
        {!runId && (
          <Alert severity="info">
            첫 단계의 입력 프롬프트를 입력하고 "시작" 을 누르세요.
            실행은 백엔드 백그라운드에서 진행되므로 페이지를 떠나도 계속됩니다 — 파이프라인 히스토리 탭에서 결과 / 재실행 가능.
            {' 각 LLM 단계는 빌더에서 연결한 사전 컨텍스트 / 시스템 프롬프트 문서를 사용합니다.'}
          </Alert>
        )}

        <TextField
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
              startIcon={startMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart}
              disabled={startMutation.isPending || !initialPrompt.trim()}
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
              disabled={retryMutation.isPending}
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
        </Box>

        {run && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2.5,
              p: 2,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.secondary', flexShrink: 0 }}>
              {completedSteps} / {totalSteps} 단계
            </Typography>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                color={run.status === 'failed' ? 'error' : run.status === 'completed' ? 'success' : 'primary'}
                sx={{ height: 6, borderRadius: 1 }}
              />
            </Box>
            <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>
              {progressPct}%
            </Typography>
          </Box>
        )}

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
                      : <Chip label={idx + 1} />
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
                      <Paper variant="outlined" sx={{ borderColor: (t) => alpha(t.palette.success.main, 0.35), bgcolor: (t) => alpha(t.palette.success.main, 0.06), overflow: 'hidden' }}>
                        <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px dashed', borderColor: 'divider', fontSize: 11.5, color: 'text.secondary', fontFamily: MONO }}>
                          결과 ({runStep.output.type})
                        </Box>
                        <Box sx={{ p: 1.5 }}>
                          {runStep.output.type === 'text' && (
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', lineHeight: 1.65 }}>
                              {runStep.output.value}
                            </Typography>
                          )}
                          {runStep.output.type === 'image' && (
                            <StepImageThumbnails runStep={runStep} />
                          )}
                        </Box>
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

      {/* 우측 사이드 레일 (Phase 5b 후속) — 데스크탑에서만 sticky */}
      {isDesktop && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'sticky', top: 12 }}>
          <Paper variant="outlined">
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
                실행 정보
              </Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <InfoRow label="파이프라인" value={pipeline.name} />
              <InfoRow label="단계 수" value={`${totalSteps}단계`} />
              {run?.startedAt && (
                <InfoRow label="시작" value={new Date(run.startedAt).toLocaleString('ko-KR')} mono />
              )}
              {run?.completedAt && (
                <InfoRow label="종료" value={new Date(run.completedAt).toLocaleString('ko-KR')} mono />
              )}
              {run?.startedAt && run?.completedAt && (
                <InfoRow label="소요" value={formatDuration(run.startedAt, run.completedAt)} mono />
              )}
              {run?._id && (
                <InfoRow label="실행 ID" value={String(run._id).slice(-8)} mono />
              )}
              {run?.triggerCount > 1 && (
                <InfoRow label="재시도" value={`${run.triggerCount - 1}회`} />
              )}
            </Box>
          </Paper>

          {recentRuns.length > 0 && (
            <Paper variant="outlined">
              <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
                  같은 파이프라인 최근 실행
                </Typography>
              </Box>
              <Box>
                {recentRuns.map((r, i) => {
                  const dotColor = r.status === 'completed' ? 'success.main'
                    : r.status === 'failed' ? 'error.main'
                    : r.status === 'running' || r.status === 'pending' ? 'info.main'
                    : 'text.disabled';
                  const isCurrent = String(r._id) === String(runId);
                  return (
                    <Box
                      key={r._id}
                      onClick={() => !isCurrent && setRunId(r._id)}
                      sx={{
                        px: 2,
                        py: 1.25,
                        borderTop: i > 0 ? 1 : 0,
                        borderColor: 'divider',
                        cursor: isCurrent ? 'default' : 'pointer',
                        bgcolor: isCurrent ? (t) => alpha(t.palette.primary.main, 0.08) : 'transparent',
                        '&:hover': isCurrent ? {} : { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
                        <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: isCurrent ? 600 : 500 }}>
                          {r.initialPrompt?.slice(0, 30) || '(빈 입력)'}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.secondary', flexShrink: 0 }}>
                          {formatRunTime(r.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </Box>
      )}
      </Box>
    </Box>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
      <Typography variant="caption" sx={{ width: 56, color: 'text.secondary', flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: 'text.primary', fontFamily: mono ? '"JetBrains Mono", monospace' : undefined, wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function formatDuration(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem === 0 ? `${min}분` : `${min}분 ${rem}초`;
}

function formatRunTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : `${d.getMonth() + 1}/${d.getDate()}`;
}

// 파이프라인 히스토리 패널 (#407). 프로젝트 상세 탭에서 사용.
export function PipelineHistoryPanel({ projectId }) {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState(null);

  const { data, isLoading } = useQuery({ queryKey: ['pipelineRuns', projectId], queryFn: () => pipelineRunAPI.list(projectId, { limit: 50 }), refetchInterval: 5000 });
  const runs = data?.data?.data?.runs || [];

  const { data: detailData } = useQuery({ queryKey: ['pipelineRun', projectId, selectedRunId], queryFn: () => pipelineRunAPI.get(projectId, selectedRunId),
      enabled: !!selectedRunId,
      // v5: refetchInterval (query) 시그니처 (#526)
      refetchInterval: (query) => {
        const run = query.state.data?.data?.data?.run;
        if (!run) return 3000;
        return (run.status === 'pending' || run.status === 'running') ? 2000 : false;
      }, });
  const detail = detailData?.data?.data?.run;

  const retryMutation = useMutation({ mutationFn: ({ runId, fromStep }) => pipelineRunAPI.retry(projectId, runId, { fromStep }),
      onSuccess: (_, vars) => {
        queryClient.invalidateQueries({ queryKey: ['pipelineRuns', projectId] });
        queryClient.invalidateQueries({ queryKey: ['pipelineRun', projectId, vars.runId] });
        toast.success('재시작 요청됨');
      },
      onError: (err) => toast.error(err.response?.data?.message || '재시작 실패'), });

  const deleteMutation = useMutation({ mutationFn: (id) => pipelineRunAPI.delete(projectId, id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['pipelineRuns', projectId] });
        if (selectedRunId) setSelectedRunId(null);
        toast.success('삭제되었습니다.');
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'), });

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
              disabled={retryMutation.isPending}
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
                  : <Chip label={idx + 1} />
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
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'success.light' }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      결과 ({runStep.output.type})
                    </Typography>
                    {runStep.output.type === 'text' && (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
                        {runStep.output.value}
                      </Typography>
                    )}
                    {runStep.output.type === 'image' && (
                      <StepImageThumbnails runStep={runStep} />
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
        <Stack spacing={2}>
          {runs.map((r) => (
            <PipelineRunCard
              key={r._id}
              run={r}
              onSelect={() => setSelectedRunId(r._id)}
              onDelete={() => {
                if (window.confirm('이 실행 기록을 삭제하시겠어요?')) deleteMutation.mutate(r._id);
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

// 파이프라인 실행 히스토리 카드 (Phase 5a 후속) — mockup PipelineHistoryTabContent.
// 헤더: 이름 + status chip + 시각
// 본문: input 프롬프트 한 줄 + step 원형 진행 + (running) LinearProgress + "상세 →"
function PipelineRunCard({ run, onSelect, onDelete }) {
  const statusLabel = run.status === 'pending' ? '대기'
    : run.status === 'running' ? '진행 중'
    : run.status === 'completed' ? '완료'
    : run.status === 'failed' ? '실패' : run.status;
  const statusColor = run.status === 'completed' ? 'success'
    : run.status === 'failed' ? 'error'
    : run.status === 'running' ? 'info'
    : run.status === 'pending' ? 'info' : 'default';
  const totalSteps = (run.steps || []).length;
  const completedSteps = (run.steps || []).filter((s) => s.status === 'completed').length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <Card variant="outlined" onClick={onSelect} sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
      <CardContent sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {run.pipelineId?.name || '(파이프라인)'}
          </Typography>
          <Chip label={statusLabel} color={statusColor} />
          {run.triggerCount > 1 && (
            <Chip label={`재시도 ${run.triggerCount - 1}회`} variant="outlined" />
          )}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
            {new Date(run.createdAt).toLocaleString('ko-KR')}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {run.initialPrompt && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={run.initialPrompt}
            >
              {run.initialPrompt}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
            {(run.steps || []).map((s, idx) => {
              const isDone = s.status === 'completed';
              const isFail = s.status === 'failed';
              const isRunning = s.status === 'running';
              const bg = isDone ? 'success.main' : isFail ? 'error.main' : isRunning ? 'info.main' : 'transparent';
              const fg = isDone || isFail || isRunning ? 'common.white' : 'text.secondary';
              const border = isDone ? 'success.main' : isFail ? 'error.main' : isRunning ? 'info.main' : 'divider';
              return (
                <Box
                  key={idx}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: 1,
                    borderColor: border,
                    bgcolor: bg,
                    color: fg,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: MONO,
                  }}
                >
                  {isDone ? <CheckCircleIcon sx={{ fontSize: 12 }} /> : idx + 1}
                </Box>
              );
            })}
          </Box>
          {run.status === 'running' && totalSteps > 0 && (
            <Box sx={{ width: 80, flexShrink: 0 }}>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                sx={{ height: 4, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right', fontFamily: MONO, fontSize: 10, mt: 0.25 }}>
                {progressPct}%
              </Typography>
            </Box>
          )}
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 500, flexShrink: 0 }}>
            상세 →
          </Typography>
          <IconButton
            color="error"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="삭제"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

export default PipelinePanel;
