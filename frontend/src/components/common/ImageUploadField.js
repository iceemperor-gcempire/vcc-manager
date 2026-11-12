import React, { useCallback, useState } from 'react';
import { Box, Typography, Card, CardMedia, IconButton, Button } from '@mui/material';
import { Delete, Add, Image as ImageIcon } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import ImageSelectDialog from './ImageSelectDialog';
import { galleryInitialSelection, gallerySlots, mergeGallerySelection } from '../../utils/attachSelection';

// 이미지 선택/미리보기/삭제 공용 필드 (#517). 비전 첨부·참조 이미지 등에서 재사용.
// images: [{ file, preview } | { _id, url }] 형태. onImagesChange 로 상위가 상태 관리.
// 업로드(서버 전송)는 호출하는 쪽에서 수행한다(여기선 선택만).
// 새 파일(+ 칸) 말고 업로드한 이미지·생성한 이미지도 갤러리에서 고를 수 있다 (#1182) — { _id, url } 로 들어간다.
function ImageUploadField({ label, description, images, onImagesChange, maxImages = 1, disabled = false }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const slots = gallerySlots(images, maxImages);

  const onDrop = useCallback((acceptedFiles) => {
    if (images.length >= maxImages) {
      toast.error(`최대 ${maxImages}개의 이미지만 첨부할 수 있습니다.`);
      return;
    }
    const remainingSlots = maxImages - images.length;
    const filesToAdd = acceptedFiles.slice(0, remainingSlots);
    const newImages = filesToAdd.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    onImagesChange([...images, ...newImages]);
  }, [images, maxImages, onImagesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024,
    disabled: disabled || images.length >= maxImages,
  });

  const removeImage = (index) => {
    const next = [...images];
    if (next[index].preview) URL.revokeObjectURL(next[index].preview);
    next.splice(index, 1);
    onImagesChange(next);
  };

  const handleGallerySelect = (selected) => {
    onImagesChange(mergeGallerySelection(images, selected, maxImages));
  };

  // 갤러리 버튼은 새 파일이 자리를 다 차지하지 않았을 때만 — 기존 이미지로 다 찼어도 열어서 바꿀 수 있다
  const showGallery = !disabled && slots > 0;

  return (
    <Box>
      {(label || showGallery) && (
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={0.5}>
          <Typography variant="subtitle2" sx={{ minWidth: 0 }}>{label}</Typography>
          {showGallery && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={() => setGalleryOpen(true)}
              sx={{ flexShrink: 0 }}
            >
              갤러리에서 선택
            </Button>
          )}
        </Box>
      )}
      {description && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          {description}
        </Typography>
      )}
      <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
        {images.map((img, index) => (
          <Box key={img._id ? `id-${img._id}` : `file-${index}`} position="relative">
            <Card sx={{ width: 72, height: 72 }}>
              <CardMedia component="img" image={img.preview || img.url} sx={{ width: 72, height: 72, objectFit: 'cover' }} />
            </Card>
            {!disabled && (
              <IconButton aria-label="첨부 이미지 제거"
                size="small"
                onClick={() => removeImage(index)}
                sx={{
                  position: 'absolute', top: -8, right: -8,
                  bgcolor: 'error.main', color: 'white',
                  '&:hover': { bgcolor: 'error.dark' }, width: 20, height: 20,
                }}
              >
                <Delete sx={{ fontSize: 14 }} />
              </IconButton>
            )}
          </Box>
        ))}
        {!disabled && images.length < maxImages && (
          <Box
            {...getRootProps()}
            sx={{
              width: 72, height: 72, border: '2px dashed',
              borderColor: isDragActive ? 'secondary.main' : 'grey.300',
              borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', bgcolor: isDragActive ? 'action.hover' : 'transparent',
              '&:hover': { borderColor: 'secondary.main', bgcolor: 'action.hover' },
            }}
          >
            <input {...getInputProps()} />
            <Add color="action" />
          </Box>
        )}
      </Box>

      {showGallery && (
        <ImageSelectDialog
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onSelect={handleGallerySelect}
          // 칸 이름을 붙이지 않는다 — 이미지 칸 이름은 보통 "이미지 (선택)" 이라 "이미지 (선택) 선택" 이 됐다 (#1184)
          title="첨부할 이미지 선택"
          multiple={slots > 1}
          maxImages={slots}
          initialSelected={galleryInitialSelection(images)}
        />
      )}
    </Box>
  );
}

export default ImageUploadField;
