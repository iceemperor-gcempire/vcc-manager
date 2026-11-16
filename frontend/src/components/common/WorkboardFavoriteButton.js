import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Star, StarBorder } from '@mui/icons-material';

// 작업판 즐겨찾기 별 (#1216) — 목록 카드·생성 화면 헤더·대시보드 카드.
// 카드 전체가 클릭 영역인 곳에 놓이므로 클릭이 카드로 번지지 않게 막는다.
function WorkboardFavoriteButton({ active, onToggle, disabled = false, size = 'small' }) {
  const label = active ? '즐겨찾기 해제' : '즐겨찾기 추가';
  return (
    <Tooltip title={label}>
      {/* disabled 버튼에도 툴팁이 붙도록 span 으로 감싼다 */}
      <span>
        <IconButton
          aria-label={label}
          aria-pressed={!!active}
          size={size}
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
          sx={{ color: active ? 'warning.main' : 'text.tertiary' }}
        >
          {active ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export default WorkboardFavoriteButton;
