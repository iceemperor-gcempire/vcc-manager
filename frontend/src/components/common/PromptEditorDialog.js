import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Typography, Box, IconButton,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { MONO } from '../../theme';

// 프롬프트 크게 편집 (#900). 생성 화면의 프롬프트 칸은 자동 확장되지만, 긴 프롬프트를 다듬을 땐
// 화면을 차지하는 넓은 편집창이 편하다. 저장을 눌러야 반영되고, 취소하면 원본이 남는다.
//
// props: open, title, value, onClose, onSave(text), helperText
export default function PromptEditorDialog({ open, title = '프롬프트 편집', value = '', onClose, onSave, helperText }) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (open) setText(value || '');
  }, [open, value]);

  const lines = text ? text.split('\n').length : 0;
  const changed = text !== (value || '');

  const onKeyDown = (e) => {
    // Ctrl/Cmd+Enter 로 저장 — 편집 중 마우스로 손을 옮기지 않게
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (changed) onSave(text); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{title}</Typography>
          <IconButton aria-label="닫기" onClick={onClose}><Close /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={16}
          maxRows={40}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          inputProps={{ 'aria-label': title, style: { lineHeight: 1.6 } }}
          helperText={helperText}
        />
        <Typography sx={{ mt: 1, fontSize: 11.5, color: 'text.secondary', fontFamily: MONO, textAlign: 'right' }}>
          {text.length.toLocaleString()}자 · {lines}줄
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={() => onSave(text)} disabled={!changed}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}
