import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * 빈 상태 — 1px dashed 패턴 (#548 공용화, 디자인 시스템 v1)
 *
 * 페이지마다 갈리던 빈 상태(2px dashed / Alert / 맨 텍스트)의 표준형.
 * - icon: 상단 아이콘 엘리먼트 (선택)
 * - title / description / action
 */
export default function EmptyState({ icon, title, description, action, sx }) {
  return (
    <Box sx={{ p: 5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2, ...sx }}>
      {icon && (
        <Box sx={{ color: 'text.disabled', mb: 1.5, '& svg': { fontSize: 32 } }}>{icon}</Box>
      )}
      {title && <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{title}</Typography>}
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: action ? 2 : 0 }}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
