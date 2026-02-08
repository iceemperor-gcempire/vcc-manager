import React, { useState, useCallback } from 'react';
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
  Checkbox
} from '@mui/material';
import {
  ArrowBack,
  Star,
  StarBorder,
  Edit,
  Delete,
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
import { projectAPI, imageAPI, userAPI, promptDataAPI } from '../services/api';
import MediaGrid from '../components/common/MediaGrid';
import PromptDataPanel from '../components/common/PromptDataPanel';
import PromptDataFormDialog from '../components/common/PromptDataFormDialog';
import WorkboardSelectDialog from '../components/common/WorkboardSelectDialog';
import JobHistoryPanel from '../components/common/JobHistoryPanel';
import TagInput from '../components/common/TagInput';
import ProjectEditDialog from '../components/common/ProjectEditDialog';

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
            size="small"
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
          <Button size="small" variant="outlined" startIcon={<Close />} onClick={() => { setBulkMode(false); setImageSelectedIds(new Set()); setVideoSelectedIds(new Set()); }}>
            선택 모드 종료
          </Button>
          <Chip label={`${totalSelected}개 선택됨`} color="primary" variant="outlined" />
          <Button size="small" startIcon={<SelectAll />} onClick={() => {
            const nextImg = new Set(imageSelectedIds);
            imageMediaState.items.forEach(item => nextImg.add(item._id));
            setImageSelectedIds(nextImg);
            const nextVid = new Set(videoSelectedIds);
            videoMediaState.items.forEach(item => nextVid.add(item._id));
            setVideoSelectedIds(nextVid);
          }}>
            이 페이지 전체 선택
          </Button>
          <Button size="small" startIcon={<Deselect />} onClick={() => { setImageSelectedIds(new Set()); setVideoSelectedIds(new Set()); }} disabled={totalSelected === 0}>
            선택 해제
          </Button>
          <Button
            size="small"
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
    navigator.clipboard.writeText(promptData.prompt);
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

// 텍스트 탭 (placeholder)
function TextTab() {
  return (
    <Alert severity="info" sx={{ mt: 2 }}>
      준비 중인 기능입니다.
    </Alert>
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

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data, isLoading, error } = useQuery(
    ['project', id],
    () => projectAPI.getById(id)
  );

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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/projects')}
        sx={{ mb: 2 }}
      >
        프로젝트 목록
      </Button>

      {/* 프로젝트 헤더 */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
          borderRadius: 2,
          p: 3,
          position: 'relative',
          ...(project.coverImage?.url && {
            backgroundImage: `url(${project.coverImage.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(255,255,255,0.85)',
              borderRadius: 2
            },
            '& > *': { position: 'relative', zIndex: 1 }
          })
        }}
      >
        <Box>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Typography variant="h4">{project.name}</Typography>
            <Tooltip title={project.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}>
              <IconButton
                onClick={() => favoriteMutation.mutate()}
                color={project.isFavorite ? 'warning' : 'default'}
              >
                {project.isFavorite ? <Star /> : <StarBorder />}
              </IconButton>
            </Tooltip>
          </Box>
          {project.description && (
            <Typography variant="body1" color="textSecondary" sx={{ mb: 1 }}>
              {project.description}
            </Typography>
          )}
          <Box display="flex" gap={1} alignItems="center">
            <Chip
              label={project.tagId?.name}
              sx={{ bgcolor: project.tagId?.color || '#7c4dff', color: 'white' }}
            />
            <Chip
              size="small"
              icon={<ImageIcon />}
              label={`이미지 ${project.counts?.images || 0}`}
              variant="outlined"
            />
            <Chip
              size="small"
              icon={<TextSnippet />}
              label={`프롬프트 ${project.counts?.promptData || 0}`}
              variant="outlined"
            />
            <Chip
              size="small"
              icon={<History />}
              label={`작업 ${project.counts?.jobs || 0}`}
              variant="outlined"
            />
          </Box>
        </Box>

        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={<ViewModule />}
            onClick={() => navigate(`/workboards?projectId=${id}`)}
            size="small"
          >
            이미지 생성하기
          </Button>
          <IconButton onClick={() => setEditOpen(true)}>
            <Edit />
          </IconButton>
          <IconButton color="error" onClick={() => setDeleteOpen(true)}>
            <Delete />
          </IconButton>
        </Box>
      </Box>

      {/* 탭 */}
      <Tabs
        value={tabValue}
        onChange={(e, v) => setTabValue(v)}
        sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<TextSnippet />} label="프롬프트 데이터" iconPosition="start" />
        <Tab icon={<ImageIcon />} label="이미지" iconPosition="start" />
        <Tab label="텍스트" />
        <Tab icon={<History />} label="작업 히스토리" iconPosition="start" />
      </Tabs>

      {tabValue === 0 && <PromptDataTab projectId={id} />}
      {tabValue === 1 && <ImagesTab projectId={id} />}
      {tabValue === 2 && <TextTab />}
      {tabValue === 3 && <JobsTab projectId={id} />}

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
