import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Chip,
  Autocomplete,
  Alert,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import { MONO } from '../../../theme';
import { formatGuideSize } from '../../../utils/guideSize';

// 프롬프트 가이드 연결 (#766).
//
// 가이드는 소유자가 없는 전역 문서라, 이 작업판을 볼 수 있는 모든 사용자에게 동일하게
// 적용된다 — 사용자 소유 문서(세계관 등)처럼 사람에 따라 빠지는 일이 없다.
//
// 선택 순서가 곧 합성 순서다. 순서가 바뀌면 LLM 출력이 달라지므로 칩에 번호를 노출한다.
// 순서 변경 UI(dnd)는 넣지 않았다 — 보통 1~2개이고, 지우고 다시 고르면 되므로
// 편집기 복잡도를 늘릴 만한 이득이 없다.

function PromptGuideCard({ control, guides }) {
  const byId = new Map((guides || []).map((g) => [g._id, g]));

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>프롬프트 가이드</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        선택한 순서대로 시스템 프롬프트 맨 앞에 합성됩니다. 이 작업판을 볼 수 있는 모든 사용자에게 동일하게 적용됩니다.
      </Typography>

      <Controller
        name="promptGuideIds"
        control={control}
        render={({ field }) => {
          const selected = field.value || [];
          const totalChars = selected.reduce((sum, id) => sum + (byId.get(id)?.contentLength || 0), 0);

          return (
            <>
              <Autocomplete
                multiple
                size="small"
                options={(guides || []).map((g) => g._id)}
                value={selected}
                onChange={(_, v) => field.onChange(v)}
                getOptionLabel={(id) => byId.get(id)?.title || `삭제된 가이드 (${String(id).slice(-6)})`}
                renderOption={(props, id) => {
                  const g = byId.get(id);
                  return (
                    <li {...props} key={id}>
                      <Box>
                        <Typography variant="body2">
                          {g?.title}
                          {g?.targetModel ? ` · ${g.targetModel}` : ''}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary' }}>
                          {formatGuideSize(g?.contentLength)}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                renderTags={(value, getTagProps) =>
                  value.map((id, index) => {
                    const g = byId.get(id);
                    return (
                      <Chip
                        {...getTagProps({ index })}
                        key={id}
                        label={`${index + 1}. ${g?.title || `삭제된 가이드 (${String(id).slice(-6)})`}`}
                        color={g ? 'primary' : 'warning'}
                        variant="outlined"
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={(guides || []).length === 0 ? '가이드 없음 — 프롬프트 가이드 화면에서 먼저 생성' : '가이드 선택'}
                  />
                )}
              />

              {selected.length > 0 && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, fontFamily: MONO, color: 'text.tertiary' }}>
                  합계 {formatGuideSize(totalChars)} — 프롬프트 생성 요청마다 실립니다
                </Typography>
              )}

              {selected.some((id) => !byId.has(id)) && (
                <Alert severity="warning" sx={{ mt: 1.5 }}>
                  삭제되었거나 비활성화된 가이드가 연결 목록에 남아 있습니다. 해당 칩을 지운 뒤 저장하세요 —
                  이 항목은 합성에서 제외되므로 지금도 적용되지 않고 있습니다.
                </Alert>
              )}
            </>
          );
        }}
      />
    </Paper>
  );
}

export default PromptGuideCard;
