// 좌측 설정 레일 (#713 R3) — 기본 정보 / 권한·노출 / 워크플로우 요약 / LLM 파라미터 카드 스택.
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore, OpenInNew } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import WorkboardBasicInfoForm from '../WorkboardBasicInfoForm';
import PermissionsCard from './PermissionsCard';
import { BUILTIN_WORKFLOW_VARIABLES } from '../../../constants/workflowVariables';
import { MONO } from '../../../theme';

function WorkflowSummaryCard({ watch, errors, onOpenEditor }) {
  const workflowData = watch('workflowData') || '';
  const allowedModelTypes = watch('allowedModelTypes') || [];
  const customFields = (watch('additionalCustomFields') || []).filter((f) => f.name);

  // 플레이스홀더는 따옴표 밖에도 올 수 있어({"seed": {{##seed##}}}) 마스킹 후 파싱
  let nodeCount = null;
  try {
    nodeCount = Object.keys(JSON.parse(workflowData.replace(/\{\{##[a-zA-Z0-9_]+##\}\}/g, '0'))).length;
  } catch { /* 비어있거나 미완성 JSON */ }

  const allVariables = [
    ...BUILTIN_WORKFLOW_VARIABLES.map((v) => v.key),
    ...customFields.map((f) => f.formatString || `{{##${f.name}##}}`),
  ];
  const usedCount = allVariables.filter((v) => workflowData.includes(v)).length;

  const kv = (label, value) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: MONO, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6">워크플로우</Typography>
        <Chip label="ComfyUI" variant="outlined" sx={{ fontFamily: MONO, fontSize: 10 }} />
      </Box>
      {kv('노드', nodeCount === null ? '—' : `${nodeCount}개`)}
      {kv('치환 변수', `${usedCount}개 사용 중`)}
      {kv('허용 모델 타입', allowedModelTypes.length ? allowedModelTypes.join(', ') : '전체')}
      {workflowData ? (
        <Box sx={{ bgcolor: 'grey.100', borderRadius: 2, p: 1.5, my: 1.5, maxHeight: 76, overflow: 'hidden' }}>
          <Typography variant="caption" sx={{ fontFamily: MONO, fontSize: 10, color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-all', display: 'block' }}>
            {workflowData.slice(0, 160)}…
          </Typography>
        </Box>
      ) : (
        <Alert severity={errors.workflowData ? 'error' : 'warning'} sx={{ my: 1.5 }}>
          {errors.workflowData?.message || 'Workflow JSON 이 비어 있습니다. 편집에서 붙여넣으세요.'}
        </Alert>
      )}
      <Button fullWidth variant="outlined" endIcon={<OpenInNew />} onClick={onOpenEditor}>
        워크플로우 편집
      </Button>
    </Paper>
  );
}

function LlmParamsCard({ control }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>LLM 파라미터</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        LLM 요청에 추가로 전달할 파라미터(JSON). thinking 비활성화, temperature 등.
        비워두면 모델 기본값. 이미지 입력은 입력 양식에 image 필드를 추가하면 활성화됩니다.
      </Typography>
      <Controller
        name="llmExtraParams"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            multiline
            minRows={5}
            size="small"
            label="추가 LLM 파라미터 (JSON)"
            placeholder={'{\n  "temperature": 1.0,\n  "chat_template_kwargs": { "enable_thinking": false }\n}'}
            helperText="OpenAI 계열은 요청 본문 최상위, Gemini 는 generationConfig 에 병합"
            InputProps={{ sx: { fontFamily: MONO, fontSize: '0.8rem' } }}
          />
        )}
      />
      <Accordion sx={{ mt: 1.5 }} disableGutters>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="caption" fontWeight={700}>자주 쓰는 예시</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" component="div" sx={{ fontFamily: MONO, whiteSpace: 'pre-wrap', fontSize: 10.5 }}>
            {'// 창작용 — 무작위성 높이고 thinking 끄기 (서버에 따라 키가 다름)\n'}
            {'{ "temperature": 1.0, "chat_template_kwargs": { "enable_thinking": false } }\n\n'}
            {'// reasoning 모델(gpt-5/o1 등) — temperature 미지원이니 비워두기\n'}
            {'{ }'}
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}

function SettingsRail({
  control, setValue, errors, watch,
  isComfyUI, isGemini, isOpenAIImage, outputFormat,
  serverId, groups, onOpenWorkflowEditor,
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>기본 정보</Typography>
        <WorkboardBasicInfoForm
          control={control}
          setValue={setValue}
          errors={errors}
          showActiveSwitch
          showTypeSelector
          isDialogOpen
        />
      </Paper>

      <PermissionsCard
        control={control}
        isComfyUI={isComfyUI}
        serverId={serverId}
        outputFormat={outputFormat}
        groups={groups}
        modelExposurePolicyValue={watch('modelExposurePolicy')}
        loraExposurePolicyValue={watch('loraExposurePolicy')}
      />

      {isComfyUI && (
        <WorkflowSummaryCard watch={watch} errors={errors} onOpenEditor={onOpenWorkflowEditor} />
      )}

      {outputFormat === 'text' && <LlmParamsCard control={control} />}

      {isGemini && (
        <Alert severity="info">Gemini 작업판은 워크플로우 JSON 없이 REST API 로 이미지를 생성합니다.</Alert>
      )}
      {isOpenAIImage && (
        <Alert severity="info">
          OpenAI 이미지 작업판은 OpenAI Images API 로 생성합니다. <strong>gpt-image-2</strong> 는 조직 인증
          (Verify Organization) 완료 후 약 15분 뒤부터 사용 가능합니다.
        </Alert>
      )}
    </Box>
  );
}

export default SettingsRail;
