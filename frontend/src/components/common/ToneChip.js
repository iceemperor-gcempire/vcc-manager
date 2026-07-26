import React from 'react';
import { Chip } from '@mui/material';
import { MONO, toneText } from '../../theme';

// 상태/출력 등 의미 색이 있는 칩 — light/dark 양쪽 테마 토큰 기반 (#548 — WorkboardCatalog 내장에서 승격).
// 같은 의미(완료/실패 등)는 모든 화면에서 이 컴포넌트로 표기한다 (MUI Chip color 직접 사용 금지).
//
// 글자색은 모드별로 다른 토큰을 쓴다 (#727). 틴트(.light) 위에 .main 을 얹던 기존 방식은
// 라이트에서 5개 톤 전부 3.13~4.20:1 로 AA 미달이었다 — 라이트 틴트가 밝아 .main 이 묻힌다.
// 라이트는 한 단계 진한 .dark(4.86~6.02:1), 다크는 틴트가 어두우므로 .main 유지(4.89~7.45:1).
const TONE_PALETTE = {
  success: 'success',
  info: 'info',
  warning: 'warning',
  error: 'error',
  accent: 'primary', // v2 — .light 토큰이 모드별 틴트 (#562)
};

export function ToneChip({ tone, label, mono, sx }) {
  return (
    <Chip
      variant="filled"
      label={label}
      sx={[
        (theme) => {
          const key = TONE_PALETTE[tone];
          if (!key) return { bgcolor: theme.palette.grey[100], color: theme.palette.text.secondary };
          return { bgcolor: theme.palette[key].light, color: toneText(theme, key) };
        },
        {
          height: 24, fontSize: '11.5px', fontWeight: 600, border: 0,
          '& .MuiChip-label': { px: '11px' },
          ...(mono && { fontFamily: MONO, fontSize: '11px' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}

export default ToneChip;
