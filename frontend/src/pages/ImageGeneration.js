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
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { workboardAPI, jobAPI, imageAPI, promptDataAPI, userAPI, projectAPI } from '../services/api';
import { copyToClipboard } from '../utils/clipboard';
import MetadataPickerModal from '../components/common/MetadataPickerModal';
import CustomFieldControl from '../components/common/CustomFieldControl';
import { extractLoraName, insertLoraTag, insertTriggerWordWithLora } from '../utils/promptUtils';
import Pagination from '../components/common/Pagination';
import ImageSelectDialog from '../components/common/ImageSelectDialog';
import PromptGeneratorDialog from '../components/PromptGeneratorDialog';
import { MONO } from '../theme';
import { BRAND_GRADIENTS } from '../utils/brandGradients';
import config from '../config';

function PromptDataSelectDialog({ open, onClose, onSelect }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 8;

  const { data, isLoading } = useQuery({ queryKey: ['promptDataList', page, limit, search], queryFn: () => promptDataAPI.getAll({ page, limit, search: search || undefined }), enabled: open, placeholderData: keepPreviousData });

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
                          color="text.secondary"
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
        >
          갤러리에서 선택
        </Button>
      </Box>

      {field.description && (
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
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
          <Typography variant="body2" color="text.secondary">
            이미지를 드래그하거나 클릭하여 업로드
          </Typography>
          <Typography variant="caption" color="text.secondary">
            최대 {maxImages}장
          </Typography>
          {isComfyUI && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
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
  const [continuedTags, setContinuedTags] = useState([]);
  const initializedRef = useRef(null);
  const promptInputRef = useRef(null);

  // 프로젝트 컨텍스트 조회
  const { data: projectData } = useQuery({ queryKey: ['project', projectId], queryFn: () => projectAPI.getById(projectId), enabled: !!projectId });
  const projectContext = projectData?.data?.data?.project;

  const handleCopyWorkboardId = async () => {
    if (!workboardData?._id) return;

    try {
      await copyToClipboard(workboardData._id);
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
    setValue('prompt', newPrompt, { shouldValidate: true, shouldDirty: true });
  };

  // MetadataPickerModal (LoRA, prompt-insert 모드) 의 onPrimary — LoRA 태그를 프롬프트 커서 위치에 삽입.
  const handleAddLoraToPrompt = (lora) => {
    const filename = lora.filename || lora;
    const currentPrompt = getValues('prompt') || '';
    const cursorPosition = promptInputRef?.current?.selectionStart ?? currentPrompt.length;
    const result = insertLoraTag(currentPrompt, filename, cursorPosition);

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
    const result = insertTriggerWordWithLora(getValues('prompt') || '', word, lora.filename, cursorPosition);

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
    setValue('prompt', promptData.prompt || '', { shouldValidate: true, shouldDirty: true });
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
    setValue('prompt', generatedPrompt, { shouldValidate: true, shouldDirty: true });
    toast.success('AI 생성 프롬프트가 적용되었습니다');
  };

  const { control, handleSubmit, setValue, reset, getValues, watch, formState: { errors } } = useForm({
    mode: 'onChange',
    shouldUnregister: false,
    shouldFocusError: true
  });

  const { data: workboard, isLoading, error } = useQuery({ queryKey: ['workboard', id], queryFn: () => workboardAPI.getById(id) });

  // 사용자 설정 가져오기
  const { data: profileData } = useQuery({ queryKey: ['userProfile'], queryFn: () => userAPI.getProfile() });
  const userPreferences = profileData?.data?.user?.preferences || {};

  // 프롬프트의 <lora:이름:가중치> 태그 → 칩 표시용 파싱 (#552, 목업 06)
  const watchedPrompt = watch('prompt') || '';
  const promptLoras = React.useMemo(() => {
    const out = [];
    for (const m of watchedPrompt.matchAll(/<lora:([^:>]+):([0-9.]+)>/g)) {
      out.push({ tag: m[0], name: m[1], weight: m[2] });
    }
    return out;
  }, [watchedPrompt]);

  const handleRemoveLoraTag = (tag) => {
    const next = watchedPrompt
      .replace(tag, '')
      .replace(/,\s*,/g, ',')
      .replace(/(^\s*,\s*)|(\s*,\s*$)/g, '')
      .replace(/[ \t]{2,}/g, ' ');
    setValue('prompt', next, { shouldDirty: true });
  };

  // 대기 큐 — 우측 레일 표시 (#552)
  const { data: queueStatsData } = useQuery({ queryKey: ['queueStats'], queryFn: jobAPI.getQueueStats,
    refetchInterval: config.monitoring.queueStatusInterval, });
  const qs = queueStatsData?.data?.stats;
  const queueStatsText = qs ? `대기 ${qs.waiting ?? 0} · 진행 ${qs.active ?? 0}` : '—';

  const generateMutation = useMutation({ mutationFn: jobAPI.create,
      onSuccess: (data) => {
        toast.success('이미지 생성 작업이 시작되었습니다');
        queryClient.invalidateQueries({ queryKey: ['historyJobs'] });
        navigate('/jobs');
      },
      onError: (error) => {
        toast.error('작업 생성 실패: ' + error.message);
      } });

  const workboardData = workboard?.data?.workboard;
  const isComfyUIWorkboard = workboardData?.serverId?.serverType === 'ComfyUI';

  // 작업판 데이터가 로드되면 선택 필드들의 기본값 설정
  useEffect(() => {

    if (workboardData) {
      // 이미 초기화된 작업판이면 스킵 (중복 초기화 방지)
      if (initializedRef.current === workboardData._id) {
        return;
      }


      // 로컬스토리지에서 계속하기 데이터 확인
      const continueJobData = localStorage.getItem('continueJobData');
      let jobInputData = null;

      let lastGeneratedMedia = null;
      let prevOutputFormat = null; // 이전 작업의 출력 타입 (#673 — base_model prefill 조건 판단용)

      if (continueJobData) {
        try {
          const parsedData = JSON.parse(continueJobData);
          // 동일한 작업판인 경우 사용
          if (parsedData.workboardId === workboardData._id) {
            jobInputData = parsedData.inputData;
            lastGeneratedMedia = parsedData.lastGeneratedMedia || null;
            prevOutputFormat = parsedData.prevOutputFormat || null; // #673
            localStorage.removeItem('continueJobData'); // 사용 후 제거
          } else {
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

        // #673: 이전 작업의 base_model 을 새 작업판에 prefill 할지 결정.
        //  ① 출력 타입이 다르면 비호환이라 skip  ② 출력 타입 같아도 작업판에 base_model 기본값이 있으면 skip  ③ 그 외 prefill
        const bmField = (workboardData.additionalInputFields || []).find((f) => f.type === 'baseModel');
        const bmHasDefault = bmField && bmField.defaultValue !== undefined && bmField.defaultValue !== null && bmField.defaultValue !== '';
        const allowBaseModelPrefill = !(prevOutputFormat && prevOutputFormat !== workboardData.outputFormat) && !bmHasDefault;

        // F2: 기본 필드 (prompt, negativePrompt) 만 직접 매핑 — aiModel/imageSize 등은 customField 가 처리.
        // legacy job 의 {key,value} 객체 값도 그대로 set 됨 (Controller 가 value 만 추출). 이전 매칭 로직은
        // baseInputFields 의 옵션 풀에 의존했는데, F2 에서 풀이 제거되어 단순화.
        if (jobInputData.prompt) {
          safeSetValue('prompt', jobInputData.prompt);
        }
        if (jobInputData.negativePrompt) {
          safeSetValue('negativePrompt', jobInputData.negativePrompt);
        }
        // customField 들은 additionalParams 네임스페이스에서 복원 (jobInputData 도 동일 구조)
        if (jobInputData.additionalParams) {
          Object.entries(jobInputData.additionalParams).forEach(([k, v]) => {
            if (k === 'base_model' && !allowBaseModelPrefill) return; // #673 비호환/기본값 → 이전 base_model 안 가져옴
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
              } else if (field.type === 'baseModel' && !allowBaseModelPrefill) {
                // #673 비호환/기본값 → 이전 base_model 안 가져옴 (작업판 기본값/빈값 유지)
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
          } else {
            setRandomSeed(false); // 고정 시드 값 사용
          }
        }

        toast.success('이전 작업 설정을 불러왔습니다');
      } else {

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

        }, 100);
      }
    }
  }, [workboardData, setValue, reset, getValues, userPreferences.useRandomSeedOnContinue]);

  const onSubmit = async (formData) => {
    setGenerating(true);
    try {

      // 시드 값 처리
      const finalSeedValue = randomSeed ? generateRandomSeed() : seedValue;

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

  // 서버 표시용 host — serverUrl 이 비정상이어도 렌더가 죽지 않게 가드
  let serverHost = '-';
  try { serverHost = new URL(workboardData?.serverUrl || '').host; } catch (_) { serverHost = workboardData?.serverUrl || '-'; }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/workboards')} sx={{ mb: 3 }}>
        작업판 목록
      </Button>

      {/* 페이지 헤더 — 목업 06 (#552): 아이콘 타일 + h1 + mono ID + 메타 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap', mb: 5 }}>
        <Box sx={{
          width: 56, height: 56, borderRadius: 2, background: BRAND_GRADIENTS[0],
          color: 'common.white', display: 'grid', placeItems: 'center', boxShadow: 2, flex: '0 0 auto',
        }}>
          <ImageIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h1">{workboardData?.name}</Typography>
            {projectContext && (
              <Chip label={`프로젝트: ${projectContext.name}`} color="primary" variant="outlined" />
            )}
          </Box>
          {workboardData?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, textWrap: 'pretty' }}>
              {workboardData.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ fontFamily: MONO, color: 'text.tertiary' }}>
              ID: {workboardData?._id}
            </Typography>
            <IconButton size="small" onClick={handleCopyWorkboardId} aria-label="작업판 ID 복사">
              <ContentCopy fontSize="inherit" />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'text.tertiary' }}>
              {serverHost} · v{workboardData?.version || 1} · 사용횟수 {workboardData?.usageCount || 0}회
            </Typography>
          </Box>
        </Box>
      </Box>

      <form key={workboardData?._id} onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper variant="outlined" sx={{ mb: 4 }}>
              {/* 카드 헤더 — 목업 06: 제목 + 우측 텍스트 액션 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 4, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="h6">기본 설정</Typography>
                <Box sx={{ flex: 1 }} />
                <Button startIcon={<FolderOpen />} onClick={() => setPromptDataDialogOpen(true)}>
                  프롬프트 불러오기
                </Button>
                <Button color="secondary" startIcon={<AutoAwesome />} onClick={() => setPromptGeneratorDialogOpen(true)}>
                  AI 프롬프트 생성
                </Button>
              </Box>
              <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 3.5 }}>
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
                    helperText={errors.prompt?.message || '명사 위주, 콤마로 구분. 가중치는 (word:1.2) 문법.'}
                    value={field.value || ''}
                  />
                )}
              />

              {/* LoRA — 프롬프트의 <lora:이름:가중치> 태그를 칩으로 표시 (목업 06, #552). 추가는 기존 prompt-insert 모달 */}
              {isComfyUIWorkboard && (
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'block', mb: 1 }}>
                    LoRA
                  </Typography>
                  <Box sx={{
                    display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center',
                    p: 2.5, minHeight: 44, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5,
                  }}>
                    {promptLoras.map((l) => (
                      <Chip
                        key={l.tag}
                        variant="outlined"
                        icon={<AutoFixHigh sx={{ fontSize: 13 }} />}
                        label={(
                          <Box component="span">
                            {l.name}
                            <Box component="span" sx={{ fontFamily: MONO, fontSize: 11, color: 'text.tertiary', ml: 0.5 }}>· {l.weight}</Box>
                          </Box>
                        )}
                        onDelete={() => handleRemoveLoraTag(l.tag)}
                        sx={{ bgcolor: 'background.paper' }}
                      />
                    ))}
                    <Button startIcon={<Add />} onClick={handleLoraModalOpen} sx={{ height: 26 }}>
                      LoRA 추가
                    </Button>
                  </Box>
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
                  />
                )}
              />

              {/* 시드 값 설정 */}
              <Paper variant="outlined" sx={{ p: 3 }}>
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
                        >
                          <Shuffle />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
              </Paper>
              </Box>
            </Paper>

            {/* 추가 설정 — customField 단일 경로 (F2 이후) */}
            {workboardData?.additionalInputFields?.length > 0 && (
              <Paper variant="outlined" sx={{ mb: 4 }}>
                <Box sx={{ px: 4, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="h6">고급 설정</Typography>
                </Box>
                <Grid container spacing={3.5} sx={{ p: 4 }}>
                  {workboardData.additionalInputFields.map((field) => (
                    <Grid item xs={12} sm={field.type === 'image' ? 12 : 6} key={field.name}>
                      {field.type === 'image' ? (
                        <Controller
                          name={`additionalParams.${field.name}`}
                          control={control}
                          defaultValue={[]}
                          render={({ field: formField }) => (
                            <CustomImageField
                              field={field}
                              value={formField.value || []}
                              onChange={formField.onChange}
                              maxImages={field.imageConfig?.maxImages || 3}
                              isComfyUI={workboardData?.serverId?.serverType === 'ComfyUI'}
                            />
                          )}
                        />
                      ) : (
                        // 공용 렌더러 (#711) — required 강제 포함. 편집기 프리뷰와 동일 렌더 보장
                        <CustomFieldControl
                          field={field}
                          control={control}
                          name={`additionalParams.${field.name}`}
                          workboardId={id}
                          serverId={workboardData?.serverId?._id || workboardData?.serverId}
                          allowedModelTypes={workboardData?.allowedModelTypes}
                        />
                      )}
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
          </Grid>

          {/* 우측 레일 — 목업 06 (#552) */}
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 4, position: 'sticky', top: 16 }}>
              <Typography variant="overline" sx={{ color: 'text.tertiary' }}>작업판 정보</Typography>

              <Box sx={{ mt: 2, mb: 3.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {[
                  ['서버', serverHost, true],
                  ['버전', `v${workboardData?.version || 1}`, false],
                  ['사용횟수', `${workboardData?.usageCount || 0}회`, false],
                  ['대기 큐', queueStatsText, false],
                ].map(([k, v, mono]) => (
                  <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.tertiary' }}>{k}</Typography>
                    <Typography variant="body2" sx={{ fontFamily: mono ? MONO : undefined, fontSize: mono ? 12 : undefined, textAlign: 'right' }}>
                      {v}
                    </Typography>
                  </Box>
                ))}
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
                disabled={generating || generateMutation.isPending}
                startIcon={generating ? <CircularProgress size={20} /> : <Send />}
              >
                {generating ? '생성 중...' : '이미지 생성 시작'}
              </Button>

              <Alert severity="info" sx={{ mt: 2.5 }}>
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
