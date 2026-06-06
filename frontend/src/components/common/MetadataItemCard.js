import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Button
} from '@mui/material';
import {
  Info as InfoIcon,
  InfoOutlined as InfoOutlinedIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
  Psychology as PsychologyIcon,
  ImageOutlined as ImageOutlinedIcon,
  HideImageOutlined as HideImageOutlinedIcon
} from '@mui/icons-material';
import MetadataMediaThumbnail from './MetadataMediaThumbnail';
import { getKindLabel } from '../../utils/metadataItem';

// baseModel → MUI color 매핑 — LoRA / Model 공용. 기존 LoraListModal 의 정책 그대로.
export function getBaseModelColor(baseModel) {
  if (!baseModel) return 'default';
  if (baseModel.includes('SDXL')) return 'primary';
  if (baseModel.includes('SD 1.5') || baseModel.includes('SD1')) return 'secondary';
  if (baseModel.includes('Pony')) return 'warning';
  if (baseModel.includes('Flux')) return 'info';
  if (baseModel.includes('Illustrious')) return 'primary';
  if (baseModel.includes('NoobAI')) return 'secondary';
  return 'default';
}

/**
 * 공통 메타데이터 카드 — LoRA / Checkpoint / Provider 모델 모두 지원.
 *
 * @param {Object} props
 * @param {import('../../utils/metadataItem').MetadataItem} props.item
 * @param {boolean} [props.selected] — 선택 표시 (단일 선택 picker)
 * @param {(item) => void} [props.onDetailClick] — 디테일 버튼 클릭 콜백 (#333)
 * @param {(item) => void} [props.onPrimary] — 카드 전체 클릭 또는 primary 버튼 액션. 미지정 시 클릭 비활성
 * @param {string} [props.primaryLabel] — primary 버튼 라벨 (기본 '선택')
 * @param {'select'|'add'|'insert'} [props.primaryVariant] — 버튼 스타일 힌트
 * @param {(word, item) => void} [props.onTrainedWordClick] — 트리거 워드 (LoRA) 클릭 콜백. 미지정 시 chip 클릭 무효
 * @param {boolean} [props.trainedWordInsertMode] — 트리거 워드를 "프롬프트에 삽입" 안내로 표시 (LoRA picker 의 prompt 삽입 모드)
 * @param {boolean} [props.cardClickable] — 카드 전체 영역 클릭으로 onPrimary 호출 (default: false. true 시 picker 용)
 * @param {boolean} [props.nsfwImageFilter] — NSFW 미리보기 이미지 숨김
 * @param {Function} [props.baseModelColorFn] — baseModel → color 매핑 (default: getBaseModelColor)
 */
const MetadataItemCard = React.memo(function MetadataItemCard({
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

  const handleCardClick = cardClickable && onPrimary ? () => onPrimary(item) : undefined;

  // 썸네일이 없을 때의 placeholder (#510). 언어(LLM)/이미지 API 모델은 썸네일이 없는 게 정상이라
  // 텍스트 대신 종류에 맞는 아이콘을 보여준다. (provider-model 의 outputFormats 로 언어/이미지 구분)
  const noImagePlaceholder = (() => {
    if (item.kind === 'provider-model') {
      const fmts = item.outputFormats || [];
      // 이미지 전용으로 분류된 모델(DALL-E/Imagen 등)만 이미지 아이콘.
      // 그 외(텍스트 또는 미분류 — 로컬 LLM 은 분류 불가라 outputFormats 가 비는 경우가 많음)는
      // 언어 모델로 본다.
      if (fmts.includes('image') && !fmts.includes('text')) return { Icon: ImageOutlinedIcon, label: '이미지 모델' };
      return { Icon: PsychologyIcon, label: '언어 모델' };
    }
    return { Icon: HideImageOutlinedIcon, label: '미리보기 없음' };
  })();

  // multi-add 모드에서 이미 선택된 항목은 토글로 \"제거\" 표시 (#277)
  const resolvedPrimaryLabel = primaryLabel || (
    primaryVariant === 'insert' ? '프롬프트에 추가'
      : primaryVariant === 'add' ? (selected ? '제거' : '추가')
      : '선택'
  );

  return (
    <Card
      variant={selected ? 'elevation' : 'outlined'}
      elevation={selected ? 8 : 0}
      onClick={handleCardClick}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: cardClickable ? 'pointer' : 'default',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        borderColor: selected ? 'primary.main' : undefined,
        borderWidth: selected ? 2 : 1,
        '&:hover': { borderColor: 'primary.main' }
      }}
    >
      {/* 미리보기 — 썸네일 없으면 종류별 아이콘 placeholder (#510) */}
      {previewImage?.url ? (
        <MetadataMediaThumbnail image={previewImage} alt={item.displayName} />
      ) : (
        <Box
          sx={{
            height: 140,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
            color: 'text.disabled'
          }}
        >
          <noImagePlaceholder.Icon sx={{ fontSize: 44 }} />
          <Typography variant="caption" color="text.secondary">
            {noImagePlaceholder.label}
          </Typography>
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* 이름 + 선택 표시 */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {selected && <CheckCircleIcon color="primary" fontSize="small" />}
          <Typography variant="subtitle2" noWrap title={item.displayName} sx={{ flexGrow: 1 }}>
            {item.displayName}
          </Typography>
        </Stack>

        {/* 버전명 (civitai 메타에 versionName 이 있을 때만) */}
        {item.versionName && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            display="block"
            title={item.versionName}
          >
            버전: {item.versionName}
          </Typography>
        )}

        {/* 배지: kind + baseModel + capabilities + 메타데이터 상태 */}
        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip label={getKindLabel(item.kind)} variant="outlined" />
          {item.baseModel && (
            <Chip
              label={item.baseModel}
              color={baseModelColorFn(item.baseModel)}
              variant="outlined"
            />
          )}
          {item.capabilities.slice(0, 3).map((c) => (
            <Chip key={c} label={c} variant="outlined" />
          ))}
          {!item.hasMetadata && !item.hash && (
            <Tooltip title={item.hashError || '메타데이터 없음 — sync 가 아직 안 됐거나 Civitai/provider 미등록'}>
              <Chip icon={<InfoIcon />} label="메타데이터 없음" variant="outlined" />
            </Tooltip>
          )}
          {item.hash && !item.hasMetadata && (
            <Tooltip title="Civitai 미등록 (custom merge / private 모델)">
              <Chip label="미등록" variant="outlined" />
            </Tooltip>
          )}
        </Box>

        {/* contextWindow (provider 만) */}
        {item.contextWindow && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            context: {item.contextWindow.toLocaleString()} tokens
          </Typography>
        )}

        {/* 트리거 워드 (LoRA / civitai trainedWords) — 최대 3개. 전체 목록은 디테일 다이얼로그에서 */}
        {item.trainedWords?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              트리거 워드{onTrainedWordClick ? (trainedWordInsertMode ? ' (클릭시 프롬프트에 삽입)' : ' (클릭시 복사)') : ''}:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {item.trainedWords.slice(0, 3).map((word, i) => (
                <Chip
                  key={i}
                  label={word}
                  onClick={onTrainedWordClick ? (e) => {
                    e.stopPropagation();
                    onTrainedWordClick(word, item);
                  } : undefined}
                  sx={{ cursor: onTrainedWordClick ? 'pointer' : 'default' }}
                  color={trainedWordInsertMode ? 'primary' : 'default'}
                  variant={trainedWordInsertMode ? 'outlined' : 'filled'}
                />
              ))}
              {item.trainedWords.length > 3 && (
                <Chip label={`+${item.trainedWords.length - 3}`} variant="outlined" />
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Stack direction="row" spacing={0.5}>
          {onDetailClick && (
            <Tooltip title="상세 정보">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onDetailClick(item);
                }}
              >
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {item.modelUrl && (
            <Tooltip title="Civitai 에서 보기">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(item.modelUrl, '_blank');
                }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {onPrimary && !cardClickable && (
          <Button
            startIcon={primaryVariant === 'select' ? null : <AddIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onPrimary(item);
            }}
            variant={primaryVariant === 'insert' ? 'contained' : 'text'}
          >
            {resolvedPrimaryLabel}
          </Button>
        )}
      </CardActions>
    </Card>
  );
});

export default MetadataItemCard;
