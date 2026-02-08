import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import {
  Add,
  Star,
  StarBorder,
  Edit,
  Delete,
  Image as ImageIcon,
  TextSnippet,
  History,
  FolderSpecial
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectAPI } from '../services/api';

function ProjectCreateDialog({ open, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagName, setTagName] = useState('');
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    (data) => projectAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('projects');
        toast.success('프로젝트가 생성되었습니다');
        setName('');
        setDescription('');
        setTagName('');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '생성 실패');
      }
    }
  );

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('프로젝트 이름을 입력해주세요');
      return;
    }
    if (!tagName.trim()) {
      toast.error('태그명을 입력해주세요');
      return;
    }
    createMutation.mutate({ name: name.trim(), description: description.trim(), tagName: tagName.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>새 프로젝트</DialogTitle>
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
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth
          label="전용 태그명"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          required
          helperText="프로젝트에 자동 생성될 태그 이름입니다. 기존 태그와 중복되면 안 됩니다."
          inputProps={{ maxLength: 50 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isLoading}
        >
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProjectEditDialog({ open, onClose, project }) {
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
        queryClient.invalidateQueries('projects');
        toast.success('프로젝트가 수정되었습니다');
        onClose();
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
          sx={{ mb: 2 }}
        />
        <Box>
          <Typography variant="body2" color="textSecondary">
            태그명: <Chip size="small" label={project?.tagId?.name} sx={{ bgcolor: project?.tagId?.color, color: 'white' }} />
          </Typography>
          <Typography variant="caption" color="textSecondary">
            태그명은 변경할 수 없습니다.
          </Typography>
        </Box>
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

function ProjectList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [deleteProject, setDeleteProject] = useState(null);

  const { data, isLoading, error } = useQuery(
    'projects',
    () => projectAPI.getAll()
  );

  const deleteMutation = useMutation(
    (id) => projectAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries('favoriteProjects');
        toast.success('프로젝트가 삭제되었습니다');
        setDeleteProject(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '삭제 실패');
      }
    }
  );

  const favoriteMutation = useMutation(
    (id) => projectAPI.toggleFavorite(id),
    {
      onSuccess: (response) => {
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

  const projects = data?.data?.data?.projects || [];
  const favoriteIds = data?.data?.data?.favoriteIds || [];

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">프로젝트 목록을 불러올 수 없습니다.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <FolderSpecial color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4">프로젝트</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateOpen(true)}
        >
          새 프로젝트
        </Button>
      </Box>

      {projects.length === 0 ? (
        <Alert severity="info">
          아직 프로젝트가 없습니다. "새 프로젝트" 버튼을 눌러 첫 프로젝트를 만들어 보세요.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => {
            const isFav = favoriteIds.includes(project._id);
            return (
              <Grid item xs={12} sm={6} md={4} key={project._id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    '&:hover': { boxShadow: 6 },
                    position: 'relative'
                  }}
                >
                  <CardContent
                    sx={{ flexGrow: 1 }}
                    onClick={() => navigate(`/projects/${project._id}`)}
                  >
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="h6" noWrap sx={{ flex: 1 }}>
                        {project.name}
                      </Typography>
                      <Tooltip title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            favoriteMutation.mutate(project._id);
                          }}
                          color={isFav ? 'warning' : 'default'}
                        >
                          {isFav ? <Star /> : <StarBorder />}
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {project.description && (
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{
                          mb: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {project.description}
                      </Typography>
                    )}

                    <Box mb={1.5}>
                      <Chip
                        size="small"
                        label={project.tagId?.name}
                        sx={{
                          bgcolor: project.tagId?.color || '#7c4dff',
                          color: 'white'
                        }}
                      />
                    </Box>

                    <Box display="flex" gap={2}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <ImageIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          {project.counts?.images || 0}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <TextSnippet fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          {project.counts?.promptData || 0}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <History fontSize="small" color="action" />
                        <Typography variant="body2" color="textSecondary">
                          {project.counts?.jobs || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditProject(project);
                      }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteProject(project);
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <ProjectCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ProjectEditDialog
        open={!!editProject}
        onClose={() => setEditProject(null)}
        project={editProject}
      />

      <Dialog
        open={!!deleteProject}
        onClose={() => setDeleteProject(null)}
      >
        <DialogTitle>프로젝트 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            "<strong>{deleteProject?.name}</strong>" 프로젝트를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            프로젝트 전용 태그도 함께 삭제되며, 관련 콘텐츠에서 태그가 해제됩니다.
            (콘텐츠 자체는 삭제되지 않습니다)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProject(null)}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteMutation.mutate(deleteProject._id)}
            disabled={deleteMutation.isLoading}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ProjectList;
