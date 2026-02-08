import React, { useState } from 'react';
import {
  Container,
  Typography,
  Button,
  Box,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab
} from '@mui/material';
import {
  CloudUpload,
  Videocam
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { imageAPI, userAPI } from '../services/api';
import TagInput from '../components/common/TagInput';
import MediaGrid from '../components/common/MediaGrid';

function ImageEditDialog({ image, open, onClose, type, onSuccess, isVideo = false }) {
  const [tags, setTags] = useState([]);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (image) {
      setTags(image.tags || []);
    }
  }, [image]);

  const getUpdateFn = () => {
    if (isVideo) return imageAPI.updateVideo;
    if (type === 'uploaded') return imageAPI.updateUploaded;
    return imageAPI.updateGenerated;
  };

  const getQueryKey = () => {
    if (isVideo) return 'generatedVideos';
    if (type === 'uploaded') return 'uploadedImages';
    return 'generatedImages';
  };

  const updateMutation = useMutation(
    (data) => getUpdateFn()(image._id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(getQueryKey());
        toast.success(`${isVideo ? '동영상' : '이미지'} 정보가 수정되었습니다`);
        onSuccess?.();
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editImage, setEditImage] = useState(null);

  const queryClient = useQueryClient();

  // 사용자 설정 가져오기
  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile());
  const userPreferences = profileData?.data?.user?.preferences || {};

  const deleteUploadedMutation = useMutation(
    imageAPI.deleteUploaded,
    {
      onSuccess: () => {
        toast.success('이미지가 삭제되었습니다');
        queryClient.invalidateQueries('uploadedImages');
      },
      onError: () => toast.error('삭제 실패')
    }
  );

  const deleteGeneratedMutation = useMutation(
    ({ id, deleteJob }) => imageAPI.deleteGenerated(id, deleteJob),
    {
      onSuccess: () => {
        toast.success('이미지가 삭제되었습니다');
        queryClient.invalidateQueries('generatedImages');
      },
      onError: () => toast.error('삭제 실패')
    }
  );

  const deleteVideoMutation = useMutation(
    ({ id, deleteJob }) => imageAPI.deleteVideo(id, deleteJob),
    {
      onSuccess: () => {
        toast.success('동영상이 삭제되었습니다');
        queryClient.invalidateQueries('generatedVideos');
      },
      onError: () => toast.error('삭제 실패')
    }
  );

  const handleEdit = (image) => {
    setEditImage(image);
    setEditOpen(true);
  };

  const handleDelete = (item) => {
    const deleteHistorySetting = userPreferences.deleteHistoryWithContent;

    if (tab === 1) {
      if (window.confirm('이미지를 삭제하시겠습니까?')) {
        deleteUploadedMutation.mutate(item._id);
      }
    } else if (tab === 2) {
      if (deleteHistorySetting && item.jobId) {
        if (window.confirm('동영상과 연관된 작업 히스토리도 함께 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
          deleteVideoMutation.mutate({ id: item._id, deleteJob: true });
        }
      } else {
        if (window.confirm('동영상을 삭제하시겠습니까?\n\n작업 히스토리는 보존됩니다.')) {
          deleteVideoMutation.mutate({ id: item._id, deleteJob: false });
        }
      }
    } else {
      if (deleteHistorySetting && item.jobId) {
        if (window.confirm('이미지와 연관된 작업 히스토리도 함께 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
          deleteGeneratedMutation.mutate({ id: item._id, deleteJob: true });
        }
      } else {
        if (window.confirm('이미지를 삭제하시겠습니까?\n\n작업 히스토리는 보존됩니다.')) {
          deleteGeneratedMutation.mutate({ id: item._id, deleteJob: false });
        }
      }
    }
  };

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries('uploadedImages');
  };

  const getTypeForTab = () => {
    if (tab === 1) return 'uploaded';
    if (tab === 2) return 'video';
    return 'generated';
  };

  const getQueryKeyForTab = () => {
    if (tab === 1) return 'uploadedImages';
    if (tab === 2) return 'generatedVideos';
    return 'generatedImages';
  };

  const currentType = getTypeForTab();

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">내 이미지</Typography>
      </Box>

      <Box mb={3}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}>
          <Tab label="생성된 이미지" />
          <Tab label="업로드된 이미지" />
          <Tab icon={<Videocam />} label="생성된 동영상" iconPosition="start" />
        </Tabs>
      </Box>

      <MediaGrid
        key={currentType}
        type={currentType}
        queryKey={getQueryKeyForTab()}
        pageSize={12}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* 업로드 FAB (업로드된 이미지 탭에서만) */}
      {tab === 1 && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={() => setUploadOpen(true)}
        >
          <CloudUpload />
        </Fab>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      <ImageEditDialog
        image={editImage}
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditImage(null); }}
        type={currentType}
        isVideo={currentType === 'video'}
      />
    </Container>
  );
}

export default MyImages;
