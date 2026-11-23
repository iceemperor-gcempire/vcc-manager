import React from 'react';
import { Box, Typography, CircularProgress, Tooltip } from '@mui/material';
import { CheckCircleOutline, ErrorOutline } from '@mui/icons-material';

// 도구 호출을 대화 안에서 한 줄로 (#1288). 도구가 주고받은 JSON 은 보이지 않는다 — 무엇을 했는지만.
export default function ChatToolSteps({ steps }) {
  return (
    <Box sx={{ alignSelf: 'flex-start', display: 'flex', flexWrap: 'wrap', gap: 1.5, pl: 9.5, maxWidth: '88%' }}>
      {steps.map((step, i) => (
        <Tooltip key={step.id || i} title={step.error || ''} disableHoverListener={!step.error}>
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.5, py: 1,
              borderRadius: '999px', border: 1, borderColor: 'divider',
              color: step.status === 'failed' ? 'error.main' : 'text.secondary',
            }}
          >
            {step.status === 'running' && <CircularProgress size={11} thickness={6} />}
            {step.status === 'ok' && <CheckCircleOutline sx={{ fontSize: 14, color: 'success.main' }} />}
            {step.status === 'failed' && <ErrorOutline sx={{ fontSize: 14 }} />}
            <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>
              {step.label}{step.status === 'failed' ? ' 실패' : ''}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
