import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { JOB_MEMO_MAX_LENGTH } from '../../constants/jobMemo';

// 작업 메모 입력 (#879). 작업 히스토리 페이지와 프로젝트 상세 패널이 함께 쓴다 —
// 저장 동작은 useJobActions.saveMemo 로 통일 (#728 과 같은 이유: 한쪽에만 붙는 사고 방지).
//
// props
//   open, onClose
//   job     — { _id, memo }  (memo 는 없을 수 있음)
//   onSave  — (memo: string) => Promise  (성공 시 닫는다)
//   saving  — 저장 중 비활성화
export default function JobMemoDialog({ open, job, onClose, onSave, saving = false }) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue(job?.memo || '');
  }, [open, job]);

  const trimmed = value.replace(/\s+/g, ' ').trim();
  const over = trimmed.length > JOB_MEMO_MAX_LENGTH;
  const unchanged = trimmed === (job?.memo || '');

  const submit = async () => {
    if (over || unchanged || saving) return;
    await onSave(trimmed);
  };

  const onKeyDown = (e) => {
    // Enter 로 저장 — 한 줄 메모라 개행이 필요 없다. IME 조합 중엔 무시.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">작업 메모</Typography>
          <IconButton aria-label="닫기" onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          이 작업이 무엇이었는지 한 줄로 남겨 두세요. 히스토리 목록과 검색에 그대로 나옵니다.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="예: 양갈래 소녀 밀밭 — ref max, 20스텝 시드 555"
          inputProps={{ 'aria-label': '작업 메모', maxLength: JOB_MEMO_MAX_LENGTH * 2 }}
          error={over}
          helperText={
            <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{over ? `${JOB_MEMO_MAX_LENGTH}자를 넘었습니다` : 'Enter 로 저장'}</span>
              <span>{trimmed.length}/{JOB_MEMO_MAX_LENGTH}</span>
            </Box>
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={submit} disabled={over || unchanged || saving}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
