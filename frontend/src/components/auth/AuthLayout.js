import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { AUTH_BG_GRADIENT_DARK, AUTH_BG_GRADIENT_LIGHT } from '../../utils/brandGradients';

// 인증 화면 공용 레이아웃 (#566) — 좌 브랜드 패널 + 우 폼 카드. 모바일은 상단 띠로 축소.
// 브랜드 그라데이션은 인증 화면 전용 무드 (라이트 테라코타 / 다크 딥 민트).
const TAGLINE = '이미지 · 영상 · 텍스트 생성을\n한 곳에서 관리하세요';
const TAGLINE_SUB = 'ComfyUI · OpenAI · Gemini 백엔드 위에서 작업판으로 생성하고, 프로젝트로 묶고, 파이프라인으로 잇습니다.';

export default function AuthLayout({ children }) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const brandBg = dark ? AUTH_BG_GRADIENT_DARK : AUTH_BG_GRADIENT_LIGHT;
  const tile = dark ? 'rgba(61,214,184,0.07)' : 'rgba(255,255,255,0.10)';
  const tileAlt = dark ? 'rgba(61,214,184,0.12)' : 'rgba(255,255,255,0.16)';
  const tileBorder = dark ? 'rgba(61,214,184,0.12)' : 'rgba(255,255,255,0.14)';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', flexDirection: { xs: 'column', md: 'row' }, bgcolor: 'background.default' }}>
      {/* 브랜드 패널 */}
      <Box
        sx={{
          flex: { md: 1 },
          background: brandBg,
          color: 'common.white',
          px: { xs: 6, md: 12 },
          py: { xs: 5, md: 11 },
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: 40, height: 40, borderRadius: '11px',
            bgcolor: dark ? 'rgba(61,214,184,0.18)' : 'rgba(255,255,255,0.16)',
            color: dark ? 'primary.main' : 'common.white',
            display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
          }}
        >
          V
        </Box>

        {/* 추상 타일 패턴 (가짜 스크린샷 금지 원칙 — 장식은 추상으로) */}
        <Box
          sx={{
            position: 'absolute', right: -40, top: 60,
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: 'repeat(3, 86px)', gap: 2.5,
            transform: 'rotate(8deg)', opacity: 0.6, pointerEvents: 'none',
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <Box key={i} sx={{ aspectRatio: '1', borderRadius: '10px', bgcolor: i % 2 ? tileAlt : tile, border: `1px solid ${tileBorder}` }} />
          ))}
        </Box>

        <Box sx={{ mt: 'auto', display: { xs: 'none', md: 'block' } }}>
          <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.35, whiteSpace: 'pre-line' }}>
            {TAGLINE}
          </Typography>
          <Typography sx={{ fontSize: 13.5, opacity: 0.75, mt: 2.5, lineHeight: 1.6, maxWidth: 340 }}>
            {TAGLINE_SUB}
          </Typography>
        </Box>

        {/* 모바일 — 로고 옆 타이틀만 */}
        <Typography sx={{ display: { xs: 'block', md: 'none' }, mt: 3, fontSize: 17, fontWeight: 800 }}>
          VCC Manager
        </Typography>
      </Box>

      {/* 폼 영역 */}
      <Box sx={{ width: { md: 480 }, display: 'flex', alignItems: 'center', justifyContent: 'center', p: { xs: 6, md: 8 } }}>
        <Box sx={{ width: '100%', maxWidth: 360 }}>{children}</Box>
      </Box>
    </Box>
  );
}

// 폼 카드 상단 타이틀 (h2 22/800 + 보조 설명)
export function AuthTitle({ title, sub }) {
  return (
    <Box sx={{ mb: 6 }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{title}</Typography>
      {sub && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, textWrap: 'pretty' }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}
