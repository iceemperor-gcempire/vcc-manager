import React from 'react';
import { Stack, Tooltip } from '@mui/material';
import { MenuBook } from '@mui/icons-material';
import ToneChip from './ToneChip';

// 작업판에 연결된 프롬프트 가이드 적용 표시 (#766).
//
// 가이드는 요청마다 시스템 프롬프트로 실려 응답이 느려지고 비용이 든다. 사용자가
// "왜 이 작업판만 오래 걸리지" 를 납득하려면 무엇이 적용 중인지 보여야 한다.
//
// 비활성(isActive:false) 가이드는 합성에서 제외되므로 표시하지 않는다 — 연결만 남고
// 적용되지 않는 것을 "적용됨" 으로 보여주면 안 된다.

function PromptGuideBadge({ workboard }) {
  const guides = (workboard?.promptGuideIds || []).filter((g) => g && typeof g === 'object' && g.isActive !== false);
  if (guides.length === 0) return null;

  const titles = guides.map((g) => g.title).filter(Boolean);
  const label = titles.length === 1 ? titles[0] : `가이드 ${titles.length}개`;

  return (
    <Tooltip title={`프롬프트 가이드가 적용됩니다 — ${titles.join(', ')}`}>
      <Stack direction="row" alignItems="center" spacing={0.5} component="span">
        <MenuBook sx={{ fontSize: 15, color: 'text.tertiary' }} />
        <ToneChip tone="info" label={label} />
      </Stack>
    </Tooltip>
  );
}

export default PromptGuideBadge;
