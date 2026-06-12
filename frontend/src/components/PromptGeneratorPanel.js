import React, { useState, useEffect, useCallback } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import {
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
  LinearProgress
} from '@mui/material';
import {
  Send,
  Delete,
  Add,
  Chat,
  ContentCopy
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { workboardAPI, imageAPI } from '../services/api';
import { useStreamingPrompt } from '../hooks/useStreamingPrompt';
import MetadataFieldInput from './common/MetadataFieldInput';
import { MONO } from '../theme';

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
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
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

function PromptGeneratorPanel({
  workboardId,
  workboard: externalWorkboard,
  onResultChange,
  showHeader = true,
  showSystemPrompt = true,
  compact = false,
  projectId,
  useWorldview
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [referenceImages, setReferenceImages] = useState({});
  const { send: streamSend, streamingText, isStreaming } = useStreamingPrompt();

  const { control, handleSubmit, setValue, formState: { errors } } = useForm({
    defaultValues: {
      model: '',
      userPrompt: ''
    }
  });

  const { data: workboardData, isLoading: workboardLoading, error: workboardError } = useQuery(
    ['workboard', workboardId],
    () => workboardAPI.getById(workboardId),
    { enabled: !!workboardId && !externalWorkboard }
  );

  const workboard = externalWorkboard || workboardData?.data?.workboard;

  // F2: baseInputFields.aiModel 기반 기본값 제거 — customField 의 defaultValue 만 사용.
  // 작업판 로드 시 customField(베이스 모델/시스템 프롬프트 등)의 defaultValue 를 폼에 적용한다.
  // 이게 없으면 실행 화면에서 베이스 모델 기본값이 빈 채로 떠 사용자가 매번 다시 골라야 했다 (#498 후속 버그).
  // workboard._id 키로 1회 적용 — 캐시 refetch 로 객체 참조가 바뀌어도 사용자 입력을 덮어쓰지 않음.
  useEffect(() => {
    if (!workboard?.additionalInputFields) return;
    workboard.additionalInputFields
      .filter((f) => f.name !== 'conversation_mode')
      .forEach((f) => {
        if (f.defaultValue !== undefined && f.defaultValue !== null && f.defaultValue !== '') {
          setValue(f.name, f.defaultValue);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workboard?._id, setValue]);

  useEffect(() => {
    if (onResultChange) {
      onResultChange(generatedResult?.result || null);
    }
  }, [generatedResult, onResultChange]);

  // 참조 이미지를 먼저 업로드한 뒤 스트리밍 생성 (#490)
  const onSubmit = async (formData) => {
    setIsGenerating(true);
    setGeneratedResult(null);

    let uploadedImages = {};
    try {
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
    } catch (error) {
      toast.error('이미지 업로드 실패: ' + (error.response?.data?.message || error.message));
      setIsGenerating(false);
      return;
    }

    streamSend(
      {
        workboardId: workboard._id,
        // #396: 프로젝트 컨텍스트 / 세계관 적용 (단일 샷 모드)
        projectId: projectId || undefined,
        useWorldview: !!useWorldview,
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
      },
      {
        onDone: (info, fullText) => {
          setGeneratedResult({ ...info, result: info.result ?? fullText });
          toast.success('프롬프트가 생성되었습니다!');
          setIsGenerating(false);
          setReferenceImages({}); // 첨부 초기화 — 재생성 시 중복 업로드 방지 (#519)
        },
        onError: (error) => {
          toast.error('생성 실패: ' + (error.message || '알 수 없는 오류'));
          setIsGenerating(false);
        }
      }
    );
  };

  const handleCopyResult = () => {
    if (generatedResult?.result) {
      copyToClipboard(generatedResult.result);
      toast.success('클립보드에 복사되었습니다');
    }
  };

  if (workboardLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  if (workboardError || !workboard) {
    return (
      <Alert severity="error">
        작업판을 불러오는 중 오류가 발생했습니다.
      </Alert>
    );
  }

  return (
    <Box>
      {showHeader && (
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Chat color="secondary" />
          <Typography variant="h6">{workboard.name}</Typography>
        </Box>
      )}

      {workboard.description && showHeader && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {workboard.description}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={compact ? 2 : 3}>
          <Grid item xs={12} md={compact ? 12 : 6}>
            <Paper sx={{ p: compact ? 2 : 4 }} variant={compact ? 'elevation' : 'outlined'} elevation={0}>
              {!compact && (
                <Typography variant="h6" gutterBottom>
                  입력 설정
                </Typography>
              )}

              {/* F2: baseInputFields.aiModel / referenceImages hardcoded UI 제거 — customField 가 통합 처리.
                  #391: conversation_mode 는 admin 전용 설정이라 사용자 폼에선 숨김 */}
              {workboard.additionalInputFields?.filter((f) => f.name !== 'conversation_mode').map((field) => (
                <Box key={field.name} sx={{ mb: 2 }}>
                  {field.type === 'string' && (
                    <Controller
                      name={field.name}
                      control={control}
                      rules={{ required: field.required ? `${field.label}을(를) 입력해주세요` : false }}
                      render={({ field: formField }) => (
                        <TextField
                          {...formField}
                          fullWidth
                          size={compact ? 'small' : 'medium'}
                          label={field.label}
                          placeholder={field.placeholder}
                          multiline={field.name.includes('prompt')}
                          rows={field.name.includes('prompt') ? 2 : 1}
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
                        <FormControl fullWidth error={!!errors[field.name]} size={compact ? 'small' : 'medium'}>
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
                  {(field.type === 'baseModel' || field.type === 'lora') && (
                    <Controller
                      name={field.name}
                      control={control}
                      rules={{ required: field.required ? `${field.label}을(를) 선택해주세요` : false }}
                      render={({ field: formField }) => (
                        <MetadataFieldInput
                          kind={field.type === 'baseModel' ? 'model' : 'lora'}
                          field={field}
                          value={formField.value || ''}
                          onChange={formField.onChange}
                          workboardId={workboard._id}
                          serverId={workboard?.serverId?._id || workboard?.serverId}
                        />
                      )}
                    />
                  )}
                  {/* 이미지 입력 (#519) — image 타입 필드. 첨부 시 비전 입력으로 사용 */}
                  {field.type === 'image' && (
                    <ImageUploadField
                      label={field.label}
                      description={field.description || '이미지를 첨부하면 모델이 분석에 참고합니다. (비전 모델 전용)'}
                      images={referenceImages[field.name] || []}
                      onImagesChange={(imgs) => setReferenceImages((prev) => ({ ...prev, [field.name]: imgs }))}
                      maxImages={field.imageConfig?.maxImages || 4}
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
                    size={compact ? 'small' : 'medium'}
                    label="사용자 프롬프트"
                    placeholder="생성하고 싶은 프롬프트에 대해 설명해주세요..."
                    multiline
                    rows={compact ? 3 : 5}
                    error={!!errors.userPrompt}
                    helperText={errors.userPrompt?.message}
                  />
                )}
              />

              <Button
                type="submit"
                variant="contained"
                color="secondary"
                size={compact ? 'medium' : 'large'}
                fullWidth
                disabled={isGenerating}
                startIcon={isGenerating ? <CircularProgress size={20} color="inherit" /> : <Send />}
                sx={{ mt: 2 }}
              >
                {isGenerating ? '생성 중...' : '프롬프트 생성'}
              </Button>
            </Paper>
          </Grid>

          <Grid item xs={12} md={compact ? 12 : 6}>
            <Paper sx={{ p: compact ? 2 : 4, minHeight: compact ? 200 : 400 }} variant={compact ? 'elevation' : 'outlined'} elevation={0}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant={compact ? 'subtitle1' : 'h6'}>
                  생성된 프롬프트
                </Typography>
                {generatedResult?.result && (
                  <IconButton onClick={handleCopyResult} title="복사" size="small">
                    <ContentCopy />
                  </IconButton>
                )}
              </Box>

              {isGenerating && !streamingText && (
                <Box>
                  <LinearProgress color="secondary" sx={{ mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    AI가 프롬프트를 생성하고 있습니다...
                  </Typography>
                </Box>
              )}

              {(streamingText || generatedResult?.result) ? (
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      bgcolor: 'grey.50',
                      p: 2,
                      borderRadius: 1,
                      maxHeight: compact ? 200 : 500,
                      overflow: 'auto',
                      fontFamily: MONO,
                      fontSize: compact ? '0.875rem' : '1rem'
                    }}
                  >
                    {streamingText || generatedResult.result}
                    {isStreaming && <Box component="span" sx={{ opacity: 0.5 }}>▍</Box>}
                  </Typography>

                  {!isStreaming && generatedResult?.usage && (
                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        토큰: 입력 {generatedResult.usage.promptTokens} / 출력 {generatedResult.usage.completionTokens}
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
                  minHeight={compact ? 100 : 300}
                  color="text.secondary"
                >
                  <Chat sx={{ fontSize: compact ? 40 : 64, mb: 1, opacity: 0.3 }} />
                  <Typography variant="body2">
                    프롬프트를 입력하고 생성 버튼을 눌러주세요
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
}

export default PromptGeneratorPanel;
export { PromptGeneratorPanel };
