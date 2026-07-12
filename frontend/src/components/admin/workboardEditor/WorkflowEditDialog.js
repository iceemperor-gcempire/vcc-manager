// ComfyUI 워크플로우 편집 다이얼로그 (#713 R3) — 구 "워크플로우" 탭을 풀스크린으로 승격.
// 좌 = 전체 높이 JSON 에디터, 우 = 치환 변수 레퍼런스(사용 중/미사용) + 허용 모델 타입.
// 변수 클릭 = 클립보드 복사 (커서 위치 삽입은 R4).
import React, { useState, useRef } from 'react';
import {
  Box,
  Dialog,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Autocomplete,
  Paper,
  Alert,
} from '@mui/material';
import { Close, Check, ContentCopy } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { copyToClipboard } from '../../../utils/clipboard';
import { BUILTIN_WORKFLOW_VARIABLES, WORKFLOW_VARIABLE_CATEGORIES, formatValueType } from '../../../constants/workflowVariables';
import { MONO } from '../../../theme';

function VariableRow({ variable, label, note, used, copied, onCopy }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
      <Chip
        label={variable}
        onClick={() => onCopy(variable)}
        icon={copied ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 13 }} />}
        variant="outlined"
        color="secondary"
        sx={{ fontFamily: MONO, fontSize: 11, cursor: 'pointer', maxWidth: 220 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ display: 'block' }} noWrap title={label}>{label}</Typography>
        {note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 10 }} noWrap title={note}>{note}</Typography>}
      </Box>
      <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 700, color: used ? 'success.main' : 'text.tertiary' }}>
        {used ? '✓ 사용 중' : '미사용'}
      </Typography>
    </Box>
  );
}

function WorkflowEditDialog({ open, onClose, control, watch, errors, availableBaseModels }) {
  const [copiedVariable, setCopiedVariable] = useState('');
  const copyTimerRef = useRef(null);

  const workflowData = watch('workflowData') || '';
  const customFields = (watch('additionalCustomFields') || []).filter((f) => f.name);

  const handleCopy = async (variable) => {
    try {
      await copyToClipboard(variable);
      setCopiedVariable(variable);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedVariable(''), 1500);
    } catch {
      toast.error('변수 복사에 실패했습니다.');
    }
  };

  const validateJson = () => {
    if (!workflowData.trim()) {
      toast.error('Workflow JSON 이 비어 있습니다.');
      return;
    }
    try {
      // 플레이스홀더는 따옴표 밖에도 올 수 있어 치환 시점 형태로 마스킹 후 검사
      const masked = workflowData.replace(/\{\{##[a-zA-Z0-9_]+##\}\}/g, '0');
      const parsed = JSON.parse(masked);
      toast.success(`유효한 JSON 입니다 (노드 ${Object.keys(parsed).length}개)`);
    } catch (e) {
      toast.error(`JSON 오류 (변수 치환 후 기준): ${e.message}`);
    }
  };

  const usedCount = [...BUILTIN_WORKFLOW_VARIABLES.map((v) => v.key),
    ...customFields.map((f) => f.formatString || `{{##${f.name}##}}`)]
    .filter((v) => workflowData.includes(v)).length;

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 4, py: 2.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>워크플로우 편집</Typography>
        <Chip label={`변수 ${usedCount}개 사용 중`} color="success" variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <Button onClick={validateJson}>유효성 검사</Button>
        <Button variant="contained" onClick={onClose}>완료</Button>
        <IconButton onClick={onClose}><Close /></IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 380px' }, gap: 4, p: 4, height: '100%', overflow: 'hidden', bgcolor: 'background.default' }}>
        {/* 좌: JSON 에디터 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Controller
            name="workflowData"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                fullWidth
                multiline
                label="ComfyUI Workflow JSON (API Format)"
                error={!!errors.workflowData}
                helperText={errors.workflowData?.message || 'Save (API Format) 으로 내보낸 JSON. 우측 변수를 클릭해 복사 후 붙여넣으세요.'}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', fontFamily: MONO, fontSize: '0.82rem' },
                  '& textarea': { height: '100% !important', overflow: 'auto !important' },
                }}
              />
            )}
          />
        </Box>

        {/* 우: 변수 레퍼런스 + 허용 모델 타입 */}
        <Box sx={{ overflow: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>치환 변수 <Typography component="span" variant="caption" color="text.secondary">클릭 = 복사</Typography></Typography>
            {Object.entries(WORKFLOW_VARIABLE_CATEGORIES).map(([catKey, catLabel]) => {
              const vars = BUILTIN_WORKFLOW_VARIABLES.filter((v) => v.category === catKey);
              if (vars.length === 0) return null;
              return (
                <Box key={catKey} sx={{ mb: 1.5 }}>
                  <Typography variant="overline" color="text.secondary">{catLabel}</Typography>
                  {vars.map((v) => (
                    <VariableRow
                      key={v.key}
                      variable={v.key}
                      label={`${v.label} (${formatValueType(v.valueType, v.defaultValue)})`}
                      note={v.note}
                      used={workflowData.includes(v.key)}
                      copied={copiedVariable === v.key}
                      onCopy={handleCopy}
                    />
                  ))}
                </Box>
              );
            })}
            <Typography variant="overline" color="text.secondary">사용자 정의 변수 (입력 양식)</Typography>
            {customFields.length > 0 ? customFields.map((f, idx) => {
              const variable = f.formatString || `{{##${f.name}##}}`;
              return (
                <VariableRow
                  key={`custom-${idx}`}
                  variable={variable}
                  label={f.label || f.name}
                  used={workflowData.includes(variable)}
                  copied={copiedVariable === variable}
                  onCopy={handleCopy}
                />
              );
            }) : (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1 }}>
                입력 양식에서 필드를 정의하면 여기에 나타납니다.
              </Typography>
            )}
            <Alert severity="info" sx={{ mt: 1.5 }}>
              seed 는 플레이스홀더 외에 하드코딩된 숫자값(<code>"seed": 12345</code>)도 자동 치환됩니다.
            </Alert>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>허용 모델 타입 (선택)</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              비워두면 모든 모델 표시. Civitai 미등록 모델은 제약과 무관하게 항상 노출됩니다.
            </Typography>
            <Controller
              name="allowedModelTypes"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  {...field}
                  multiple
                  freeSolo
                  size="small"
                  options={availableBaseModels}
                  value={field.value || []}
                  onChange={(_, newValue) => field.onChange(newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip {...getTagProps({ index })} key={option} label={option} color="primary" variant="outlined" />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={availableBaseModels.length === 0 ? '서버 모델 sync 후 자동 채움' : '예: SDXL, Illustrious, Pony'}
                    />
                  )}
                />
              )}
            />
          </Paper>
        </Box>
      </Box>
    </Dialog>
  );
}

export default WorkflowEditDialog;
