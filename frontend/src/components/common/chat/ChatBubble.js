import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { BRAND_GRADIENTS } from '../../../utils/brandGradients';

/**
 * v2 채팅 말풍선 (#572) — 대화형 화면 공용.
 * - user: 테라코타 틴트 버블, 우측 정렬
 * - assistant: 카드형 버블, 좌측 정렬
 * - system: 중앙 캡션
 * streaming 이면 content 대신 streamingText + 커서를 표시한다 (로직은 호출측 소유).
 */
export default function ChatBubble({ role, content, attachments, actions, streaming, streamingText }) {
  if (role === 'system') {
    return (
      <Box sx={{ alignSelf: 'center', maxWidth: '92%', textAlign: 'center', py: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.tertiary', whiteSpace: 'pre-wrap' }}>
          {content}
        </Typography>
      </Box>
    );
  }

  const isUser = role === 'user';
  return (
    <Box
      sx={{
        display: 'flex', gap: 2.5, maxWidth: '88%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      <Box
        sx={{
          width: 28, height: 28, borderRadius: '50%', flex: '0 0 auto',
          display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, mt: 0.5,
          ...(isUser
            ? { background: BRAND_GRADIENTS[0], color: 'common.white' }
            : { bgcolor: 'info.light', color: 'info.main' }),
        }}
      >
        {isUser ? '나' : 'AI'}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box
          sx={{
            borderRadius: '14px', px: 3.5, py: 2.75,
            ...(isUser
              ? { bgcolor: 'primary.light', borderBottomRightRadius: '4px' }
              : {
                  bgcolor: 'background.paper', border: 1, borderColor: 'divider',
                  boxShadow: 1, borderBottomLeftRadius: '4px',
                }),
          }}
        >
          {attachments?.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              {attachments.map((a, ai) => (
                <Box
                  key={ai}
                  component="img"
                  src={a.url}
                  alt="첨부 이미지"
                  sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                />
              ))}
            </Box>
          )}
          <Typography component="div" variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13.5, lineHeight: 1.65 }}>
            {streaming ? (
              <>
                {streamingText}
                {!streamingText && <CircularProgress size={14} sx={{ ml: 0.5 }} />}
                {streamingText && <Box component="span" sx={{ opacity: 0.5 }}>▍</Box>}
              </>
            ) : content}
          </Typography>
        </Box>
        {actions && <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>{actions}</Box>}
      </Box>
    </Box>
  );
}
