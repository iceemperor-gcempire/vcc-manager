import React, { useState } from 'react';
import { Box, Button, Collapse, Typography } from '@mui/material';
import { Rule } from '@mui/icons-material';
import ToneChip from './ToneChip';

// 대상 작업판의 AI 프롬프트 생성 지침 표시 (#1109).
//
// 이미지·영상 판에서 AI 프롬프트 생성을 열면 그 판의 지침이 시스템 프롬프트에 함께 들어간다.
// 사용자가 고른 텍스트 판과 별개로 들어가는 지시라, 무엇이 적용되는지 보이지 않으면 결과를 납득하기 어렵다.
// 읽기 전용이다 — 지침은 관리자가 작업판 편집기에서 고친다.

function TargetInstructionsNotice({ instructions }) {
  const [open, setOpen] = useState(false);
  const text = (instructions || '').trim();
  if (!text) return null;

  return (
    <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}>
      {/* 좁은 화면에서는 설명을 둘째 줄로 내린다 — 칩·버튼 사이에 끼우면 몇 글자씩 꺾여 읽히지 않는다 (390px) */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Rule sx={{ fontSize: 16, color: 'text.secondary' }} />
        <ToneChip tone="info" label="작업판 지침 적용됨" />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ flex: 1, minWidth: 0, order: { xs: 3, sm: 0 }, flexBasis: { xs: '100%', sm: 0 } }}
        >
          이 작업판의 프롬프트 작성 지침이 함께 들어갑니다.
        </Typography>
        <Button size="small" onClick={() => setOpen((v) => !v)} aria-expanded={open} sx={{ ml: 'auto' }}>
          {open ? '접기' : '지침 보기'}
        </Button>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Typography
          variant="body2"
          sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto' }}
        >
          {text}
        </Typography>
      </Collapse>
    </Box>
  );
}

export default TargetInstructionsNotice;
