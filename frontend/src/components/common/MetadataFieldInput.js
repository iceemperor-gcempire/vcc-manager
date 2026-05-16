import React, { useState, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tooltip
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import MetadataPickerModal from './MetadataPickerModal';

// 작업판 사용자 페이지의 type='baseModel' / 'lora' 필드 렌더러.
// 다른 customField (select / number / string) 와 동일하게 TextField 의 floating label 사용해 디자인 통일.
// 표시는 Civitai 모델 이름 (있으면) 또는 파일 basename — 경로는 tooltip / helperText.
// 내부 form value 는 그대로 filename (workflow injection 용).
function MetadataFieldInput({ kind, field, value, onChange, workboardId, serverId, allowedModelTypes }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value !== displayValue) {
      setDisplayName('');
      setDisplayValue(value || '');
    }
  }, [value, displayValue]);

  const placeholder = kind === 'model' ? '베이스 모델을 선택하세요' : 'LoRA 를 선택하세요';
  const filenameBase = value ? String(value).split(/[/\\]/).pop() : '';
  const shown = displayName || filenameBase;

  return (
    <>
      <Tooltip title={value || ''} placement="top" disableHoverListener={!value}>
        <TextField
          label={field.label || (kind === 'model' ? '베이스 모델' : 'LoRA')}
          required={field.required}
          value={shown}
          fullWidth
          placeholder={placeholder}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                {value && (
                  <Tooltip title="해제">
                    <IconButton size="small" onClick={() => { onChange(''); setDisplayName(''); }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  variant="text"
                  size="small"
                  startIcon={<SearchIcon />}
                  onClick={() => setPickerOpen(true)}
                  disabled={!serverId && !workboardId}
                  sx={{ ml: 0.5 }}
                >
                  선택
                </Button>
              </InputAdornment>
            )
          }}
          helperText={value && value !== shown ? value : field.description}
        />
      </Tooltip>
      <MetadataPickerModal
        kind={kind}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        workboardId={workboardId}
        serverId={serverId}
        allowedModelTypes={allowedModelTypes}
        mode="select-single"
        selectedItem={value}
        onPrimary={(rawItem) => {
          if (!rawItem?.filename) return;
          onChange(rawItem.filename);
          const civName = rawItem?.civitai?.model?.name || rawItem?.civitai?.name || '';
          setDisplayName(civName);
          setDisplayValue(rawItem.filename);
        }}
      />
    </>
  );
}

export default MetadataFieldInput;
