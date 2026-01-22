import React, { useState } from 'react';
import {
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Fab
} from '@mui/material';
import {
  Search,
  CloudUpload,
  Download,
  Delete,
  MoreVert,
  Edit,
  Info,
  Close,
  Share
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { imageAPI } from '../services/api';

function ImageCard({ image, type, onEdit, onDelete, onView }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDownload = async () => {
    if (type === 'generated') {
      try {
        const response = await imageAPI.downloadGenerated(image._id);
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = image.originalName;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success('다운로드 완료');
      } catch (error) {
        toast.error('다운로드 실패');
      }
    }
    handleMenuClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardMedia
        component="img"
        height="200"
        image={image.url}
        alt={image.originalName}
        sx={{ cursor: 'pointer' }}
        onClick={() => onView(image)}
      />
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography variant="subtitle2" noWrap gutterBottom>
          {image.originalName}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {image.metadata?.width}x{image.metadata?.height}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {formatFileSize(image.size)}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {new Date(image.createdAt).toLocaleDateString()}
        </Typography>

        {/* 태그 */}
        {image.tags?.length > 0 && (
          <Box mt={1}>
            {image.tags.slice(0, 2).map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
            {image.tags.length > 2 && (
              <Chip
                label={`+${image.tags.length - 2}`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        )}

        {/* 참조 상태 (업로드된 이미지만) */}
        {type === 'uploaded' && image.isReferenced && (
          <Chip
            label="참조됨"
            color="primary"
            size="small"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        )}

        {/* 공개 상태 (생성된 이미지만) */}
        {type === 'generated' && image.isPublic && (
          <Chip
            label="공개"
            color="success"
            size="small"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Button size="small" onClick={() => onView(image)} startIcon={<Info />}>
          상세보기
        </Button>
        <IconButton size="small" onClick={handleMenuOpen}>
          <MoreVert />
        </IconButton>
        
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => { onEdit(image); handleMenuClose(); }}>
            <Edit sx={{ mr: 1 }} fontSize="small" />
            편집
          </MenuItem>
          {type === 'generated' && (
            <MenuItem onClick={handleDownload}>
              <Download sx={{ mr: 1 }} fontSize="small" />
              다운로드
            </MenuItem>
          )}
          <MenuItem 
            onClick={() => { onDelete(image); handleMenuClose(); }}
            sx={{ color: 'error.main' }}
          >
            <Delete sx={{ mr: 1 }} fontSize="small" />
            삭제
          </MenuItem>
        </Menu>
      </CardActions>
    </Card>
  );
}

function ImageDetailDialog({ image, open, onClose, type }) {
  if (!image) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{image.originalName}</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box textAlign="center" mb={3}>
          <img 
            src={image.url} 
            alt={image.originalName}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '400px',
              objectFit: 'contain'
            }}
          />
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">크기</Typography>
            <Typography variant="body1">
              {image.metadata?.width} x {image.metadata?.height}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">파일 크기</Typography>
            <Typography variant="body1">
              {(image.size / 1024 / 1024).toFixed(2)} MB
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">생성일</Typography>
            <Typography variant="body1">
              {new Date(image.createdAt).toLocaleString()}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="textSecondary">형식</Typography>
            <Typography variant="body1">
              {image.metadata?.format || 'PNG'}
            </Typography>
          </Grid>
        </Grid>

        {/* 생성된 이미지의 추가 정보 */}
        {type === 'generated' && image.generationParams && (
          <Box mt={3}>
            <Typography variant="h6" gutterBottom>생성 정보</Typography>
            <Typography variant="body2" color="textSecondary">프롬프트</Typography>
            <Typography variant="body1" paragraph>
              {image.generationParams.prompt}
            </Typography>
            
            {image.generationParams.negativePrompt && (
              <>
                <Typography variant="body2" color="textSecondary">부정 프롬프트</Typography>
                <Typography variant="body1" paragraph>
                  {image.generationParams.negativePrompt}
                </Typography>
              </>
            )}
            
            <Typography variant="body2" color="textSecondary">모델</Typography>
            <Typography variant="body1">
              {image.generationParams.model}
            </Typography>
          </Box>
        )}

        {/* 태그 */}
        {image.tags?.length > 0 && (
          <Box mt={3}>
            <Typography variant="body2" color="textSecondary" gutterBottom>태그</Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {image.tags.map((tag, index) => (
                <Chip key={index} label={tag} size="small" />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ open, onClose, onSuccess }) {
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true
  });

  const handleUpload = async () => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = acceptedFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return await imageAPI.upload(formData);
      });

      await Promise.all(uploadPromises);
      toast.success(`${acceptedFiles.length}개 이미지 업로드 완료`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('업로드 실패');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>이미지 업로드</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          sx={{
            border: '2px dashed',
            borderColor: isDragActive ? 'primary.main' : 'grey.300',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragActive ? 'primary.light' : 'grey.50',
            transition: 'all 0.3s'
          }}
        >
          <input {...getInputProps()} />
          <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragActive ? '이미지를 여기에 놓으세요' : '이미지를 선택하거나 드래그하세요'}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            JPG, PNG, WebP 형식 지원
          </Typography>
        </Box>

        {acceptedFiles.length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle1" gutterBottom>
              선택된 파일 ({acceptedFiles.length}개)
            </Typography>
            {acceptedFiles.map((file, index) => (
              <Typography key={index} variant="body2" color="textSecondary">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Typography>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button
          onClick={handleUpload}
          disabled={acceptedFiles.length === 0 || uploading}
          variant="contained"
        >
          {uploading ? '업로드 중...' : '업로드'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MyImages() {
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: uploadedImages, isLoading: uploadedLoading } = useQuery(
    ['uploadedImages', search, page],
    () => imageAPI.getUploaded({ search, page, limit: 12 }),
    { enabled: tab === 0 }
  );

  const { data: generatedImages, isLoading: generatedLoading } = useQuery(
    ['generatedImages', search, page],
    () => imageAPI.getGenerated({ search, page, limit: 12 }),
    { enabled: tab === 1 }
  );

  const deleteUploadedMutation = useMutation(
    imageAPI.deleteUploaded,
    {
      onSuccess: () => {
        toast.success('이미지가 삭제되었습니다');
        queryClient.invalidateQueries('uploadedImages');
      },
      onError: () => {
        toast.error('삭제 실패');
      }
    }
  );

  const deleteGeneratedMutation = useMutation(
    ({ id, deleteJob }) => imageAPI.deleteGenerated(id, deleteJob),
    {
      onSuccess: () => {
        toast.success('이미지가 삭제되었습니다');
        queryClient.invalidateQueries('generatedImages');
      },
      onError: () => {
        toast.error('삭제 실패');
      }
    }
  );

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setPage(1);
    setSearch('');
  };

  const handleView = (image) => {
    setSelectedImage(image);
    setDetailOpen(true);
  };

  const handleEdit = (image) => {
    // 편집 기능 구현 (태그 편집 등)
    console.log('Edit image:', image);
  };

  const handleDelete = (image) => {
    if (tab === 0) {
      if (window.confirm('이미지를 삭제하시겠습니까?')) {
        deleteUploadedMutation.mutate(image._id);
      }
    } else {
      const deleteJob = window.confirm('이미지와 함께 생성 작업도 삭제하시겠습니까?');
      deleteGeneratedMutation.mutate({ id: image._id, deleteJob });
    }
  };

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries('uploadedImages');
  };

  const currentImages = tab === 0 ? uploadedImages?.data?.images || [] : generatedImages?.data?.images || [];
  const currentPagination = tab === 0 ? uploadedImages?.data?.pagination || {} : generatedImages?.data?.pagination || {};
  const isLoading = tab === 0 ? uploadedLoading : generatedLoading;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">내 이미지</Typography>
      </Box>

      <Box mb={3}>
        <Tabs value={tab} onChange={handleTabChange}>
          <Tab label="업로드된 이미지" />
          <Tab label="생성된 이미지" />
        </Tabs>
      </Box>

      <Box mb={3}>
        <TextField
          fullWidth
          placeholder="이미지 이름이나 태그로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 500 }}
        />
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      ) : currentImages.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : `${tab === 0 ? '업로드된' : '생성된'} 이미지가 없습니다.`}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {currentImages.map((image) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={image._id}>
                <ImageCard
                  image={image}
                  type={tab === 0 ? 'uploaded' : 'generated'}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </Grid>
            ))}
          </Grid>

          {currentPagination.pages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Box display="flex" gap={1}>
                {Array.from({ length: currentPagination.pages }, (_, i) => i + 1).map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? "contained" : "outlined"}
                    onClick={() => setPage(pageNum)}
                    size="small"
                  >
                    {pageNum}
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* 업로드 FAB (업로드된 이미지 탭에서만) */}
      {tab === 0 && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setUploadOpen(true)}
        >
          <CloudUpload />
        </Fab>
      )}

      {/* 다이얼로그들 */}
      <ImageDetailDialog
        image={selectedImage}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={tab === 0 ? 'uploaded' : 'generated'}
      />

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </Container>
  );
}

export default MyImages;