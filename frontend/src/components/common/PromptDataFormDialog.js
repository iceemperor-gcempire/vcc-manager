import React, { useState } from 'react';
import {
  Grid,
  Button,
  Box,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography
} from '@mui/material';
import { Image as ImageIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import ImageSelectDialog from './ImageSelectDialog';
import ImageViewerDialog from './ImageViewerDialog';
import TagInput from './TagInput';

function PromptDataFormDialog({ open, onClose, promptData = null, onSave }) {
  const isEditing = !!promptData;
  const [imageSelectOpen, setImageSelectOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(promptData?.representativeImage || null);
  const [tags, setTags] = useState(promptData?.tags || []);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: promptData?.name || '',
      memo: promptData?.memo || '',
      prompt: promptData?.prompt || '',
      negativePrompt: promptData?.negativePrompt || '',
      seed: promptData?.seed || ''
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: promptData?.name || '',
        memo: promptData?.memo || '',
        prompt: promptData?.prompt || '',
        negativePrompt: promptData?.negativePrompt || '',
        seed: promptData?.seed || ''
      });
      setSelectedImage(promptData?.representativeImage || null);
      setTags(promptData?.tags || []);
    }
  }, [open, promptData, reset]);

  const onSubmit = (data) => {
    onSave({
      ...data,
      seed: data.seed ? parseInt(data.seed) : undefined,
      representativeImage: selectedImage,
      tags: tags.map(t => t._id)
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditing ? '프롬프트 데이터 수정' : '새 프롬프트 데이터'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" gutterBottom>대표 이미지</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 150,
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    bgcolor: selectedImage?.url ? 'grey.100' : 'grey.50'
                  }}
                  onClick={() => {
                    if (selectedImage?.url) {
                      setImageViewerOpen(true);
                    } else {
                      setImageSelectOpen(true);
                    }
                  }}
                >
                  {selectedImage?.url ? (
                    <img
                      src={selectedImage.url}
                      alt="Representative"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Box textAlign="center">
                      <ImageIcon sx={{ fontSize: 40, color: 'grey.400' }} />
                      <Typography variant="caption" color="textSecondary" display="block">
                        클릭하여 선택
                      </Typography>
                    </Box>
                  )}
                </Box>
                {selectedImage && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => setImageSelectOpen(true)}
                    >
                      이미지 변경
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => setSelectedImage(null)}
                    >
                      이미지 제거
                    </Button>
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} sm={8}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: '이름을 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="이름"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Controller
                  name="memo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={4}
                      label="메모"
                      placeholder="이 프롬프트에 대한 메모..."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="prompt"
                  control={control}
                  rules={{ required: '프롬프트를 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={4}
                      label="프롬프트"
                      error={!!errors.prompt}
                      helperText={errors.prompt?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="negativePrompt"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={2}
                      label="부정 프롬프트"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="seed"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="number"
                      label="시드 (선택사항)"
                      placeholder="비워두면 랜덤"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  label="태그"
                  placeholder="태그 추가..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>취소</Button>
            <Button type="submit" variant="contained">
              {isEditing ? '수정' : '생성'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ImageSelectDialog
        open={imageSelectOpen}
        onClose={() => setImageSelectOpen(false)}
        onSelect={setSelectedImage}
        title="대표 이미지 선택"
        filterTags={tags.map(t => t._id)}
      />

      <ImageViewerDialog
        images={selectedImage?.url ? [{ url: selectedImage.url }] : []}
        open={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        title="대표 이미지"
        showNavigation={false}
        showMetadata={false}
      />
    </>
  );
}

export default PromptDataFormDialog;
