import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  Link
} from '@mui/material';
import {
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import MetadataMediaThumbnail from './MetadataMediaThumbnail';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { getKindLabel } from '../../utils/metadataItem';
import { getBaseModelColor } from './MetadataItemCard';

// 베이스 모델 / LoRA 카드의 상세 메타데이터 다이얼로그 (#333).
// 카드에서 디테일 버튼 클릭 시 표시. 이름/버전, 미디어 그리드, 설명, trained words,
// 파일 경로, hash, civitai 링크 등 카드에는 표시하지 않은 항목까지 모두 모아 보여줌.
function MetadataDetailDialog({ open, onClose, item, nsfwImageFilter = true, baseModelColorFn = getBaseModelColor }) {
  if (!item) return null;

  const filteredImages = nsfwImageFilter
    ? (item.images || []).filter((img) => !img.nsfw)
    : (item.images || []);
  const hasCivitai = item.metadataSource === 'civitai';
  const hasProvider = item.metadataSource === 'provider';

  const handleCopyFilename = () => {
    navigator.clipboard.writeText(item.filename || '').then(
      () => toast.success('파일 경로를 복사했습니다.'),
      () => toast.error('복사 실패')
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
            {item.displayName}
          </Typography>
          {item.versionName && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              버전: {item.versionName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* 배지 */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
          <Chip label={getKindLabel(item.kind)} size="small" variant="outlined" />
          {item.baseModel && (
            <Chip
              label={item.baseModel}
              size="small"
              color={baseModelColorFn(item.baseModel)}
              variant="outlined"
            />
          )}
          {item.capabilities?.map((c) => (
            <Chip key={c} label={c} size="small" variant="outlined" />
          ))}
        </Box>

        {/* 미디어 그리드 */}
        {filteredImages.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 1,
              mb: 2
            }}
          >
            {filteredImages.map((img, i) => (
              <MetadataMediaThumbnail
                key={i}
                image={img}
                alt={`Preview ${i + 1}`}
                height={150}
                sx={{ borderRadius: 1 }}
              />
            ))}
          </Box>
        )}

        {/* 설명 */}
        {item.description && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              설명
            </Typography>
            {hasCivitai ? (
              <Typography
                variant="body2"
                color="text.primary"
                sx={{ '& p': { margin: 0 }, '& img': { maxWidth: '100%' } }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
              />
            ) : (
              <Typography variant="body2" color="text.primary" sx={{ whiteSpace: 'pre-wrap' }}>
                {item.description}
              </Typography>
            )}
          </Box>
        )}

        {/* 트리거 워드 */}
        {item.trainedWords?.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              트리거 워드
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {item.trainedWords.map((word, i) => (
                <Chip key={i} label={word} size="small" />
              ))}
            </Box>
          </Box>
        )}

        {item.contextWindow && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            context: {item.contextWindow.toLocaleString()} tokens
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {/* 메타데이터 */}
        <Stack spacing={1}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              파일 경로
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ wordBreak: 'break-all', flexGrow: 1, fontFamily: 'monospace' }}>
                {item.filename || '—'}
              </Typography>
              {item.filename && (
                <Tooltip title="복사">
                  <IconButton size="small" onClick={handleCopyFilename}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Box>

          {item.hash && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                SHA256
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>
                {item.hash}
              </Typography>
            </Box>
          )}

          {item.modelUrl && (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Civitai
              </Typography>
              <Link href={item.modelUrl} target="_blank" rel="noopener noreferrer" variant="body2">
                {item.modelUrl} <OpenInNewIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} />
              </Link>
            </Box>
          )}

          {!item.hasMetadata && (
            <Typography variant="caption" color="text.secondary">
              메타데이터 없음 — Civitai 미등록 또는 sync 대기 중
            </Typography>
          )}

          {hasProvider && (
            <Typography variant="caption" color="text.secondary">
              메타데이터 출처: provider API
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default MetadataDetailDialog;
