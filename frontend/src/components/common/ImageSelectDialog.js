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

function ImageSelectDialog({
  open,
  onClose,
  onSelect,
  title = '이미지 선택',
  multiple = false,
  maxImages = 1,
  initialSelected = [],
  filterTags = []
}) {
  const [tab, setTab] = useState(0);
  const [selectedImages, setSelectedImages] = useState([]);

  useEffect(() => {
    if (open) {
      setSelectedImages(initialSelected);
    }
  }, [open, initialSelected]);

  const tagsParam = filterTags.length > 0 ? filterTags.join(',') : undefined;

  const handleSelectionChange = (newSelection) => {
    if (multiple) {
      if (newSelection.length <= maxImages) {
        setSelectedImages(newSelection);
      }
    } else {
      setSelectedImages(newSelection.slice(0, 1));
    }
  };

  const handleConfirm = () => {
    if (selectedImages.length > 0) {
      if (multiple) {
        onSelect(selectedImages);
      } else {
        const selected = selectedImages[0];
        onSelect({
          imageId: selected.imageId,
          imageType: selected.imageType,
          url: selected.image.url,
          image: selected.image
        });
      }
      onClose();
      setSelectedImages([]);
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedImages([]);
  };

  const getType = () => tab === 0 ? 'uploaded' : 'generated';

  const fetchFn = (params) => {
    const fetchParams = { ...params };
    if (tagsParam) fetchParams.tags = tagsParam;
    if (tab === 0) return imageAPI.getUploaded(fetchParams);
    return imageAPI.getGenerated(fetchParams);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title}
        {multiple && (
          <Typography variant="body2" color="textSecondary">
            {selectedImages.length}/{maxImages} 선택됨
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="업로드한 이미지" />
          <Tab label="생성한 이미지" />
        </Tabs>

        <MediaGrid
          key={`select-${tab}-${tagsParam}`}
          type={getType()}
          fetchFn={fetchFn}
          queryKey={`imageSelect-${tab}-${tagsParam}`}
          selectable
          multiSelect={multiple}
          selectedItems={selectedImages}
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
          disabled={selectedImages.length === 0}
        >
          선택
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ImageSelectDialog;
