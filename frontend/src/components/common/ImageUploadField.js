import React, { useCallback } from 'react';
import { Box, Typography, Card, CardMedia, IconButton } from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

// 이미지 선택/미리보기/삭제 공용 필드 (#517). 비전 첨부·참조 이미지 등에서 재사용.
// images: [{ file, preview } | { _id, url }] 형태. onImagesChange 로 상위가 상태 관리.
// 업로드(서버 전송)는 호출하는 쪽에서 수행한다(여기선 선택만).
function ImageUploadField({ label, description, images, onImagesChange, maxImages = 1, disabled = false }) {
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

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" gutterBottom>{label}</Typography>
      )}
      {description && (
        <Typography variant="caption" color="textSecondary" display="block" mb={1}>
          {description}
        </Typography>
      )}
      <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
        {images.map((img, index) => (
          <Box key={index} position="relative">
            <Card sx={{ width: 72, height: 72 }}>
              <CardMedia component="img" image={img.preview || img.url} sx={{ width: 72, height: 72, objectFit: 'cover' }} />
            </Card>
            {!disabled && (
              <IconButton
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
    </Box>
  );
}

export default ImageUploadField;
