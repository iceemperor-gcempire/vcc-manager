import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { MONO } from '../../theme';

/**
 * 세그먼트 컨트롤 — 언더라인 탭 + 카운트 (#548 공용화, 디자인 목업 27/28 기준)
 *
 * MyImages 의 ContentTabLabel 패턴을 일반화. 필 버튼/칩 등 페이지별로 갈리던
 * 세그먼트 구현을 단일화한다.
 * - items: [{ value, label, count?, icon? }]
 * - value/onChange: 선택 값 제어 (onChange 는 value 만 받음)
 */
export function SegmentTabLabel({ label, count }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      {label}
      {count !== undefined && count !== null && (
        <Box component="span" sx={{ fontFamily: MONO, fontSize: 11, color: 'text.tertiary' }}>
          {count}
        </Box>
      )}
    </Box>
  );
}

export default function SegmentTabs({ value, onChange, items, sx }) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4.5, ...sx }}>
      <Tabs
        value={value}
        onChange={(e, v) => onChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {items.map((it) => (
          <Tab
            key={it.value}
            value={it.value}
            disableRipple
            icon={it.icon}
            iconPosition={it.icon ? 'start' : undefined}
            label={<SegmentTabLabel label={it.label} count={it.count} />}
          />
        ))}
      </Tabs>
    </Box>
  );
}
