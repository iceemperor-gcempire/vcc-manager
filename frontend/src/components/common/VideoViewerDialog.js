import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button
} from '@mui/material';
import { Close, Download, NavigateBefore, NavigateNext } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { imageAPI } from '../../services/api';

function VideoViewerDialog({ 
  videos = [], 
  selectedIndex = 0, 
  open, 
  onClose,
  title = '동영상 보기'
}) {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);

  useEffect(() => {
    setCurrentIndex(selectedIndex);
  }, [selectedIndex, open]);

  if (!videos || videos.length === 0) return null;

  // 이전 항목의 인덱스가 더 짧은 목록으로 이월돼 범위를 벗어나면
  // 빈 플레이어가 뜨므로 유효 범위로 보정한다.
  const safeIndex = Math.min(Math.max(currentIndex, 0), videos.length - 1);
  const currentVideo = videos[safeIndex];

  const handleDownload = async () => {
    if (!currentVideo) return;
    
    try {
      let blob;
      
      if (currentVideo._id) {
        const response = await imageAPI.downloadVideo(currentVideo._id);
        blob = new Blob([response.data]);
      } else if (currentVideo.url) {
        const response = await fetch(currentVideo.url);
        blob = await response.blob();
      } else {
        throw new Error('No video source available');
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = currentVideo.originalName || `video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('다운로드 완료');
      
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 1000);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('다운로드 실패');
    }
  };

  const handlePrev = () => {
    setCurrentIndex(Math.max(0, safeIndex - 1));
  };

  const handleNext = () => {
    setCurrentIndex(Math.min(videos.length - 1, safeIndex + 1));
  };

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
            {title} {videos.length > 1 && `(${safeIndex + 1}/${videos.length})`}
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
        <video
          key={currentVideo?._id || safeIndex}
          src={currentVideo?.url}
          controls
          autoPlay
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            borderRadius: '8px'
          }}
        />
        
        {videos.length > 1 && (
          <Box display="flex" justifyContent="center" gap={2} mt={2}>
            <Button
              variant="outlined"
              onClick={handlePrev}
              disabled={safeIndex === 0}
              startIcon={<NavigateBefore />}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              이전
            </Button>
            <Button
              variant="outlined"
              onClick={handleNext}
              disabled={safeIndex === videos.length - 1}
              endIcon={<NavigateNext />}
              sx={{ color: 'white', borderColor: 'white' }}
            >
              다음
            </Button>
          </Box>
        )}

        <Box mt={2} sx={{ color: 'white' }}>
          <Typography variant="body2">
            {currentVideo?.originalName}
          </Typography>
          {currentVideo?.metadata && (
            <Typography variant="body2">
              크기: {currentVideo.metadata.width} x {currentVideo.metadata.height}
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default VideoViewerDialog;
