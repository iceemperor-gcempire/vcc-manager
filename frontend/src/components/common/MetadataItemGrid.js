import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * 메타데이터 아이템 카드 그리드 — auto-fill 기반의 일관된 layout.
 * LoRA admin / Model admin / Picker modal 에서 공용.
 *
 * 정책:
 * - `display: grid` + `auto-fill` 로 화면 폭에 따라 자동 채움
 * - xs (모바일): minmax(150px, 1fr) — 좁은 화면 효율
 * - sm+ (태블릿/데스크탑): minmax(200px, 1fr)
 * - 카드 max width 280 (sm+) — 너무 늘어나는 것 방지
 *
 * @param {Object} props
 * @param {Array} props.items — 렌더할 아이템 배열
 * @param {(item, index) => React.Node} props.renderItem — 카드 렌더 콜백
 * @param {(item, index) => string|number} [props.getKey] — key 추출 (default: item.id || index)
 * @param {React.Node} [props.empty] — items.length === 0 일 때 렌더할 컨텐츠
 * @param {Object} [props.sx] — 추가 스타일
 */
function MetadataItemGrid({ items, renderItem, getKey, empty, sx }) {
  if (!items || items.length === 0) {
    if (empty) return empty;
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          항목이 없습니다.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(auto-fill, minmax(150px, 1fr))',
          sm: 'repeat(auto-fill, minmax(200px, 1fr))'
        },
        gap: 2,
        '& > *': {
          maxWidth: { xs: 'none', sm: 280 }
        },
        ...sx
      }}
    >
      {items.map((item, index) => {
        const key = getKey ? getKey(item, index) : (item?.id ?? index);
        return <Box key={key}>{renderItem(item, index)}</Box>;
      })}
    </Box>
  );
}

export default MetadataItemGrid;
