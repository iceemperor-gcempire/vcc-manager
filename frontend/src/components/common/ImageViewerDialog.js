import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Avatar,
  CircularProgress
} from '@mui/material';
import { Download, Close } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { downloadFromUrl } from '../../utils/download';

function ImageViewerDialog({ 
  images = [], 
  selectedIndex = 0, 
  open, 
  onClose,
  title = '이미지 보기',
  showNavigation = true,
  showMetadata = true
}) {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);

  useEffect(() => {
    if (selectedIndex !== undefined) {
      setCurrentIndex(selectedIndex);
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (open) {
      setCurrentIndex(selectedIndex || 0);
    }
  }, [open, selectedIndex]);

  // 로드 완료된 URL 집합 (#894). 이미지를 넘길 때 새 src 가 도착하기 전까지 <img> 가 빈 상태로
  // 레이아웃돼 다이얼로그가 쪼그라들었다 — 업스케일본(수 MB)에서 눈에 띄고, 캐시되면 재현이
  // 안 돼 "가끔 작게 나온다" 로 보였다. 로드 전엔 스피너를 띄우고 영역 높이를 고정한다.
  const [loadedUrls, setLoadedUrls] = useState(() => new Set());
  const markLoaded = (url) => setLoadedUrls((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const normalizedImages = (images || []).map(img => (typeof img === 'string' ? { url: img } : img));
  const safeIndexForEffect = Math.min(Math.max(currentIndex, 0), Math.max(normalizedImages.length - 1, 0));

  // 인접 이미지 프리로드 — 넘김 지연 자체를 줄인다
  useEffect(() => {
    if (!open || normalizedImages.length < 2) return;
    [safeIndexForEffect - 1, safeIndexForEffect + 1].forEach((i) => {
      const img = normalizedImages[i];
      if (!img || !img.url || typeof Image === 'undefined') return;
      const pre = new Image();
      pre.onload = () => markLoaded(img.url);
      pre.src = img.url;
    });
    // normalizedImages 는 매 렌더 새 배열 — url 목록 문자열로 의존성을 고정
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeIndexForEffect, normalizedImages.map((i) => i.url).join('|')]);

  if (!images || images.length === 0) return null;

  // 이전 항목에서 선택했던 인덱스가 더 짧은 이미지 목록으로 이월돼
  // 범위를 벗어나면 흰 화면이 뜨므로 유효 범위로 보정한다.
  const safeIndex = Math.min(Math.max(currentIndex, 0), normalizedImages.length - 1);
  const currentImage = normalizedImages[safeIndex];
  const isLoaded = loadedUrls.has(currentImage.url);
  
  const handleDownload = async () => {
    try {
      await downloadFromUrl(currentImage.url, currentImage.originalName || `image_${safeIndex + 1}.png`);
      toast.success('다운로드 완료');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('다운로드 실패. 잠시 후 다시 시도해주세요.');
    }
  };

  const displayTitle = normalizedImages.length > 1
    ? `${title} (${safeIndex + 1} / ${normalizedImages.length})`
    : title;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { bgcolor: 'black', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ color: 'white', pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {displayTitle}
          </Typography>
          <Box>
            <IconButton aria-label="다운로드" onClick={handleDownload} sx={{ color: 'white', mr: 1 }}>
              <Download />
            </IconButton>
            <IconButton aria-label="닫기" onClick={onClose} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', p: 2, bgcolor: 'black' }}>
        {/* 높이를 고정해 로드 전후로 다이얼로그가 출렁이지 않게 한다 (#894) */}
        <Box sx={{ position: 'relative', height: '70vh', display: 'grid', placeItems: 'center' }}>
          <img
            key={currentImage.url}
            src={currentImage.url}
            alt={`Image ${safeIndex + 1}`}
            onLoad={() => markLoaded(currentImage.url)}
            onError={() => markLoaded(currentImage.url)}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              opacity: isLoaded ? 1 : 0.35,
              transition: 'opacity 150ms'
            }}
          />
          {!isLoaded && (
            <Box role="progressbar" aria-label="이미지 불러오는 중"
              sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <CircularProgress sx={{ color: 'common.white' }} />
            </Box>
          )}
        </Box>
        
        {showMetadata && currentImage.metadata && (
          <Box mt={2} sx={{ color: 'white' }}>
            <Typography variant="body2">
              크기: {currentImage.metadata.width} x {currentImage.metadata.height}
            </Typography>
            {currentImage.size && (
              <Typography variant="body2">
                파일 크기: {(currentImage.size / 1024 / 1024).toFixed(2)} MB
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      
      {showNavigation && normalizedImages.length > 1 && (
        <DialogActions sx={{ bgcolor: 'black', justifyContent: 'center', pb: 2 }}>
          <Box display="flex" gap={1} maxWidth="100%" sx={{ overflowX: 'auto' }}>
            {normalizedImages.map((image, index) => (
              <Avatar
                key={index}
                src={image.url}
                onClick={() => setCurrentIndex(index)}
                sx={{
                  width: 60,
                  height: 60,
                  cursor: 'pointer',
                  border: index === safeIndex ? '2px solid white' : 'none',
                  opacity: index === safeIndex ? 1 : 0.7,
                  '&:hover': { opacity: 1 }
                }}
                variant="rounded"
              />
            ))}
          </Box>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default ImageViewerDialog;
