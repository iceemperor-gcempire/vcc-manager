// 우측 레일 — 필드 인스펙터 ↔ 라이브 프리뷰 (#713 R3).
// 선택 필드의 옵션 편집(구 아코디언 상세를 이식) + 사용자 시점 프리뷰 세그먼트 토글.
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  IconButton,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { Add, Delete, DragIndicator, Visibility } from '@mui/icons-material';
import { Controller, useFieldArray } from 'react-hook-form';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import CustomFieldControl from '../../common/CustomFieldControl';
import { ServerMetadataDefaultValueInput, FIELD_TYPES } from './shared';
import { MONO } from '../../../theme';

// 프리뷰 필드 — 실행 화면과 동일한 공용 렌더러의 preview 모드 (#711)
export function PreviewField({ field }) {
  if (field.type === 'image') {
    return (
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {field.label}{field.required ? ' *' : ''}
        </Typography>
        <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 1, p: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            이미지 업로드 (최대 {field.imageConfig?.maxImages || 3}개)
          </Typography>
        </Box>
      </Box>
    );
  }
  return <CustomFieldControl field={field} preview />;
}

// select 타입의 옵션 목록 편집기 — 인스펙터 안 중첩 dnd (useFieldArray)
function SelectOptionsEditor({ control, fieldIndex }) {
  const { fields: options, append, remove, move } = useFieldArray({
    control,
    name: `additionalCustomFields.${fieldIndex}.options`,
    keyName: 'optionKey',
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="overline" color="text.secondary">선택 옵션</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<Add />} onClick={() => append({ key: '', value: '' })}>
          옵션 추가
        </Button>
      </Box>
      <DragDropContext
        onDragEnd={(result) => {
          if (!result.destination || result.destination.index === result.source.index) return;
          move(result.source.index, result.destination.index);
        }}
      >
        <Droppable droppableId={`customFieldOptions-${fieldIndex}`}>
          {(droppableProvided) => (
            <Box ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
              {options.map((opt, optIndex) => (
                <Draggable key={opt.optionKey} draggableId={opt.optionKey} index={optIndex}>
                  {(draggableProvided) => (
                    <Box
                      ref={draggableProvided.innerRef}
                      {...draggableProvided.draggableProps}
                      sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}
                    >
                      <Box {...draggableProvided.dragHandleProps} sx={{ display: 'flex', color: 'text.tertiary', cursor: 'grab' }}>
                        <DragIndicator fontSize="small" />
                      </Box>
                      <Controller
                        name={`additionalCustomFields.${fieldIndex}.options.${optIndex}.key`}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} size="small" label="표시명" sx={{ flex: 1 }} />
                        )}
                      />
                      <Controller
                        name={`additionalCustomFields.${fieldIndex}.options.${optIndex}.value`}
                        control={control}
                        render={({ field }) => (
                          <TextField {...field} size="small" label="실제 값" sx={{ flex: 1, '& input': { fontFamily: MONO, fontSize: 12 } }} />
                        )}
                      />
                      <IconButton size="small" color="error" onClick={() => remove(optIndex)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Draggable>
              ))}
              {droppableProvided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
    </Box>
  );
}

function InspectorForm({ control, watch, selectedIdx, serverId, onRemove }) {
  const field = watch(`additionalCustomFields.${selectedIdx}`) || {};
  const fieldType = field.type || 'string';

  return (
    <Paper variant="outlined" sx={{ p: 3, borderTop: 3, borderTopColor: 'primary.main' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip
          label={fieldType}
          variant="outlined"
          sx={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', fontWeight: 600 }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }} noWrap>
          {field.label || '새 필드'}
        </Typography>
      </Box>

      <Stack spacing={2}>
        <Controller
          name={`additionalCustomFields.${selectedIdx}.name`}
          control={control}
          render={({ field: f }) => (
            <TextField {...f} fullWidth size="small" label="필드명 (영문)" placeholder="예: customField1"
              helperText="워크플로우 변수명으로 사용됩니다"
              sx={{ '& input': { fontFamily: MONO } }} />
          )}
        />
        <Controller
          name={`additionalCustomFields.${selectedIdx}.label`}
          control={control}
          render={({ field: f }) => (
            <TextField {...f} fullWidth size="small" label="표시명" placeholder="예: 커스텀 옵션" />
          )}
        />
        <Controller
          name={`additionalCustomFields.${selectedIdx}.type`}
          control={control}
          render={({ field: f }) => (
            <TextField {...f} fullWidth size="small" select label="입력 타입">
              {FIELD_TYPES.map((t) => (
                <MenuItem key={t.type} value={t.type}>{t.label}</MenuItem>
              ))}
            </TextField>
          )}
        />
        <Controller
          name={`additionalCustomFields.${selectedIdx}.formatString`}
          control={control}
          render={({ field: f }) => (
            <TextField {...f} fullWidth size="small" label="Workflow 형식 문자열"
              placeholder={`예: {{##${field.name || 'field_name'}##}}`}
              helperText="비워두면 필드명으로 자동 생성"
              sx={{ '& input': { fontFamily: MONO } }} />
          )}
        />
        <Controller
          name={`additionalCustomFields.${selectedIdx}.required`}
          control={control}
          render={({ field: f }) => (
            <FormControlLabel control={<Switch {...f} checked={!!f.value} />} label="필수 입력" />
          )}
        />

        <Divider />

        {/* 기본값 — type 별 입력 (#391) */}
        <Controller
          name={`additionalCustomFields.${selectedIdx}.defaultValue`}
          control={control}
          render={({ field: f }) => {
            if (fieldType === 'boolean') {
              return (
                <FormControlLabel
                  control={<Switch checked={!!f.value} onChange={(e) => f.onChange(e.target.checked)} />}
                  label="기본값 (ON / OFF)"
                />
              );
            }
            if (fieldType === 'select') {
              const options = field.options || [];
              return (
                <TextField
                  {...f}
                  value={f.value || ''}
                  fullWidth
                  size="small"
                  select
                  label="기본값 (선택)"
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">선택 없음</MenuItem>
                  {options.map((opt, i) => (
                    <MenuItem key={i} value={opt.value || ''}>{opt.key || opt.value}</MenuItem>
                  ))}
                </TextField>
              );
            }
            if (fieldType === 'baseModel' || fieldType === 'lora') {
              return (
                <ServerMetadataDefaultValueInput
                  serverId={serverId}
                  type={fieldType}
                  value={f.value || ''}
                  onChange={f.onChange}
                  label={fieldType === 'baseModel' ? '기본값 (베이스 모델)' : '기본값 (LoRA)'}
                />
              );
            }
            if (fieldType === 'image') return <Box />;
            return (
              <TextField {...f} value={f.value ?? ''} fullWidth size="small"
                label="기본값" type={fieldType === 'number' ? 'number' : 'text'} />
            );
          }}
        />

        {(fieldType === 'string' || fieldType === 'number') && (
          <Controller
            name={`additionalCustomFields.${selectedIdx}.placeholder`}
            control={control}
            render={({ field: f }) => (
              <TextField {...f} value={f.value ?? ''} fullWidth size="small" label="플레이스홀더" />
            )}
          />
        )}
        <Controller
          name={`additionalCustomFields.${selectedIdx}.description`}
          control={control}
          render={({ field: f }) => (
            <TextField {...f} value={f.value ?? ''} fullWidth size="small" label="설명" helperText="입력 아래 도움말로 표시" />
          )}
        />

        {(fieldType === 'baseModel' || fieldType === 'lora') && (
          <Alert severity="info">
            노출 범위는 "권한 / 노출" 카드의 {fieldType === 'baseModel' ? '모델' : 'LoRA'} 노출 정책을 따릅니다.
          </Alert>
        )}

        {fieldType === 'image' && (
          <Controller
            name={`additionalCustomFields.${selectedIdx}.imageConfig.maxImages`}
            control={control}
            render={({ field: f }) => (
              <TextField {...f} value={f.value || 1} fullWidth size="small" select label="최대 이미지 수">
                {[1, 2, 3].map((n) => <MenuItem key={n} value={n}>{n}개</MenuItem>)}
              </TextField>
            )}
          />
        )}

        {fieldType === 'select' && (
          <>
            <Divider />
            <SelectOptionsEditor control={control} fieldIndex={selectedIdx} />
          </>
        )}

        <Box sx={{ textAlign: 'right' }}>
          <Button color="error" startIcon={<Delete />} onClick={onRemove}>
            필드 삭제
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}

function FieldInspector({ control, watch, selectedIdx, rightTab, onRightTabChange, serverId, onRemoveSelected }) {
  const fields = watch('additionalCustomFields') || [];
  const hasSelection = selectedIdx >= 0 && selectedIdx < fields.length;
  const effectiveTab = hasSelection ? rightTab : 'preview';

  return (
    <Box sx={{ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
      <ToggleButtonGroup
        value={effectiveTab}
        exclusive
        fullWidth
        size="small"
        onChange={(_, v) => v && onRightTabChange(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="inspector" disabled={!hasSelection}>필드 설정</ToggleButton>
        <ToggleButton value="preview">라이브 프리뷰</ToggleButton>
      </ToggleButtonGroup>

      {effectiveTab === 'inspector' && hasSelection ? (
        <InspectorForm
          control={control}
          watch={watch}
          selectedIdx={selectedIdx}
          serverId={serverId}
          onRemove={onRemoveSelected}
        />
      ) : (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Visibility fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
              라이브 프리뷰
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Chip label="사용자 시점" variant="outlined" />
          </Box>
          {fields.filter((f) => f && f.name).length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              필드를 정의하면 사용자에게 보일 모습이 여기 표시됩니다.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {fields.filter((f) => f && f.name).map((f, i) => <PreviewField key={f.name || i} field={f} />)}
            </Stack>
          )}
        </Paper>
      )}
    </Box>
  );
}

export default FieldInspector;
