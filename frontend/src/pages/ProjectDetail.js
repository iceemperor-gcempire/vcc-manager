import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
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
  TextField,
  Tooltip
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
  Videocam,
  ViewModule
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { projectAPI } from '../services/api';
import Pagination from '../components/common/Pagination';
import ImageViewerDialog from '../components/common/ImageViewerDialog';
import VideoViewerDialog from '../components/common/VideoViewerDialog';

function ProjectEditDialog({ open, onClose, project, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
    }
  }, [project]);

  const updateMutation = useMutation(
    (data) => projectAPI.update(project._id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project', project._id]);
        queryClient.invalidateQueries('projects');
        toast.success('프로젝트가 수정되었습니다');
        onClose();
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '수정 실패');
      }
    }
  );

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('프로젝트 이름을 입력해주세요');
      return;
    }
    updateMutation.mutate({ name: name.trim(), description: description.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>프로젝트 수정</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="프로젝트 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          inputProps={{ maxLength: 100 }}
          sx={{ mt: 2, mb: 2 }}
        />
        <TextField
          fullWidth
          label="설명 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          rows={2}
          inputProps={{ maxLength: 500 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={updateMutation.isLoading}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// 이미지 탭
function ImagesTab({ projectId, tagId }) {
  const [page, setPage] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [videoViewerOpen, setVideoViewerOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const { data, isLoading } = useQuery(
    ['projectImages', projectId, page],
    () => projectAPI.getImages(projectId, { page, limit: 20 }),
    { keepPreviousData: true }
  );

  const images = data?.data?.data?.images || [];
  const videos = data?.data?.data?.videos || [];
  const pagination = data?.data?.data?.pagination || {};

  const handleImageClick = (index) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const handleVideoClick = (video) => {
    setSelectedVideo(video);
    setVideoViewerOpen(true);
  };

  if (isLoading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  if (images.length === 0 && videos.length === 0) {
    return <Alert severity="info" sx={{ mt: 2 }}>프로젝트에 아직 이미지/비디오가 없습니다.</Alert>;
  }

  return (
    <>
      {images.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            이미지 ({pagination.imageTotal || images.length})
          </Typography>
          <Grid container spacing={2}>
            {images.map((img, index) => (
              <Grid item xs={6} sm={4} md={3} key={img._id}>
                <Card
                  sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                  onClick={() => handleImageClick(index)}
                >
                  <CardMedia
                    component="img"
                    height="180"
                    image={img.url}
                    alt={img.originalName}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" noWrap display="block">
                      {img.generationParams?.prompt?.substring(0, 50) || img.originalName}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {videos.length > 0 && (
        <>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            비디오 ({pagination.videoTotal || videos.length})
          </Typography>
          <Grid container spacing={2}>
            {videos.map((video) => (
              <Grid item xs={6} sm={4} md={3} key={video._id}>
                <Card
                  sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 } }}
                  onClick={() => handleVideoClick(video)}
                >
                  <Box
                    sx={{
                      height: 180,
                      bgcolor: 'grey.900',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Videocam sx={{ fontSize: 48, color: 'grey.400' }} />
                  </Box>
                  <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                    <Typography variant="caption" noWrap display="block">
                      {video.originalName || 'Video'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {pagination.total > 20 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(pagination.total / 20)}
            onPageChange={setPage}
          />
        </Box>
      )}

      <ImageViewerDialog
        images={images}
        selectedIndex={viewerIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <VideoViewerDialog
        video={selectedVideo}
        open={videoViewerOpen}
        onClose={() => setVideoViewerOpen(false)}
      />
    </>
  );
}

// 프롬프트 데이터 탭
function PromptDataTab({ projectId }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(
    ['projectPromptData', projectId, page],
    () => projectAPI.getPromptData(projectId, { page, limit: 20 }),
    { keepPreviousData: true }
  );

  const promptDataList = data?.data?.data?.promptDataList || [];
  const pagination = data?.data?.data?.pagination || {};

  if (isLoading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  if (promptDataList.length === 0) {
    return <Alert severity="info" sx={{ mt: 2 }}>프로젝트에 아직 프롬프트 데이터가 없습니다.</Alert>;
  }

  return (
    <>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {promptDataList.map((pd) => (
          <Grid item xs={12} sm={6} key={pd._id}>
            <Card>
              <Box sx={{ display: 'flex' }}>
                {pd.representativeImage?.url ? (
                  <CardMedia
                    component="img"
                    sx={{ width: 100, height: 100, objectFit: 'cover' }}
                    image={pd.representativeImage.url}
                    alt={pd.name}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 100,
                      height: 100,
                      bgcolor: 'grey.200',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <TextSnippet sx={{ color: 'grey.400', fontSize: 40 }} />
                  </Box>
                )}
                <CardContent sx={{ flex: 1, py: 1 }}>
                  <Typography variant="subtitle1" noWrap>{pd.name}</Typography>
                  {pd.memo && (
                    <Typography variant="body2" color="textSecondary" noWrap>
                      {pd.memo}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      mt: 0.5
                    }}
                  >
                    {pd.prompt}
                  </Typography>
                </CardContent>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {pagination.total > 20 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            currentPage={page}
            totalPages={Math.ceil(pagination.total / 20)}
            onPageChange={setPage}
          />
        </Box>
      )}
    </>
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

// 작업 히스토리 탭
function JobsTab({ projectId }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery(
    ['projectJobs', projectId, page],
    () => projectAPI.getJobs(projectId, { page, limit: 10 }),
    { keepPreviousData: true }
  );

  const jobs = data?.data?.data?.jobs || [];
  const pagination = data?.data?.data?.pagination || {};

  const getStatusConfig = (status) => {
    const configs = {
      pending: { color: 'warning', label: '대기중' },
      processing: { color: 'info', label: '처리중' },
      completed: { color: 'success', label: '완료' },
      failed: { color: 'error', label: '실패' },
      cancelled: { color: 'default', label: '취소됨' }
    };
    return configs[status] || { color: 'default', label: status };
  };

  if (isLoading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  if (jobs.length === 0) {
    return <Alert severity="info" sx={{ mt: 2 }}>프로젝트에 아직 작업 히스토리가 없습니다.</Alert>;
  }

  return (
    <>
      <Box sx={{ mt: 2 }}>
        {jobs.map((job) => {
          const statusConfig = getStatusConfig(job.status);
          const resultCount = (job.resultImages?.length || 0) + (job.resultVideos?.length || 0);
          return (
            <Card key={job._id} sx={{ mb: 2 }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      size="small"
                      color={statusConfig.color}
                      label={statusConfig.label}
                    />
                    <Typography variant="body2" color="textSecondary">
                      {job.workboardId?.name || '알 수 없는 작업판'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {new Date(job.createdAt).toLocaleString()}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {job.inputData?.prompt}
                </Typography>
                {resultCount > 0 && (
                  <Box display="flex" gap={1} mt={1}>
                    {job.resultImages?.slice(0, 4).map((img) => (
                      <Box
                        key={img._id}
                        component="img"
                        src={img.url}
                        alt=""
                        sx={{
                          width: 60,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 1
                        }}
                      />
                    ))}
                    {resultCount > 4 && (
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          bgcolor: 'grey.200',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Typography variant="caption">+{resultCount - 4}</Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {pagination.pages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            currentPage={page}
            totalPages={pagination.pages}
            onPageChange={setPage}
          />
        </Box>
      )}
    </>
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
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
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
        <Tab icon={<ImageIcon />} label="이미지" iconPosition="start" />
        <Tab icon={<TextSnippet />} label="프롬프트 데이터" iconPosition="start" />
        <Tab label="텍스트" />
        <Tab icon={<History />} label="작업 히스토리" iconPosition="start" />
      </Tabs>

      {tabValue === 0 && <ImagesTab projectId={id} tagId={project.tagId?._id} />}
      {tabValue === 1 && <PromptDataTab projectId={id} />}
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
