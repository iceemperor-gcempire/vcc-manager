import React, { useState, useEffect, useRef } from 'react';
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
  DialogActions,
  FormControlLabel,
  Switch,
  InputAdornment
} from '@mui/material';
import {
  Send,
  Image as ImageIcon,
  Delete,
  Add,
  ArrowBack,
  Shuffle,
  ViewList
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { workboardAPI, jobAPI, imageAPI } from '../services/api';
import LoraListModal from '../components/LoraListModal';

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

// 사용자 정의 이미지 입력 필드 컴포넌트
function CustomImageField({ field, value, onChange, maxImages = 1 }) {
  const [selectedImages, setSelectedImages] = useState(value || []);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: uploadedImages, isLoading } = useQuery(
    'uploadedImages',
    () => imageAPI.getUploaded({ limit: 50 })
  );

  const images = uploadedImages?.data?.images || [];

  const handleImageSelect = (image) => {
    const isSelected = selectedImages.find(img => img.imageId === image._id);
    if (isSelected) {
      const updated = selectedImages.filter(img => img.imageId !== image._id);
      setSelectedImages(updated);
    } else if (selectedImages.length < maxImages) {
      const updated = [...selectedImages, {
        imageId: image._id,
        image: image
      }];
      setSelectedImages(updated);
    } else {
      toast.error(`최대 ${maxImages}장까지 선택할 수 있습니다.`);
    }
  };

  const handleSave = () => {
    onChange(selectedImages);
    setDialogOpen(false);
  };

  const handleRemove = (imageId) => {
    const updated = selectedImages.filter(img => img.imageId !== imageId);
    setSelectedImages(updated);
    onChange(updated);
  };

  const handleNewUpload = async (files) => {
    if (files.length === 0) return;
    
    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const response = await imageAPI.upload(formData);
        return response.data.image;
      });

      const uploadedImgs = await Promise.all(uploadPromises);
      const newSelections = uploadedImgs.map(image => ({
        imageId: image._id,
        image: image
      }));

      const remainingSlots = maxImages - selectedImages.length;
      const toAdd = newSelections.slice(0, remainingSlots);
      
      const updated = [...selectedImages, ...toAdd];
      setSelectedImages(updated);
      onChange(updated);
      toast.success(`${toAdd.length}개 이미지 업로드 완료`);
    } catch (error) {
      toast.error('이미지 업로드 실패');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: maxImages - selectedImages.length,
    disabled: selectedImages.length >= maxImages,
    onDrop: handleNewUpload
  });

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="subtitle2">
          {field.label} ({selectedImages.length}/{maxImages})
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setDialogOpen(true)}
          startIcon={<ImageIcon />}
          size="small"
          disabled={selectedImages.length >= maxImages}
        >
          갤러리에서 선택
        </Button>
      </Box>

      {field.description && (
        <Typography variant="caption" color="textSecondary" display="block" mb={1}>
          {field.description}
        </Typography>
      )}

      {selectedImages.length === 0 ? (
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 1,
            p: 2,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'primary.light' : 'grey.50'
          }}
        >
          <input {...getInputProps()} />
          <ImageIcon sx={{ fontSize: 32, color: 'grey.400', mb: 1 }} />
          <Typography variant="body2" color="textSecondary">
            이미지를 드래그하거나 클릭하여 업로드
          </Typography>
          <Typography variant="caption" color="textSecondary">
            최대 {maxImages}장
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={1}>
          {selectedImages.map((item, index) => (
            <Grid item xs={4} key={index}>
              <Card sx={{ position: 'relative' }}>
                <CardMedia
                  component="img"
                  height="80"
                  image={item.image.url}
                  alt={`Image ${index + 1}`}
                  sx={{ objectFit: 'cover' }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemove(item.imageId)}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Card>
            </Grid>
          ))}
          {selectedImages.length < maxImages && (
            <Grid item xs={4}>
              <Box
                {...getRootProps()}
                sx={{
                  height: 80,
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <input {...getInputProps()} />
                <Add sx={{ color: 'grey.400' }} />
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      {/* 갤러리 선택 다이얼로그 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{field.label} 선택 ({selectedImages.length}/{maxImages})</DialogTitle>
        <DialogContent>
          {isLoading ? (
            <CircularProgress />
          ) : images.length === 0 ? (
            <Alert severity="info">업로드된 이미지가 없습니다.</Alert>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {images.map((image) => {
                const isSelected = selectedImages.find(img => img.imageId === image._id);
                return (
                  <Grid item xs={6} sm={4} md={3} key={image._id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? '3px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'grey.300',
                        opacity: !isSelected && selectedImages.length >= maxImages ? 0.5 : 1
                      }}
                      onClick={() => handleImageSelect(image)}
                    >
                      <CardMedia
                        component="img"
                        height="100"
                        image={image.url}
                        alt="Uploaded"
                        sx={{ objectFit: 'cover' }}
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
          <Button onClick={() => setDialogOpen(false)}>취소</Button>
          <Button onClick={handleSave} variant="contained">
            선택 완료
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 64비트 부호없는 정수 범위에서 랜덤 시드 생성
const generateRandomSeed = () => {
  // ComfyUI는 64비트 부호없는 정수를 사용 (음수 불가)
  // JavaScript의 안전한 정수 범위 내에서 생성 (0 ~ Number.MAX_SAFE_INTEGER)
  return Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER + 1));
};

function ImageGeneration() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [randomSeed, setRandomSeed] = useState(true);
  const [seedValue, setSeedValue] = useState(generateRandomSeed);
  const [loraModalOpen, setLoraModalOpen] = useState(false);
  const initializedRef = useRef(null);

  const handleLoraModalOpen = () => {
    setLoraModalOpen(true);
  };

  const handleLoraModalClose = () => {
    setLoraModalOpen(false);
  };

  const handleAddLora = (loraString) => {
    const currentPrompt = getValues('prompt') || '';
    const newPrompt = currentPrompt ? `${currentPrompt}, ${loraString}` : loraString;
    setValue('prompt', newPrompt);
  };

  const { control, handleSubmit, setValue, reset, getValues, formState: { errors } } = useForm({
    mode: 'onChange',
    shouldUnregister: false,
    shouldFocusError: true
  });

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

  const workboardData = workboard?.data?.workboard;

  // 작업판 데이터가 로드되면 선택 필드들의 기본값 설정
  useEffect(() => {
    console.log('🔄 useEffect triggered with workboardData:', workboardData);

    if (workboardData) {
      // 이미 초기화된 작업판이면 스킵 (중복 초기화 방지)
      if (initializedRef.current === workboardData._id) {
        console.log('⏭️ Already initialized for workboard:', workboardData._id);
        return;
      }

      console.log('✅ Setting up form with workboard:', workboardData.name);

      // 로컬스토리지에서 계속하기 데이터 확인
      const continueJobData = localStorage.getItem('continueJobData');
      let jobInputData = null;

      if (continueJobData) {
        try {
          const parsedData = JSON.parse(continueJobData);
          console.log('Found continue job data:', parsedData);
          // 동일한 작업판인 경우 사용
          if (parsedData.workboardId === workboardData._id) {
            jobInputData = parsedData.inputData;
            localStorage.removeItem('continueJobData'); // 사용 후 제거
            console.log('Using continue job data for same workboard');
          } else {
            console.log('Different workboard, not using continue data');
          }
        } catch (error) {
          console.warn('Failed to parse continue job data:', error);
        }
      }

      // 초기화 완료 표시
      initializedRef.current = workboardData._id;

      if (jobInputData) {
        // 스마트 필드 매칭: 작업판에 존재하는 필드만 적용
        const safeSetValue = (fieldName, value) => {
          try {
            if (value !== undefined && value !== null) {
              setValue(fieldName, value);
            }
          } catch (error) {
            console.warn(`Failed to set value for field ${fieldName}:`, error);
          }
        };

        // 기본 필드 매칭
        const basicFields = {
          prompt: jobInputData.prompt,
          negativePrompt: jobInputData.negativePrompt,
          aiModel: jobInputData.aiModel,
          imageSize: jobInputData.imageSize
        };

        Object.keys(basicFields).forEach(key => {
          const inputValue = basicFields[key];
          if (!inputValue) return;

          if (key === 'aiModel' && workboardData.baseInputFields?.aiModel) {
            // AI 모델 매칭: 우선 값으로, 없으면 키로 매칭
            let matchedValue = null;

            if (typeof inputValue === 'object' && inputValue.value) {
              // 키-값 객체인 경우, 먼저 값으로 매칭
              matchedValue = workboardData.baseInputFields.aiModel.find(
                model => model.value === inputValue.value
              )?.value;

              // 값 매칭 실패 시 키로 매칭
              if (!matchedValue) {
                matchedValue = workboardData.baseInputFields.aiModel.find(
                  model => model.key === inputValue.key
                )?.value;
              }
            } else if (typeof inputValue === 'string') {
              // 문자열인 경우, 먼저 값으로 매칭
              matchedValue = workboardData.baseInputFields.aiModel.find(
                model => model.value === inputValue
              )?.value;

              // 값 매칭 실패 시 키로 매칭
              if (!matchedValue) {
                matchedValue = workboardData.baseInputFields.aiModel.find(
                  model => model.key === inputValue
                )?.value;
              }
            }

            if (matchedValue) {
              safeSetValue(key, matchedValue);
            } else {
              console.warn(`AI model ${JSON.stringify(inputValue)} not found in workboard, using default`);
              safeSetValue(key, workboardData.baseInputFields.aiModel[0]?.value);
            }

          } else if (key === 'imageSize' && workboardData.baseInputFields?.imageSizes) {
            // 이미지 크기 매칭: 우선 값으로, 없으면 키로 매칭
            let matchedValue = null;

            if (typeof inputValue === 'object' && inputValue.value) {
              matchedValue = workboardData.baseInputFields.imageSizes.find(
                size => size.value === inputValue.value
              )?.value;

              if (!matchedValue) {
                matchedValue = workboardData.baseInputFields.imageSizes.find(
                  size => size.key === inputValue.key
                )?.value;
              }
            } else if (typeof inputValue === 'string') {
              matchedValue = workboardData.baseInputFields.imageSizes.find(
                size => size.value === inputValue
              )?.value;

              if (!matchedValue) {
                matchedValue = workboardData.baseInputFields.imageSizes.find(
                  size => size.key === inputValue
                )?.value;
              }
            }

            if (matchedValue) {
              safeSetValue(key, matchedValue);
            } else {
              console.warn(`Image size ${JSON.stringify(inputValue)} not found in workboard, using default`);
              safeSetValue(key, workboardData.baseInputFields.imageSizes[0]?.value);
            }
          } else {
            safeSetValue(key, inputValue);
          }
        });

        // 추가 파라미터 매칭
        if (jobInputData.additionalParams && workboardData.additionalInputFields) {
          Object.keys(jobInputData.additionalParams).forEach(paramKey => {
            const field = workboardData.additionalInputFields.find(f => f.name === paramKey);
            if (field) {
              const inputValue = jobInputData.additionalParams[paramKey];

              // select 타입의 경우 키-값 매칭
              if (field.type === 'select' && field.options) {
                let matchedValue = null;

                if (typeof inputValue === 'object' && inputValue.value) {
                  // 키-값 객체인 경우, 먼저 값으로 매칭
                  matchedValue = field.options.find(option => option.value === inputValue.value)?.value;

                  // 값 매칭 실패 시 키로 매칭
                  if (!matchedValue) {
                    matchedValue = field.options.find(option => option.key === inputValue.key)?.value;
                  }
                } else if (typeof inputValue === 'string') {
                  // 문자열인 경우, 먼저 값으로 매칭
                  matchedValue = field.options.find(option => option.value === inputValue)?.value;

                  // 값 매칭 실패 시 키로 매칭
                  if (!matchedValue) {
                    matchedValue = field.options.find(option => option.key === inputValue)?.value;
                  }
                }

                if (matchedValue) {
                  safeSetValue(`additionalParams.${paramKey}`, matchedValue);
                } else {
                  console.warn(`Option ${JSON.stringify(inputValue)} not found for field ${paramKey}, using default`);
                  safeSetValue(`additionalParams.${paramKey}`, field.defaultValue || field.options[0]?.value);
                }
              } else {
                // 다른 타입의 경우 그대로 사용
                safeSetValue(`additionalParams.${paramKey}`, inputValue);
              }
            } else {
              console.warn(`Field ${paramKey} not found in workboard, skipping`);
            }
          });
        }

        // 참조 이미지 설정 (있는 경우)
        if (jobInputData.referenceImages) {
          safeSetValue('referenceImages', jobInputData.referenceImages);
        }

        // 시드 값 설정 (있는 경우)
        if (jobInputData.seed !== undefined) {
          setSeedValue(jobInputData.seed);
          setRandomSeed(false); // 고정 시드 값이 있으면 랜덤 해제
        }

        toast.success(`이전 작업 설정을 불러왔습니다 (${Object.keys(basicFields).filter(k => basicFields[k]).length}개 필드 적용)`);
      } else {
        console.log('🎯 Setting default values...');

        // 기본값 객체 구성
        const defaultValues = {};

        // AI 모델 기본값 설정
        if (workboardData.baseInputFields?.aiModel?.length > 0) {
          const defaultAiModel = workboardData.baseInputFields.aiModel[0].value;
          defaultValues.aiModel = defaultAiModel;
        }

        // 이미지 크기 기본값 설정
        if (workboardData.baseInputFields?.imageSizes?.length > 0) {
          const defaultImageSize = workboardData.baseInputFields.imageSizes[0].value;
          defaultValues.imageSize = defaultImageSize;
        }

        // 스타일 프리셋 기본값 설정
        if (workboardData.baseInputFields?.stylePresets?.length > 0) {
          const defaultStylePreset = workboardData.baseInputFields.stylePresets[0].value;
          defaultValues.stylePreset = defaultStylePreset;
        }

        // 참조 이미지 방법 기본값 설정
        if (workboardData.baseInputFields?.referenceImageMethods?.length > 0) {
          const defaultRefMethod = workboardData.baseInputFields.referenceImageMethods[0].value;
          defaultValues.referenceImageMethod = defaultRefMethod;
        }

        // 업스케일 방법 기본값 설정
        if (workboardData.baseInputFields?.upscaleMethods?.length > 0) {
          const defaultUpscale = workboardData.baseInputFields.upscaleMethods[0].value;
          defaultValues.upscaleMethod = defaultUpscale;
        }

        // 추가 입력 필드들의 기본값 설정
        if (workboardData.additionalInputFields?.length > 0) {
          defaultValues.additionalParams = {};

          workboardData.additionalInputFields.forEach((field) => {
            if (field.type === 'select' && field.options?.length > 0) {
              const defaultValue = field.defaultValue || field.options[0].value;
              defaultValues.additionalParams[field.name] = defaultValue;
            } else if (field.defaultValue !== undefined) {
              defaultValues.additionalParams[field.name] = field.defaultValue;
            }
          });
        }

        console.log('🎯 Applying default values with reset():', defaultValues);

        // 렌더링 완료 후 기본값 설정 (비동기 처리로 폼 초기화 보장)
        setTimeout(() => {
          reset(defaultValues);

          // 개별 필드도 확실하게 설정 (reset이 일부 컴포넌트에서 동작하지 않을 수 있음)
          Object.keys(defaultValues).forEach(key => {
            if (key === 'additionalParams') {
              Object.keys(defaultValues.additionalParams || {}).forEach(paramKey => {
                setValue(`additionalParams.${paramKey}`, defaultValues.additionalParams[paramKey]);
              });
            } else {
              setValue(key, defaultValues[key]);
            }
          });

          console.log('✅ Default values setup completed');
        }, 100);
      }
    }
  }, [workboardData, setValue, reset, getValues]);

  const onSubmit = async (formData) => {
    setGenerating(true);
    try {
      console.log('🚀 Form submission started');
      console.log('📝 Raw form data:', formData);
      console.log('🎲 Random seed:', randomSeed);
      console.log('🔢 Seed value:', seedValue);

      // 시드 값 처리
      const finalSeedValue = randomSeed ? generateRandomSeed() : seedValue;
      console.log('✅ Final seed value:', finalSeedValue);

      // 선택 필드들의 키-값 매핑 처리
      const processedFormData = { ...formData };

      // AI 모델 키-값 매핑
      if (formData.aiModel && workboardData?.baseInputFields?.aiModel) {
        const selectedModel = workboardData.baseInputFields.aiModel.find(model => model.value === formData.aiModel);
        if (selectedModel) {
          processedFormData.aiModel = {
            key: selectedModel.key,
            value: selectedModel.value
          };
          console.log('🤖 AI Model mapped:', processedFormData.aiModel);
        } else {
          console.warn('⚠️ AI model not found:', formData.aiModel);
        }
      }

      // 이미지 크기 키-값 매핑
      if (formData.imageSize && workboardData?.baseInputFields?.imageSizes) {
        const selectedSize = workboardData.baseInputFields.imageSizes.find(size => size.value === formData.imageSize);
        if (selectedSize) {
          processedFormData.imageSize = {
            key: selectedSize.key,
            value: selectedSize.value
          };
          console.log('📐 Image size mapped:', processedFormData.imageSize);
        } else {
          console.warn('⚠️ Image size not found:', formData.imageSize);
        }
      }

      // 스타일 프리셋 키-값 매핑
      if (formData.stylePreset && workboardData?.baseInputFields?.stylePresets) {
        const selectedPreset = workboardData.baseInputFields.stylePresets.find(preset => preset.value === formData.stylePreset);
        if (selectedPreset) {
          processedFormData.stylePreset = {
            key: selectedPreset.key,
            value: selectedPreset.value
          };
          console.log('🎨 Style preset mapped:', processedFormData.stylePreset);
        }
      }

      // 참조 이미지 방법 키-값 매핑
      if (formData.referenceImageMethod && workboardData?.baseInputFields?.referenceImageMethods) {
        const selectedMethod = workboardData.baseInputFields.referenceImageMethods.find(method => method.value === formData.referenceImageMethod);
        if (selectedMethod) {
          processedFormData.referenceImageMethod = {
            key: selectedMethod.key,
            value: selectedMethod.value
          };
          console.log('🖼️ Reference method mapped:', processedFormData.referenceImageMethod);
        }
      }

      // 업스케일 방법 키-값 매핑
      if (formData.upscaleMethod && workboardData?.baseInputFields?.upscaleMethods) {
        const selectedUpscale = workboardData.baseInputFields.upscaleMethods.find(method => method.value === formData.upscaleMethod);
        if (selectedUpscale) {
          processedFormData.upscaleMethod = {
            key: selectedUpscale.key,
            value: selectedUpscale.value
          };
          console.log('📈 Upscale method mapped:', processedFormData.upscaleMethod);
        }
      }

      // 추가 입력 필드들의 키-값 매핑
      if (formData.additionalParams && workboardData?.additionalInputFields) {
        const processedAdditionalParams = { ...formData.additionalParams };

        workboardData.additionalInputFields.forEach(field => {
          const paramValue = formData.additionalParams[field.name];
          if (paramValue !== undefined && field.type === 'select' && field.options) {
            const selectedOption = field.options.find(option => option.value === paramValue);
            if (selectedOption) {
              processedAdditionalParams[field.name] = {
                key: selectedOption.key,
                value: selectedOption.value
              };
              console.log(`⚙️ ${field.name} mapped:`, processedAdditionalParams[field.name]);
            } else {
              console.warn(`⚠️ Option not found for ${field.name}:`, paramValue);
            }
          }
        });

        processedFormData.additionalParams = processedAdditionalParams;
      }

      const finalPayload = {
        workboardId: id,
        ...processedFormData,
        seed: finalSeedValue,
        randomSeed
      };

      console.log('📤 Final payload to API:', JSON.stringify(finalPayload, null, 2));

      await generateMutation.mutateAsync(finalPayload);
    } catch (error) {
      console.error('❌ Submission error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
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

      <form key={workboardData?._id} onSubmit={handleSubmit(onSubmit)}>
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
                    sx={{ mb: 2 }}
                  />
                )}
              />

              {/* LoRA 목록 버튼 - 임시 비활성화 */}
              {/* 
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleLoraModalOpen}
                  startIcon={<ViewList />}
                >
                  LoRA 목록
                </Button>
              </Box>
              */}

              {/* AI 모델 선택 */}
              {workboardData?.baseInputFields?.aiModel && (
                <Controller
                  name="aiModel"
                  control={control}
                  defaultValue={workboardData.baseInputFields.aiModel[0]?.value || ''}
                  rules={{ required: 'AI 모델을 선택해주세요' }}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 3 }} error={!!errors.aiModel}>
                      <InputLabel>AI 모델</InputLabel>
                      <Select
                        {...field}
                        value={field.value || workboardData.baseInputFields.aiModel[0]?.value || ''}
                        label="AI 모델"
                      >
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
                  defaultValue={workboardData.baseInputFields.imageSizes[0]?.value || ''}
                  render={({ field }) => (
                    <FormControl fullWidth sx={{ mb: 3 }}>
                      <InputLabel>이미지 크기</InputLabel>
                      <Select
                        {...field}
                        value={field.value || workboardData.baseInputFields.imageSizes[0]?.value || ''}
                        label="이미지 크기"
                      >
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

              {/* 시드 값 설정 */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="subtitle1">시드 (Seed)</Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={randomSeed}
                        onChange={(e) => {
                          setRandomSeed(e.target.checked);
                          if (e.target.checked) {
                            setSeedValue(generateRandomSeed());
                          }
                        }}
                        color="primary"
                      />
                    }
                    label="무작위"
                  />
                </Box>
                <TextField
                  fullWidth
                  type="number"
                  label="시드 값"
                  value={seedValue}
                  onChange={(e) => setSeedValue(parseInt(e.target.value) || 0)}
                  disabled={randomSeed}
                  placeholder="-9223372036854775808 ~ 9223372036854775807"
                  helperText={randomSeed ? "무작위 모드에서는 자동으로 시드가 생성됩니다" : "동일한 시드는 동일한 결과를 생성합니다"}
                  InputProps={{
                    endAdornment: randomSeed ? (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setSeedValue(generateRandomSeed())}
                          size="small"
                        >
                          <Shuffle />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
              </Paper>
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
                    <Grid item xs={12} sm={field.type === 'image' ? 12 : 6} key={field.name}>
                      <Controller
                        name={`additionalParams.${field.name}`}
                        control={control}
                        defaultValue={field.type === 'select' ?
                          (field.defaultValue || field.options?.[0]?.value || '') :
                          field.type === 'image' ? [] :
                          (field.defaultValue || '')
                        }
                        render={({ field: formField }) => (
                          field.type === 'select' ? (
                            <FormControl fullWidth>
                              <InputLabel>{field.label}</InputLabel>
                              <Select
                                {...formField}
                                value={formField.value || field.defaultValue || field.options?.[0]?.value || ''}
                                label={field.label}
                              >
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
                          ) : field.type === 'image' ? (
                            <CustomImageField
                              field={field}
                              value={formField.value || []}
                              onChange={formField.onChange}
                              maxImages={field.imageConfig?.maxImages || 1}
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

      {/* LoRA 목록 모달 */}
      <LoraListModal
        open={loraModalOpen}
        onClose={handleLoraModalClose}
        workboardId={id}
        onAddLora={handleAddLora}
      />
    </Container>
  );
}

export default ImageGeneration;