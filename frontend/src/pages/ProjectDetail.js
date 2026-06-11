import React, { useState, useCallback } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import {
  Container,
  Typography,
  Box,
  Button,
  IconButton,
  Chip,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Stack,
  TextField,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ArrowBack,
  Star,
  StarBorder,
  Edit,
  Delete,
  Delete as DeleteIcon,
  PlayArrow,
  Image as ImageIcon,
  TextSnippet,
  History,
  ViewModule,
  CheckBox as CheckBoxIcon,
  Close,
  DeleteSweep,
  SelectAll,
  Deselect
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { projectAPI, imageAPI, userAPI, promptDataAPI, tagAPI, workboardAPI, pipelineAPI, pipelineRunAPI } from '../services/api';
import TextContentPanel from '../components/common/TextContentPanel';
import ConversationHistoryPanel from '../components/common/ConversationHistoryPanel';
import PipelinePanel, { PipelineHistoryPanel } from '../components/common/PipelinePanel';
import { BUILTIN_TAG_NAMES } from '../constants/builtinTags';
import MediaGrid from '../components/common/MediaGrid';
import PromptDataPanel from '../components/common/PromptDataPanel';
import PromptDataFormDialog from '../components/common/PromptDataFormDialog';
import WorkboardSelectDialog from '../components/common/WorkboardSelectDialog';
import JobHistoryPanel from '../components/common/JobHistoryPanel';
import TagInput from '../components/common/TagInput';
import ProjectEditDialog from '../components/common/ProjectEditDialog';
import { BRAND_GRADIENTS } from '../utils/brandGradients';

// 이미지/비디오 편집 다이얼로그
function ImageEditDialog({ image, open, onClose, isVideo = false, projectId }) {
  const [tags, setTags] = useState([]);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (image) {
      setTags(image.tags || []);
    }
  }, [image]);

  const updateMutation = useMutation(
    (data) => (isVideo ? imageAPI.updateVideo : imageAPI.updateGenerated)(image._id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(`projectImages-${projectId}`);
        queryClient.invalidateQueries(`projectVideos-${projectId}`);
        queryClient.invalidateQueries(isVideo ? 'generatedVideos' : 'generatedImages');
        queryClient.invalidateQueries(['project', projectId]);
        toast.success(`${isVideo ? '동영상' : '이미지'} 정보가 수정되었습니다`);
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '수정 실패');
      }
    }
  );

  const handleSave = () => {
    updateMutation.mutate({
      tags: tags.map(t => t._id)
    });
  };

  if (!image) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isVideo ? '동영상' : '이미지'} 편집</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2, textAlign: 'center' }}>
          {isVideo ? (
            <video
              src={image.url}
              style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
              muted
              controls
            />
          ) : (
            <img
              src={image.url}
              alt={image.originalName}
              style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain' }}
            />
          )}
        </Box>
        <Typography variant="subtitle2" gutterBottom>{image.originalName}</Typography>
        <Box sx={{ mt: 2 }}>
          <TagInput
            value={tags}
            onChange={setTags}
            label="태그"
            placeholder="태그 추가..."
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={updateMutation.isLoading}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 이미지 탭 - MediaGrid 사용
function ImagesTab({ projectId }) {
  const [editOpen, setEditOpen] = useState(false);
  const [editImage, setEditImage] = useState(null);
  const [editIsVideo, setEditIsVideo] = useState(false);
  const queryClient = useQueryClient();

  // Bulk delete 상태
  const [bulkMode, setBulkMode] = useState(false);
  const [imageSelectedIds, setImageSelectedIds] = useState(new Set());
  const [videoSelectedIds, setVideoSelectedIds] = useState(new Set());
  const [imageMediaState, setImageMediaState] = useState({ items: [], search: '', pagination: {} });
  const [videoMediaState, setVideoMediaState] = useState({ items: [], search: '', pagination: {} });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteJobChecked, setDeleteJobChecked] = useState(false);

  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile());
  const userPreferences = profileData?.data?.user?.preferences || {};

  const deleteGeneratedMutation = useMutation(
    ({ id, deleteJob }) => imageAPI.deleteGenerated(id, deleteJob),
    {
      onSuccess: () => {
        toast.success('이미지가 삭제되었습니다');
        queryClient.invalidateQueries(`projectImages-${projectId}`);
        queryClient.invalidateQueries('generatedImages');
        queryClient.invalidateQueries(['project', projectId]);
      },
      onError: () => toast.error('삭제 실패')
    }
  );

  const deleteVideoMutation = useMutation(
    ({ id, deleteJob }) => imageAPI.deleteVideo(id, deleteJob),
    {
      onSuccess: () => {
        toast.success('동영상이 삭제되었습니다');
        queryClient.invalidateQueries(`projectVideos-${projectId}`);
        queryClient.invalidateQueries('generatedVideos');
        queryClient.invalidateQueries(['project', projectId]);
      },
      onError: () => toast.error('삭제 실패')
    }
  );

  const bulkDeleteMutation = useMutation(
    ({ items, deleteJob }) => imageAPI.bulkDelete(items, deleteJob),
    {
      onSuccess: (response) => {
        const result = response.data?.data || response.data;
        toast.success(`${result.deleted}개 항목이 삭제되었습니다${result.failed ? ` (${result.failed}개 실패)` : ''}`);
        queryClient.invalidateQueries(`projectImages-${projectId}`);
        queryClient.invalidateQueries(`projectVideos-${projectId}`);
        queryClient.invalidateQueries('generatedImages');
        queryClient.invalidateQueries('generatedVideos');
        queryClient.invalidateQueries(['project', projectId]);
        setBulkMode(false);
        setImageSelectedIds(new Set());
        setVideoSelectedIds(new Set());
        setConfirmOpen(false);
      },
      onError: () => toast.error('일괄 삭제 실패')
    }
  );

  const handleEditImage = (image) => {
    setEditImage(image);
    setEditIsVideo(false);
    setEditOpen(true);
  };

  const handleEditVideo = (video) => {
    setEditImage(video);
    setEditIsVideo(true);
    setEditOpen(true);
  };

  const handleDeleteImage = (item) => {
    const deleteHistorySetting = userPreferences.deleteHistoryWithContent;
    if (deleteHistorySetting && item.jobId) {
      if (window.confirm('이미지와 연관된 작업 히스토리도 함께 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        deleteGeneratedMutation.mutate({ id: item._id, deleteJob: true });
      }
    } else {
      if (window.confirm('이미지를 삭제하시겠습니까?\n\n작업 히스토리는 보존됩니다.')) {
        deleteGeneratedMutation.mutate({ id: item._id, deleteJob: false });
      }
    }
  };

  const handleDeleteVideo = (item) => {
    const deleteHistorySetting = userPreferences.deleteHistoryWithContent;
    if (deleteHistorySetting && item.jobId) {
      if (window.confirm('동영상과 연관된 작업 히스토리도 함께 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
        deleteVideoMutation.mutate({ id: item._id, deleteJob: true });
      }
    } else {
      if (window.confirm('동영상을 삭제하시겠습니까?\n\n작업 히스토리는 보존됩니다.')) {
        deleteVideoMutation.mutate({ id: item._id, deleteJob: false });
      }
    }
  };

  const handleImageBulkToggle = useCallback((id) => {
    setImageSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleVideoBulkToggle = useCallback((id) => {
    setVideoSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const totalSelected = imageSelectedIds.size + videoSelectedIds.size;

  const handleBulkDeleteConfirm = () => {
    const items = [
      ...Array.from(imageSelectedIds).map(id => ({ id, type: 'generated' })),
      ...Array.from(videoSelectedIds).map(id => ({ id, type: 'video' }))
    ];
    bulkDeleteMutation.mutate({ items, deleteJob: deleteJobChecked });
  };

  const openConfirmDialog = () => {
    setDeleteJobChecked(userPreferences.deleteHistoryWithContent || false);
    setConfirmOpen(true);
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Bulk mode 툴바 */}
      <Box display="flex" justifyContent="flex-end" mb={1}>
        {!bulkMode ? (
          <Button
            variant="outlined"
            startIcon={<CheckBoxIcon />}
            onClick={() => setBulkMode(true)}
          >
            선택
          </Button>
        ) : null}
      </Box>
      {bulkMode && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5,
            bgcolor: 'action.hover', borderRadius: 1, flexWrap: 'wrap'
          }}
        >
          <Button variant="outlined" startIcon={<Close />} onClick={() => { setBulkMode(false); setImageSelectedIds(new Set()); setVideoSelectedIds(new Set()); }}>
            선택 모드 종료
          </Button>
          <Chip label={`${totalSelected}개 선택됨`} color="primary" variant="outlined" />
          <Button startIcon={<SelectAll />} onClick={() => {
            const nextImg = new Set(imageSelectedIds);
            imageMediaState.items.forEach(item => nextImg.add(item._id));
            setImageSelectedIds(nextImg);
            const nextVid = new Set(videoSelectedIds);
            videoMediaState.items.forEach(item => nextVid.add(item._id));
            setVideoSelectedIds(nextVid);
          }}>
            이 페이지 전체 선택
          </Button>
          <Button startIcon={<Deselect />} onClick={() => { setImageSelectedIds(new Set()); setVideoSelectedIds(new Set()); }} disabled={totalSelected === 0}>
            선택 해제
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteSweep />}
            onClick={openConfirmDialog}
            disabled={totalSelected === 0}
          >
            선택 삭제
          </Button>
        </Box>
      )}

      <Typography variant="subtitle2" sx={{ mb: 1 }}>이미지</Typography>
      <MediaGrid
        type="generated"
        fetchFn={(params) => projectAPI.getImages(projectId, params)}
        queryKey={`projectImages-${projectId}`}
        showSearch={false}
        pageSize={20}
        onEdit={handleEditImage}
        onDelete={handleDeleteImage}
        bulkMode={bulkMode}
        bulkSelectedIds={imageSelectedIds}
        onBulkToggle={handleImageBulkToggle}
        onStateChange={setImageMediaState}
        responseExtractor={(data) => {
          const d = data?.data?.data || {};
          return {
            items: d.images || [],
            pagination: { ...d.pagination, pages: d.pagination ? Math.ceil(d.pagination.imageTotal / 20) : 1 }
          };
        }}
      />

      <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>비디오</Typography>
      <MediaGrid
        type="video"
        fetchFn={(params) => projectAPI.getImages(projectId, params)}
        queryKey={`projectVideos-${projectId}`}
        showSearch={false}
        pageSize={20}
        onEdit={handleEditVideo}
        onDelete={handleDeleteVideo}
        bulkMode={bulkMode}
        bulkSelectedIds={videoSelectedIds}
        onBulkToggle={handleVideoBulkToggle}
        onStateChange={setVideoMediaState}
        responseExtractor={(data) => {
          const d = data?.data?.data || {};
          return {
            items: d.videos || [],
            pagination: { ...d.pagination, pages: d.pagination ? Math.ceil(d.pagination.videoTotal / 20) : 1 }
          };
        }}
      />

      <ImageEditDialog
        image={editImage}
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditImage(null); }}
        isVideo={editIsVideo}
        projectId={projectId}
      />

      {/* 일괄 삭제 확인 다이얼로그 */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>선택한 항목 삭제</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            선택한 {totalSelected}개 항목을 삭제합니다.
            {imageSelectedIds.size > 0 && ` (이미지 ${imageSelectedIds.size}개)`}
            {videoSelectedIds.size > 0 && ` (동영상 ${videoSelectedIds.size}개)`}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteJobChecked}
                onChange={(e) => setDeleteJobChecked(e.target.checked)}
              />
            }
            label="연관된 작업 히스토리도 함께 삭제"
          />
          <Alert severity="warning" sx={{ mt: 2 }}>
            이 작업은 되돌릴 수 없습니다.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={bulkDeleteMutation.isLoading}>취소</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDeleteConfirm}
            disabled={bulkDeleteMutation.isLoading}
          >
            {bulkDeleteMutation.isLoading ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 프롬프트 데이터 탭 - PromptDataPanel 사용
function PromptDataTab({ projectId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromptData, setEditingPromptData] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [workboardSelectOpen, setWorkboardSelectOpen] = useState(false);
  const [selectedPromptData, setSelectedPromptData] = useState(null);

  const updateMutation = useMutation(
    ({ id, data }) => promptDataAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('프롬프트 데이터가 수정되었습니다');
        queryClient.invalidateQueries(`projectPromptData-${projectId}`);
        queryClient.invalidateQueries('promptDataList');
        queryClient.invalidateQueries(['project', projectId]);
        setFormOpen(false);
        setEditingPromptData(null);
      },
      onError: () => toast.error('프롬프트 데이터 수정 실패')
    }
  );

  const deleteMutation = useMutation(promptDataAPI.delete, {
    onSuccess: () => {
      toast.success('프롬프트 데이터가 삭제되었습니다');
      queryClient.invalidateQueries(`projectPromptData-${projectId}`);
      queryClient.invalidateQueries('promptDataList');
      queryClient.invalidateQueries(['project', projectId]);
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    },
    onError: () => toast.error('프롬프트 데이터 삭제 실패')
  });

  const handleSave = (data) => {
    updateMutation.mutate({ id: editingPromptData._id, data });
  };

  const handleEdit = (promptData) => {
    setEditingPromptData(promptData);
    setFormOpen(true);
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const handleQuickGenerate = (promptData) => {
    setSelectedPromptData(promptData);
    setWorkboardSelectOpen(true);
  };

  const handleWorkboardSelect = (workboard) => {
    if (selectedPromptData) {
      localStorage.setItem('continueJobData', JSON.stringify({
        workboardId: workboard._id,
        inputData: {
          prompt: selectedPromptData.prompt,
          negativePrompt: selectedPromptData.negativePrompt,
          seed: selectedPromptData.seed
        }
      }));
      promptDataAPI.use(selectedPromptData._id);
      navigate(`/generate/${workboard._id}?projectId=${projectId}`);
    }
    setWorkboardSelectOpen(false);
  };

  const handleCopyPrompt = (promptData) => {
    copyToClipboard(promptData.prompt);
    toast.success('프롬프트가 클립보드에 복사되었습니다');
  };

  return (
    <Box sx={{ mt: 2 }}>
      <PromptDataPanel
        fetchFn={(params) => projectAPI.getPromptData(projectId, params)}
        queryKey={`projectPromptData-${projectId}`}
        showSearch={false}
        showCreateButton={false}
        pageSize={20}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onQuickGenerate={handleQuickGenerate}
        onCopyPrompt={handleCopyPrompt}
      />

      <PromptDataFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingPromptData(null);
        }}
        promptData={editingPromptData}
        onSave={handleSave}
      />

      <WorkboardSelectDialog
        open={workboardSelectOpen}
        onClose={() => setWorkboardSelectOpen(false)}
        onSelect={handleWorkboardSelect}
      />

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>프롬프트 데이터 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 프롬프트 데이터를 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button
            onClick={() => deleteMutation.mutate(deletingId)}
            color="error"
            variant="contained"
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// 세계관 (설정 문서) 탭 (#396 → #400 일반화).
// 프로젝트 + 타입(세계관/시스템 프롬프트/등) 태그 조합으로 문서를 분류.
// 상단 chip 필터로 타입 전환. 문서 생성 시 현재 타입 태그가 자동 부여됨.
function WorldviewTab({ projectTag }) {
  const { data: wvTagData } = useQuery('worldviewTag', () => tagAPI.getWorldview(), { staleTime: 60_000 });
  const { data: spTagData } = useQuery('systemPromptTag', () => tagAPI.getSystemPrompt(), { staleTime: 60_000 });
  const worldviewTag = wvTagData?.data?.tag;
  const systemPromptTag = spTagData?.data?.tag;

  // 현재 선택된 타입 — 기본은 세계관
  const [activeTypeName, setActiveTypeName] = useState(BUILTIN_TAG_NAMES.WORLDVIEW);

  if (!projectTag) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }
  if (!worldviewTag || !systemPromptTag) {
    return <Alert severity="warning" sx={{ mt: 2 }}>역할 태그 로딩 중...</Alert>;
  }

  const typeOptions = [
    { name: BUILTIN_TAG_NAMES.WORLDVIEW, tag: worldviewTag, hint: '작업판 실행 시 [배경 / 사전 컨텍스트] 로 LLM 에 주입' },
    { name: BUILTIN_TAG_NAMES.SYSTEM_PROMPT, tag: systemPromptTag, hint: 'LLM 의 역할 / 작업 방침 정의 — 파이프라인 / 작업판이 참조' },
  ];
  const activeOption = typeOptions.find((o) => o.name === activeTypeName) || typeOptions[0];
  const activeTag = activeOption.tag;

  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" spacing={0} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        {typeOptions.map((opt) => (
          <Chip
            key={opt.name}
            label={opt.name}
            color={activeTypeName === opt.name ? 'primary' : 'default'}
            variant={activeTypeName === opt.name ? 'filled' : 'outlined'}
            onClick={() => setActiveTypeName(opt.name)}
            sx={{ fontWeight: activeTypeName === opt.name ? 600 : 400 }}
          />
        ))}
      </Stack>

      <Alert severity="info" variant="outlined" sx={{ mb: 3 }}>
        <strong>{activeOption.name}</strong> — {activeOption.hint}
      </Alert>

      <TextContentPanel
        kind="uploaded"
        defaultTags={[projectTag, activeTag]}
        filterTags={[projectTag, activeTag]}
      />
    </Box>
  );
}

// 작업판 멤버십 탭 (#396).
function WorkboardsTab({ projectId }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data, isLoading } = useQuery(
    ['projectWorkboards', projectId],
    () => projectAPI.getWorkboards(projectId),
  );
  const workboards = data?.data?.data?.workboards || [];

  const addMutation = useMutation(
    (workboardId) => projectAPI.addWorkboard(projectId, workboardId),
    {
      onSuccess: () => {
        toast.success('작업판이 추가되었습니다.');
        queryClient.invalidateQueries(['projectWorkboards', projectId]);
        setPickerOpen(false);
      },
      onError: (err) => toast.error(err.response?.data?.message || '추가 실패'),
    }
  );

  const removeMutation = useMutation(
    (workboardId) => projectAPI.removeWorkboard(projectId, workboardId),
    {
      onSuccess: () => {
        toast.success('작업판이 제거되었습니다.');
        queryClient.invalidateQueries(['projectWorkboards', projectId]);
      },
      onError: (err) => toast.error(err.response?.data?.message || '제거 실패'),
    }
  );

  if (isLoading) return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="outlined" startIcon={<TextSnippet />} onClick={() => setPickerOpen(true)}>
          작업판 추가
        </Button>
      </Box>
      {workboards.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            소속 작업판이 없습니다. 우상단 "작업판 추가" 로 등록하세요.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {workboards.map((wb) => (
            <Box
              key={wb._id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1,
                '&:hover': { borderColor: 'primary.main' }
              }}
            >
              <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap>{wb.name}</Typography>
                {wb.description && (
                  <Typography variant="caption" color="text.secondary" noWrap display="block">{wb.description}</Typography>
                )}
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                  {wb.outputFormat && <Chip label={wb.outputFormat} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  {wb.serverId?.name && <Chip label={wb.serverId.name} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  {!wb.isActive && <Chip label="비활성" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                </Stack>
              </Box>
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayArrow />}
                onClick={() => navigate(`${wb.outputFormat === 'text' ? '/prompt-generate' : '/generate'}/${wb._id}?projectId=${projectId}`)}
              >
                실행
              </Button>
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  if (window.confirm('작업판을 프로젝트에서 제거하시겠습니까? (작업판 자체는 삭제되지 않습니다)')) {
                    removeMutation.mutate(wb._id);
                  }
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}

      <WorkboardPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={workboards.map((w) => w._id)}
        onPick={(wbId) => addMutation.mutate(wbId)}
      />
    </Box>
  );
}

// 모든 작업판 중 골라 프로젝트에 추가하는 다이얼로그 (#396).
function WorkboardPickerDialog({ open, onClose, existingIds = [], onPick }) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery(
    ['allWorkboardsForPicker'],
    () => workboardAPI.getAll(),
    { enabled: open }
  );
  const all = data?.data?.workboards || data?.data?.data?.workboards || [];
  const filtered = all.filter((wb) => {
    if (existingIds.includes(wb._id)) return false;
    if (!search) return true;
    return wb.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>작업판 추가</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          placeholder="작업판 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
        />
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}><CircularProgress size={20} /></Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
            추가할 수 있는 작업판이 없습니다.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {filtered.map((wb) => (
              <Box
                key={wb._id}
                onClick={() => onPick(wb._id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' }
                }}
              >
                <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>{wb.name}</Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                    {wb.outputFormat && <Chip label={wb.outputFormat} variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  </Stack>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

// 작업 히스토리 탭 - JobHistoryPanel 사용
function JobsTab({ projectId }) {
  return (
    <Box sx={{ mt: 2 }}>
      <JobHistoryPanel
        fetchFn={(params) => projectAPI.getJobs(projectId, params)}
        queryKey={`projectJobs-${projectId}`}
        showTags={false}
        pageSize={10}
      />
    </Box>
  );
}

// 프로젝트 헤더 — gradient avatar tile + 제목/설명/메타 / 데스크탑 액션 버튼 (Phase 5a).
function ProjectHero({ project, isMobile, onEdit, onDelete, onToggleFavorite, onViewWorkboards }) {
  const initial = (project.name?.trim()?.[0] || '?').toUpperCase();
  const isFav = project.isFavorite;
  const hasCover = !!project.coverImage?.url;

  return (
    // 간격은 mockup px 그대로 — theme.spacing(4) = 16px 이므로 gap=4 가 16px
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 3, md: 4 }, mb: { xs: 3.5, md: 4.5 } }}>
      <Box
        sx={{
          width: { xs: 56, md: 72 },
          height: { xs: 56, md: 72 },
          flexShrink: 0,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: { xs: 22, md: 26 },
          letterSpacing: '-0.02em',
          overflow: 'hidden',
          backgroundImage: hasCover
            ? `url(${project.coverImage.url})`
            : BRAND_GRADIENTS[0],
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 1,
          '&::after': hasCover ? undefined : {
            content: '""',
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
            borderRadius: 'inherit',
            pointerEvents: 'none',
          },
          position: 'relative',
        }}
      >
        {!hasCover && initial}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box display="flex" alignItems="center" gap={0.5} sx={{ flexWrap: 'wrap' }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              fontWeight: 700,
              letterSpacing: '-0.01em',
              wordBreak: 'break-word',
              mr: 1,
            }}
          >
            {project.name}
          </Typography>
          <Tooltip title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}>
            <IconButton onClick={onToggleFavorite} color={isFav ? 'warning' : 'default'}>
              {isFav ? <Star /> : <StarBorder />}
            </IconButton>
          </Tooltip>
        </Box>
        {project.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, wordBreak: 'break-word' }}>
            {project.description}
          </Typography>
        )}
        <Box display="flex" gap={1.5} alignItems="center" sx={{ flexWrap: 'wrap', mt: 2.5 }}>
          {project.tagId?.name && (
            <Chip
              label={project.tagId.name}
              sx={{ bgcolor: project.tagId?.color || 'primary.main', color: 'white' }}
            />
          )}
          <Chip icon={<ImageIcon />} label={`이미지 ${project.counts?.images || 0}`} variant="outlined" />
          <Chip icon={<TextSnippet />} label={`프롬프트 ${project.counts?.promptData || 0}`} variant="outlined" />
          <Chip icon={<History />} label={`작업 ${project.counts?.jobs || 0}`} variant="outlined" />
        </Box>
      </Box>

      {!isMobile && (
        <Box display="flex" gap={1.5} sx={{ flexShrink: 0 }}>
          <Button variant="outlined" startIcon={<Edit />} onClick={onEdit}>
            편집
          </Button>
          <Button variant="outlined" startIcon={<ViewModule />} onClick={onViewWorkboards}>
            작업판 보기
          </Button>
          <Tooltip title="삭제">
            <IconButton color="error" onClick={onDelete}><Delete /></IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

// 탭 라벨 + count badge — count 가 0/null 이면 그냥 라벨만.
function TabLabel({ label, count }) {
  if (!count) return label;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      {label}
      <Box
        component="span"
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          px: 0.75,
          py: 0.125,
          borderRadius: 1,
          bgcolor: 'action.selected',
          color: 'text.secondary',
          lineHeight: 1.4,
          minWidth: 18,
          textAlign: 'center',
        }}
      >
        {count}
      </Box>
    </Box>
  );
}

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // 탭 위치는 프로젝트별로 localStorage 영속화 (#396 후속) — 다른 프로젝트엔 영향 없음.
  const TAB_KEY = id ? `vcc.projectDetail.tab.${id}` : '';
  const TAB_COUNT = 6;
  const [tabValue, setTabValue] = useState(0);
  React.useEffect(() => {
    if (!TAB_KEY) return;
    const stored = parseInt(localStorage.getItem(TAB_KEY), 10);
    if (!Number.isNaN(stored) && stored >= 0 && stored < TAB_COUNT) {
      setTabValue(stored);
    }
  }, [TAB_KEY]);
  React.useEffect(() => {
    if (TAB_KEY) localStorage.setItem(TAB_KEY, String(tabValue));
  }, [TAB_KEY, tabValue]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery(
    ['project', id],
    () => projectAPI.getById(id)
  );

  // 탭 라벨용 가벼운 count 조회 (Phase 5a 후속). staleTime 길게 — 새로고침 부담 회피.
  const { data: pipelinesData } = useQuery(
    ['pipelines', id],
    () => pipelineAPI.list(id),
    { enabled: !!id, staleTime: 60_000 }
  );
  const pipelinesCount = (pipelinesData?.data?.data?.pipelines || []).length;
  const { data: runsData } = useQuery(
    ['pipelineRuns', id],
    () => pipelineRunAPI.list(id, { limit: 50 }),
    { enabled: !!id, staleTime: 30_000 }
  );
  const runsCount = (runsData?.data?.data?.runs || []).length;
  const { data: convData } = useQuery(
    ['projectConversations', id, { limit: 1 }],
    () => projectAPI.getConversations(id, { limit: 1, page: 1 }),
    { enabled: !!id, staleTime: 60_000 }
  );
  // 백엔드가 pagination.total 을 반환하므로 그쪽이 진실. 없으면 fetch 한 개수 fallback.
  const convCount = convData?.data?.data?.pagination?.total
    ?? (convData?.data?.data?.conversations || []).length;

  const deleteMutation = useMutation(
    () => projectAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries('favoriteProjects');
        toast.success('프로젝트가 삭제되었습니다');
        navigate('/projects');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '삭제 실패');
      }
    }
  );

  const favoriteMutation = useMutation(
    () => projectAPI.toggleFavorite(id),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries(['project', id]);
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries('favoriteProjects');
        const isFav = response.data?.data?.isFavorite;
        toast.success(isFav ? '즐겨찾기에 추가되었습니다' : '즐겨찾기에서 제거되었습니다');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '즐겨찾기 변경 실패');
      }
    }
  );

  const project = data?.data?.data?.project;

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !project) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">프로젝트를 불러올 수 없습니다.</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')} sx={{ mt: 2 }}>
          프로젝트 목록으로
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, mb: { xs: 2, md: 4 }, px: { xs: 1.5, sm: 3 } }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/projects')}
        sx={{ mb: 1 }}
      >
        프로젝트 목록
      </Button>

      <ProjectHero
        project={project}
        isMobile={isMobile}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onToggleFavorite={() => favoriteMutation.mutate()}
        onViewWorkboards={() => navigate(`/workboards?projectId=${id}`)}
      />

      {isMobile && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<ViewModule />}
            onClick={() => navigate(`/workboards?projectId=${id}`)}
            sx={{ flex: 1 }}
          >
            작업판 보기
          </Button>
          <IconButton onClick={() => setEditOpen(true)} sx={{ border: 1, borderColor: 'divider' }}>
            <Edit />
          </IconButton>
          <IconButton color="error" onClick={() => setDeleteOpen(true)} sx={{ border: 1, borderColor: 'divider' }}>
            <Delete />
          </IconButton>
        </Box>
      )}

      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          borderRadius: 1,
          mb: 0,
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: { xs: 40, md: 48 },
            '& .MuiTab-root': {
              minHeight: { xs: 40, md: 48 },
              py: { xs: 0.5, md: 1 },
              px: { xs: 1.5, md: 2 },
              fontSize: { xs: '0.8125rem', md: '0.875rem' },
              minWidth: 'auto',
            },
            '& .MuiTab-iconWrapper': { mr: 0.5 },
          }}
        >
          <Tab label={<TabLabel label="파이프라인" count={pipelinesCount} />} />
          <Tab label="세계관" />
          <Tab icon={<TextSnippet fontSize="small" />} iconPosition="start" label={<TabLabel label="프롬프트 데이터" count={project.counts?.promptData} />} />
          <Tab icon={<ImageIcon fontSize="small" />} iconPosition="start" label={<TabLabel label="이미지" count={project.counts?.images} />} />
          <Tab icon={<History fontSize="small" />} iconPosition="start" label={<TabLabel label="파이프라인 히스토리" count={runsCount} />} />
          <Tab label={<TabLabel label="대화 히스토리" count={convCount} />} />
        </Tabs>
      </Box>

      {tabValue === 0 && <PipelinePanel projectId={id} />}
      {tabValue === 1 && <WorldviewTab projectTag={project?.tagId} />}
      {tabValue === 2 && <PromptDataTab projectId={id} />}
      {tabValue === 3 && <ImagesTab projectId={id} />}
      {tabValue === 4 && <PipelineHistoryPanel projectId={id} />}
      {tabValue === 5 && (
        <Box sx={{ mt: 2 }}>
          <ConversationHistoryPanel
            fetchFn={(params) => projectAPI.getConversations(id, params)}
            queryKey={`projectConversations-${id}`}
          />
        </Box>
      )}

      {/* 편집 다이얼로그 */}
      <ProjectEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>프로젝트 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            "<strong>{project.name}</strong>" 프로젝트를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            프로젝트 전용 태그도 함께 삭제되며, 관련 콘텐츠에서 태그가 해제됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isLoading}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ProjectDetail;
