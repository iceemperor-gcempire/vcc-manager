import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Tabs,
  Tab
} from '@mui/material';
import MediaGrid from './MediaGrid';
import { imageAPI } from '../../services/api';

// 참조 비디오 선택 다이얼로그 (#753) — ImageSelectDialog 와 대칭.
// 업로드한 비디오(UploadedVideo)와 생성한 비디오(GeneratedVideo) 모두 참조로 쓸 수 있다.
function VideoSelectDialog({
  open,
  onClose,
  onSelect,
  title = '비디오 선택',
  multiple = false,
  maxVideos = 1,
  initialSelected = []
}) {
  const [tab, setTab] = useState(0);
  const [selectedVideos, setSelectedVideos] = useState([]);

  useEffect(() => {
    if (open) {
      setSelectedVideos(initialSelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSelectionChange = (newSelection) => {
    if (multiple) {
      if (newSelection.length <= maxVideos) {
        setSelectedVideos(newSelection);
      }
    } else {
      setSelectedVideos(newSelection.slice(0, 1));
    }
  };

  const toVideoEntry = (item) => ({
    videoId: item.imageId, // MediaGrid 선택 항목의 공통 키 이름 (item._id)
    video: item.image
  });

  const handleConfirm = () => {
    if (selectedVideos.length > 0) {
      if (multiple) {
        onSelect(selectedVideos.map(toVideoEntry));
      } else {
        onSelect(toVideoEntry(selectedVideos[0]));
      }
      onClose();
      setSelectedVideos([]);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedVideos([]);
  };

  const fetchFn = (params) => {
    if (tab === 0) return imageAPI.getUploadedVideos(params);
    return imageAPI.getVideos(params);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title}
        {multiple && (
          <Typography variant="body2" color="text.secondary">
            {selectedVideos.length}/{maxVideos} 선택됨
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="업로드한 비디오" />
          <Tab label="생성한 비디오" />
        </Tabs>

        <MediaGrid
          key={`video-select-${tab}`}
          type="video"
          fetchFn={fetchFn}
          queryKey={`videoSelect-${tab}`}
          // 열 때마다 새로 받는다 (#827) — ImageSelectDialog 와 같은 이유
          staleTime={0}
          selectable
          multiSelect={multiple}
          selectedItems={selectedVideos}
          onSelectionChange={handleSelectionChange}
          showSearch={false}
          showTags={false}
          readOnly
          pageSize={12}
          columns={{ xs: 6, sm: 4, md: 3 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={selectedVideos.length === 0}
        >
          선택
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default VideoSelectDialog;
