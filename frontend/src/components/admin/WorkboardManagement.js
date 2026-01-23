import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  TextField,
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
import { workboardAPI } from '../../services/api';

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
            {new URL(workboard.serverUrl).hostname}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TrendingUp fontSize="small" />
          <Typography variant="caption" color="textSecondary">
            사용횟수: {workboard.usageCount || 0}회
          </Typography>
        </Box>

        <Box display="flex" flex-wrap gap={1} mb={2}>
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
      serverUrl: '',
      workflowData: '',
      isActive: true,
      aiModels: [],
      imageSizes: [],
      referenceImageMethods: [],
      negativePromptField: { enabled: false, required: false },
      upscaleMethodField: { enabled: false, required: false, options: [] },
      baseStyleField: { enabled: false, required: false, options: [], formatString: '{{##base_style##}}' },
      additionalCustomFields: []
    }
  });

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
            serverUrl: fullData.serverUrl || '',
            workflowData: fullData.workflowData || '',
            isActive: fullData.isActive ?? true,
            // 기초 입력값
            aiModels: fullData.baseInputFields?.aiModel?.map(m => ({ key: m.key || '', value: m.value || '' })) || [],
            imageSizes: fullData.baseInputFields?.imageSizes?.map(s => ({ key: s.key || '', value: s.value || '' })) || [],
            referenceImageMethods: fullData.baseInputFields?.referenceImageMethods?.map(r => ({ key: r.key || '', value: r.value || '' })) || [],
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
            additionalCustomFields: fullData.additionalInputFields?.filter(f => !['negativePrompt', 'upscaleMethod', 'baseStyle'].includes(f.name)) || []
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
          additionalInputFields.push({
            name: field.name,
            label: field.label,
            type: field.type || 'string',
            required: Boolean(field.required),
            options: field.type === 'select' ? (field.options || []) : undefined,
            formatString: field.formatString || `{{##${field.name}##}}`
          });
        }
      });
    }

    const updateData = {
      name: data.name?.trim(),
      description: data.description?.trim(),
      serverUrl: data.serverUrl?.trim(),
      workflowData: data.workflowData,
      isActive: Boolean(data.isActive),
      baseInputFields: {
        aiModel: (data.aiModels || []).filter(m => m.key && m.value),
        imageSizes: (data.imageSizes || []).filter(s => s.key && s.value),
        referenceImageMethods: (data.referenceImageMethods || []).filter(r => r.key && r.value)
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
            <Tab label="워크플로우" />
          </Tabs>

          {/* 기본 정보 탭 */}
          {tabValue === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: '작업판 이름을 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="작업판 이름"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={3}
                      label="설명"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="serverUrl"
                  control={control}
                  rules={{ required: 'ComfyUI 서버 URL을 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="ComfyUI 서버 URL"
                      error={!!errors.serverUrl}
                      helperText={errors.serverUrl?.message}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Switch {...field} checked={field.value} />}
                      label="활성 상태"
                    />
                  )}
                />
              </Grid>
            </Grid>
          )}

          {/* 기초 입력값 탭 */}
          {tabValue === 1 && (
            <Box>
              {/* AI 모델 설정 */}
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
                      <Typography variant="caption" color="primary" sx={{ fontFamily: 'monospace', mt: 1, display: 'block' }}>
                        📝 Workflow JSON 형식: <code>{'{{##model##}}'}</code>
                      </Typography>
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
                            label="모델 파일 경로"
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

              {/* 이미지 크기 설정 */}
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
                        📝 Workflow JSON 형식: <code>{'{{##width##}}'}</code>, <code>{'{{##height##}}'}</code>
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

              {/* 참고 이미지 사용방식 */}
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
                        📝 Workflow JSON 형식: <code>{'{{##reference_method##}}'}</code>
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
                          options: []
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

          {/* 워크플로우 탭 */}
          {tabValue === 3 && (
            <Box>
              <Controller
                name="workflowData"
                control={control}
                rules={{ required: 'Workflow JSON을 입력해주세요' }}
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
  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: workboard?.name || '',
      description: workboard?.description || '',
      serverUrl: workboard?.serverUrl || 'http://localhost:8188',
      isActive: workboard?.isActive ?? true
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: workboard?.name || '',
        description: workboard?.description || '',
        serverUrl: workboard?.serverUrl || 'http://localhost:8188',
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
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Controller
                name="name"
                control={control}
                rules={{ required: '작업판 이름을 입력해주세요' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="작업판 이름"
                    error={!!errors.name}
                    helperText={errors.name?.message}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={3}
                    label="설명"
                    placeholder="작업판에 대한 설명을 입력하세요..."
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="serverUrl"
                control={control}
                rules={{ 
                  required: 'ComfyUI 서버 URL을 입력해주세요',
                  pattern: {
                    value: /^https?:\/\/.+/,
                    message: '올바른 URL 형식이 아닙니다'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="ComfyUI 서버 URL"
                    placeholder="http://localhost:8188"
                    error={!!errors.serverUrl}
                    helperText={errors.serverUrl?.message}
                  />
                )}
              />
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 2 }}>
            기본 작업판 구조가 생성됩니다. 상세 설정(AI 모델, 입력 필드 등)은 
            생성 후 편집에서 추가할 수 있습니다.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>취소</Button>
          <Button type="submit" variant="contained">
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
    () => workboardAPI.getAll({ search, limit: 50 }),
    { keepPreviousData: true }
  );

  const createMutation = useMutation(
    workboardAPI.create,
    {
      onSuccess: () => {
        toast.success('작업판이 생성되었습니다');
        queryClient.invalidateQueries('adminWorkboards');
        setDialogOpen(false);
      },
      onError: (error) => {
        toast.error('생성 실패: ' + error.message);
      }
    }
  );

  const updateMutation = useMutation(
    ({ id, data }) => workboardAPI.update(id, data),
    {
      onSuccess: (response) => {
        toast.success('작업판이 수정되었습니다');
        queryClient.invalidateQueries('adminWorkboards');
        // 상세 편집 다이얼로그가 열려있으면 선택된 작업판 데이터를 업데이트
        if (detailDialogOpen && response.data?.workboard) {
          setSelectedWorkboard(response.data.workboard);
        }
        setDialogOpen(false);
      },
      onError: (error) => {
        toast.error('수정 실패: ' + error.message);
      }
    }
  );

  const deleteMutation = useMutation(
    workboardAPI.delete,
    {
      onSuccess: () => {
        toast.success('작업판이 비활성화되었습니다');
        queryClient.invalidateQueries('adminWorkboards');
      },
      onError: (error) => {
        toast.error('삭제 실패: ' + error.message);
      }
    }
  );

  const duplicateMutation = useMutation(
    ({ id, name }) => workboardAPI.duplicate(id, { name }),
    {
      onSuccess: () => {
        toast.success('작업판이 복제되었습니다');
        queryClient.invalidateQueries('adminWorkboards');
      },
      onError: (error) => {
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
      // 기본 작업판 구조 생성
      const workboardData = {
        ...data,
        baseInputFields: {
          aiModel: [
            { key: 'Default Model', value: 'default.safetensors' }
          ],
          imageSizes: [
            { key: '512x512', value: '512x512' },
            { key: '768x768', value: '768x768' },
            { key: '1024x1024', value: '1024x1024' }
          ],
          referenceImageMethods: [
            { key: 'Image to Image', value: 'img2img' },
            { key: 'ControlNet Canny', value: 'controlnet_canny' }
          ]
        },
        additionalInputFields: [],
        workflowData: JSON.stringify({
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