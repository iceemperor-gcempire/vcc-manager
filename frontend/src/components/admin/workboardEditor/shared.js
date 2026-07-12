// 작업판 편집기 공용 입력기 (#713 R3 — WorkboardManagement.js 에서 이동, 로직 불변)
import React, { useState } from 'react';
import { Box, TextField, Button, Chip, Autocomplete } from '@mui/material';
import { PlaylistAdd } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { serverAPI } from '../../../services/api';
import MetadataPickerModal from '../../common/MetadataPickerModal';

// admin 의 customField 기본값 입력기 — type=baseModel/lora 일 때 서버 모델 목록 Autocomplete (#391)
export function ServerMetadataDefaultValueInput({ serverId, type, value, onChange, label }) {
  const fetcher = type === 'baseModel' ? serverAPI.getDetailedModels : serverAPI.getLoras;
  const { data, isLoading } = useQuery({ queryKey: ['adminDefaultValueMetadata', type, serverId], queryFn: () => fetcher(serverId, { limit: 200, detailed: true }), enabled: !!serverId, staleTime: 60_000 });
  const items = data?.data?.data?.items
    || data?.data?.data?.models
    || data?.data?.data?.loraModels
    || data?.data?.data?.loras
    || data?.data?.models
    || data?.data?.loraModels
    || data?.data?.loras
    || [];

  const keyOf = (m) => (typeof m === 'string' ? m : (m?.filename || m?.fileName || m?.name || ''));

  // 저장된 기본값(문자열)을 항상 표시한다 (#498). 모델 목록이 로딩 중이거나 stale/누락이어도
  // 선택값이 비어 보이지 않도록, 목록에 없으면 합성 옵션을 만들어 value/options 를 객체로 일치시킨다.
  const matched = typeof value === 'string' ? items.find((m) => keyOf(m) === value) : value;
  const selectedValue = matched || (typeof value === 'string' && value ? { filename: value } : (value || null));
  const options = (selectedValue && !items.some((m) => keyOf(m) === keyOf(selectedValue)))
    ? [selectedValue, ...items]
    : items;

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(opt) => {
        if (!opt) return '';
        if (typeof opt === 'string') return opt;
        return opt.civitai?.model?.name
          ? `${opt.civitai.model.name} (${opt.filename || opt.fileName})`
          : (opt.filename || opt.fileName || opt.name || '');
      }}
      isOptionEqualToValue={(opt, val) => keyOf(opt) === keyOf(val)}
      value={selectedValue}
      onChange={(_, picked) => {
        if (!picked) return onChange('');
        const key = typeof picked === 'string' ? picked : (picked.filename || picked.fileName || picked.name || '');
        onChange(key);
      }}
      loading={isLoading}
      disabled={!serverId}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          label={label}
          helperText={!serverId ? '서버 선택 후 사용 가능' : (isLoading ? '모델 목록 로딩 중...' : `${items.length}개 중 선택`)}
        />
      )}
      size="small"
    />
  );
}

// 화이트리스트 필드 — Autocomplete (수동 입력) + picker 모달 (서버 모델/LoRA 선택).
// ComfyUI 서버에서만 picker 표시. picker 는 multi-add 모드 — 카드 클릭마다 한 건씩 추가됨.
export function WhitelistField({ name, control, kind, serverId, outputFormat, placeholder, showPicker = true }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const value = field.value || [];
        // picker 의 multi-add 모드에서 카드를 다시 클릭하면 토글 — 이미 포함된 항목은 제거 (#277)
        const handleToggle = (rawItem) => {
          const id = rawItem?.filename;
          if (!id) return;
          if (value.includes(id)) {
            field.onChange(value.filter((v) => v !== id));
          } else {
            field.onChange([...value, id]);
          }
        };
        return (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={value}
                onChange={(_, newValue) => field.onChange(newValue)}
                sx={{ flex: 1 }}
                renderTags={(values, getTagProps) =>
                  values.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option}
                      label={option}
                      variant="outlined"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} placeholder={placeholder} />
                )}
              />
              {showPicker && (
                <Button
                  variant="outlined"
                  startIcon={<PlaylistAdd />}
                  onClick={() => setPickerOpen(true)}
                  disabled={!serverId}
                  sx={{ mt: 0.25, whiteSpace: 'nowrap' }}
                >
                  선택
                </Button>
              )}
            </Box>
            {showPicker && (
              <MetadataPickerModal
                kind={kind}
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                serverId={serverId}
                outputFormat={outputFormat}
                isAdmin
                mode="multi-add"
                selectedItems={value}
                onPrimary={handleToggle}
              />
            )}
          </Box>
        );
      }}
    />
  );
}

// 필드 타입 팔레트 정의 — "+ 필드 추가" 메뉴와 타입 셀렉터의 단일 소스
export const FIELD_TYPES = [
  { type: 'string',    label: '텍스트',      hint: '한 줄 또는 다중 라인 입력' },
  { type: 'number',    label: '숫자',        hint: '정수/실수' },
  { type: 'select',    label: '선택',        hint: '선택지 중 하나' },
  { type: 'boolean',   label: '체크박스',    hint: 'on/off 토글' },
  { type: 'image',     label: '이미지',      hint: '드래그 드롭 업로드' },
  { type: 'baseModel', label: '베이스 모델', hint: '서버 모델 선택' },
  { type: 'lora',      label: 'LoRA',        hint: 'LoRA 슬롯' },
];

export const emptyCustomField = (type) => ({
  name: '',
  label: '',
  type,
  required: false,
  formatString: '',
  options: [],
  imageConfig: { maxImages: 1 },
});
