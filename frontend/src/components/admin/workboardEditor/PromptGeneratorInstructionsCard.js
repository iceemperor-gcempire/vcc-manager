import React, { useState } from 'react';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';
import { OpenInFull } from '@mui/icons-material';
import { Controller } from 'react-hook-form';
import { MONO } from '../../../theme';
import { formatGuideSize } from '../../../utils/guideSize';
import PromptEditorDialog from '../../common/PromptEditorDialog';

// AI 프롬프트 생성 지침 (#1109) — 이미지·영상 판 전용.
//
// 실행 화면의 AI 프롬프트 생성은 어느 텍스트 판을 고르든 이 지침을 시스템 프롬프트에 함께 넣는다.
// 프롬프트를 어떻게 써야 하는지는 받는 모델이 정하므로 받는 판이 지침을 가진다.
// 프롬프트 가이드(전역 문서)와 달리 이 판 전용이고, 판 export·sync 로 함께 배포된다.

function PromptGeneratorInstructionsCard({ control }) {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>AI 프롬프트 생성 지침</Typography>
        <Button size="small" startIcon={<OpenInFull />} onClick={() => setEditorOpen(true)}>
          크게 편집
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        이 작업판에서 AI 프롬프트 생성을 쓰면, 고른 텍스트 작업판과 상관없이 이 지침이 시스템 프롬프트에 함께 들어갑니다.
        이 모델에 맞는 프롬프트 형식·길이·금지 표현 등을 적어 두세요. 비워 두면 적용하지 않습니다.
      </Typography>

      <Controller
        name="promptGeneratorInstructions"
        control={control}
        render={({ field }) => (
          <>
            <TextField
              {...field}
              value={field.value || ''}
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              size="small"
              placeholder="예: 영어 한 문단으로, 피사체 → 배경 → 조명 → 카메라 순서로 쓴다. 태그 나열은 하지 않는다."
              inputProps={{ 'aria-label': 'AI 프롬프트 생성 지침' }}
            />
            <Typography sx={{ mt: 0.5, fontSize: 11.5, color: 'text.secondary', fontFamily: MONO, textAlign: 'right' }}>
              {formatGuideSize((field.value || '').length)}
            </Typography>
            <PromptEditorDialog
              open={editorOpen}
              title="AI 프롬프트 생성 지침 편집"
              value={field.value || ''}
              helperText="Ctrl/⌘+Enter 저장. 작업판 저장을 눌러야 반영됩니다."
              onClose={() => setEditorOpen(false)}
              onSave={(text) => { field.onChange(text); setEditorOpen(false); }}
            />
          </>
        )}
      />
    </Paper>
  );
}

export default PromptGeneratorInstructionsCard;
