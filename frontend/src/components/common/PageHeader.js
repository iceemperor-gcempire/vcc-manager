import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * 페이지 헤더 — h1 타이틀 + 설명 + 우측 액션 (#548 공용화, 디자인 시스템 v1)
 *
 * 기존에 신규 페이지들이 각자 hand-roll 하던 패턴의 단일화.
 * - title: 페이지 제목 (h1, 28px)
 * - description: 보조 설명 (body1 · text.secondary · text-wrap pretty)
 * - actions: 우측 액션 버튼 영역 (없으면 미렌더)
 * - children: 설명 아래 부가 요소 (프로젝트 컨텍스트 칩 등)
 *
 * 제목 칸의 기준 폭(240px)은 줄바꿈 판단용이다 (#1053). basis 가 0 이면 버튼 묶음이 한 줄에 들어가는 한
 * 버튼이 내려가지 않고 제목이 남은 폭으로 눌린다 — 모바일 작업판 관리에서 제목이 한 글자씩 세로로 쌓였다.
 */
export default function PageHeader({ title, description, actions, children, sx }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap', mb: 4.5, ...sx }}>
      <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
        <Typography variant="h1">{title}</Typography>
        {description && (
          <Typography variant="body1" color="text.secondary" sx={{ textWrap: 'pretty', mt: 0.5 }}>
            {description}
          </Typography>
        )}
        {children}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
