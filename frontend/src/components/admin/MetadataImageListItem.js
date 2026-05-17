import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  InfoOutlined as InfoOutlinedIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon
} from '@mui/icons-material';
import MetadataMediaThumbnail from '../common/MetadataMediaThumbnail';
import { getKindLabel } from '../../utils/metadataItem';
import { getBaseModelColor } from '../common/MetadataItemCard';

// 한 줄 / 아이템 — 이미지 좌측, 정보 우측 (#344).
// 좌: 썸네일 (90x90). 우: 모델명+버전 / chips / 트리거 워드 또는 파일명 / 액션 버튼.
function MetadataImageListItem({
  item,
  selected = false,
  onDetailClick,
  onPrimary,
  primaryLabel,
  primaryVariant = 'select',
  onTrainedWordClick,
  trainedWordInsertMode = false,
  cardClickable = false,
  nsfwImageFilter = true,
  baseModelColorFn = getBaseModelColor
}) {
  if (!item) return null;

  const filteredImages = nsfwImageFilter
    ? (item.images || []).filter((img) => !img.nsfw)
    : (item.images || []);
  const previewImage = filteredImages[0];

  const handleRowClick = cardClickable && onPrimary ? () => onPrimary(item) : undefined;
  // multi-add 모드에서 이미 선택된 항목은 토글로 \"제거\" 표시 (#277)
  const resolvedPrimaryLabel = primaryLabel || (
    primaryVariant === 'insert' ? '프롬프트에 추가'
      : primaryVariant === 'add' ? (selected ? '제거' : '추가')
      : '선택'
  );

  return (
    <Box
      onClick={handleRowClick}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 1.5,
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        borderRadius: 1,
        mb: 1,
        p: 1,
        cursor: cardClickable ? 'pointer' : 'default',
        bgcolor: 'background.paper',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: 'primary.main' }
      }}
    >
      {/* 썸네일 */}
      <Box sx={{ width: 90, height: 90, flexShrink: 0, overflow: 'hidden', borderRadius: 1, bgcolor: 'action.hover' }}>
        {previewImage?.url ? (
          <MetadataMediaThumbnail image={previewImage} alt={item.displayName} width={90} height={90} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary">N/A</Typography>
          </Box>
        )}
      </Box>

      {/* 중앙: 정보 */}
      <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', py: 0.25 }}>
        {/* 모델명 + 버전 */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {selected && <CheckCircleIcon color="primary" fontSize="small" />}
            <Typography variant="subtitle2" noWrap title={item.displayName} sx={{ flexGrow: 1, fontWeight: 600 }}>
              {item.displayName}
            </Typography>
          </Stack>
          {item.versionName && (
            <Typography variant="caption" color="text.secondary" noWrap display="block" title={item.versionName}>
              버전: {item.versionName}
            </Typography>
          )}
        </Box>

        {/* chip 들 */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip label={getKindLabel(item.kind)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          {item.baseModel && (
            <Chip
              label={item.baseModel}
              size="small"
              color={baseModelColorFn(item.baseModel)}
              variant="outlined"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
          {item.capabilities?.slice(0, 2).map((c) => (
            <Chip key={c} label={c} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          ))}
          {!item.hasMetadata && (
            <Chip label={item.hash ? '미등록' : '메타데이터 없음'} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          )}
        </Box>

        {/* 3행: 트리거 워드 or 파일명 fallback */}
        {item.trainedWords?.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5, maxHeight: 24, overflow: 'hidden' }}>
            {item.trainedWords.slice(0, 4).map((w, i) => (
              <Chip
                key={i}
                label={w}
                size="small"
                onClick={onTrainedWordClick ? (e) => { e.stopPropagation(); onTrainedWordClick(w, item); } : undefined}
                color={trainedWordInsertMode ? 'primary' : 'default'}
                variant={trainedWordInsertMode ? 'outlined' : 'filled'}
                sx={{ height: 20, fontSize: '0.7rem', cursor: onTrainedWordClick ? 'pointer' : 'default' }}
              />
            ))}
            {item.trainedWords.length > 4 && (
              <Chip label={`+${item.trainedWords.length - 4}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" noWrap title={item.filename} sx={{ mt: 0.5, fontFamily: 'monospace' }}>
            {item.filename}
          </Typography>
        )}
      </Box>

      {/* 우측: 액션 */}
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
        {onDetailClick && (
          <Tooltip title="상세 정보">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDetailClick(item); }}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {item.modelUrl && (
          <Tooltip title="Civitai 에서 보기">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); window.open(item.modelUrl, '_blank'); }}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {onPrimary && !cardClickable && (
          <Button
            size="small"
            startIcon={primaryVariant === 'select' ? null : <AddIcon />}
            onClick={(e) => { e.stopPropagation(); onPrimary(item); }}
            variant={primaryVariant === 'insert' ? 'contained' : 'text'}
          >
            {resolvedPrimaryLabel}
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default React.memo(MetadataImageListItem);
