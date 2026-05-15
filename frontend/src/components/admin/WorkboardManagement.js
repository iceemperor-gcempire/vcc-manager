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
  Switch,
  Autocomplete
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  MoreVert,
  ContentCopy,
  Visibility,
  VisibilityOff,
  Computer,
  TrendingUp,
  ExpandMore,
  ToggleOn,
  ToggleOff,
  DragIndicator,
  FileDownload,
  FileUpload,
  Check,
  CheckCircle,
  Warning,
  PlaylistAdd
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { workboardAPI, serverAPI, groupAPI } from '../../services/api';
import WorkboardBasicInfoForm from './WorkboardBasicInfoForm';
import MetadataPickerModal from '../common/MetadataPickerModal';
import { getWorkboardTemplate } from '../../templates';
import {
  getServerTypeLabel,
  getOutputFormatLabel,
  getServerTypeColor,
} from '../../templates/capabilities';

function WorkboardCard({ workboard, onEdit, onDelete, onDuplicate, onExport, onView, onToggleActive }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);
  const isInactive = !workboard.isActive;
  const getWorkboardChipLabel = (wb) => {
    const serverType = getServerTypeLabel(wb.serverId?.serverType || '');
    const outputLabel = getOutputFormatLabel(wb.outputFormat || 'image');
    if (!serverType) return outputLabel;
    return `${serverType} · ${outputLabel}`;
  };
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCopyWorkboardId = async () => {
    try {
      await navigator.clipboard.writeText(workboard._id);
      toast.success('작업판 ID를 복사했습니다.');
    } catch (error) {
      toast.error('작업판 ID 복사에 실패했습니다.');
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(isInactive && {
          opacity: 0.7,
          bgcolor: 'grey.100',
          border: '2px dashed',
          borderColor: 'grey.400'
        })
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {isInactive && <VisibilityOff fontSize="small" color="disabled" />}
            <Typography
              variant="h6"
              gutterBottom
              sx={{ color: isInactive ? 'text.disabled' : 'text.primary', mb: 0 }}
            >
              {workboard.name}
            </Typography>
          </Box>
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

        <Box display="flex" alignItems="center" gap={0.5} mb={2}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            ID: {workboard._id}
          </Typography>
          <IconButton size="small" onClick={handleCopyWorkboardId} aria-label="작업판 ID 복사">
            <ContentCopy fontSize="inherit" />
          </IconButton>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          <Chip
            label={getWorkboardChipLabel(workboard)}
            size="small"
            sx={{ bgcolor: getServerTypeColor(workboard.serverId?.serverType), color: 'white' }}
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
        <MenuItem onClick={() => { onEdit(workboard, 'detailed'); handleMenuClose(); }}>
          <Edit sx={{ mr: 1 }} fontSize="small" />
          편집
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate(workboard); handleMenuClose(); }}>
          <ContentCopy sx={{ mr: 1 }} fontSize="small" />
          복제
        </MenuItem>
        <MenuItem onClick={() => { onExport(workboard); handleMenuClose(); }}>
          <FileDownload sx={{ mr: 1 }} fontSize="small" />
          내보내기
        </MenuItem>
        <MenuItem
          onClick={() => { onToggleActive(workboard); handleMenuClose(); }}
          sx={{ color: isInactive ? 'success.main' : 'warning.main' }}
        >
          {isInactive ? (
            <>
              <ToggleOn sx={{ mr: 1 }} fontSize="small" />
              활성화
            </>
          ) : (
            <>
              <ToggleOff sx={{ mr: 1 }} fontSize="small" />
              비활성화
            </>
          )}
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

// 화이트리스트 필드 — Autocomplete (수동 입력) + picker 모달 (서버 모델/LoRA 선택).
// ComfyUI 서버에서만 picker 표시. picker 는 multi-add 모드 — 카드 클릭마다 한 건씩 추가됨.
function WhitelistField({ name, control, kind, serverId, placeholder, showPicker }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const value = field.value || [];
        const handleAdd = (rawItem) => {
          const id = rawItem?.filename;
          if (!id) return;
          if (value.includes(id)) return;
          field.onChange([...value, id]);
        };
        return (
          <Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={value}
                onChange={(_, newValue) => field.onChange(newValue)}
                sx={{ flex: 1 }}
                renderTags={(values, getTagProps) =>
                  values.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={option}
                      label={option}
                      size="small"
                      variant="outlined"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} size="small" placeholder={placeholder} />
                )}
              />
              {showPicker && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlaylistAdd />}
                  onClick={() => setPickerOpen(true)}
                  disabled={!serverId}
                  sx={{ mt: 0.25, whiteSpace: 'nowrap' }}
                >
                  선택
                </Button>
              )}
            </Box>
            {showPicker && (
              <MetadataPickerModal
                kind={kind}
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                serverId={serverId}
                isAdmin
                mode="multi-add"
                onPrimary={handleAdd}
              />
            )}
          </Box>
        );
      }}
    />
  );
}

// 권한 / 노출 정책 panel (#198) — 작업판 admin 폼의 한 탭으로 사용.
function PermissionsAndExposurePanel({ control, isComfyUI, serverId, groups, modelExposurePolicyValue, loraExposurePolicyValue }) {
  return (
    <Box>
      {/* 접근 그룹 */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">접근 그룹</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            이 작업판에 접근 가능한 사용자 그룹을 지정합니다. 비워두면 admin 외 접근 불가. admin 은 그룹과 무관하게 모든 작업판 접근 가능.
          </Typography>
          <Controller
            name="allowedGroupIds"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                options={groups.map((g) => g._id)}
                value={field.value || []}
                onChange={(_, newValue) => field.onChange(newValue)}
                getOptionLabel={(option) => {
                  const g = groups.find((x) => x._id === option);
                  return g ? `${g.name}${g.isDefault ? ' (기본)' : ''}` : option;
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const g = groups.find((x) => x._id === option);
                    return (
                      <Chip
                        {...getTagProps({ index })}
                        key={option}
                        label={g ? `${g.name}${g.isDefault ? ' (기본)' : ''}` : option}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder={groups.length === 0 ? '그룹 없음 — 관리 메뉴에서 먼저 그룹 생성' : '그룹 선택'}
                  />
                )}
              />
            )}
          />
        </AccordionDetails>
      </Accordion>

      {/* 모델 노출 정책 */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">모델 노출 정책</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            이 작업판에서 사용자에게 노출되는 base 모델 범위.
          </Typography>
          <Controller
            name="modelExposurePolicy"
            control={control}
            render={({ field }) => (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>정책</InputLabel>
                <Select {...field} label="정책">
                  <MenuItem value="full">전체 노출 (서버의 모든 모델)</MenuItem>
                  <MenuItem value="whitelist">화이트리스트 (지정 모델만)</MenuItem>
                </Select>
              </FormControl>
            )}
          />
          {modelExposurePolicyValue === 'whitelist' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                노출할 모델 식별자 (ComfyUI=파일 경로, OpenAI/Gemini=모델 ID)
                {isComfyUI && ' · "선택" 으로 서버에서 직접 추가'}
              </Typography>
              <WhitelistField
                name="modelWhitelist"
                control={control}
                kind="model"
                serverId={serverId}
                placeholder="예: SDXL/illustrious_v6.safetensors"
                showPicker={isComfyUI}
              />
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* LoRA 노출 정책 (ComfyUI 만) */}
      {isComfyUI && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography variant="h6">LoRA 노출 정책</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              ComfyUI 작업판에서 사용자에게 노출되는 LoRA 범위.
            </Typography>
            <Controller
              name="loraExposurePolicy"
              control={control}
              render={({ field }) => (
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>정책</InputLabel>
                  <Select {...field} label="정책">
                    <MenuItem value="full">전체 노출</MenuItem>
                    <MenuItem value="whitelist">화이트리스트</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
            {loraExposurePolicyValue === 'whitelist' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  노출할 LoRA 식별자 (파일 경로 또는 hash) · "선택" 으로 서버에서 직접 추가
                </Typography>
                <WhitelistField
                  name="loraWhitelist"
                  control={control}
                  kind="lora"
                  serverId={serverId}
                  placeholder="예: character/style_v2.safetensors"
                  showPicker
                />
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

// 상세 편집을 위한 새로운 다이얼로그 컴포넌트
function WorkboardDetailDialog({ open, onClose, workboard, onSave }) {
  const [tabValue, setTabValue] = useState(0);
  const [fullWorkboard, setFullWorkboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState('');
  const [availableBaseModels, setAvailableBaseModels] = useState([]);
  // 그룹 목록 (#198) — allowedGroupIds Autocomplete 의 옵션 풀
  const [availableGroups, setAvailableGroups] = useState([]);
  const copyResetTimerRef = React.useRef(null);
  const { control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      serverId: '',
      serverType: '',
      outputFormat: 'image',
      workflowData: '',
      allowedModelTypes: [],
      // 권한 / 노출 정책 (#198)
      allowedGroupIds: [],
      modelExposurePolicy: 'full',
      modelWhitelist: [],
      loraExposurePolicy: 'full',
      loraWhitelist: [],
      isActive: true,
      additionalCustomFields: []
    }
  });

  const serverType = watch('serverType');
  const outputFormat = watch('outputFormat');
  const watchedServerId = watch('serverId');
  const isComfyUI = serverType === 'ComfyUI';
  const isGemini = serverType === 'Gemini';
  const isOpenAIImage = (serverType === 'OpenAI' || serverType === 'OpenAI Compatible') && outputFormat === 'image';

  // ComfyUI 서버의 availableBaseModels (#252) — allowedModelTypes 옵션 풀.
  // ServerModelCache 의 detailed endpoint 에서 derived (limit 1 로 가벼운 호출).
  React.useEffect(() => {
    if (!open || !isComfyUI || !watchedServerId) {
      setAvailableBaseModels([]);
      return;
    }
    serverAPI.getDetailedModels(watchedServerId, { limit: 1 })
      .then((res) => {
        setAvailableBaseModels(res.data?.data?.availableBaseModels || []);
      })
      .catch(() => setAvailableBaseModels([]));
  }, [open, isComfyUI, watchedServerId]);

  // 그룹 목록 fetch (#198) — 모달 open 시 1회
  React.useEffect(() => {
    if (!open) return;
    groupAPI.getAll()
      .then((res) => setAvailableGroups(res.data?.data?.groups || []))
      .catch(() => setAvailableGroups([]));
  }, [open]);

  React.useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const handleCopyVariable = async (variable) => {
    try {
      await navigator.clipboard.writeText(variable);
      setCopiedVariable(variable);

      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = setTimeout(() => {
        setCopiedVariable('');
      }, 1500);
    } catch (error) {
      toast.error('변수 복사에 실패했습니다.');
    }
  };

  const renderVariableRow = (variable, description, rowKey = variable) => (
    <tr key={rowKey}>
      <td>
        <Box display="flex" alignItems="center" gap={1}>
          <code>{variable}</code>
          <IconButton
            size="small"
            onClick={() => handleCopyVariable(variable)}
            aria-label={`${variable} 복사`}
          >
            {copiedVariable === variable ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
          </IconButton>
        </Box>
      </td>
      <td>{description}</td>
    </tr>
  );

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
            serverType: fullData.serverId?.serverType || '',
            outputFormat: fullData.outputFormat || (fullData.workboardType === 'prompt' ? 'text' : 'image'),
            workflowData: fullData.workflowData || '',
            allowedModelTypes: fullData.allowedModelTypes || [],
            // 권한 / 노출 정책 (#198) hydration
            allowedGroupIds: (fullData.allowedGroupIds || []).map((g) => (typeof g === 'object' ? g._id : g)),
            modelExposurePolicy: fullData.modelExposurePolicy || 'full',
            modelWhitelist: fullData.modelWhitelist || [],
            loraExposurePolicy: fullData.loraExposurePolicy || 'full',
            loraWhitelist: fullData.loraWhitelist || [],
            isActive: fullData.isActive ?? true,
            // 커스텀 필드 — 모든 additionalInputFields 를 단일 generic 편집기에 노출
            additionalCustomFields: (fullData.additionalInputFields || []).map(f => ({
              ...f,
              imageConfig: f.imageConfig || { maxImages: 1 }
            }))
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

  const reorderArrayItem = (fieldName, fromIndex, toIndex) => {
    const currentItems = [...(watch(fieldName) || [])];
    const [removed] = currentItems.splice(fromIndex, 1);
    currentItems.splice(toIndex, 0, removed);
    setValue(fieldName, currentItems);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    reorderArrayItem(result.type, result.source.index, result.destination.index);
  };

  const onSubmit = (data) => {
    // 커스텀 필드들을 단일 generic 편집기에서 가져와서 구성
    const additionalInputFields = [];

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

    const isComfyUIServer = data.serverType === 'ComfyUI';
    const normalizedOutputFormat = data.outputFormat || 'image';
    const updateData = {
      name: data.name?.trim(),
      description: data.description?.trim(),
      serverId: data.serverId,
      outputFormat: normalizedOutputFormat,
      workflowData: isComfyUIServer ? data.workflowData : '',
      allowedModelTypes: isComfyUIServer ? (data.allowedModelTypes || []) : [],
      // 권한 / 노출 정책 (#198)
      allowedGroupIds: data.allowedGroupIds || [],
      modelExposurePolicy: data.modelExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      modelWhitelist: Array.isArray(data.modelWhitelist) ? data.modelWhitelist : [],
      loraExposurePolicy: isComfyUIServer && data.loraExposurePolicy === 'whitelist' ? 'whitelist' : 'full',
      loraWhitelist: isComfyUIServer && Array.isArray(data.loraWhitelist) ? data.loraWhitelist : [],
      isActive: Boolean(data.isActive),
      // F3: baseInputFields 편집 제거 — 신규/기존 모두 빈 상태로 저장.
      // 스키마의 required: true (aiModel) 통과 위해 빈 배열 명시.
      // F4 에서 baseInputFields 스키마 자체 drop 예정.
      baseInputFields: {
        aiModel: [],
        imageSizes: [],
        referenceImageMethods: [],
        systemPrompt: '',
        referenceImages: []
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
          <Box display="flex" alignItems="center" gap={0.5} mb={2}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              작업판 ID: {workboard?._id}
            </Typography>
            <IconButton
              size="small"
              onClick={() => handleCopyVariable(workboard?._id)}
              aria-label="작업판 ID 복사"
              disabled={!workboard?._id}
            >
              {copiedVariable === workboard?._id ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
            </IconButton>
          </Box>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="기본 정보" />
            <Tab label="입력 양식" />
            <Tab label="권한 / 노출" />
            {isComfyUI && <Tab label="워크플로우" />}
          </Tabs>

          {/* 기본 정보 탭 */}
          {tabValue === 0 && (
            <WorkboardBasicInfoForm
              control={control}
              setValue={setValue}
              errors={errors}
              showActiveSwitch={true}
              showTypeSelector={true}
              isDialogOpen={open}
            />
          )}


          {/* 입력 양식 탭 */}
          {tabValue === 1 && (
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="textSecondary">
                  작업판의 입력 필드를 자유롭게 정의합니다. 타입별로 사용자에게 다른 입력 UI 가 제공됩니다.
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
                  <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="additionalCustomFields" type="additionalCustomFields">
                      {(droppableProvided) => (
                        <Box ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                  {watch('additionalCustomFields')?.map((field, index) => (
                    <Draggable key={index} draggableId={`customField-${index}`} index={index}>
                      {(draggableProvided) => (
                        <Box ref={draggableProvided.innerRef} {...draggableProvided.draggableProps}>
                          <Accordion sx={{ mb: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMore />}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <Box {...draggableProvided.dragHandleProps} sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.secondary' }} onClick={(e) => e.stopPropagation()}>
                                  <DragIndicator />
                                </Box>
                                <Typography>
                                  {field.label || `커스텀 필드 ${index + 1}`}
                                </Typography>
                              </Box>
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
                                  placeholder="예: 커스텀 옵션"
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
                                  <MenuItem value="baseModel">베이스 모델</MenuItem>
                                  <MenuItem value="lora">LoRA</MenuItem>
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
                          {(field.type === 'baseModel' || field.type === 'lora') && (
                            <Grid item xs={12}>
                              <Alert severity="info" sx={{ mb: 0 }}>
                                {field.type === 'baseModel'
                                  ? '베이스 모델 타입 — 사용자는 서버의 모델 목록에서 선택합니다. 작업판의 모델 노출 정책 / 화이트리스트 (권한 / 노출 탭) 가 적용됩니다.'
                                  : 'LoRA 타입 — 사용자는 서버의 LoRA 목록에서 선택합니다. 작업판의 LoRA 노출 정책 / 화이트리스트 (권한 / 노출 탭) 가 적용됩니다.'}
                              </Alert>
                            </Grid>
                          )}
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
                              <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId={`customFieldOptions-${index}`} type={`additionalCustomFields.${index}.options`}>
                                  {(provided) => (
                                    <Box ref={provided.innerRef} {...provided.droppableProps}>
                                      {watch(`additionalCustomFields.${index}.options`)?.map((option, optionIndex) => (
                                        <Draggable key={optionIndex} draggableId={`customFieldOption-${index}-${optionIndex}`} index={optionIndex}>
                                          {(provided) => (
                                            <Box
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              display="flex" gap={1} mb={1} alignItems="center"
                                            >
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
                                              <Box {...provided.dragHandleProps} sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.secondary' }}>
                                                <DragIndicator />
                                              </Box>
                                            </Box>
                                          )}
                                        </Draggable>
                                      ))}
                                      {provided.placeholder}
                                    </Box>
                                  )}
                                </Droppable>
                              </DragDropContext>
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
                        </Box>
                      )}
                    </Draggable>
                  ))}
                          {droppableProvided.placeholder}
                        </Box>
                      )}
                    </Droppable>
                  </DragDropContext>
            </Box>
          )}

          {/* 권한 / 노출 탭 (#198) */}
          {tabValue === 2 && (
            <PermissionsAndExposurePanel
              control={control}
              isComfyUI={isComfyUI}
              serverId={watchedServerId}
              groups={availableGroups}
              modelExposurePolicyValue={watch('modelExposurePolicy')}
              loraExposurePolicyValue={watch('loraExposurePolicy')}
            />
          )}

          {/* 워크플로우 탭 - 이미지 타입만 */}
          {isComfyUI && tabValue === 3 && (
            <Box>
              {/* 사용 가능한 변수 목록 */}
              <Accordion defaultExpanded={false} sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    사용 가능한 워크플로우 변수
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    아래 변수들을 워크플로우 JSON에서 사용할 수 있습니다. 변수는 작업 실행 시 실제 값으로 치환됩니다.
                  </Typography>

                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>기본 변수</Typography>
                  <Box component="table" sx={{ width: '100%', mb: 2, '& td, & th': { p: 1, borderBottom: '1px solid #eee' } }}>
                    <tbody>
                      {renderVariableRow('{{##prompt##}}', '프롬프트 (문자열)')}
                      {renderVariableRow('{{##negative_prompt##}}', '네거티브 프롬프트 (문자열)')}
                      {renderVariableRow('{{##model##}}', 'AI 모델 (문자열)')}
                      {renderVariableRow('{{##width##}}', '이미지 너비 (숫자)')}
                      {renderVariableRow('{{##height##}}', '이미지 높이 (숫자)')}
                      {renderVariableRow('{{##seed##}}', '시드값 (숫자, 64비트)')}
                    </tbody>
                  </Box>

                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>샘플링 파라미터</Typography>
                  <Box component="table" sx={{ width: '100%', mb: 2, '& td, & th': { p: 1, borderBottom: '1px solid #eee' } }}>
                    <tbody>
                      {renderVariableRow('{{##steps##}}', '스텝 수 (숫자, 기본값: 20)')}
                      {renderVariableRow('{{##cfg##}}', 'CFG 스케일 (숫자, 기본값: 7)')}
                      {renderVariableRow('{{##sampler##}}', '샘플러 (문자열, 기본값: euler)')}
                      {renderVariableRow('{{##scheduler##}}', '스케줄러 (문자열, 기본값: normal)')}
                    </tbody>
                  </Box>

                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>추가 기능</Typography>
                  <Box component="table" sx={{ width: '100%', mb: 2, '& td, & th': { p: 1, borderBottom: '1px solid #eee' } }}>
                    <tbody>
                      {renderVariableRow('{{##reference_method##}}', '참조 이미지 방식 (문자열)')}
                      {renderVariableRow('{{##upscale_method##}}', '업스케일 방식 (문자열)')}
                      {renderVariableRow('{{##upscale##}}', '업스케일 방식 별칭 (문자열)')}
                      {renderVariableRow('{{##base_style##}}', '기본 스타일 (문자열)')}
                      {renderVariableRow('{{##user_id##}}', '사용자 ID 해시 (문자열, 8자리)')}
                    </tbody>
                  </Box>

                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>사용자 정의 변수</Typography>
                  {watch('additionalCustomFields')?.length > 0 ? (
                    <Box component="table" sx={{ width: '100%', mb: 2, '& td, & th': { p: 1, borderBottom: '1px solid #eee' } }}>
                      <tbody>
                        {watch('additionalCustomFields').map((field, idx) => (
                          field.name && (
                            renderVariableRow(
                              field.formatString || `{{##${field.name}##}}`,
                              `${field.label || field.name} (${field.type === 'number' ? '숫자' : field.type === 'select' ? '선택' : field.type === 'image' ? '이미지' : '문자열'})`,
                              `custom-${idx}`
                            )
                          )
                        ))}
                      </tbody>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      "입력 양식" 탭에서 항목을 정의하면 여기에 표시됩니다.
                    </Typography>
                  )}

                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'info.lighter', borderRadius: 1 }}>
                    <Typography variant="body2" color="info.dark">
                      <strong>팁:</strong> seed 값은 플레이스홀더 방식(<code>{'{{##seed##}}'}</code>) 외에도,
                      하드코딩된 숫자값(<code>"seed": 12345</code>)도 자동으로 치환됩니다.
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>

              {isComfyUI && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      허용 모델 타입 (선택)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      이 작업판에서 사용 가능한 base 모델 타입을 다중 지정. 비워두면 모든 모델이 표시됩니다. Civitai 미등록 모델 (메타데이터 없음) 은 제약과 무관하게 항상 노출됩니다.
                    </Typography>
                    <Controller
                      name="allowedModelTypes"
                      control={control}
                      render={({ field }) => (
                        <Autocomplete
                          {...field}
                          multiple
                          freeSolo
                          options={availableBaseModels}
                          value={field.value || []}
                          onChange={(_, newValue) => field.onChange(newValue)}
                          renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                              <Chip
                                {...getTagProps({ index })}
                                key={option}
                                label={option}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ))
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              size="small"
                              placeholder={availableBaseModels.length === 0 ? '서버 모델 sync 후 baseModel 자동 채움' : '예: SDXL, Illustrious, Pony'}
                            />
                          )}
                        />
                      )}
                    />
                  </Box>
                  <Controller
                    name="workflowData"
                    control={control}
                    rules={{ required: isComfyUI ? 'Workflow JSON을 입력해주세요' : false }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={20}
                        label="ComfyUI Workflow JSON"
                        error={!!errors.workflowData}
                        helperText={errors.workflowData?.message || "위 변수 목록을 참고하여 워크플로우를 작성하세요"}
                        sx={{ fontFamily: 'monospace' }}
                      />
                    )}
                  />
                </>
              )}
              {isGemini && (
                <Alert severity="info">
                  Gemini 작업판은 워크플로우 JSON 없이 REST API로 이미지를 생성합니다.
                </Alert>
              )}
              {isOpenAIImage && (
                <>
                  <Alert severity="info">
                    OpenAI 이미지 작업판은 워크플로우 JSON 없이 OpenAI Images API로 이미지를 생성합니다.
                  </Alert>
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <strong>gpt-image-2</strong> 모델은 OpenAI 조직 인증(Verify Organization) 완료 후 약 15분 뒤부터 사용 가능합니다. 인증 페이지: <a href="https://platform.openai.com/settings/organization/general" target="_blank" rel="noopener noreferrer">platform.openai.com/settings/organization/general</a>
                  </Alert>
                </>
              )}
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

function WorkboardCreateDialog({ open, onClose, onSave }) {
  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      outputFormat: 'image',
      serverId: '',
      serverType: '',
      isActive: true
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: '',
        description: '',
        outputFormat: 'image',
        serverId: '',
        serverType: '',
        isActive: true
      });
    }
  }, [open, reset]);

  const onSubmit = (data) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>새 작업판 생성</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <WorkboardBasicInfoForm
            control={control}
            setValue={setValue}
            errors={errors}
            showActiveSwitch={false}
            showTypeSelector={true}
            isDialogOpen={open}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            기본 작업판 구조가 생성됩니다. 상세 설정(AI 모델, 입력 필드 등)은
            생성 후 편집에서 추가할 수 있습니다.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>취소</Button>
          <Button type="submit" variant="contained">생성</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function WorkboardImportDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importName, setImportName] = useState('');
  const [needsServer, setNeedsServer] = useState(false);
  const [availableServers, setAvailableServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [preview, setPreview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const resetState = () => {
    setFile(null);
    setParsedData(null);
    setParseError('');
    setImportName('');
    setNeedsServer(false);
    setAvailableServers([]);
    setSelectedServerId('');
    setPreview(null);
    setWarnings([]);
    setImporting(false);
    setDragOver(false);
  };

  React.useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.json')) {
      setParseError('JSON 파일만 지원합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data._exportVersion || !data.workboard) {
          setParseError('올바른 작업판 백업 파일이 아닙니다.');
          return;
        }
        setFile(selectedFile);
        setParsedData(data);
        setImportName(data.workboard.name || '');
        setParseError('');
      } catch {
        setParseError('JSON 파일을 파싱할 수 없습니다.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setImporting(true);
    try {
      // 이름이 변경되었다면 반영
      const dataToSend = {
        ...parsedData,
        workboard: { ...parsedData.workboard, name: importName || parsedData.workboard.name }
      };

      const response = await workboardAPI.import(dataToSend, selectedServerId || undefined);
      const result = response.data;

      if (result.needsServer) {
        setNeedsServer(true);
        setAvailableServers(result.servers || []);
        setPreview(result.preview);
        setWarnings(result.warnings || []);
        setImporting(false);
        return;
      }

      toast.success(result.message || '작업판을 가져왔습니다.');
      if (result.warnings?.length > 0) {
        result.warnings.forEach(w => toast(w, { icon: '⚠️' }));
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>작업판 가져오기</DialogTitle>
      <DialogContent>
        {!parsedData ? (
          <Box
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'grey.400',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: dragOver ? 'action.hover' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => document.getElementById('workboard-import-file').click()}
          >
            <FileUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              JSON 파일을 드래그하거나 클릭하여 선택
            </Typography>
            <Typography variant="caption" color="textSecondary">
              작업판 내보내기로 생성된 .json 파일
            </Typography>
            <input
              id="workboard-import-file"
              type="file"
              accept=".json"
              hidden
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
          </Box>
        ) : (
          <Box>
            {/* 미리보기 */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">작업판 정보</Typography>
              <Typography variant="body2">
                서버: {parsedData.server?.serverType || '?'} / 출력: {parsedData.workboard.outputFormat || 'image'}
              </Typography>
              {parsedData.server && (
                <Typography variant="body2">
                  원본 서버: {parsedData.server.name} ({parsedData.server.serverType})
                </Typography>
              )}
              {parsedData.exportedAt && (
                <Typography variant="caption" color="textSecondary">
                  내보낸 날짜: {new Date(parsedData.exportedAt).toLocaleString()}
                </Typography>
              )}
            </Alert>

            {warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ mb: 1 }}>{w}</Alert>
            ))}

            {/* 이름 변경 */}
            <TextField
              fullWidth
              label="작업판 이름"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              sx={{ mb: 2 }}
            />

            {/* 서버 매칭 상태 */}
            {needsServer ? (
              <Box sx={{ mb: 2 }}>
                <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
                  원본 서버를 찾을 수 없습니다. 서버를 선택해주세요.
                  {preview?.server && (
                    <Typography variant="caption" display="block">
                      원본: {preview.server.name} ({preview.server.serverType})
                    </Typography>
                  )}
                </Alert>
                <FormControl fullWidth>
                  <InputLabel>서버 선택</InputLabel>
                  <Select
                    value={selectedServerId}
                    label="서버 선택"
                    onChange={(e) => setSelectedServerId(e.target.value)}
                  >
                    {availableServers.map((s) => (
                      <MenuItem key={s._id} value={s._id}>
                        {s.name} ({s.serverType})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            ) : parsedData.server ? (
              <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
                서버 자동 매칭 대기: "{parsedData.server.name}" ({parsedData.server.serverType})
              </Alert>
            ) : null}
          </Box>
        )}

        {parseError && (
          <Alert severity="error" sx={{ mt: 2 }}>{parseError}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        {parsedData && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || (needsServer && !selectedServerId)}
            startIcon={importing ? <CircularProgress size={16} /> : <FileUpload />}
          >
            {importing ? '가져오는 중...' : '가져오기'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function WorkboardManagement() {
  const [search, setSearch] = useState('');
  const [serverTypeFilter, setServerTypeFilter] = useState('');
  const [outputFormatFilter, setOutputFormatFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedWorkboard, setSelectedWorkboard] = useState(null);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    ['adminWorkboards', { search, serverTypeFilter, outputFormatFilter }],
    () => workboardAPI.getAll({ search, limit: 50, includeAll: true, includeInactive: true, serverType: serverTypeFilter || undefined, outputFormat: outputFormatFilter || undefined }),
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
        toast.success('작업판이 삭제되었습니다');

        // 즉시 캐시 업데이트 - 삭제된 작업판을 목록에서 제거
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

  const toggleActiveMutation = useMutation(
    ({ id, isActive }) => isActive ? workboardAPI.deactivate(id) : workboardAPI.activate(id),
    {
      onSuccess: (response) => {
        const workboard = response.data.workboard;
        const action = workboard.isActive ? '활성화' : '비활성화';
        toast.success(`작업판이 ${action}되었습니다`);
        queryClient.refetchQueries('adminWorkboards');
      },
      onError: (error) => {
        console.error('❌ Toggle active failed:', error);
        toast.error('상태 변경 실패: ' + error.message);
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
    if (window.confirm(`"${workboard.name}" 작업판을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      deleteMutation.mutate(workboard._id);
    }
  };

  const handleToggleActive = (workboard) => {
    const action = workboard.isActive ? '비활성화' : '활성화';
    if (window.confirm(`"${workboard.name}" 작업판을 ${action}하시겠습니까?`)) {
      toggleActiveMutation.mutate({ id: workboard._id, isActive: workboard.isActive });
    }
  };

  const handleDuplicate = (workboard) => {
    const name = prompt('복제할 작업판의 이름을 입력하세요:', `${workboard.name} (복제)`);
    if (name) {
      duplicateMutation.mutate({ id: workboard._id, name });
    }
  };

  const handleExport = async (workboard) => {
    try {
      const response = await workboardAPI.export(workboard._id);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workboard.name.replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_backup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('작업판을 내보냈습니다.');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  const handleImportSuccess = () => {
    queryClient.refetchQueries('adminWorkboards');
  };

  const handleView = (workboard) => {
    // 상세 보기 구현
    console.log('View workboard:', workboard);
  };

  const handleSave = (data) => {
    if (selectedWorkboard) {
      const { serverType: _omit, ...normalizedData } = data;
      updateMutation.mutate({ id: selectedWorkboard._id, data: normalizedData });
    } else {
      // 생성: serverType + outputFormat → 템플릿 적용
      const serverType = data.serverType || 'ComfyUI';
      const outputFormat = data.outputFormat || 'image';
      const template = getWorkboardTemplate(serverType, outputFormat);

      const { serverType: _omit, ...rest } = data;
      const workboardData = {
        ...rest,
        outputFormat,
        ...template,
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
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            onClick={() => setImportDialogOpen(true)}
            startIcon={<FileUpload />}
          >
            가져오기
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            startIcon={<Add />}
          >
            새 작업판
          </Button>
        </Box>
      </Box>

      <Box mb={3} display="flex" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          placeholder="작업판 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 300, flex: 1 }}
        />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel>서버 타입</InputLabel>
          <Select
            value={serverTypeFilter}
            label="서버 타입"
            onChange={(e) => setServerTypeFilter(e.target.value)}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="ComfyUI">ComfyUI</MenuItem>
            <MenuItem value="OpenAI">OpenAI</MenuItem>
            <MenuItem value="OpenAI Compatible">OpenAI Compatible</MenuItem>
            <MenuItem value="Gemini">Gemini</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>출력 타입</InputLabel>
          <Select
            value={outputFormatFilter}
            label="출력 타입"
            onChange={(e) => setOutputFormatFilter(e.target.value)}
          >
            <MenuItem value="">전체</MenuItem>
            <MenuItem value="image">이미지</MenuItem>
            <MenuItem value="video">비디오</MenuItem>
            <MenuItem value="text">텍스트</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : workboards.length === 0 ? (
        <Alert severity="info">
          {(search || serverTypeFilter || outputFormatFilter) ? '검색 결과가 없습니다.' : '등록된 작업판이 없습니다.'}
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
                onExport={handleExport}
                onView={handleView}
                onToggleActive={handleToggleActive}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <WorkboardCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />

      <WorkboardDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        workboard={selectedWorkboard}
        onSave={handleDetailSave}
      />

      <WorkboardImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </Box>
  );
}

export default WorkboardManagement;
