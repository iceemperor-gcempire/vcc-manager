import React from 'react';
import {
  TextField,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Switch,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import MetadataFieldInput from './MetadataFieldInput';

/**
 * customField 공용 렌더러 (#711 R2).
 *
 * 이미지 실행(ImageGeneration)·텍스트 실행(PromptGeneratorPanel)·편집기 라이브 프리뷰가
 * 각자 필드 렌더를 재구현하면서 "편집기에서 정의한 필드가 실행에서 다르게 보이거나
 * 아예 안 보이는" drift 가 누적됐다 (boolean 이 TextField 로 렌더, number 미렌더,
 * required 미강제 등 — #440 전면 재검토). 이 컴포넌트가 단일 소스.
 *
 * - string / number / select / boolean / baseModel / lora 를 처리
 * - image 타입은 컨텍스트별 업로드 플로우(참조 이미지 vs 비전 첨부)가 달라 호출부가 렌더
 * - required 는 react-hook-form rules 로 일관 강제 (에러 메시지 = "{표시명}을(를) 입력/선택해주세요")
 * - preview 모드: 폼 없이 disabled 로 동일 UI 렌더 — 프리뷰가 정의상 실행과 같은 모습
 */

const isPromptLike = (field) => (field.name || '').includes('prompt');

function requiredMessage(field) {
  const verb = ['select', 'baseModel', 'lora', 'boolean'].includes(field.type) ? '선택' : '입력';
  return `${field.label}을(를) ${verb}해주세요`;
}

// 실제 입력 UI — 폼 유무와 무관한 표현 계층
function FieldBody({ field, value, onChange, error, size, disabled, serverId, workboardId, allowedModelTypes }) {
  switch (field.type) {
    case 'number':
      return (
        <TextField
          type="number"
          fullWidth
          size={size}
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          helperText={error?.message || field.description}
          disabled={disabled}
        />
      );

    case 'select':
      return (
        <FormControl fullWidth size={size} error={!!error} disabled={disabled}>
          <InputLabel required={field.required}>{field.label}</InputLabel>
          <Select
            value={value ?? ''}
            label={field.label}
            onChange={(e) => onChange(e.target.value)}
          >
            {field.options?.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.key}
              </MenuItem>
            ))}
          </Select>
          {(error?.message || field.description) && (
            <FormHelperText>{error?.message || field.description}</FormHelperText>
          )}
        </FormControl>
      );

    case 'boolean':
      return (
        <FormControl error={!!error} disabled={disabled}>
          <FormControlLabel
            control={
              <Switch
                checked={value === true || value === 'true'}
                onChange={(e) => onChange(e.target.checked)}
              />
            }
            label={field.label}
          />
          {(error?.message || field.description) && (
            <FormHelperText sx={{ mt: -0.5 }}>{error?.message || field.description}</FormHelperText>
          )}
        </FormControl>
      );

    case 'baseModel':
    case 'lora':
      return (
        <MetadataFieldInput
          kind={field.type === 'baseModel' ? 'model' : 'lora'}
          field={field}
          value={value || ''}
          onChange={onChange}
          workboardId={workboardId}
          serverId={serverId}
          allowedModelTypes={field.type === 'baseModel' ? allowedModelTypes : undefined}
          disabled={disabled}
          error={!!error}
          errorMessage={error?.message}
        />
      );

    case 'string':
    default:
      return (
        <TextField
          fullWidth
          size={size}
          label={field.label}
          required={field.required}
          placeholder={field.placeholder}
          multiline={isPromptLike(field)}
          rows={isPromptLike(field) ? 2 : 1}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          error={!!error}
          helperText={error?.message || field.description}
          disabled={disabled}
        />
      );
  }
}

function CustomFieldControl({
  field,
  control,
  name,
  size = 'medium',
  serverId,
  workboardId,
  allowedModelTypes,
  preview = false,
}) {
  // 프리뷰(편집기 "사용자 시점") — 폼 없이 기본값을 disabled 로 표시
  if (preview || !control) {
    return (
      <FieldBody
        field={field}
        value={field.defaultValue ?? (field.type === 'boolean' ? false : '')}
        onChange={() => {}}
        size={size}
        disabled
        serverId={serverId}
        workboardId={workboardId}
        allowedModelTypes={allowedModelTypes}
      />
    );
  }

  const defaultValue =
    field.type === 'boolean'
      ? (field.defaultValue === true || field.defaultValue === 'true')
      : field.type === 'select'
        ? (field.defaultValue || field.options?.[0]?.value || '')
        : (field.defaultValue || '');

  return (
    <Controller
      name={name || field.name}
      control={control}
      defaultValue={defaultValue}
      rules={{
        required: field.required ? requiredMessage(field) : false,
        // boolean 필수는 "켜짐 강제"가 아니라 "값 존재"라 rules 미적용 (Switch 는 항상 값 보유)
        ...(field.type === 'boolean' ? { required: false } : {}),
      }}
      render={({ field: formField, fieldState }) => (
        <FieldBody
          field={field}
          value={formField.value}
          onChange={formField.onChange}
          error={fieldState.error}
          size={size}
          serverId={serverId}
          workboardId={workboardId}
          allowedModelTypes={allowedModelTypes}
        />
      )}
    />
  );
}

export default CustomFieldControl;
