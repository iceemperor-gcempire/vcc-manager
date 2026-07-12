import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  IconButton,
  Avatar
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

  if (!images || images.length === 0) return null;

  const normalizedImages = images.map(img => {
    if (typeof img === 'string') {
      return { url: img };
    }
    return img;
  });

  // 이전 항목에서 선택했던 인덱스가 더 짧은 이미지 목록으로 이월돼
  // 범위를 벗어나면 흰 화면이 뜨므로 유효 범위로 보정한다.
  const safeIndex = Math.min(Math.max(currentIndex, 0), normalizedImages.length - 1);
  const currentImage = normalizedImages[safeIndex];
  
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
            <IconButton onClick={handleDownload} sx={{ color: 'white', mr: 1 }}>
              <Download />
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', p: 2, bgcolor: 'black' }}>
        <img
          src={currentImage.url}
          alt={`Image ${safeIndex + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            borderRadius: '8px'
          }}
        />
        
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
