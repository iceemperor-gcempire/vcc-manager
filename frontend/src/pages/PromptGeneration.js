import React, { useState, useEffect, useCallback } from 'react';
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
  CardMedia,
  IconButton,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  Send,
  Image as ImageIcon,
  Delete,
  Add,
  ArrowBack,
  Chat,
  ContentCopy
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { workboardAPI, jobAPI, imageAPI } from '../services/api';

function ImageUploadField({ label, description, images, onImagesChange, maxImages = 1 }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (images.length >= maxImages) {
      toast.error(`최대 ${maxImages}개의 이미지만 업로드할 수 있습니다.`);
      return;
    }
    
    const remainingSlots = maxImages - images.length;
    const filesToAdd = acceptedFiles.slice(0, remainingSlots);
    
    const newImages = filesToAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    
    onImagesChange([...images, ...newImages]);
  }, [images, maxImages, onImagesChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxSize: 10 * 1024 * 1024,
    disabled: images.length >= maxImages
  });

  const removeImage = (index) => {
    const newImages = [...images];
    if (newImages[index].preview) {
      URL.revokeObjectURL(newImages[index].preview);
    }
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {label}
      </Typography>
      {description && (
        <Typography variant="caption" color="textSecondary" display="block" mb={1}>
          {description}
        </Typography>
      )}
      
      <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
        {images.map((img, index) => (
          <Box key={index} position="relative">
            <Card sx={{ width: 80, height: 80 }}>
              <CardMedia
                component="img"
                image={img.preview || img.url}
                sx={{ width: 80, height: 80, objectFit: 'cover' }}
              />
            </Card>
            <IconButton
              size="small"
              onClick={() => removeImage(index)}
              sx={{
                position: 'absolute',
                top: -8,
                right: -8,
                bgcolor: 'error.main',
                color: 'white',
                '&:hover': { bgcolor: 'error.dark' },
                width: 20,
                height: 20
              }}
            >
              <Delete sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
        
        {images.length < maxImages && (
          <Box
            {...getRootProps()}
            sx={{
              width: 80,
              height: 80,
              border: '2px dashed',
              borderColor: isDragActive ? 'secondary.main' : 'grey.300',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'transparent',
              '&:hover': { borderColor: 'secondary.main', bgcolor: 'action.hover' }
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

function PromptGeneration() {
  const { workboardId } = useParams();
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [referenceImages, setReferenceImages] = useState({});

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      model: '',
      userPrompt: ''
    }
  });

  const { data: workboardData, isLoading: workboardLoading, error: workboardError } = useQuery(
    ['workboard', workboardId],
    () => workboardAPI.getById(workboardId),
    { enabled: !!workboardId }
  );

  const workboard = workboardData?.data?.workboard;

  useEffect(() => {
    if (workboard?.baseInputFields?.aiModel?.length > 0) {
      const defaultModel = workboard.baseInputFields.aiModel[0].value;
      setValue('model', defaultModel);
    }
  }, [workboard, setValue]);

  const generateMutation = useMutation(
    async (formData) => {
      const uploadedImages = {};
      
      for (const [fieldName, images] of Object.entries(referenceImages)) {
        if (images && images.length > 0) {
          const imageIds = [];
          for (const img of images) {
            if (img.file) {
              const uploadData = new FormData();
              uploadData.append('image', img.file);
              uploadData.append('imageType', 'reference');
              const response = await imageAPI.upload(uploadData);
              imageIds.push(response.data.image._id);
            } else if (img._id) {
              imageIds.push(img._id);
            }
          }
          uploadedImages[fieldName] = imageIds;
        }
      }
      
      const jobData = {
        workboardId,
        inputData: {
          model: formData.model,
          userPrompt: formData.userPrompt,
          ...uploadedImages,
          ...Object.fromEntries(
            Object.entries(formData).filter(([key]) => 
              !['model', 'userPrompt'].includes(key)
            )
          )
        }
      };
      
      return jobAPI.createPromptJob(jobData);
    },
    {
      onSuccess: (response) => {
        console.log('Prompt generation response:', response);
        console.log('Response data:', response.data);
        setGeneratedResult(response.data);
        toast.success('프롬프트가 생성되었습니다!');
        setIsGenerating(false);
      },
      onError: (error) => {
        console.error('Prompt generation error:', error);
        toast.error('생성 실패: ' + (error.response?.data?.message || error.message));
        setIsGenerating(false);
      }
    }
  );

  const onSubmit = (data) => {
    setIsGenerating(true);
    setGeneratedResult(null);
    generateMutation.mutate(data);
  };

  const handleCopyResult = () => {
    if (generatedResult?.result) {
      navigator.clipboard.writeText(generatedResult.result);
      toast.success('클립보드에 복사되었습니다');
    }
  };

  if (workboardLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress color="secondary" />
        </Box>
      </Container>
    );
  }

  if (workboardError || !workboard) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          작업판을 불러오는 중 오류가 발생했습니다.
        </Alert>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/prompt-workboards')}
          sx={{ mt: 2 }}
        >
          작업판 목록으로
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/prompt-workboards')}
        >
          작업판 선택
        </Button>
        <Box display="flex" alignItems="center" gap={1}>
          <Chat color="secondary" />
          <Typography variant="h5">{workboard.name}</Typography>
        </Box>
        <Chip label="프롬프트 생성" color="secondary" size="small" />
      </Box>

      {workboard.description && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {workboard.description}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                입력 설정
              </Typography>

              <Controller
                name="model"
                control={control}
                rules={{ required: 'AI 모델을 선택해주세요' }}
                render={({ field }) => (
                  <FormControl fullWidth sx={{ mb: 3 }} error={!!errors.model}>
                    <InputLabel>AI 모델</InputLabel>
                    <Select {...field} label="AI 모델">
                      {workboard.baseInputFields?.aiModel?.map((model) => (
                        <MenuItem key={model.value} value={model.value}>
                          {model.key}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              {workboard.baseInputFields?.referenceImages?.map((refImage) => (
                <Box key={refImage.key} sx={{ mb: 3 }}>
                  <ImageUploadField
                    label={refImage.key}
                    description={refImage.value}
                    images={referenceImages[refImage.key] || []}
                    onImagesChange={(images) => setReferenceImages(prev => ({
                      ...prev,
                      [refImage.key]: images
                    }))}
                    maxImages={3}
                  />
                </Box>
              ))}

              {workboard.additionalInputFields?.map((field) => (
                <Box key={field.name} sx={{ mb: 3 }}>
                  {field.type === 'string' && (
                    <Controller
                      name={field.name}
                      control={control}
                      rules={{ required: field.required ? `${field.label}을(를) 입력해주세요` : false }}
                      render={({ field: formField }) => (
                        <TextField
                          {...formField}
                          fullWidth
                          label={field.label}
                          placeholder={field.placeholder}
                          multiline={field.name.includes('prompt')}
                          rows={field.name.includes('prompt') ? 3 : 1}
                          error={!!errors[field.name]}
                          helperText={errors[field.name]?.message || field.description}
                        />
                      )}
                    />
                  )}
                  {field.type === 'select' && (
                    <Controller
                      name={field.name}
                      control={control}
                      rules={{ required: field.required ? `${field.label}을(를) 선택해주세요` : false }}
                      render={({ field: formField }) => (
                        <FormControl fullWidth error={!!errors[field.name]}>
                          <InputLabel>{field.label}</InputLabel>
                          <Select {...formField} label={field.label}>
                            {field.options?.map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.key}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                    />
                  )}
                </Box>
              ))}

              <Controller
                name="userPrompt"
                control={control}
                rules={{ required: '프롬프트를 입력해주세요' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="사용자 프롬프트"
                    placeholder="생성하고 싶은 프롬프트에 대해 설명해주세요..."
                    multiline
                    rows={5}
                    error={!!errors.userPrompt}
                    helperText={errors.userPrompt?.message}
                  />
                )}
              />

              <Button
                type="submit"
                variant="contained"
                color="secondary"
                size="large"
                fullWidth
                disabled={isGenerating}
                startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <Send />}
                sx={{ mt: 3 }}
              >
                {isGenerating ? '생성 중...' : '프롬프트 생성'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, minHeight: 400 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  생성된 프롬프트
                </Typography>
                {generatedResult?.result && (
                  <IconButton onClick={handleCopyResult} title="복사">
                    <ContentCopy />
                  </IconButton>
                )}
              </Box>

              {isGenerating && (
                <Box>
                  <LinearProgress color="secondary" sx={{ mb: 2 }} />
                  <Typography variant="body2" color="textSecondary" textAlign="center">
                    AI가 프롬프트를 생성하고 있습니다...
                  </Typography>
                </Box>
              )}

              {generatedResult?.result ? (
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      bgcolor: 'grey.50',
                      p: 2,
                      borderRadius: 1,
                      maxHeight: 500,
                      overflow: 'auto',
                      fontFamily: 'monospace'
                    }}
                  >
                    {generatedResult.result}
                  </Typography>
                  
                  {generatedResult.usage && (
                    <Box mt={2}>
                      <Typography variant="caption" color="textSecondary">
                        토큰 사용량: 입력 {generatedResult.usage.promptTokens} / 출력 {generatedResult.usage.completionTokens}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : !isGenerating && (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  minHeight={300}
                  color="text.secondary"
                >
                  <Chat sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                  <Typography variant="body2">
                    프롬프트를 입력하고 생성 버튼을 눌러주세요
                  </Typography>
                </Box>
              )}
            </Paper>

            {workboard.baseInputFields?.systemPrompt && (
              <Paper sx={{ p: 3, mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  시스템 프롬프트
                </Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    maxHeight: 150,
                    overflow: 'auto',
                    bgcolor: 'grey.100',
                    p: 1,
                    borderRadius: 1
                  }}
                >
                  {workboard.baseInputFields.systemPrompt}
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      </form>
    </Container>
  );
}

export default PromptGeneration;
