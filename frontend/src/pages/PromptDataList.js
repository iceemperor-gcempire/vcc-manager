import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Box,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add,
  Search,
  Edit,
  Delete,
  PlayArrow,
  MoreVert,
  Image as ImageIcon,
  ContentCopy
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { promptDataAPI, workboardAPI } from '../services/api';
import ImageSelectDialog from '../components/common/ImageSelectDialog';
import ImageViewerDialog from '../components/common/ImageViewerDialog';
import Pagination from '../components/common/Pagination';
import TagInput from '../components/common/TagInput';

/* eslint-disable no-unused-vars */

function PromptDataFormDialog({ open, onClose, promptData = null, onSave }) {
  const isEditing = !!promptData;
  const [imageSelectOpen, setImageSelectOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(promptData?.representativeImage || null);
  const [tags, setTags] = useState(promptData?.tags || []);

  const { control, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: promptData?.name || '',
      memo: promptData?.memo || '',
      prompt: promptData?.prompt || '',
      negativePrompt: promptData?.negativePrompt || '',
      seed: promptData?.seed || ''
    }
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: promptData?.name || '',
        memo: promptData?.memo || '',
        prompt: promptData?.prompt || '',
        negativePrompt: promptData?.negativePrompt || '',
        seed: promptData?.seed || ''
      });
      setSelectedImage(promptData?.representativeImage || null);
      setTags(promptData?.tags || []);
    }
  }, [open, promptData, reset]);

  const onSubmit = (data) => {
    onSave({
      ...data,
      seed: data.seed ? parseInt(data.seed) : undefined,
      representativeImage: selectedImage,
      tags: tags.map(t => t._id)
    });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {isEditing ? '프롬프트 데이터 수정' : '새 프롬프트 데이터'}
        </DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="subtitle2" gutterBottom>대표 이미지</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 150,
                    border: '2px dashed',
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    bgcolor: selectedImage?.url ? 'grey.100' : 'grey.50'
                  }}
                  onClick={() => {
                    if (selectedImage?.url) {
                      setImageViewerOpen(true);
                    } else {
                      setImageSelectOpen(true);
                    }
                  }}
                >
                  {selectedImage?.url ? (
                    <img
                      src={selectedImage.url}
                      alt="Representative"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <Box textAlign="center">
                      <ImageIcon sx={{ fontSize: 40, color: 'grey.400' }} />
                      <Typography variant="caption" color="textSecondary" display="block">
                        클릭하여 선택
                      </Typography>
                    </Box>
                  )}
                </Box>
                {selectedImage && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => setImageSelectOpen(true)}
                    >
                      이미지 변경
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => setSelectedImage(null)}
                    >
                      이미지 제거
                    </Button>
                  </Box>
                )}
              </Grid>

              <Grid item xs={12} sm={8}>
                <Controller
                  name="name"
                  control={control}
                  rules={{ required: '이름을 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="이름"
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      sx={{ mb: 2 }}
                    />
                  )}
                />

                <Controller
                  name="memo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={4}
                      label="메모"
                      placeholder="이 프롬프트에 대한 메모..."
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="prompt"
                  control={control}
                  rules={{ required: '프롬프트를 입력해주세요' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={4}
                      label="프롬프트"
                      error={!!errors.prompt}
                      helperText={errors.prompt?.message}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="negativePrompt"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      multiline
                      rows={2}
                      label="부정 프롬프트"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="seed"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="number"
                      label="시드 (선택사항)"
                      placeholder="비워두면 랜덤"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  label="태그"
                  placeholder="태그 추가..."
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>취소</Button>
            <Button type="submit" variant="contained">
              {isEditing ? '수정' : '생성'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ImageSelectDialog
        open={imageSelectOpen}
        onClose={() => setImageSelectOpen(false)}
        onSelect={setSelectedImage}
        title="대표 이미지 선택"
        filterTags={tags.map(t => t._id)}
      />

      <ImageViewerDialog
        images={selectedImage?.url ? [{ url: selectedImage.url }] : []}
        open={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        title="대표 이미지"
        showNavigation={false}
        showMetadata={false}
      />
    </>
  );
}

function WorkboardSelectDialog({ open, onClose, onSelect }) {
  const { data, isLoading } = useQuery(
    ['workboards'],
    () => workboardAPI.getAll({ isActive: true }),
    { enabled: open }
  );

  const workboards = data?.data?.workboards || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>작업판 선택</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : workboards.length === 0 ? (
          <Alert severity="info">사용 가능한 작업판이 없습니다.</Alert>
        ) : (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {workboards.map((workboard) => (
              <Grid item xs={12} key={workboard._id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => onSelect(workboard)}
                >
                  <CardContent>
                    <Typography variant="subtitle1">{workboard.name}</Typography>
                    {workboard.description && (
                      <Typography variant="body2" color="textSecondary">
                        {workboard.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
      </DialogActions>
    </Dialog>
  );
}

function PromptDataList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPromptData, setEditingPromptData] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [workboardSelectOpen, setWorkboardSelectOpen] = useState(false);
  const [selectedPromptData, setSelectedPromptData] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuPromptData, setMenuPromptData] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState('');
  const limit = 12;

  const { data, isLoading, error } = useQuery(
    ['promptDataList', page, limit, search],
    () => promptDataAPI.getAll({ page, limit, search: search || undefined }),
    { keepPreviousData: true }
  );

  const promptDataList = data?.data?.data?.promptDataList || [];
  const pagination = data?.data?.data?.pagination || { total: 0, pages: 1 };

  const createMutation = useMutation(promptDataAPI.create, {
    onSuccess: () => {
      toast.success('프롬프트 데이터가 생성되었습니다');
      queryClient.invalidateQueries('promptDataList');
      setFormOpen(false);
    },
    onError: () => toast.error('프롬프트 데이터 생성 실패')
  });

  const updateMutation = useMutation(
    ({ id, data }) => promptDataAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('프롬프트 데이터가 수정되었습니다');
        queryClient.invalidateQueries('promptDataList');
        setFormOpen(false);
        setEditingPromptData(null);
      },
      onError: () => toast.error('프롬프트 데이터 수정 실패')
    }
  );

  const deleteMutation = useMutation(promptDataAPI.delete, {
    onSuccess: () => {
      toast.success('프롬프트 데이터가 삭제되었습니다');
      queryClient.invalidateQueries('promptDataList');
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    },
    onError: () => toast.error('프롬프트 데이터 삭제 실패')
  });

  const handleSave = (data) => {
    if (editingPromptData) {
      updateMutation.mutate({ id: editingPromptData._id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (promptData) => {
    setEditingPromptData(promptData);
    setFormOpen(true);
    handleMenuClose();
  };

  const handleDelete = (id) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
    handleMenuClose();
  };

  const handleQuickGenerate = (promptData) => {
    setSelectedPromptData(promptData);
    setWorkboardSelectOpen(true);
    handleMenuClose();
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
      navigate(`/generate/${workboard._id}`);
    }
    setWorkboardSelectOpen(false);
  };

  const handleMenuOpen = (event, promptData) => {
    setAnchorEl(event.currentTarget);
    setMenuPromptData(promptData);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuPromptData(null);
  };

  const handleCopyPrompt = (promptData) => {
    navigator.clipboard.writeText(promptData.prompt);
    toast.success('프롬프트가 클립보드에 복사되었습니다');
    handleMenuClose();
  };

  const handleImageClick = (imageUrl, e) => {
    e.stopPropagation();
    setViewerImageUrl(imageUrl);
    setImageViewerOpen(true);
  };

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">프롬프트 데이터를 불러올 수 없습니다.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">프롬프트 데이터</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingPromptData(null);
            setFormOpen(true);
          }}
        >
          새 프롬프트
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="프롬프트 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : promptDataList.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : '저장된 프롬프트 데이터가 없습니다. 새 프롬프트를 생성해보세요!'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {promptDataList.map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item._id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {item.representativeImage?.url ? (
                    <CardMedia
                      component="img"
                      image={item.representativeImage.url}
                      alt={item.name}
                      onClick={(e) => handleImageClick(item.representativeImage.url, e)}
                      sx={{
                        aspectRatio: '1/1',
                        objectFit: 'cover',
                        objectPosition: 'top',
                        cursor: 'pointer',
                        '&:hover': { opacity: 0.9 }
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        aspectRatio: '1/1',
                        bgcolor: 'grey.100',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ImageIcon sx={{ fontSize: 48, color: 'grey.400' }} />
                    </Box>
                  )}
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start">
                      <Typography variant="h6" gutterBottom noWrap sx={{ flex: 1 }}>
                        {item.name}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, item)}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        color: 'text.secondary'
                      }}
                    >
                      {item.memo || item.prompt}
                    </Typography>
                    <Box mt={1}>
                      {item.seed && (
                        <Chip
                          label={`Seed: ${item.seed}`}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                      {item.tags?.slice(0, 3).map((tag) => (
                        <Chip
                          key={tag._id || tag}
                          label={tag.name || tag}
                          size="small"
                          sx={{ 
                            mr: 0.5, 
                            mb: 0.5,
                            bgcolor: tag.color || undefined,
                            color: tag.color ? 'white' : undefined
                          }}
                        />
                      ))}
                      {item.tags?.length > 3 && (
                        <Chip
                          label={`+${item.tags.length - 3}`}
                          size="small"
                          variant="outlined"
                          sx={{ mb: 0.5 }}
                        />
                      )}
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<PlayArrow />}
                      onClick={() => handleQuickGenerate(item)}
                    >
                      생성
                    </Button>
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => handleEdit(item)}
                    >
                      수정
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {pagination.pages > 1 && (
            <Box mt={3}>
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

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleQuickGenerate(menuPromptData)}>
          <ListItemIcon><PlayArrow fontSize="small" /></ListItemIcon>
          <ListItemText>이미지 생성</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCopyPrompt(menuPromptData)}>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          <ListItemText>프롬프트 복사</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleEdit(menuPromptData)}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>수정</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDelete(menuPromptData?._id)}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>삭제</ListItemText>
        </MenuItem>
      </Menu>

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

      <ImageViewerDialog
        images={viewerImageUrl ? [{ url: viewerImageUrl }] : []}
        open={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        title="대표 이미지"
        showNavigation={false}
        showMetadata={false}
      />
    </Container>
  );
}

export default PromptDataList;
