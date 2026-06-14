import React from 'react';
import { Chip } from '@mui/material';
import { MONO } from '../../theme';

// 상태/출력 등 의미 색이 있는 칩 — light/dark 양쪽 테마 토큰 기반 (#548 — WorkboardCatalog 내장에서 승격).
// 같은 의미(완료/실패 등)는 모든 화면에서 이 컴포넌트로 표기한다 (MUI Chip color 직접 사용 금지).
const TONE_SX = {
  success: { bgcolor: 'success.light', color: 'success.main' },
  info: { bgcolor: 'info.light', color: 'info.main' },
  warning: { bgcolor: 'warning.light', color: 'warning.main' },
  error: { bgcolor: 'error.light', color: 'error.main' },
  accent: { bgcolor: 'primary.light', color: 'primary.main' }, // v2 — .light 토큰이 모드별 틴트 (#562)
  neutral: { bgcolor: 'grey.100', color: 'text.secondary' },
};

export function ToneChip({ tone, label, mono, sx }) {
  const ts = TONE_SX[tone] || TONE_SX.neutral;
  return (
    <Chip
      variant="filled"
      label={label}
      sx={{
        height: 24, fontSize: '11.5px', fontWeight: 600, border: 0,
        ...(mono && { fontFamily: MONO, fontSize: '11px' }),
        '& .MuiChip-label': { px: '11px' },
        ...ts, ...sx,
      }}
    />
  );
}

export default ToneChip;
