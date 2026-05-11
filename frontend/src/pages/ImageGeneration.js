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
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  InputAdornment,
  Chip
} from '@mui/material';
import {
  Send,
  Image as ImageIcon,
  Delete,
  Add,
  ArrowBack,
  Shuffle,
  FolderOpen,
  AutoAwesome,
  AutoFixHigh,
  Storage as StorageIcon,
  ContentCopy
} from '@mui/icons-material';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { workboardAPI, jobAPI, imageAPI, promptDataAPI, userAPI, projectAPI } from '../services/api';
import MetadataPickerModal from '../components/common/MetadataPickerModal';
import MetadataFieldInput from '../components/common/MetadataFieldInput';
import { extractLoraName, insertLoraTag, insertTriggerWordWithLora } from '../utils/promptUtils';
import Pagination from '../components/common/Pagination';
import ImageSelectDialog from '../components/common/ImageSelectDialog';
import PromptGeneratorDialog from '../components/PromptGeneratorDialog';

function PromptDataSelectDialog({ open, onClose, onSelect }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 8;

  const { data, isLoading } = useQuery(
    ['promptDataList', page, limit, search],
    () => promptDataAPI.getAll({ page, limit, search: search || undefined }),
    { enabled: open, keepPreviousData: true }
  );

  const promptDataList = data?.data?.data?.promptDataList || [];
  const pagination = data?.data?.data?.pagination || { total: 0, pages: 1 };

  const handleSelect = (promptData) => {
    promptDataAPI.use(promptData._id);
    onSelect(promptData);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>프롬프트 데이터 불러오기</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder="프롬프트 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          size="small"
          sx={{ mb: 2 }}
        />

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : promptDataList.length === 0 ? (
          <Alert severity="info">
            {search ? '검색 결과가 없습니다.' : '저장된 프롬프트 데이터가 없습니다.'}
          </Alert>
        ) : (
          <>
            <Grid container spacing={2}>
              {promptDataList.map((item) => (
                <Grid item xs={12} sm={6} key={item._id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { boxShadow: 3 },
                      height: '100%'
                    }}
                    onClick={() => handleSelect(item)}
                  >
                    <Box sx={{ display: 'flex', height: '100%' }}>
                      {item.representativeImage?.url ? (
                        <CardMedia
                          component="img"
                          sx={{ width: 80, height: 80, objectFit: 'cover' }}
                          image={item.representativeImage.url}
                          alt={item.name}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 80,
                            height: 80,
                            bgcolor: 'grey.100',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <ImageIcon sx={{ color: 'grey.400' }} />
                        </Box>
                      )}
                      <CardContent sx={{ flex: 1, py: 1, px: 1.5 }}>
                        <Typography variant="subtitle2" noWrap>
                          {item.name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {item.prompt}
                        </Typography>
                      </CardContent>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {pagination.pages > 1 && (
              <Box mt={2}>
                <Pagination
                  currentPage={page}
                  totalPages={pagination.pages}
                  totalItems={pagination.total}
                  onPageChange={setPage}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
      </DialogActions>
    </Dialog>
  );
}

// 사용자 정의 이미지 입력 필드 컴포넌트
function CustomImageField({ field, value, onChange, maxImages = 1, isComfyUI = false }) {
  const [selectedImages, setSelectedImages] = useState(value || []);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (value && Array.isArray(value) && value.length > 0) {
      const hasValidImages = value.every(item => item.imageId && item.image?.url);
      if (hasValidImages && selectedImages.length === 0) {
        setSelectedImages(value);
      }
    }
  }, [value]);

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

  const handleGallerySelect = (selected) => {
    let updated;
    if (Array.isArray(selected)) {
      updated = selected.map(item => ({
        imageId: item.imageId,
        image: item.image
      }));
    } else {
      updated = [{
        imageId: selected.imageId,
        image: selected.image
      }];
    }
    setSelectedImages(updated);
    onChange(updated);
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
            p: 3,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'primary.light' : 'grey.50'
          }}
        >
          <input {...getInputProps()} />
          <ImageIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
          <Typography variant="body2" color="textSecondary">
            이미지를 드래그하거나 클릭하여 업로드
          </Typography>
          <Typography variant="caption" color="textSecondary">
            최대 {maxImages}장
          </Typography>
          {isComfyUI && (
            <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mt: 1 }}>
              미첨부 시 1024×1024 흰색 이미지가 자동으로 사용됩니다
            </Typography>
          )}
        </Box>
      ) : (
        <Grid container spacing={1}>
          {selectedImages.map((item, index) => (
            <Grid item xs={6} sm={4} key={index}>
              <Card sx={{ position: 'relative' }}>
                <CardMedia
                  component="img"
                  image={item.image.url}
                  alt={`Image ${index + 1}`}
                  sx={{
                    height: 150,
                    objectFit: 'contain',
                    bgcolor: 'grey.100'
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemove(item.imageId)}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' }
                  }}
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Card>
            </Grid>
          ))}
          {selectedImages.length < maxImages && (
            <Grid item xs={6} sm={4}>
              <Box
                {...getRootProps()}
                sx={{
                  height: 150,
                  border: '2px dashed',
                  borderColor: 'grey.300',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  bgcolor: 'grey.50',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.100' }
                }}
              >
                <input {...getInputProps()} />
                <Add sx={{ color: 'grey.400', fontSize: 32 }} />
              </Box>
            </Grid>
          )}
        </Grid>
      )}

      <ImageSelectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleGallerySelect}
        title={`${field.label} 선택`}
        multiple={maxImages > 1}
        maxImages={maxImages}
        initialSelected={selectedImages.map(item => ({
          imageId: item.imageId,
          image: item.image
        }))}
      />
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
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const [generating, setGenerating] = useState(false);
  const [randomSeed, setRandomSeed] = useState(true);
  const [seedValue, setSeedValue] = useState(generateRandomSeed);
  const [loraModalOpen, setLoraModalOpen] = useState(false);
  const [promptDataDialogOpen, setPromptDataDialogOpen] = useState(false);
  const [promptGeneratorDialogOpen, setPromptGeneratorDialogOpen] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [continuedTags, setContinuedTags] = useState([]);
  const initializedRef = useRef(null);
  const promptInputRef = useRef(null);

  // 프로젝트 컨텍스트 조회
  const { data: projectData } = useQuery(
    ['project', projectId],
    () => projectAPI.getById(projectId),
    { enabled: !!projectId }
  );
  const projectContext = projectData?.data?.data?.project;

  const handleCopyWorkboardId = async () => {
    if (!workboardData?._id) return;

    try {
      await navigator.clipboard.writeText(workboardData._id);
      toast.success('작업판 ID를 복사했습니다.');
    } catch (error) {
      toast.error('작업판 ID 복사에 실패했습니다.');
    }
  };

  const handleLoraModalOpen = () => {
    setLoraModalOpen(true);
  };

  const handleLoraModalClose = () => {
    setLoraModalOpen(false);
  };

  // F2: handleModelModalOpen / handleCheckpointModelSelect 제거 — customField (type=baseModel) 가 picker 통합

  // LoRA 모달에서 프롬프트 변경 핸들러
  const handlePromptChangeFromLora = (newPrompt) => {
    setPromptValue(newPrompt);
    setValue('prompt', newPrompt);
  };

  // MetadataPickerModal (LoRA, prompt-insert 모드) 의 onPrimary — LoRA 태그를 프롬프트 커서 위치에 삽입.
  const handleAddLoraToPrompt = (lora) => {
    const filename = lora.filename || lora;
    const cursorPosition = promptInputRef?.current?.selectionStart ?? (promptValue?.length || 0);
    const result = insertLoraTag(promptValue || '', filename, cursorPosition);

    if (!result.added) {
      const displayName = lora.civitai?.name || extractLoraName(filename);
      toast(`"${displayName}" LoRA가 이미 프롬프트에 있습니다.`);
      return;
    }

    handlePromptChangeFromLora(result.newPrompt);

    setTimeout(() => {
      if (promptInputRef?.current) {
        promptInputRef.current.focus();
        promptInputRef.current.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
      }
    }, 0);

    const displayName = lora.civitai?.name || extractLoraName(filename);
    toast.success(`${displayName} LoRA가 프롬프트에 추가되었습니다.`);
  };

  // 트리거 워드 chip 클릭 — 프롬프트에 삽입 (LoRA 태그도 자동 추가)
  const handleInsertTriggerWord = (word, lora) => {
    const cursorPosition = promptInputRef?.current?.selectionStart;
    const result = insertTriggerWordWithLora(promptValue || '', word, lora.filename, cursorPosition);

    if (!result.addedTrigger && !result.addedLora) {
      toast(`"${word}"가 이미 프롬프트에 있습니다.`);
      return;
    }

    handlePromptChangeFromLora(result.newPrompt);

    setTimeout(() => {
      if (promptInputRef?.current) promptInputRef.current.focus();
    }, 0);

    if (result.addedLora && result.addedTrigger) {
      toast.success(`"${word}" + LoRA 태그가 프롬프트에 추가되었습니다.`);
    } else if (result.addedTrigger) {
      toast.success(`"${word}"가 프롬프트에 추가되었습니다.`);
    } else if (result.addedLora) {
      toast.success('LoRA 태그가 프롬프트에 추가되었습니다.');
    }
  };

  const handlePromptDataSelect = (promptData) => {
    setValue('prompt', promptData.prompt || '');
    setValue('negativePrompt', promptData.negativePrompt || '');
    if (promptData.seed) {
      setSeedValue(promptData.seed);
      setRandomSeed(false);
    }

    // 대표 이미지가 있고, 작업판에 이미지 필드가 있으면 자동 첨부
    if (promptData.representativeImage?.imageId && workboardData?.additionalInputFields) {
      const imageField = workboardData.additionalInputFields.find(f => f.type === 'image');
      if (imageField) {
        const currentValue = getValues(`additionalParams.${imageField.name}`);
        if (!currentValue || currentValue.length === 0) {
          const { imageId, imageType, url } = promptData.representativeImage;
          setValue(`additionalParams.${imageField.name}`, [{
            imageId,
            image: { _id: imageId, imageType, url }
          }]);
        }
      }
    }

    toast.success(`프롬프트 "${promptData.name}" 불러옴`);
  };

  const handleGeneratedPromptApply = (generatedPrompt) => {
    setValue('prompt', generatedPrompt);
    toast.success('AI 생성 프롬프트가 적용되었습니다');
  };

  const { control, handleSubmit, setValue, reset, getValues, watch, formState: { errors } } = useForm({
    mode: 'onChange',
    shouldUnregister: false,
    shouldFocusError: true
  });

  const { data: workboard, isLoading, error } = useQuery(
    ['workboard', id],
    () => workboardAPI.getById(id)
  );

  // 사용자 설정 가져오기
  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile());
  const userPreferences = profileData?.data?.user?.preferences || {};

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
  const isComfyUIWorkboard = workboardData?.serverId?.serverType === 'ComfyUI';

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

      let lastGeneratedMedia = null;

      if (continueJobData) {
        try {
          const parsedData = JSON.parse(continueJobData);
          console.log('Found continue job data:', parsedData);
          // 동일한 작업판인 경우 사용
          if (parsedData.workboardId === workboardData._id) {
            jobInputData = parsedData.inputData;
            lastGeneratedMedia = parsedData.lastGeneratedMedia || null;
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

        // F2: 기본 필드 (prompt, negativePrompt) 만 직접 매핑 — aiModel/imageSize 등은 customField 가 처리.
        // legacy job 의 {key,value} 객체 값도 그대로 set 됨 (Controller 가 value 만 추출). 이전 매칭 로직은
        // baseInputFields 의 옵션 풀에 의존했는데, F2 에서 풀이 제거되어 단순화.
        if (jobInputData.prompt) {
          safeSetValue('prompt', jobInputData.prompt);
          setPromptValue(jobInputData.prompt);
        }
        if (jobInputData.negativePrompt) {
          safeSetValue('negativePrompt', jobInputData.negativePrompt);
        }
        // customField 들은 additionalParams 네임스페이스에서 복원 (jobInputData 도 동일 구조)
        if (jobInputData.additionalParams) {
          Object.entries(jobInputData.additionalParams).forEach(([k, v]) => {
            safeSetValue(`additionalParams.${k}`, typeof v === 'object' && v?.value !== undefined ? v.value : v);
          });
        }
        // 기존 jobInputData 의 top-level aiModel / imageSize 등 — additionalParams 네임스페이스로 매핑 (legacy job 호환)
        const legacyTopLevelKeys = ['aiModel', 'imageSize', 'imageSizes', 'stylePreset', 'upscaleMethod', 'referenceImageMethod'];
        legacyTopLevelKeys.forEach((k) => {
          const v = jobInputData[k];
          if (v === undefined || v === null) return;
          const unwrapped = typeof v === 'object' && v?.value !== undefined ? v.value : v;
          safeSetValue(`additionalParams.${k}`, unwrapped);
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

        // 마지막 생성 미디어 → 이미지 타입 필드 주입
        if (lastGeneratedMedia?.image && workboardData.additionalInputFields) {
          const imageField = workboardData.additionalInputFields.find(f => f.type === 'image');
          if (imageField) {
            const currentValue = getValues(`additionalParams.${imageField.name}`);
            if (!currentValue || currentValue.length === 0) {
              const image = lastGeneratedMedia.image;
              safeSetValue(`additionalParams.${imageField.name}`, [{
                imageId: image._id,
                image: { _id: image._id, url: image.url, originalName: image.originalName }
              }]);
              console.log('🖼️ Injected last generated image into field:', imageField.name);
            }
          }
        }

        // 참조 이미지 설정 (있는 경우)
        if (jobInputData.referenceImages) {
          safeSetValue('referenceImages', jobInputData.referenceImages);
        }

        // 태그 복원 (계속하기 시 프로젝트 태그 등 유지)
        if (jobInputData.tags && jobInputData.tags.length > 0) {
          setContinuedTags(jobInputData.tags);
        }

        // 시드 값 설정 (있는 경우)
        if (jobInputData.seed !== undefined) {
          setSeedValue(jobInputData.seed);
          // 사용자 설정에 따라 랜덤 시드 적용
          if (userPreferences.useRandomSeedOnContinue) {
            setRandomSeed(true);
            console.log('🎲 Random seed enabled by user preference');
          } else {
            setRandomSeed(false); // 고정 시드 값 사용
          }
        }

        toast.success('이전 작업 설정을 불러왔습니다');
      } else {
        console.log('🎯 Setting default values...');

        // F2: baseInputFields 기반 hardcoded 기본값 제거 — customField 의 defaultValue 만 사용
        const defaultValues = {};

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
  }, [workboardData, setValue, reset, getValues, userPreferences.useRandomSeedOnContinue]);

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

      // F2: baseInputFields hardcoded 매핑 제거 — customField 값이 raw string 으로 그대로 전달됨.
      // 서비스 코드의 extractValue() 가 string / {key,value} 양쪽 모두 처리하므로 backward compat.
      const processedFormData = { ...formData };

      // 태그 병합: 프로젝트 태그 + 계속하기에서 이어받은 태그 (중복 제거)
      const projectTags = projectContext?.tagId?._id ? [projectContext.tagId._id] : [];
      const mergedTags = [...new Set([...projectTags, ...continuedTags])];

      const finalPayload = {
        workboardId: id,
        ...processedFormData,
        seed: finalSeedValue,
        randomSeed,
        ...(mergedTags.length > 0 && { tags: mergedTags })
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

        <Box display="flex" alignItems="center" gap={2}>
          <Typography variant="h4" gutterBottom>
            {workboardData?.name}
          </Typography>
          {projectContext && (
            <Chip
              label={`프로젝트: ${projectContext.name}`}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ mb: 1 }}
            />
          )}
        </Box>
        {workboardData?.description && (
          <Typography variant="body1" color="textSecondary" gutterBottom>
            {workboardData.description}
          </Typography>
        )}
        <Box display="flex" alignItems="center" gap={0.5} mb={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            작업판 ID: {workboardData?._id}
          </Typography>
          <IconButton size="small" onClick={handleCopyWorkboardId} aria-label="작업판 ID 복사">
            <ContentCopy fontSize="inherit" />
          </IconButton>
        </Box>
      </Box>

      <form key={workboardData?._id} onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                기본 설정
              </Typography>

              {/* 프롬프트 */}
              <Box display="flex" justifyContent="flex-end" gap={1} mb={1}>
                <Button
                  size="small"
                  startIcon={<FolderOpen />}
                  onClick={() => setPromptDataDialogOpen(true)}
                >
                  프롬프트 불러오기
                </Button>
                <Button
                  size="small"
                  color="secondary"
                  variant="outlined"
                  startIcon={<AutoAwesome />}
                  onClick={() => setPromptGeneratorDialogOpen(true)}
                >
                  AI 프롬프트 생성
                </Button>
              </Box>
              <Controller
                name="prompt"
                control={control}
                rules={{ required: '프롬프트를 입력해주세요' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    inputRef={promptInputRef}
                    fullWidth
                    multiline
                    rows={4}
                    label="프롬프트"
                    placeholder="생성하고 싶은 이미지에 대한 설명을 입력하세요..."
                    error={!!errors.prompt}
                    helperText={errors.prompt?.message}
                    sx={{ mb: 2 }}
                    onChange={(e) => {
                      field.onChange(e);
                      setPromptValue(e.target.value);
                    }}
                    value={promptValue || field.value || ''}
                  />
                )}
              />

              {/* LoRA 목록 버튼 — 모델 선택은 customField (type=baseModel) 가 picker 통합. LoRA 는 prompt-insert 모드라 별도 유지 */}
              {isComfyUIWorkboard && (
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleLoraModalOpen}
                    startIcon={<AutoFixHigh />}
                  >
                    LoRA 목록
                  </Button>
                </Box>
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

            {/* 추가 설정 — customField 단일 경로 (F2 이후) */}
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
                              isComfyUI={workboardData?.serverId?.serverType === 'ComfyUI'}
                            />
                          ) : field.type === 'baseModel' || field.type === 'lora' ? (
                            <MetadataFieldInput
                              kind={field.type === 'baseModel' ? 'model' : 'lora'}
                              field={field}
                              value={formField.value || ''}
                              onChange={formField.onChange}
                              workboardId={id}
                              serverId={workboardData?.serverId?._id || workboardData?.serverId}
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
      {isComfyUIWorkboard && (
        <MetadataPickerModal
          kind="lora"
          open={loraModalOpen}
          onClose={handleLoraModalClose}
          workboardId={id}
          serverId={workboardData?.serverId?._id || workboardData?.serverId}
          mode="prompt-insert"
          onPrimary={handleAddLoraToPrompt}
          onTrainedWordClick={handleInsertTriggerWord}
        />
      )}

      {/* 프롬프트 데이터 선택 다이얼로그 */}
      <PromptDataSelectDialog
        open={promptDataDialogOpen}
        onClose={() => setPromptDataDialogOpen(false)}
        onSelect={handlePromptDataSelect}
      />

      {/* AI 프롬프트 생성 다이얼로그 */}
      <PromptGeneratorDialog
        open={promptGeneratorDialogOpen}
        onClose={() => setPromptGeneratorDialogOpen(false)}
        onApply={handleGeneratedPromptApply}
      />
    </Container>
  );
}

export default ImageGeneration;
