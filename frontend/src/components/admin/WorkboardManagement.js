import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  ContentCopy,
  Visibility,
  Computer,
  TrendingUp,
  Settings,
  ExpandMore
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { workboardAPI, serverAPI } from '../../services/api';
import WorkboardBasicInfoForm from './WorkboardBasicInfoForm';

function WorkboardCard({ workboard, onEdit, onDelete, onDuplicate, onView }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" gutterBottom>
            {workboard.name}
          </Typography>
          <IconButton size="small" onClick={handleMenuOpen}>
            <MoreVert />
          </IconButton>
        </Box>

        {workboard.description && (
          <Typography variant="body2" color="textSecondary" paragraph>
            {workboard.description}
          </Typography>
        )}

        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Computer fontSize="small" />
          <Typography variant="caption" color="textSecondary">
            {workboard.serverId ? 
              `${workboard.serverId.name} (${workboard.serverId.serverType})` :
              workboard.serverUrl ? new URL(workboard.serverUrl).hostname : '서버 미설정'
            }
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TrendingUp fontSize="small" />
          <Typography variant="caption" color="textSecondary">
            사용횟수: {workboard.usageCount || 0}회
          </Typography>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          <Chip
            label={workboard.workboardType === 'prompt' ? '프롬프트' : '이미지'}
            color={workboard.workboardType === 'prompt' ? 'secondary' : 'primary'}
            size="small"
          />
          <Chip
            label={workboard.isActive ? '활성' : '비활성'}
            color={workboard.isActive ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`v${workboard.version || 1}`}
            color="info"
            size="small"
            variant="outlined"
          />
        </Box>

        <Typography variant="caption" color="textSecondary">
          생성자: {workboard.createdBy?.nickname || '알 수 없음'}
        </Typography>
        <br />
        <Typography variant="caption" color="textSecondary">
          생성일: {new Date(workboard.createdAt).toLocaleDateString()}
        </Typography>
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { onView(workboard); handleMenuClose(); }}>
          <Visibility sx={{ mr: 1 }} fontSize="small" />
          보기
        </MenuItem>
        <MenuItem onClick={() => { onEdit(workboard); handleMenuClose(); }}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          편집
        </MenuItem>
        <MenuItem onClick={() => { onEdit(workboard, 'detailed'); handleMenuClose(); }}>
          <Settings sx={{ mr: 1 }} fontSize="small" />
          상세 편집
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(workboard); handleMenuClose(); }}>
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          복제
        </MenuItem>
        <MenuItem 
          onClick={() => { onDelete(workboard); handleMenuClose(); }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} fontSize="small" />
          삭제
        </MenuItem>
      </Menu>
    </Card>
  );
}

// 상세 편집을 위한 새로운 다이얼로그 컴포넌트
function WorkboardDetailDialog({ open, onClose, workboard, onSave }) {
  const [tabValue, setTabValue] = useState(0);
  const [fullWorkboard, setFullWorkboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      serverId: '',
      workboardType: 'image',
      workflowData: '',
      isActive: true,
      aiModels: [],
      imageSizes: [],
      referenceImageMethods: [],
      systemPrompt: '',
      referenceImages: [],
      temperature: 0.7,
      maxTokens: 2000,
      negativePromptField: { enabled: false, required: false },
      upscaleMethodField: { enabled: false, required: false, options: [] },
      baseStyleField: { enabled: false, required: false, options: [], formatString: '{{##base_style##}}' },
      additionalCustomFields: []
    }
  });
  
  const workboardType = watch('workboardType');

  // 관리자 전용 API로 완전한 데이터 로딩
  React.useEffect(() => {
    if (workboard && workboard._id && open) {
      setLoading(true);
      console.log('Fetching full workboard data with ID:', workboard._id);
      
      workboardAPI.getByIdAdmin(workboard._id)
        .then(response => {
          const fullData = response.data.workboard;
          console.log('Full workboard data received:', fullData);
          console.log('WorkflowData from admin API:', fullData.workflowData);
          setFullWorkboard(fullData);
          
          const formData = {
            name: fullData.name || '',
            description: fullData.description || '',
            serverId: fullData.serverId?._id || fullData.serverId || '',
            workboardType: fullData.workboardType || 'image',
            workflowData: fullData.workflowData || '',
            isActive: fullData.isActive ?? true,
            aiModels: fullData.baseInputFields?.aiModel?.map(m => ({ key: m.key || '', value: m.value || '' })) || [],
            imageSizes: fullData.baseInputFields?.imageSizes?.map(s => ({ key: s.key || '', value: s.value || '' })) || [],
            referenceImageMethods: fullData.baseInputFields?.referenceImageMethods?.map(r => ({ key: r.key || '', value: r.value || '' })) || [],
            systemPrompt: fullData.baseInputFields?.systemPrompt || '',
            referenceImages: fullData.baseInputFields?.referenceImages?.map(r => ({ key: r.key || '', value: r.value || '' })) || [],
            temperature: fullData.baseInputFields?.temperature ?? 0.7,
            maxTokens: fullData.baseInputFields?.maxTokens ?? 2000,
            // 추가 입력값
            negativePromptField: {
              enabled: fullData.additionalInputFields?.some(f => f.name === 'negativePrompt') || false,
              required: fullData.additionalInputFields?.find(f => f.name === 'negativePrompt')?.required || false
            },
            upscaleMethodField: {
              enabled: fullData.additionalInputFields?.some(f => f.name === 'upscaleMethod') || false,
              required: fullData.additionalInputFields?.find(f => f.name === 'upscaleMethod')?.required || false,
              options: fullData.additionalInputFields?.find(f => f.name === 'upscaleMethod')?.options || []
            },
            baseStyleField: {
              enabled: fullData.additionalInputFields?.some(f => f.name === 'baseStyle') || false,
              required: fullData.additionalInputFields?.find(f => f.name === 'baseStyle')?.required || false,
              options: fullData.additionalInputFields?.find(f => f.name === 'baseStyle')?.options || [],
              formatString: fullData.additionalInputFields?.find(f => f.name === 'baseStyle')?.formatString || '{{##base_style##}}'
            },
            // 추가 커스톰 필드들
            additionalCustomFields: fullData.additionalInputFields?.filter(f => !['negativePrompt', 'upscaleMethod', 'baseStyle'].includes(f.name)).map(f => ({
              ...f,
              imageConfig: f.imageConfig || { maxImages: 1 }
            })) || []
          };
          
          console.log('Form data to reset with:', formData);
          reset(formData);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error fetching full workboard data:', error);
          setLoading(false);
        });
    }
  }, [workboard?._id, open, reset]);

  const addArrayItem = (fieldName, defaultItem = { key: '', value: '' }) => {
    const currentItems = watch(fieldName) || [];
    setValue(fieldName, [...currentItems, defaultItem]);
  };

  const removeArrayItem = (fieldName, index) => {
    const currentItems = watch(fieldName) || [];
    setValue(fieldName, currentItems.filter((_, i) => i !== index));
  };

  const onSubmit = (data) => {
    // 추가 입력 필드들을 올바른 형식으로 변환
    const additionalInputFields = [];

    if (data.negativePromptField?.enabled) {
      additionalInputFields.push({
        name: 'negativePrompt',
        label: '부정 프롬프트',
        type: 'string',
        required: Boolean(data.negativePromptField.required),
        placeholder: '부정 프롬프트를 입력하세요...'
      });
    }

    if (data.upscaleMethodField?.enabled) {
      additionalInputFields.push({
        name: 'upscaleMethod',
        label: '업스케일 방법',
        type: 'select',
        required: Boolean(data.upscaleMethodField.required),
        options: (data.upscaleMethodField.options || []).filter(opt => opt.key && opt.value)
      });
    }

    if (data.baseStyleField?.enabled) {
      additionalInputFields.push({
        name: 'baseStyle',
        label: '기초 스타일',
        type: 'select',
        required: Boolean(data.baseStyleField.required),
        options: (data.baseStyleField.options || []).filter(opt => opt.key && opt.value),
        formatString: data.baseStyleField.formatString || '{{##base_style##}}'
      });
    }

    // 추가 커스톰 필드들 추가
    if (data.additionalCustomFields) {
      data.additionalCustomFields.forEach(field => {
        if (field.name && field.label) {
          const fieldData = {
            name: field.name,
            label: field.label,
            type: field.type || 'string',
            required: Boolean(field.required),
            formatString: field.formatString || `{{##${field.name}##}}`
          };
          
          if (field.type === 'select') {
            fieldData.options = field.options || [];
          }
          
          if (field.type === 'image') {
            fieldData.imageConfig = {
              maxImages: field.imageConfig?.maxImages || 1
            };
          }
          
          additionalInputFields.push(fieldData);
        }
      });
    }

    const updateData = {
      name: data.name?.trim(),
      description: data.description?.trim(),
      serverId: data.serverId,
      workboardType: data.workboardType || 'image',
      workflowData: data.workboardType === 'prompt' ? '' : data.workflowData,
      isActive: Boolean(data.isActive),
      baseInputFields: {
        aiModel: (data.aiModels || []).filter(m => m.key && m.value),
        imageSizes: data.workboardType === 'image' ? (data.imageSizes || []).filter(s => s.key && s.value) : [],
        referenceImageMethods: data.workboardType === 'image' ? (data.referenceImageMethods || []).filter(r => r.key && r.value) : [],
        systemPrompt: data.workboardType === 'prompt' ? (data.systemPrompt || '') : '',
        referenceImages: data.workboardType === 'prompt' ? (data.referenceImages || []).filter(r => r.key && r.value) : [],
        temperature: data.workboardType === 'prompt' ? (parseFloat(data.temperature) || 0.7) : undefined,
        maxTokens: data.workboardType === 'prompt' ? (parseInt(data.maxTokens) || 2000) : undefined
      },
      additionalInputFields
    };

    console.log('Form data before processing:', data);
    console.log('WorkflowData being sent:', data.workflowData);
    console.log('Full update data:', JSON.stringify(updateData, null, 2));
    onSave(updateData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        작업판 상세 편집 - {workboard?.name}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                작업판 데이터 로딩 중...
              </Typography>
            </Box>
          ) : (
            <>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="기본 정보" />
            <Tab label="기초 입력값" />
            <Tab label="추가 입력값" />
            {workboardType === 'image' && <Tab label="워크플로우" />}
          </Tabs>

          {/* 기본 정보 탭 */}
          {tabValue === 0 && (
            <WorkboardBasicInfoForm
              control={control}
              errors={errors}
              showActiveSwitch={true}
              showTypeSelector={true}
              isDialogOpen={open}
            />
          )}

          {/* 기초 입력값 탭 */}
          {tabValue === 1 && (
            <Box>
              {/* AI 모델 설정 - 공통 */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">AI 모델 설정</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Box>
                      <Typography variant="body2" color="textSecondary">
                        사용자가 선택할 수 있는 AI 모델들을 설정합니다.
                      </Typography>
                      {workboardType === 'image' && (
                        <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace', mt: 1, display: 'block' }}>
                          Workflow JSON 형식: <code>{'{{##model##}}'}</code>
                        </Typography>
                      )}
                    </Box>
                    <Button
                      startIcon={<Add />}
                      onClick={() => addArrayItem('aiModels')}
                      size="small"
                    >
                      모델 추가
                    </Button>
                  </Box>
                  {watch('aiModels')?.map((model, index) => (
                    <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                      <Controller
                        name={`aiModels.${index}.key`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label="모델 표시명"
                            size="small"
                            sx={{ flex: 1 }}
                          />
                        )}
                      />
                      <Controller
                        name={`aiModels.${index}.value`}
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            label={workboardType === 'prompt' ? '모델 ID (예: gpt-4)' : '모델 파일 경로'}
                            size="small"
                            sx={{ flex: 2 }}
                          />
                        )}
                      />
                      <IconButton
                        onClick={() => removeArrayItem('aiModels', index)}
                        color="error"
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>

              {/* 프롬프트 작업판 전용 설정 */}
              {workboardType === 'prompt' && (
                <>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="h6">시스템 프롬프트</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="textSecondary" mb={2}>
                        AI에게 전달할 시스템 프롬프트를 설정합니다. 사용자 입력 앞에 이 내용이 추가됩니다.
                      </Typography>
                      <Controller
                        name="systemPrompt"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            multiline
                            rows={6}
                            label="시스템 프롬프트"
                            placeholder="예: 당신은 창의적인 프롬프트 작성 전문가입니다..."
                          />
                        )}
                      />
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="h6">생성 설정</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="textSecondary" mb={2}>
                        프롬프트 생성 시 사용할 파라미터를 설정합니다.
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Controller
                            name="temperature"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                type="number"
                                label="Temperature"
                                inputProps={{ step: 0.1, min: 0, max: 2 }}
                                helperText="창의성 수준 (0~2, 높을수록 다양한 결과)"
                              />
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Controller
                            name="maxTokens"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                fullWidth
                                type="number"
                                label="Max Tokens"
                                inputProps={{ min: 100, max: 16000 }}
                                helperText="최대 출력 토큰 수"
                              />
                            )}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="h6">참고 이미지 설정</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="body2" color="textSecondary">
                          프롬프트 생성 시 참고할 이미지 타입을 설정합니다.
                        </Typography>
                        <Button
                          startIcon={<Add />}
                          onClick={() => addArrayItem('referenceImages')}
                          size="small"
                        >
                          이미지 타입 추가
                        </Button>
                      </Box>
                      {watch('referenceImages')?.map((ref, index) => (
                        <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                          <Controller
                            name={`referenceImages.${index}.key`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="이미지 타입명"
                                placeholder="예: 캐릭터 참고"
                                size="small"
                                sx={{ flex: 1 }}
                              />
                            )}
                          />
                          <Controller
                            name={`referenceImages.${index}.value`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="설명"
                                placeholder="예: 캐릭터 외형 참고 이미지"
                                size="small"
                                sx={{ flex: 2 }}
                              />
                            )}
                          />
                          <IconButton
                            onClick={() => removeArrayItem('referenceImages', index)}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                </>
              )}

              {/* 이미지 작업판 전용 설정 */}
              {workboardType === 'image' && (
                <>
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="h6">이미지 크기 설정</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            이미지 생성 크기 옵션들을 설정합니다.
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace', mt: 1, display: 'block' }}>
                            Workflow JSON 형식: <code>{'{{##width##}}'}</code>, <code>{'{{##height##}}'}</code>
                          </Typography>
                        </Box>
                        <Button
                          startIcon={<Add />}
                          onClick={() => addArrayItem('imageSizes')}
                          size="small"
                        >
                          크기 추가
                        </Button>
                      </Box>
                      {watch('imageSizes')?.map((size, index) => (
                        <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                          <Controller
                            name={`imageSizes.${index}.key`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="크기 표시명 (예: 512x512)"
                                size="small"
                                sx={{ flex: 1 }}
                              />
                            )}
                          />
                          <Controller
                            name={`imageSizes.${index}.value`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="실제 크기 값"
                                size="small"
                                sx={{ flex: 1 }}
                              />
                            )}
                          />
                          <IconButton
                            onClick={() => removeArrayItem('imageSizes', index)}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="h6">참고 이미지 사용방식</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            참고 이미지를 어떻게 활용할지 옵션들을 설정합니다.
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace', mt: 1, display: 'block' }}>
                            Workflow JSON 형식: <code>{'{{##reference_method##}}'}</code>
                          </Typography>
                        </Box>
                        <Button
                          startIcon={<Add />}
                          onClick={() => addArrayItem('referenceImageMethods')}
                          size="small"
                        >
                          방식 추가
                        </Button>
                      </Box>
                      {watch('referenceImageMethods')?.map((method, index) => (
                        <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                          <Controller
                            name={`referenceImageMethods.${index}.key`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="방식 표시명"
                                size="small"
                                sx={{ flex: 1 }}
                              />
                            )}
                          />
                          <Controller
                            name={`referenceImageMethods.${index}.value`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                label="실제 처리 방식"
                                size="small"
                                sx={{ flex: 1 }}
                              />
                            )}
                          />
                          <IconButton
                            onClick={() => removeArrayItem('referenceImageMethods', index)}
                            color="error"
                            size="small"
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                </>
              )}
            </Box>
          )}

          {/* 추가 입력값 탭 */}
          {tabValue === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 3 }}>
                추가 입력값은 관리자가 선택적으로 활성화할 수 있는 입력 필드들입니다.
              </Alert>

              {/* 부정 프롬프트 필드 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="h6">부정 프롬프트</Typography>
                    <Controller
                      name="negativePromptField.enabled"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="활성화"
                        />
                      )}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Controller
                    name="negativePromptField.required"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="필수 입력"
                      />
                    )}
                  />
                  <Typography variant="body2" color="textSecondary" mt={1}>
                    사용자가 부정 프롬프트를 입력할 수 있는 텍스트 필드입니다.
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace', mt: 1, display: 'block' }}>
                    📝 Workflow JSON 형식: <code>{'{{##negative_prompt##}}'}</code>
                  </Typography>
                </AccordionDetails>
              </Accordion>

              {/* 업스케일 방법 필드 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="h6">업스케일 방법</Typography>
                    <Controller
                      name="upscaleMethodField.enabled"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="활성화"
                        />
                      )}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Controller
                    name="upscaleMethodField.required"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="필수 선택"
                      />
                    )}
                  />
                  <Box mt={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Box>
                        <Typography variant="body2">업스케일 방법 옵션</Typography>
                        <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace', mt: 1, display: 'block' }}>
                          📝 Workflow JSON 형식: <code>{'{{##upscale_method##}}'}</code>
                        </Typography>
                      </Box>
                      <Button
                        startIcon={<Add />}
                        onClick={() => {
                          const current = watch('upscaleMethodField.options') || [];
                          setValue('upscaleMethodField.options', [...current, { key: '', value: '' }]);
                        }}
                        size="small"
                      >
                        옵션 추가
                      </Button>
                    </Box>
                    {watch('upscaleMethodField.options')?.map((option, index) => (
                      <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                        <Controller
                          name={`upscaleMethodField.options.${index}.key`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="표시명"
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          )}
                        />
                        <Controller
                          name={`upscaleMethodField.options.${index}.value`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="실제 값"
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          )}
                        />
                        <IconButton
                          onClick={() => {
                            const current = watch('upscaleMethodField.options') || [];
                            setValue('upscaleMethodField.options', current.filter((_, i) => i !== index));
                          }}
                          color="error"
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 기초 스타일 필드 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Typography variant="h6">기초 스타일</Typography>
                    <Controller
                      name="baseStyleField.enabled"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Switch {...field} checked={field.value} />}
                          label="활성화"
                        />
                      )}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Controller
                    name="baseStyleField.required"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Switch {...field} checked={field.value} />}
                        label="필수 선택"
                      />
                    )}
                  />
                  {/* 형식 문자열 설정 */}
                  <Box mb={2}>
                    <Controller
                      name="baseStyleField.formatString"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Workflow JSON 형식 문자열"
                          placeholder="예: {{##base_style##}}"
                          size="small"
                          sx={{ fontFamily: 'monospace' }}
                        />
                      )}
                    />
                    <Typography variant="caption" color="textSecondary">
                      Workflow JSON에서 이 필드를 대체할 문자열을 설정하세요.
                    </Typography>
                  </Box>
                  <Box mt={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="body2">스타일 옵션 (LoRA 설정)</Typography>
                      <Button
                        startIcon={<Add />}
                        onClick={() => {
                          const current = watch('baseStyleField.options') || [];
                          setValue('baseStyleField.options', [...current, { key: '', value: '' }]);
                        }}
                        size="small"
                      >
                        스타일 추가
                      </Button>
                    </Box>
                    {watch('baseStyleField.options')?.map((style, index) => (
                      <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                        <Controller
                          name={`baseStyleField.options.${index}.key`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="스타일명"
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          )}
                        />
                        <Controller
                          name={`baseStyleField.options.${index}.value`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              label="LoRA 경로/설정"
                              size="small"
                              sx={{ flex: 2 }}
                            />
                          )}
                        />
                        <IconButton
                          onClick={() => {
                            const current = watch('baseStyleField.options') || [];
                            setValue('baseStyleField.options', current.filter((_, i) => i !== index));
                          }}
                          color="error"
                          size="small"
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {/* 추가 커스톰 필드 */}
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">추가 커스톰 필드</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="body2" color="textSecondary">
                      사용자 정의 입력 필드를 추가할 수 있습니다.
                    </Typography>
                    <Button
                      startIcon={<Add />}
                      onClick={() => {
                        const current = watch('additionalCustomFields') || [];
                        setValue('additionalCustomFields', [...current, {
                          name: '',
                          label: '',
                          type: 'string',
                          required: false,
                          formatString: '',
                          options: [],
                          imageConfig: { maxImages: 1 }
                        }]);
                      }}
                      size="small"
                    >
                      필드 추가
                    </Button>
                  </Box>
                  {watch('additionalCustomFields')?.map((field, index) => (
                    <Accordion key={index} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMore />}>
                        <Typography>
                          {field.label || `커스톰 필드 ${index + 1}`}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Controller
                              name={`additionalCustomFields.${index}.name`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <TextField
                                  {...fieldProps}
                                  fullWidth
                                  label="필드명 (영문)"
                                  placeholder="예: customField1"
                                  size="small"
                                  sx={{ fontFamily: 'monospace' }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <Controller
                              name={`additionalCustomFields.${index}.label`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <TextField
                                  {...fieldProps}
                                  fullWidth
                                  label="표시명"
                                  placeholder="예: 커스톰 옵션"
                                  size="small"
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <Controller
                              name={`additionalCustomFields.${index}.type`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <TextField
                                  {...fieldProps}
                                  fullWidth
                                  select
                                  label="입력 타입"
                                  size="small"
                                >
                                  <MenuItem value="string">텍스트</MenuItem>
                                  <MenuItem value="number">숫자</MenuItem>
                                  <MenuItem value="select">선택</MenuItem>
                                  <MenuItem value="boolean">체크박스</MenuItem>
                                  <MenuItem value="image">이미지</MenuItem>
                                </TextField>
                              )}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <Controller
                              name={`additionalCustomFields.${index}.formatString`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <TextField
                                  {...fieldProps}
                                  fullWidth
                                  label="Workflow 형식 문자열"
                                  placeholder={`예: {{##${field.name || 'field_name'}##}}`}
                                  size="small"
                                  sx={{ fontFamily: 'monospace' }}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <Controller
                              name={`additionalCustomFields.${index}.required`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <FormControlLabel
                                  control={<Switch {...fieldProps} checked={fieldProps.value} />}
                                  label="필수 입력"
                                />
                              )}
                            />
                          </Grid>
                          {field.type === 'image' && (
                            <Grid item xs={12}>
                              <Typography variant="body2" gutterBottom>
                                이미지 설정
                              </Typography>
                              <Controller
                                name={`additionalCustomFields.${index}.imageConfig.maxImages`}
                                control={control}
                                render={({ field: imageField }) => (
                                  <TextField
                                    {...imageField}
                                    fullWidth
                                    select
                                    label="최대 이미지 수"
                                    size="small"
                                    value={imageField.value || 1}
                                  >
                                    <MenuItem value={1}>1개</MenuItem>
                                    <MenuItem value={2}>2개</MenuItem>
                                    <MenuItem value={3}>3개</MenuItem>
                                  </TextField>
                                )}
                              />
                              <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                                사용자가 선택할 수 있는 참고 이미지의 최대 개수를 설정합니다.
                              </Typography>
                            </Grid>
                          )}
                          {field.type === 'select' && (
                            <Grid item xs={12}>
                              <Typography variant="body2" gutterBottom>
                                선택 옵션
                              </Typography>
                              <Box display="flex" justifyContent="flex-end" mb={1}>
                                <Button
                                  startIcon={<Add />}
                                  onClick={() => {
                                    const currentOptions = watch(`additionalCustomFields.${index}.options`) || [];
                                    setValue(`additionalCustomFields.${index}.options`, [...currentOptions, { key: '', value: '' }]);
                                  }}
                                  size="small"
                                >
                                  옵션 추가
                                </Button>
                              </Box>
                              {watch(`additionalCustomFields.${index}.options`)?.map((option, optionIndex) => (
                                <Box key={optionIndex} display="flex" gap={1} mb={1} alignItems="center">
                                  <Controller
                                    name={`additionalCustomFields.${index}.options.${optionIndex}.key`}
                                    control={control}
                                    render={({ field: optionField }) => (
                                      <TextField
                                        {...optionField}
                                        label="표시명"
                                        size="small"
                                        sx={{ flex: 1 }}
                                      />
                                    )}
                                  />
                                  <Controller
                                    name={`additionalCustomFields.${index}.options.${optionIndex}.value`}
                                    control={control}
                                    render={({ field: optionField }) => (
                                      <TextField
                                        {...optionField}
                                        label="실제 값"
                                        size="small"
                                        sx={{ flex: 1 }}
                                      />
                                    )}
                                  />
                                  <IconButton
                                    onClick={() => {
                                      const currentOptions = watch(`additionalCustomFields.${index}.options`) || [];
                                      setValue(`additionalCustomFields.${index}.options`, currentOptions.filter((_, i) => i !== optionIndex));
                                    }}
                                    color="error"
                                    size="small"
                                  >
                                    <Delete />
                                  </IconButton>
                                </Box>
                              ))}
                            </Grid>
                          )}
                          <Grid item xs={12}>
                            <Box display="flex" justifyContent="flex-end">
                              <IconButton
                                onClick={() => {
                                  const current = watch('additionalCustomFields') || [];
                                  setValue('additionalCustomFields', current.filter((_, i) => i !== index));
                                }}
                                color="error"
                              >
                                <Delete />
                              </IconButton>
                            </Box>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </AccordionDetails>
              </Accordion>
            </Box>
          )}

          {/* 워크플로우 탭 - 이미지 타입만 */}
          {workboardType === 'image' && tabValue === 3 && (
            <Box>
              <Controller
                name="workflowData"
                control={control}
                rules={{ required: workboardType === 'image' ? 'Workflow JSON을 입력해주세요' : false }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={20}
                    label="ComfyUI Workflow JSON"
                    error={!!errors.workflowData}
                    helperText={errors.workflowData?.message || "Mustache 형식의 변수를 사용하세요: {{##prompt##}}, {{##model##}}, {{##width##}}, {{##height##}} 등"}
                    sx={{ fontFamily: 'monospace' }}
                  />
                )}
              />
            </Box>
          )}
            </>
          )}
      </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>취소</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            저장
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function WorkboardDialog({ open, onClose, workboard = null, onSave }) {
  const isEditing = !!workboard;
  
  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: workboard?.name || '',
      description: workboard?.description || '',
      workboardType: workboard?.workboardType || 'image',
      serverId: workboard?.serverId?._id || '',
      isActive: workboard?.isActive ?? true
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: workboard?.name || '',
        description: workboard?.description || '',
        workboardType: workboard?.workboardType || 'image',
        serverId: workboard?.serverId?._id || '',
        isActive: workboard?.isActive ?? true
      });
    }
  }, [open, workboard, reset]);

  const onSubmit = (data) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {isEditing ? '작업판 편집' : '새 작업판 생성'}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <WorkboardBasicInfoForm
            control={control}
            errors={errors}
            showActiveSwitch={false}
            showTypeSelector={!isEditing}
            isDialogOpen={open}
          />

          {!isEditing && (
            <Alert severity="info" sx={{ mt: 2 }}>
              기본 작업판 구조가 생성됩니다. 상세 설정(AI 모델, 입력 필드 등)은 
              생성 후 상세 편집에서 추가할 수 있습니다.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>취소</Button>
          <Button 
            type="submit" 
            variant="contained"
          >
            {isEditing ? '수정' : '생성'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function WorkboardManagement() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedWorkboard, setSelectedWorkboard] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    ['adminWorkboards', { search }],
    () => workboardAPI.getAll({ search, limit: 50, includeAll: true }),
    { keepPreviousData: true }
  );

  const createMutation = useMutation(
    workboardAPI.create,
    {
      onSuccess: (response) => {
        console.log('✨ New workboard created, updating cache immediately');
        toast.success('작업판이 생성되었습니다');
        
        // 즉시 캐시 업데이트 - 새 작업판을 목록에 추가
        queryClient.setQueryData('adminWorkboards', (oldData) => {
          if (!oldData?.data?.workboards || !response.data?.workboard) {
            queryClient.refetchQueries('adminWorkboards');
            return oldData;
          }
          
          return {
            ...oldData,
            data: {
              ...oldData.data,
              workboards: [response.data.workboard, ...oldData.data.workboards],
              pagination: {
                ...oldData.data.pagination,
                total: oldData.data.pagination.total + 1
              }
            }
          };
        });
        
        // 강제 리패치로 정확한 데이터 보장
        queryClient.refetchQueries('adminWorkboards');
        setDialogOpen(false);
      },
      onError: (error) => {
        console.error('❌ Workboard creation failed:', error);
        toast.error('생성 실패: ' + error.message);
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => workboardAPI.update(id, data),
    {
      onSuccess: (response) => {
        console.log('🔄 Workboard update success, immediately updating cache');
        toast.success('작업판이 수정되었습니다');
        
        // 즉시 캐시 업데이트 - 기존 데이터를 새 데이터로 교체
        queryClient.setQueryData('adminWorkboards', (oldData) => {
          if (!oldData?.data?.workboards || !response.data?.workboard) return oldData;
          
          const updatedWorkboards = oldData.data.workboards.map(wb => 
            wb._id === response.data.workboard._id ? response.data.workboard : wb
          );
          
          return {
            ...oldData,
            data: {
              ...oldData.data,
              workboards: updatedWorkboards
            }
          };
        });
        
        // 강제 리패치도 수행하여 확실히 최신 데이터 보장
        queryClient.refetchQueries('adminWorkboards');
        
        // 상세 편집 다이얼로그가 열려있으면 선택된 작업판 데이터를 업데이트
        if (detailDialogOpen && response.data?.workboard) {
          setSelectedWorkboard(response.data.workboard);
        }
        setDialogOpen(false);
        
        console.log('✅ Cache updated immediately with new workboard data');
      },
      onError: (error) => {
        console.error('❌ Workboard update failed:', error);
        toast.error('수정 실패: ' + error.message);
      }
    }
  );

  const deleteMutation = useMutation(
    workboardAPI.delete,
    {
      onSuccess: (response, deletedId) => {
        console.log('🗑️ Workboard delete success, immediately updating cache');
        toast.success('작업판이 비활성화되었습니다');
        
        // 즉시 캐시 업데이트 - 삭제된 작업판을 목록에서 제거 또는 비활성 상태로 변경
        queryClient.setQueryData('adminWorkboards', (oldData) => {
          if (!oldData?.data?.workboards) return oldData;
          
          const updatedWorkboards = oldData.data.workboards.filter(wb => wb._id !== deletedId);
          
          return {
            ...oldData,
            data: {
              ...oldData.data,
              workboards: updatedWorkboards,
              pagination: {
                ...oldData.data.pagination,
                total: Math.max(0, oldData.data.pagination.total - 1)
              }
            }
          };
        });
        
        // 강제 리패치로 정확한 데이터 보장
        queryClient.refetchQueries('adminWorkboards');
        
        console.log('✅ Cache updated immediately - workboard removed from list');
      },
      onError: (error) => {
        console.error('❌ Workboard deletion failed:', error);
        toast.error('삭제 실패: ' + error.message);
      }
    }
  );

  const duplicateMutation = useMutation(
    ({ id, name }) => workboardAPI.duplicate(id, { name }),
    {
      onSuccess: (response) => {
        console.log('📋 Workboard duplicate success, immediately updating cache');
        toast.success('작업판이 복제되었습니다');
        
        // 즉시 캐시 업데이트 - 새로 복제된 작업판을 목록에 추가
        queryClient.setQueryData('adminWorkboards', (oldData) => {
          if (!oldData?.data?.workboards || !response.data?.workboard) {
            queryClient.refetchQueries('adminWorkboards');
            return oldData;
          }
          
          return {
            ...oldData,
            data: {
              ...oldData.data,
              workboards: [response.data.workboard, ...oldData.data.workboards],
              pagination: {
                ...oldData.data.pagination,
                total: oldData.data.pagination.total + 1
              }
            }
          };
        });
        
        // 강제 리패치로 정확한 데이터 보장
        queryClient.refetchQueries('adminWorkboards');
        
        console.log('✅ Cache updated immediately with duplicated workboard');
      },
      onError: (error) => {
        console.error('❌ Workboard duplication failed:', error);
        toast.error('복제 실패: ' + error.message);
      }
    }
  );

  const workboards = data?.data?.workboards || [];

  const handleCreate = () => {
    setSelectedWorkboard(null);
    setDialogOpen(true);
  };

  const handleEdit = (workboard, editType = 'basic') => {
    setSelectedWorkboard(workboard);
    if (editType === 'detailed') {
      setDetailDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  };

  const handleDelete = (workboard) => {
    if (window.confirm(`"${workboard.name}" 작업판을 비활성화하시겠습니까?`)) {
      deleteMutation.mutate(workboard._id);
    }
  };

  const handleDuplicate = (workboard) => {
    const name = prompt('복제할 작업판의 이름을 입력하세요:', `${workboard.name} (복제)`);
    if (name) {
      duplicateMutation.mutate({ id: workboard._id, name });
    }
  };

  const handleView = (workboard) => {
    // 상세 보기 구현
    console.log('View workboard:', workboard);
  };

  const handleSave = (data) => {
    if (selectedWorkboard) {
      updateMutation.mutate({ id: selectedWorkboard._id, data });
    } else {
      const isPromptType = data.workboardType === 'prompt';
      
      const workboardData = {
        ...data,
        baseInputFields: isPromptType ? {
          aiModel: [
            { key: 'GPT-4', value: 'gpt-4' },
            { key: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
          ],
          systemPrompt: '',
          referenceImages: []
        } : {
          aiModel: [
            { key: 'Default Model', value: 'default.safetensors' }
          ],
          imageSizes: [
            { key: '1024x1024', value: '1024x1024' },
            { key: '896x1152', value: '896x1152' },
            { key: '1152x896', value: '1152x896' },
            { key: '832x1216', value: '832x1216' },
            { key: '1216x832', value: '1216x832' },
            { key: '768x1344', value: '768x1344' },
            { key: '1344x768', value: '1344x768' }
          ],
          referenceImageMethods: [
            { key: 'Image to Image', value: 'img2img' },
            { key: 'ControlNet Canny', value: 'controlnet_canny' }
          ]
        },
        additionalInputFields: [],
        workflowData: isPromptType ? '' : JSON.stringify({
          "prompt": "{{##prompt##}}",
          "negative_prompt": "{{##negative_prompt##}}",
          "model": "{{##model##}}",
          "width": "{{##width##}}",
          "height": "{{##height##}}"
        }, null, 2)
      };
      createMutation.mutate(workboardData);
    }
  };

  const handleDetailSave = (data) => {
    if (selectedWorkboard) {
      updateMutation.mutate({ id: selectedWorkboard._id, data });
      // 다이얼로그는 닫지 않고 데이터만 업데이트 - updateMutation의 onSuccess에서 처리
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">작업판 관리</Typography>
        <Button
          variant="contained"
          onClick={handleCreate}
          startIcon={<Add />}
        >
          새 작업판
        </Button>
      </Box>

      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="작업판 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: 400 }}
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : workboards.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : '등록된 작업판이 없습니다.'}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {workboards.map((workboard) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={workboard._id}>
              <WorkboardCard
                workboard={workboard}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onView={handleView}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <WorkboardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workboard={selectedWorkboard}
        onSave={handleSave}
      />

      <WorkboardDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        workboard={selectedWorkboard}
        onSave={handleDetailSave}
      />
    </Box>
  );
}

export default WorkboardManagement;