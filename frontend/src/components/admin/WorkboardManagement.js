import React, { useState, useEffect } from 'react';
import { copyToClipboard } from '../../utils/clipboard';
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
  Autocomplete,
  Stack,
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
import { useQuery } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import toast from 'react-hot-toast';
import { workboardAPI, serverAPI, groupAPI } from '../../services/api';
import WorkboardBasicInfoForm from './WorkboardBasicInfoForm';
import MetadataPickerModal from '../common/MetadataPickerModal';
import { BUILTIN_WORKFLOW_VARIABLES, WORKFLOW_VARIABLE_CATEGORIES, formatValueType } from '../../constants/workflowVariables';
import { MONO } from '../../theme';
import { BRAND_GRADIENTS } from '../../utils/brandGradients';
import {
  getServerTypeLabel,
  getOutputFormatLabel,
  getServerTypeColor,
} from '../../templates/capabilities';

// admin 의 customField 기본값 입력기 — type=baseModel/lora 일 때 서버 모델 목록 Autocomplete (#391)
function ServerMetadataDefaultValueInput({ serverId, type, value, onChange, label }) {
  const fetcher = type === 'baseModel' ? serverAPI.getDetailedModels : serverAPI.getLoras;
  const { data, isLoading } = useQuery(
    ['adminDefaultValueMetadata', type, serverId],
    () => fetcher(serverId, { limit: 200, detailed: true }),
    { enabled: !!serverId, staleTime: 60_000 }
  );
  const items = data?.data?.data?.items
    || data?.data?.data?.models
    || data?.data?.data?.loraModels
    || data?.data?.data?.loras
    || data?.data?.models
    || data?.data?.loraModels
    || data?.data?.loras
    || [];

  const keyOf = (m) => (typeof m === 'string' ? m : (m?.filename || m?.fileName || m?.name || ''));

  // 저장된 기본값(문자열)을 항상 표시한다 (#498). 모델 목록이 로딩 중이거나 stale/누락이어도
  // 선택값이 비어 보이지 않도록, 목록에 없으면 합성 옵션을 만들어 value/options 를 객체로 일치시킨다.
  const matched = typeof value === 'string' ? items.find((m) => keyOf(m) === value) : value;
  const selectedValue = matched || (typeof value === 'string' && value ? { filename: value } : (value || null));
  const options = (selectedValue && !items.some((m) => keyOf(m) === keyOf(selectedValue)))
    ? [selectedValue, ...items]
    : items;

  return (
    <Autocomplete
      options={options}
      getOptionLabel={(opt) => {
        if (!opt) return '';
        if (typeof opt === 'string') return opt;
        return opt.civitai?.model?.name
          ? `${opt.civitai.model.name} (${opt.filename || opt.fileName})`
          : (opt.filename || opt.fileName || opt.name || '');
      }}
      isOptionEqualToValue={(opt, val) => keyOf(opt) === keyOf(val)}
      value={selectedValue}
      onChange={(_, picked) => {
        if (!picked) return onChange('');
        const key = typeof picked === 'string' ? picked : (picked.filename || picked.fileName || picked.name || '');
        onChange(key);
      }}
      loading={isLoading}
      disabled={!serverId}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          label={label}
          helperText={!serverId ? '서버 선택 후 사용 가능' : (isLoading ? '모델 목록 로딩 중...' : `${items.length}개 중 선택`)}
        />
      )}
      size="small"
    />
  );
}

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
      await copyToClipboard(workboard._id);
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
          <Typography variant="body2" color="text.secondary" paragraph>
            {workboard.description}
          </Typography>
        )}

        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Computer fontSize="small" />
          <Typography variant="caption" color="text.secondary">
            {workboard.serverId ? 
              `${workboard.serverId.name} (${workboard.serverId.serverType})` :
              workboard.serverUrl ? new URL(workboard.serverUrl).hostname : '서버 미설정'
            }
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <TrendingUp fontSize="small" />
          <Typography variant="caption" color="text.secondary">
            사용횟수: {workboard.usageCount || 0}회
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={0.5} mb={2}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
            ID: {workboard._id}
          </Typography>
          <IconButton size="small" onClick={handleCopyWorkboardId} aria-label="작업판 ID 복사">
            <ContentCopy fontSize="inherit" />
          </IconButton>
        </Box>

        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          <Chip
            label={getWorkboardChipLabel(workboard)}
            sx={{ bgcolor: getServerTypeColor(workboard.serverId?.serverType), color: 'white' }}
          />
          <Chip
            label={workboard.isActive ? '활성' : '비활성'}
            color={workboard.isActive ? 'success' : 'default'}
            variant="outlined"
          />
          <Chip
            label={`v${workboard.version || 1}`}
            color="info"
            variant="outlined"
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          생성자: {workboard.createdBy?.nickname || '알 수 없음'}
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
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
function WhitelistField({ name, control, kind, serverId, outputFormat, placeholder, showPicker = true }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const value = field.value || [];
        // picker 의 multi-add 모드에서 카드를 다시 클릭하면 토글 — 이미 포함된 항목은 제거 (#277)
        const handleToggle = (rawItem) => {
          const id = rawItem?.filename;
          if (!id) return;
          if (value.includes(id)) {
            field.onChange(value.filter((v) => v !== id));
          } else {
            field.onChange([...value, id]);
          }
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
                      variant="outlined"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField {...params} placeholder={placeholder} />
                )}
              />
              {showPicker && (
                <Button
                  variant="outlined"
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
                outputFormat={outputFormat}
                isAdmin
                mode="multi-add"
                selectedItems={value}
                onPrimary={handleToggle}
              />
            )}
          </Box>
        );
      }}
    />
  );
}

// 권한 / 노출 정책 panel (#198) — 작업판 admin 폼의 한 탭으로 사용.
function PermissionsAndExposurePanel({ control, isComfyUI, serverId, outputFormat, groups, modelExposurePolicyValue, loraExposurePolicyValue }) {
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
                        color="primary"
                        variant="outlined"
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
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
                노출할 모델 식별자 (ComfyUI=파일 경로, OpenAI/Gemini=모델 ID) · "선택" 으로 서버에서 직접 추가
              </Typography>
              <WhitelistField
                name="modelWhitelist"
                control={control}
                kind="model"
                serverId={serverId}
                outputFormat={outputFormat}
                placeholder="예: SDXL/illustrious_v6.safetensors"
                showPicker
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

// 필드 타입 팔레트 (Phase 5e 2차) — 입력 양식 탭 좌측. 클릭으로 해당 타입의
// 신규 customField 를 form 에 추가.
const FIELD_TYPE_PALETTE = [
  { type: 'string',    label: '텍스트',      hint: '한 줄 또는 다중 라인 입력' },
  { type: 'number',    label: '숫자',        hint: '정수/실수' },
  { type: 'select',    label: '선택',        hint: '선택지 중 하나' },
  { type: 'boolean',   label: '체크박스',    hint: 'on/off 토글' },
  { type: 'image',     label: '이미지',      hint: '드래그 드롭 업로드' },
  { type: 'baseModel', label: '베이스 모델', hint: '서버 모델 선택' },
  { type: 'lora',      label: 'LoRA',        hint: 'LoRA 슬롯' },
];

function FieldTypePalette({ onAdd }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 12,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
          필드 타입
        </Typography>
      </Box>
      <Box sx={{ p: 1, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {FIELD_TYPE_PALETTE.map((ft) => (
          <Box
            key={ft.type}
            onClick={() => onAdd(ft.type)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: 1.25,
              borderRadius: 1,
              cursor: 'pointer',
              border: 1,
              borderColor: 'transparent',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{ft.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {ft.hint}
              </Typography>
            </Box>
            <Add sx={{ fontSize: 16, color: 'text.tertiary' }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// 라이브 프리뷰 (Phase 5e 1차) — admin 이 추가한 customField 들이 사용자에게
// 어떻게 보일지 실시간 미리보기. 입력 양식 탭 우측에 sticky 패널.
function CustomFieldsPreview({ fields }) {
  const safeFields = (fields || []).filter((f) => f && f.name);
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 12,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 220px)',
      }}
    >
      <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Visibility fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'text.secondary' }}>
          라이브 프리뷰
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip label="사용자 시점" variant="outlined" />
      </Box>
      <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
        {safeFields.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            customField 가 없습니다. 왼쪽에서 "필드 추가" 로 정의하면 여기에 실시간 표시됩니다.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {safeFields.map((f, i) => <PreviewField key={f.name || i} field={f} />)}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function PreviewField({ field }) {
  const label = (
    <Typography variant="caption" sx={{ display: 'block', fontWeight: 500, mb: 0.5 }}>
      {field.label || field.name}
      {field.required && <Box component="span" sx={{ color: 'error.main', ml: 0.5 }}>*</Box>}
    </Typography>
  );

  if (field.type === 'string') {
    const multi = field.name?.includes('prompt');
    return (
      <Box>
        {label}
        <TextField
          fullWidth disabled placeholder={field.placeholder}
          multiline={multi} rows={multi ? 2 : 1}
          defaultValue={field.defaultValue || ''}
        />
        {field.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {field.description}
          </Typography>
        )}
      </Box>
    );
  }
  if (field.type === 'number') {
    return (
      <Box>
        {label}
        <TextField fullWidth disabled type="number" defaultValue={field.defaultValue || ''} />
      </Box>
    );
  }
  if (field.type === 'boolean') {
    return (
      <FormControlLabel
        disabled
        control={<Switch defaultChecked={!!field.defaultValue} />}
        label={field.label || field.name}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <Box>
        {label}
        <TextField
          fullWidth disabled select SelectProps={{ native: true }}
          defaultValue={field.defaultValue || ''}
          InputLabelProps={{ shrink: true }}
        >
          <option value="">— 선택 없음 —</option>
          {(field.options || []).map((opt, i) => (
            <option key={i} value={opt.value}>{opt.key || opt.value}</option>
          ))}
        </TextField>
      </Box>
    );
  }
  if (field.type === 'baseModel') {
    return (
      <Box>
        {label}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover' }}>
          <Box sx={{ width: 22, height: 22, borderRadius: 0.5, background: BRAND_GRADIENTS[0], color: 'white', display: 'grid', placeItems: 'center', fontSize: 11 }}>
            M
          </Box>
          <Typography variant="caption" sx={{ flex: 1 }}>모델 선택…</Typography>
        </Box>
      </Box>
    );
  }
  if (field.type === 'lora') {
    return (
      <Box>
        {label}
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 1.5, bgcolor: 'action.hover', minHeight: 40, display: 'flex', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">LoRA 슬롯 — 사용자가 추가</Typography>
        </Box>
      </Box>
    );
  }
  if (field.type === 'image') {
    return (
      <Box>
        {label}
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 2.5, textAlign: 'center', bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">이미지를 드래그하거나 클릭해서 선택</Typography>
        </Box>
      </Box>
    );
  }
  return (
    <Box>
      {label}
      <Typography variant="caption" color="text.secondary">(타입 {field.type} preview 미지원)</Typography>
    </Box>
  );
}

// 상세 편집을 위한 새로운 다이얼로그 컴포넌트
// asPage 모드 (#437 Phase A) — Dialog 대신 페이지 안에 인라인 렌더. 데이터 fetch 게이트는
// open 또는 asPage 가 true 일 때 열림. 페이지 경로는 WorkboardEditorPage 가 wrap.
export function WorkboardDetailDialog({ open, onClose, workboard, onSave, asPage = false, onCancel }) {
  const isOpen = asPage || open;
  const handleCancel = onCancel || onClose;
  const [tabValue, setTabValue] = useState(0);
  // 5e-3 — 입력 양식 탭의 선택 필드 (인스펙터 패턴)
  const [selectedFieldIdx, setSelectedFieldIdx] = useState(-1);
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
      llmExtraParams: '',
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
  useEffect(() => {
    if (!isOpen || !isComfyUI || !watchedServerId) {
      setAvailableBaseModels([]);
      return;
    }
    serverAPI.getDetailedModels(watchedServerId, { limit: 1 })
      .then((res) => {
        setAvailableBaseModels(res.data?.data?.availableBaseModels || []);
      })
      .catch(() => setAvailableBaseModels([]));
  }, [isOpen, isComfyUI, watchedServerId]);

  // 그룹 목록 fetch (#198) — 모달 open 시 1회
  useEffect(() => {
    if (!isOpen) return;
    groupAPI.getAll()
      .then((res) => setAvailableGroups(res.data?.data?.groups || []))
      .catch(() => setAvailableGroups([]));
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const handleCopyVariable = async (variable) => {
    try {
      await copyToClipboard(variable);
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
  useEffect(() => {
    if (workboard && workboard._id && isOpen) {
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
            // LLM 추가 파라미터 (#493) — 편집용으로 JSON 문자열(보기 좋게 들여쓰기)로 hydrate
            llmExtraParams: fullData.llmExtraParams && Object.keys(fullData.llmExtraParams).length > 0
              ? JSON.stringify(fullData.llmExtraParams, null, 2)
              : '',
            isActive: fullData.isActive ?? true,
            // 커스텀 필드 — 모든 additionalInputFields 를 단일 generic 편집기에 노출.
            // defaultValue / description / placeholder 도 form 에 같이 싣어 admin 이 편집 가능 (#391)
            additionalCustomFields: (fullData.additionalInputFields || []).map(f => ({
              ...f,
              defaultValue: f.defaultValue,
              description: f.description || '',
              placeholder: f.placeholder || '',
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
  }, [workboard?._id, isOpen, reset]);

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

          // defaultValue / description / placeholder 보존 (#391).
          // boolean 은 false 도 의미 있으니 undefined 만 제외.
          if (field.defaultValue !== undefined && field.defaultValue !== '') {
            // number 타입은 숫자로 변환
            if (field.type === 'number') {
              const n = Number(field.defaultValue);
              if (!Number.isNaN(n)) fieldData.defaultValue = n;
            } else if (field.type === 'boolean') {
              fieldData.defaultValue = Boolean(field.defaultValue);
            } else {
              fieldData.defaultValue = field.defaultValue;
            }
          } else if (field.type === 'boolean' && field.defaultValue === false) {
            fieldData.defaultValue = false;
          }
          if (field.description) fieldData.description = field.description;
          if (field.placeholder) fieldData.placeholder = field.placeholder;

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

    // LLM 추가 파라미터 (#493) — JSON 문자열을 파싱해 객체로. 비었으면 빈 객체.
    let parsedLlmExtraParams = {};
    const rawExtra = (data.llmExtraParams || '').trim();
    if (rawExtra) {
      try {
        parsedLlmExtraParams = JSON.parse(rawExtra);
        if (typeof parsedLlmExtraParams !== 'object' || Array.isArray(parsedLlmExtraParams)) {
          throw new Error('객체(JSON object) 형태여야 합니다');
        }
      } catch (e) {
        toast.error('추가 LLM 파라미터 JSON 형식 오류: ' + e.message);
        return;
      }
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
      llmExtraParams: parsedLlmExtraParams,
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

  // asPage (#437 Phase A) — Dialog wrapper 대신 React.Fragment 로 감싸 페이지 안에 그대로 렌더.
  // 사용자가 외부에서 form submit 할 수 있도록 form 에 id 부여 + sticky header 의 저장 버튼은
  // form="wbEditForm" 으로 연결.
  const Wrapper = asPage ? React.Fragment : Dialog;
  const wrapperProps = asPage ? {} : { open, onClose: handleCancel, maxWidth: 'xl', fullWidth: true };
  return (
    <Wrapper {...wrapperProps}>
      {asPage ? (
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 10,
          bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
          py: 2, mb: 2,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          <Button onClick={handleCancel} sx={{ flexShrink: 0 }}>← 작업판 관리</Button>
          <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
            {workboard?.name || '작업판 편집'}
          </Typography>
          <Chip
            label={watch('isActive') ? '활성' : '비활성'}
            color={watch('isActive') ? 'success' : 'default'}
            variant="outlined"
          />
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCancel}>취소</Button>
          <Button form="wbEditForm" type="submit" variant="contained" disabled={loading}>저장</Button>
        </Box>
      ) : (
        <DialogTitle>
          작업판 상세 편집 - {workboard?.name}
        </DialogTitle>
      )}
      <form id="wbEditForm" onSubmit={handleSubmit(onSubmit)}>
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
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
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
            {outputFormat === 'text' && <Tab label="LLM 파라미터" />}
          </Tabs>

          {/* 기본 정보 탭 */}
          {tabValue === 0 && (
            <WorkboardBasicInfoForm
              control={control}
              setValue={setValue}
              errors={errors}
              showActiveSwitch={true}
              showTypeSelector={true}
              isDialogOpen={isOpen}
            />
          )}


          {/* 입력 양식 탭 */}
          {tabValue === 1 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px 1fr 320px' }, gap: 3, alignItems: 'start' }}>
              {/* 좌측 필드 타입 팔레트 (Phase 5e 2차) — 데스크탑만 */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <FieldTypePalette onAdd={(type) => {
                  const current = watch('additionalCustomFields') || [];
                  setValue('additionalCustomFields', [...current, {
                    name: '',
                    label: '',
                    type,
                    required: false,
                    formatString: '',
                    options: [],
                    imageConfig: { maxImages: 1 },
                  }]);
                }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="body2" color="text.secondary">
                  작업판의 입력 필드를 자유롭게 정의합니다. 타입별로 사용자에게 다른 입력 UI 가 제공됩니다.
                </Typography>
                <Button
                  startIcon={<Add />}
                  // 모바일에서는 팔레트가 hide 되므로 기존 string default add 버튼 유지
                  sx={{ display: { xs: 'inline-flex', md: 'none' } }}
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
                          {/* 5e-3 — Accordion controlled expansion + 선택 시 primary 테두리 */}
                          <Accordion
                            sx={{
                              mb: 2,
                              border: 1,
                              borderColor: selectedFieldIdx === index ? 'primary.main' : 'transparent',
                              transition: 'border-color 120ms',
                            }}
                            expanded={selectedFieldIdx === index}
                            onChange={(_, expanded) => setSelectedFieldIdx(expanded ? index : -1)}
                          >
                            <AccordionSummary expandIcon={<ExpandMore />}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <Box {...draggableProvided.dragHandleProps} sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', color: 'text.secondary' }} onClick={(e) => e.stopPropagation()}>
                                  <DragIndicator />
                                </Box>
                                <Chip
                                  label={field.type}
                                  variant="outlined"
                                  sx={{ fontFamily: MONO, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                                />
                                <Typography sx={{ fontWeight: selectedFieldIdx === index ? 600 : 500 }}>
                                  {field.label || `커스텀 필드 ${index + 1}`}
                                </Typography>
                                {field.name && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
                                    {field.name}
                                  </Typography>
                                )}
                                <Box sx={{ flex: 1 }} />
                                {field.required && (
                                  <Chip label="required" color="error" variant="outlined" />
                                )}
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
                                  sx={{ fontFamily: MONO }}
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
                                  sx={{ fontFamily: MONO }}
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
                          {/* 사전정의값 (defaultValue) — type 별 입력 (#391) */}
                          <Grid item xs={12}>
                            <Controller
                              name={`additionalCustomFields.${index}.defaultValue`}
                              control={control}
                              render={({ field: fieldProps }) => {
                                if (field.type === 'boolean') {
                                  return (
                                    <FormControlLabel
                                      control={<Switch checked={!!fieldProps.value} onChange={(e) => fieldProps.onChange(e.target.checked)} />}
                                      label="기본값 (ON / OFF)"
                                    />
                                  );
                                }
                                if (field.type === 'select') {
                                  const options = watch(`additionalCustomFields.${index}.options`) || [];
                                  return (
                                    <TextField
                                      {...fieldProps}
                                      value={fieldProps.value || ''}
                                      fullWidth
                                      select
                                      label="기본값 (선택)"
                                      SelectProps={{ displayEmpty: true }}
                                    >
                                      <MenuItem value="">선택 없음</MenuItem>
                                      {options.map((opt, i) => (
                                        <MenuItem key={i} value={opt.value || ''}>{opt.key || opt.value}</MenuItem>
                                      ))}
                                    </TextField>
                                  );
                                }
                                if (field.type === 'baseModel' || field.type === 'lora') {
                                  return (
                                    <ServerMetadataDefaultValueInput
                                      serverId={watch('serverId')}
                                      type={field.type}
                                      value={fieldProps.value || ''}
                                      onChange={fieldProps.onChange}
                                      label={field.type === 'baseModel' ? '기본값 (베이스 모델)' : '기본값 (LoRA)'}
                                    />
                                  );
                                }
                                if (field.type === 'image') {
                                  return null; // 이미지 기본값은 의미 없음
                                }
                                return (
                                  <TextField
                                    {...fieldProps}
                                    value={fieldProps.value ?? ''}
                                    fullWidth
                                    type={field.type === 'number' ? 'number' : 'text'}
                                    label="기본값"
                                    placeholder="비워두면 기본값 없음"
                                  />
                                );
                              }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Controller
                              name={`additionalCustomFields.${index}.placeholder`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <TextField
                                  {...fieldProps}
                                  value={fieldProps.value || ''}
                                  fullWidth
                                  label="플레이스홀더"
                                  placeholder="입력창 안내 문구"
                                  disabled={['boolean', 'image', 'baseModel', 'lora'].includes(field.type)}
                                />
                              )}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Controller
                              name={`additionalCustomFields.${index}.description`}
                              control={control}
                              render={({ field: fieldProps }) => (
                                <TextField
                                  {...fieldProps}
                                  value={fieldProps.value || ''}
                                  fullWidth
                                  label="설명"
                                  placeholder="필드 아래에 표시될 설명"
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
                                    value={imageField.value || 1}
                                  >
                                    <MenuItem value={1}>1개</MenuItem>
                                    <MenuItem value={2}>2개</MenuItem>
                                    <MenuItem value={3}>3개</MenuItem>
                                  </TextField>
                                )}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
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
              {/* 우측 라이브 프리뷰 (Phase 5e 1차) — 데스크탑만 */}
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <CustomFieldsPreview fields={watch('additionalCustomFields')} />
              </Box>
            </Box>
          )}

          {/* 권한 / 노출 탭 (#198) */}
          {tabValue === 2 && (
            <PermissionsAndExposurePanel
              control={control}
              isComfyUI={isComfyUI}
              serverId={watchedServerId}
              outputFormat={watch('outputFormat')}
              groups={availableGroups}
              modelExposurePolicyValue={watch('modelExposurePolicy')}
              loraExposurePolicyValue={watch('loraExposurePolicy')}
            />
          )}

          {/* LLM 파라미터 탭 - 텍스트(LLM) 작업판만 (#495). ComfyUI 워크플로우 탭과 동일 위치(index 3) */}
          {outputFormat === 'text' && tabValue === 3 && (
            <Box>
              {/* 이미지 입력은 입력 양식 탭에서 'image' 타입 필드를 추가하면 자동 활성화됩니다 (#519).
                  비전(멀티모달) 모델을 베이스 모델로 선택해야 분석됩니다. */}
              <Typography variant="body2" color="text.secondary" paragraph>
                LLM 요청에 추가로 전달할 파라미터를 JSON 으로 지정합니다. 모델/서버별 thinking 비활성화나
                창작용 temperature 등을 작업판마다 다르게 설정할 수 있습니다. 비워두면 모델 기본값으로 동작합니다.
              </Typography>
              <Controller
                name="llmExtraParams"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    minRows={6}
                    label="추가 LLM 파라미터 (JSON)"
                    placeholder={'{\n  "temperature": 1.0,\n  "chat_template_kwargs": { "enable_thinking": false }\n}'}
                    helperText="OpenAI 계열은 요청 본문 최상위, Gemini 는 generationConfig 에 병합됩니다. thinking 끄는 방식은 모델/서버마다 달라 가이드 문서를 참고하세요."
                    InputProps={{ sx: { fontFamily: MONO, fontSize: '0.85rem' } }}
                  />
                )}
              />
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle2" fontWeight="bold">자주 쓰는 예시</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="caption" component="div" sx={{ fontFamily: MONO, whiteSpace: 'pre-wrap' }}>
                    {'// 창작용 — 무작위성 높이고 thinking 끄기 (서버에 따라 키가 다름)\n'}
                    {'{ "temperature": 1.0, "chat_template_kwargs": { "enable_thinking": false } }\n\n'}
                    {'// reasoning 모델(gpt-5/o1 등) — temperature 미지원이니 비워두기\n'}
                    {'{ }'}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
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
                  <Typography variant="body2" color="text.secondary" paragraph>
                    아래 변수들을 워크플로우 JSON에서 사용할 수 있습니다. 변수는 작업 실행 시 실제 값으로 치환됩니다.
                  </Typography>

                  {Object.entries(WORKFLOW_VARIABLE_CATEGORIES).map(([catKey, catLabel]) => {
                    const vars = BUILTIN_WORKFLOW_VARIABLES.filter((v) => v.category === catKey);
                    if (vars.length === 0) return null;
                    return (
                      <React.Fragment key={catKey}>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{catLabel}</Typography>
                        <Box component="table" sx={{ width: '100%', mb: 2, '& td, & th': { p: 1, borderBottom: 1, borderColor: 'divider' } }}>
                          <tbody>
                            {vars.map((v) => renderVariableRow(
                              v.key,
                              <Box>
                                {v.label} ({formatValueType(v.valueType, v.defaultValue)})
                                {v.note && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {v.note}
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </tbody>
                        </Box>
                      </React.Fragment>
                    );
                  })}

                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>사용자 정의 변수</Typography>
                  {watch('additionalCustomFields')?.length > 0 ? (
                    <Box component="table" sx={{ width: '100%', mb: 2, '& td, & th': { p: 1, borderBottom: 1, borderColor: 'divider' } }}>
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
                    <Typography variant="body2" color="text.secondary">
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
                                color="primary"
                                variant="outlined"
                              />
                            ))
                          }
                          renderInput={(params) => (
                            <TextField
                              {...params}
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
                        sx={{ fontFamily: MONO }}
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
        {!asPage && (
          <DialogActions>
            <Button onClick={handleCancel}>취소</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              저장
            </Button>
          </DialogActions>
        )}
      </form>
    </Wrapper>
  );
}

export function WorkboardCreateDialog({ open, onClose, onSave, asPage = false, onCancel }) {
  const isOpen = asPage || open;
  const handleCancel = onCancel || onClose;
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

  useEffect(() => {
    if (isOpen) {
      reset({
        name: '',
        description: '',
        outputFormat: 'image',
        serverId: '',
        serverType: '',
        isActive: true
      });
    }
  }, [isOpen, reset]);

  const onSubmit = (data) => {
    onSave(data);
  };

  const Wrapper = asPage ? React.Fragment : Dialog;
  const wrapperProps = asPage ? {} : { open, onClose: handleCancel, maxWidth: 'md', fullWidth: true };
  return (
    <Wrapper {...wrapperProps}>
      {asPage ? (
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 10,
          bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
          py: 2, mb: 2,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          <Button onClick={handleCancel} sx={{ flexShrink: 0 }}>← 작업판 관리</Button>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>새 작업판</Typography>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCancel}>취소</Button>
          <Button form="wbCreateForm" type="submit" variant="contained">생성</Button>
        </Box>
      ) : (
        <DialogTitle>새 작업판 생성</DialogTitle>
      )}
      <form id="wbCreateForm" onSubmit={handleSubmit(onSubmit)}>
        <DialogContent>
          <WorkboardBasicInfoForm
            control={control}
            setValue={setValue}
            errors={errors}
            showActiveSwitch={false}
            showTypeSelector={true}
            isDialogOpen={isOpen}
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            기본 작업판 구조가 생성됩니다. 상세 설정(AI 모델, 입력 필드 등)은
            생성 후 편집에서 추가할 수 있습니다.
          </Alert>
        </DialogContent>
        {!asPage && (
          <DialogActions>
            <Button onClick={handleCancel}>취소</Button>
            <Button type="submit" variant="contained">생성</Button>
          </DialogActions>
        )}
      </form>
    </Wrapper>
  );
}

export function WorkboardImportDialog({ open, onClose, onSuccess }) {
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

  useEffect(() => {
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
            <Typography variant="caption" color="text.secondary">
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
                <Typography variant="caption" color="text.secondary">
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

