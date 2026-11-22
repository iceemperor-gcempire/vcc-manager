import React from 'react';
import { Paper, Typography, TextField, Stack } from '@mui/material';
import { Controller } from 'react-hook-form';

// 기본 프롬프트·기본 부정 프롬프트 (#1262) — 이미지·영상·오디오 판 전용.
//
// 새 작업을 열면 실행 화면의 프롬프트·부정 프롬프트 칸에 이 값이 채워져 나온다. 모델 제공자가 권하는
// 품질 태그·부정 프롬프트를 워크플로 문자열에 박아 두면 사용자가 볼 수도 뺄 수도 없어서, 여기 둔다.
// 부정 프롬프트를 보내지 않은 API·MCP 호출은 기본 부정 프롬프트로 돈다.

function DefaultPromptsCard({ control }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>기본 프롬프트</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        새 작업을 열면 프롬프트·부정 프롬프트 칸에 채워져 나오는 값입니다. 모델 제공자가 권하는 품질 태그나
        부정 프롬프트를 적어 두면 사용자가 보고 고칠 수 있습니다. 비워 두면 칸이 빈 채로 열립니다.
      </Typography>
      <Stack spacing={1.5}>
        <Controller
          name="defaultPrompt"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value || ''}
              label="기본 프롬프트"
              fullWidth
              multiline
              minRows={2}
              maxRows={8}
              size="small"
              placeholder="예: masterpiece, best quality,"
              helperText="프롬프트 칸 맨 앞에 채워집니다. 사용자는 그 뒤에 이어서 씁니다."
            />
          )}
        />
        <Controller
          name="defaultNegativePrompt"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              value={field.value || ''}
              label="기본 부정 프롬프트"
              fullWidth
              multiline
              minRows={2}
              maxRows={8}
              size="small"
              placeholder="예: worst quality, low quality, blurry"
              helperText="워크플로가 부정 프롬프트를 쓰는 작업판에서만 의미가 있습니다. API·MCP 가 부정 프롬프트를 보내지 않으면 이 값으로 생성합니다."
            />
          )}
        />
      </Stack>
    </Paper>
  );
}

export default DefaultPromptsCard;
