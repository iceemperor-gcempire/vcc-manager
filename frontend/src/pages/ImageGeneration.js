import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Send,
  Image as ImageIcon,
  Delete,
  Add,
  Info,
  ArrowBack
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { workboardAPI, jobAPI, imageAPI } from '../services/api';

function ImageUploadZone({ onUpload, maxFiles = 5 }) {
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      setUploading(true);
      try {
        const uploadPromises = acceptedFiles.map(async (file) => {
          const formData = new FormData();
          formData.append('image', file);
          const response = await imageAPI.upload(formData);
          return response.data.image;
        });

        const uploadedImages = await Promise.all(uploadPromises);
        onUpload(uploadedImages);
        toast.success(`${uploadedImages.length}개 이미지 업로드 완료`);
      } catch (error) {
        toast.error('이미지 업로드 실패');
      } finally {
        setUploading(false);
      }
    }
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : 'grey.300',
        borderRadius: 2,
        p: 3,
        textAlign: 'center',
        cursor: 'pointer',
        bgcolor: isDragActive ? 'primary.light' : 'grey.50',
        transition: 'all 0.3s',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'primary.light'
        }
      }}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <CircularProgress />
      ) : (
        <>
          <ImageIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? '이미지를 여기에 놓으세요' : '이미지를 드래그하거나 클릭하여 업로드'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            JPG, PNG, WebP 형식 지원 (최대 {maxFiles}개)
          </Typography>
        </>
      )}
    </Box>
  );
}

function ReferenceImageSelector({ value, onChange, workboard }) {
  const [open, setOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState(value || []);

  const { data: uploadedImages, isLoading } = useQuery(
    'uploadedImages',
    () => imageAPI.getUploaded({ limit: 50 })
  );

  const images = uploadedImages?.data?.images || [];

  const handleImageSelect = (image) => {
    const isSelected = selectedImages.find(img => img.imageId === image._id);
    if (isSelected) {
      setSelectedImages(selectedImages.filter(img => img.imageId !== image._id));
    } else {
      setSelectedImages([...selectedImages, {
        imageId: image._id,
        image: image,
        method: workboard?.baseInputFields?.referenceImageMethods?.[0]?.value || 'img2img'
      }]);
    }
  };

  const handleSave = () => {
    onChange(selectedImages);
    setOpen(false);
  };

  const handleRemove = (imageId) => {
    const updated = selectedImages.filter(img => img.imageId !== imageId);
    setSelectedImages(updated);
    onChange(updated);
  };

  const handleNewUpload = (newImages) => {
    const newSelections = newImages.map(image => ({
      imageId: image._id,
      image: image,
      method: workboard?.baseInputFields?.referenceImageMethods?.[0]?.value || 'img2img'
    }));
    
    setSelectedImages([...selectedImages, ...newSelections]);
    onChange([...selectedImages, ...newSelections]);
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1">참고 이미지</Typography>
        <Button
          variant="outlined"
          onClick={() => setOpen(true)}
          startIcon={<Add />}
          size="small"
        >
          이미지 선택
        </Button>
      </Box>

      {selectedImages.length === 0 ? (
        <ImageUploadZone onUpload={handleNewUpload} maxFiles={3} />
      ) : (
        <Grid container spacing={2}>
          {selectedImages.map((item, index) => (
            <Grid item xs={6} sm={4} md={3} key={index}>
              <Card>
                <CardMedia
                  component="img"
                  height="120"
                  image={item.image.url}
                  alt="Reference"
                />
                <CardContent sx={{ p: 1 }}>
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(item.imageId)}
                    sx={{ float: 'right' }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                  <Chip
                    label={item.method}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
          <Grid item xs={6} sm={4} md={3}>
            <Box
              sx={{
                height: 200,
                border: '2px dashed',
                borderColor: 'grey.300',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              onClick={() => setOpen(true)}
            >
              <Add sx={{ fontSize: 48, color: 'grey.400' }} />
            </Box>
          </Grid>
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>참고 이미지 선택</DialogTitle>
        <DialogContent>
          {isLoading ? (
            <CircularProgress />
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {images.map((image) => {
                const isSelected = selectedImages.find(img => img.imageId === image._id);
                return (
                  <Grid item xs={6} sm={4} md={3} key={image._id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? '2px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'grey.300'
                      }}
                      onClick={() => handleImageSelect(image)}
                    >
                      <CardMedia
                        component="img"
                        height="120"
                        image={image.url}
                        alt="Uploaded"
                      />
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" noWrap>
                          {image.originalName}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>취소</Button>
          <Button onClick={handleSave} variant="contained">
            선택 완료
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ImageGeneration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  
  const { control, handleSubmit, watch, formState: { errors } } = useForm();
  
  const { data: workboard, isLoading, error } = useQuery(
    ['workboard', id],
    () => workboardAPI.getById(id)
  );

  const generateMutation = useMutation(
    jobAPI.create,
    {
      onSuccess: (data) => {
        toast.success('이미지 생성 작업이 시작되었습니다');
        queryClient.invalidateQueries('recentJobs');
        navigate('/jobs');
      },
      onError: (error) => {
        toast.error('작업 생성 실패: ' + error.message);
      }
    }
  );

  const onSubmit = async (formData) => {
    setGenerating(true);
    try {
      await generateMutation.mutateAsync({
        workboardId: id,
        ...formData
      });
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          작업판을 불러올 수 없습니다: {error.message}
        </Alert>
      </Container>
    );
  }

  const workboardData = workboard?.data?.workboard;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/workboards')}
          sx={{ mb: 2 }}
        >
          작업판 목록으로 돌아가기
        </Button>
        
        <Typography variant="h4" gutterBottom>
          {workboardData?.name}
        </Typography>
        {workboardData?.description && (
          <Typography variant="body1" color="textSecondary" gutterBottom>
            {workboardData.description}
          </Typography>
        )}
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                기본 설정
              </Typography>

              {/* 프롬프트 */}
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
                    placeholder="생성하고 싶은 이미지에 대한 설명을 입력하세요..."
                    error={!!errors.prompt}
                    helperText={errors.prompt?.message}
                    sx={{ mb: 3 }}
                  />
                )}
              />

              {/* AI 모델 선택 */}
              {workboardData?.baseInputFields?.aiModel && (
                <Controller
                  name="aiModel"
                  control={control}
                  rules={{ required: 'AI 모델을 선택해주세요' }}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 3 }} error={!!errors.aiModel}>
                      <InputLabel>AI 모델</InputLabel>
                      <Select {...field} label="AI 모델">
                        {workboardData.baseInputFields.aiModel.map((model) => (
                          <MenuItem key={model.value} value={model.value}>
                            {model.key}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.aiModel && (
                        <Typography variant="caption" color="error">
                          {errors.aiModel.message}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />
              )}

              {/* 이미지 크기 */}
              {workboardData?.baseInputFields?.imageSizes && (
                <Controller
                  name="imageSize"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>이미지 크기</InputLabel>
                      <Select {...field} label="이미지 크기">
                        {workboardData.baseInputFields.imageSizes.map((size) => (
                          <MenuItem key={size.value} value={size.value}>
                            {size.key}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              )}

              {/* 부정 프롬프트 */}
              <Controller
                name="negativePrompt"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={2}
                    label="부정 프롬프트 (선택사항)"
                    placeholder="생성하지 않았으면 하는 요소들을 입력하세요..."
                    sx={{ mb: 3 }}
                  />
                )}
              />
            </Paper>

            {/* 참고 이미지 */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Controller
                name="referenceImages"
                control={control}
                defaultValue={[]}
                render={({ field }) => (
                  <ReferenceImageSelector
                    value={field.value}
                    onChange={field.onChange}
                    workboard={workboardData}
                  />
                )}
              />
            </Paper>

            {/* 추가 설정 */}
            {workboardData?.additionalInputFields?.length > 0 && (
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  고급 설정
                </Typography>
                <Grid container spacing={2}>
                  {workboardData.additionalInputFields.map((field) => (
                    <Grid item xs={12} sm={6} key={field.name}>
                      <Controller
                        name={`additionalParams.${field.name}`}
                        control={control}
                        render={({ field: formField }) => (
                          field.type === 'select' ? (
                            <FormControl fullWidth>
                              <InputLabel>{field.label}</InputLabel>
                              <Select {...formField} label={field.label}>
                                {field.options?.map((option) => (
                                  <MenuItem key={option.value} value={option.value}>
                                    {option.key}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : field.type === 'number' ? (
                            <TextField
                              {...formField}
                              type="number"
                              fullWidth
                              label={field.label}
                              placeholder={field.placeholder}
                              helperText={field.description}
                            />
                          ) : (
                            <TextField
                              {...formField}
                              fullWidth
                              label={field.label}
                              placeholder={field.placeholder}
                              helperText={field.description}
                            />
                          )
                        )}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
          </Grid>

          {/* 사이드바 */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, position: 'sticky', top: 24 }}>
              <Typography variant="h6" gutterBottom>
                작업판 정보
              </Typography>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  서버: {new URL(workboardData?.serverUrl || '').hostname}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  버전: {workboardData?.version || 1}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  사용횟수: {workboardData?.usageCount || 0}회
                </Typography>
              </Box>

              {generating && (
                <Box mb={3}>
                  <Typography variant="body2" gutterBottom>
                    작업 생성 중...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={generating || generateMutation.isLoading}
                startIcon={generating ? <CircularProgress size={20} /> : <Send />}
              >
                {generating ? '생성 중...' : '이미지 생성 시작'}
              </Button>

              <Alert severity="info" sx={{ mt: 2 }}>
                이미지 생성은 백그라운드에서 처리됩니다. 
                작업 히스토리에서 진행 상황을 확인할 수 있습니다.
              </Alert>
            </Paper>
          </Grid>
        </Grid>
      </form>
    </Container>
  );
}

export default ImageGeneration;