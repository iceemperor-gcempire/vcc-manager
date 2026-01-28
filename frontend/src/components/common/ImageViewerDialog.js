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

  const currentImage = normalizedImages[currentIndex];
  
  const handleDownload = async () => {
    try {
      const response = await fetch(currentImage.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
      
      if (isIOS && isSafari) {
        const newWindow = window.open(blobUrl, '_blank');
        if (!newWindow) {
          window.location.href = blobUrl;
        }
        toast.success('이미지를 길게 눌러서 저장하세요');
      } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = currentImage.originalName || `image_${currentIndex + 1}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('다운로드 완료');
      }
      
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('다운로드 실패. 잠시 후 다시 시도해주세요.');
    }
  };

  const displayTitle = normalizedImages.length > 1 
    ? `${title} (${currentIndex + 1} / ${normalizedImages.length})`
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
          alt={`Image ${currentIndex + 1}`}
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
                  border: index === currentIndex ? '2px solid white' : 'none',
                  opacity: index === currentIndex ? 1 : 0.7,
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
