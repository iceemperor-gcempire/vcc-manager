import React, { useRef } from 'react';
import { Box } from '@mui/material';

// Civitai 미리보기 미디어 썸네일 — LoRA / Model picker 공용.
// 메모리 절약 포인트:
// - 이미지: `loading="lazy"` 로 viewport 밖 카드는 fetch 안 함
// - 비디오: `preload="metadata"` 만 받고, hover 시에만 재생 (idle 메모리 최소화)
// 다운로드 절약 포인트 (#268):
// - Civitai 의 `/original=true/` 경로 → `/width=N/` 으로 자동 치환. CDN 측에서
//   resize 된 썸네일 반환 (수 MB → 수십 KB). 카드 크기 (140px) 에 맞춰 default 300

export function isVideoMedia(img) {
  if (img?.type === 'video') return true;
  if (!img?.url) return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(img.url);
}

// Civitai CDN URL 의 transform segment 를 width 기반 thumbnail 로 치환.
// 비-Civitai URL 은 변경 없이 통과.
export function civitaiThumbnailUrl(url, width = 300) {
  if (!url || typeof url !== 'string') return url;
  // image.civitai.com 의 URL 만 처리
  if (!url.includes('image.civitai.com')) return url;
  // /original=true/  → /width=N/
  // 또는 /width=NN/ 이미 있으면 그대로 (사용자 명시 size 존중)
  if (/\/width=\d+/.test(url)) return url;
  return url.replace(/\/original=true\//, `/width=${width}/`);
}

function MetadataMediaThumbnail({ image, alt, height, width, sx }) {
  const videoRef = useRef(null);

  if (!image?.url) return null;

  // Civitai 의 /original=true/ → /width=N/ 자동 치환 (이미지). 비디오는 transform 무관.
  // height 가 명시된 경우 그 값을 width 보다 약간 크게 잡아 quality 보장 (CDN 은 long-edge 기준).
  const targetWidth = Math.max((height || 140) * 2, 300);  // retina 대응 + 최소 300
  const optimizedUrl = isVideoMedia(image) ? image.url : civitaiThumbnailUrl(image.url, targetWidth);

  if (isVideoMedia(image)) {
    return (
      <Box
        component="video"
        ref={videoRef}
        src={optimizedUrl}
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
      src={optimizedUrl}
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
