import React, { useRef } from 'react';
import { Box } from '@mui/material';

// Civitai 미리보기 미디어 썸네일 — LoRA / Model picker 공용.
// 메모리 절약 포인트:
// - 이미지: `loading="lazy"` 로 viewport 밖 카드는 fetch 안 함
// - 비디오: `preload="metadata"` 만 받고, hover 시에만 재생 (idle 메모리 최소화)

export function isVideoMedia(img) {
  if (img?.type === 'video') return true;
  if (!img?.url) return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(img.url);
}

function MetadataMediaThumbnail({ image, alt, height, width, sx }) {
  const videoRef = useRef(null);

  if (!image?.url) return null;

  if (isVideoMedia(image)) {
    return (
      <Box
        component="video"
        ref={videoRef}
        src={image.url}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={(e) => e.target.play().catch(() => {})}
        onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
        sx={{
          width: width || '100%',
          height: height || 140,
          objectFit: 'cover',
          display: 'block',
          cursor: 'pointer',
          ...sx
        }}
      />
    );
  }

  return (
    <Box
      component="img"
      src={image.url}
      alt={alt}
      loading="lazy"
      sx={{
        width: width || '100%',
        height: height || 140,
        objectFit: 'cover',
        display: 'block',
        ...sx
      }}
    />
  );
}

export default React.memo(MetadataMediaThumbnail);
