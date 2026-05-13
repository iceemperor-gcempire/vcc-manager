import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Tooltip
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import MetadataPickerModal from './MetadataPickerModal';

// 작업판 사용자 페이지의 type='baseModel' / 'lora' 필드 렌더러 (#199 Phase E).
// "선택" 버튼으로 MetadataPickerModal 을 열어 서버의 모델 / LoRA 목록에서 단건 선택.
// 표시는 Civitai 모델 이름 (있으면) 또는 파일 basename — 경로는 tooltip / 보조 라인.
// 내부 form value 는 그대로 filename (workflow injection 용).
//
// props:
//   kind: 'model' | 'lora'
//   field: customField 정의 ({ name, label, ... })
//   value: 현재 선택된 filename (path 포함, e.g. "IXL/nova.safetensors")
//   onChange: (filename) => void
//   workboardId: string
//   serverId: string
function MetadataFieldInput({ kind, field, value, onChange, workboardId, serverId }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // picker 로 선택 시 캡쳐된 Civitai 모델명 — value 가 동일하면 유지, 다르면 초기화
  const [displayName, setDisplayName] = useState('');
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    // value 가 displayValue 와 다르면 (외부 변경 / restore), 캐시된 displayName 무효화
    if (value !== displayValue) {
      setDisplayName('');
      setDisplayValue(value || '');
    }
  }, [value, displayValue]);

  const placeholder = kind === 'model' ? '베이스 모델을 선택하세요' : 'LoRA 를 선택하세요';
  const filenameBase = value ? String(value).split(/[/\\]/).pop() : '';
  const shown = displayName || filenameBase;

  return (
    <Box>
      {field.label && (
        <Typography variant="body2" gutterBottom>
          {field.label}
          {field.required && <span style={{ color: '#d32f2f' }}> *</span>}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Tooltip title={value || ''} placement="top" disableHoverListener={!value}>
          <TextField
            value={shown}
            fullWidth
            size="small"
            placeholder={placeholder}
            InputProps={{ readOnly: true }}
            helperText={value && value !== shown ? value : field.description}
          />
        </Tooltip>
        {value && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => { onChange(''); setDisplayName(''); }}
          >
            해제
          </Button>
        )}
        <Button
          variant="contained"
          size="small"
          startIcon={<SearchIcon />}
          onClick={() => setPickerOpen(true)}
          disabled={!serverId && !workboardId}
        >
          선택
        </Button>
      </Box>
      <MetadataPickerModal
        kind={kind}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workboardId={workboardId}
        serverId={serverId}
        mode="select-single"
        selectedItem={value}
        onPrimary={(rawItem) => {
          if (!rawItem?.filename) return;
          onChange(rawItem.filename);
          // 표시용 이름 캡쳐 — civitai name 우선, 없으면 빈값 (filename basename 으로 fallback)
          const civName = rawItem?.civitai?.model?.name || rawItem?.civitai?.name || '';
          setDisplayName(civName);
          setDisplayValue(rawItem.filename);
        }}
      />
    </Box>
  );
}

export default MetadataFieldInput;
