import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import { Image as ImageIcon, Close, ArrowBack } from '@mui/icons-material';
import { useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { projectAPI } from '../../services/api';
import MediaGrid from './MediaGrid';

function ProjectEditDialog({ open, onClose, project, onSuccess }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState(null);
  const [coverImageRemoved, setCoverImageRemoved] = useState(false);
  // 이미지 브라우저 모드
  const [browseMode, setBrowseMode] = useState(false);
  const [browseTab, setBrowseTab] = useState(0);
  const [browseSelection, setBrowseSelection] = useState([]);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setCoverImage(project.coverImage || null);
      setCoverImageRemoved(false);
    }
  }, [project]);

  // 다이얼로그 닫힐 때 브라우저 모드 초기화
  React.useEffect(() => {
    if (!open) {
      setBrowseMode(false);
      setBrowseSelection([]);
    }
  }, [open]);

  const updateMutation = useMutation(
    (data) => projectAPI.update(project._id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project', project._id]);
        queryClient.invalidateQueries('projects');
        queryClient.invalidateQueries('favoriteProjects');
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

    const data = {
      name: name.trim(),
      description: description.trim()
    };

    if (coverImageRemoved) {
      data.coverImage = null;
    } else if (coverImage) {
      data.coverImage = {
        url: coverImage.url,
        imageId: coverImage.imageId,
        imageType: coverImage.imageType
      };
    }

    updateMutation.mutate(data);
  };

  const handleImageRemove = () => {
    setCoverImage(null);
    setCoverImageRemoved(true);
  };

  const handleBrowseConfirm = () => {
    if (browseSelection.length > 0) {
      const selected = browseSelection[0];
      setCoverImage({
        url: selected.image.url,
        imageId: selected.imageId,
        imageType: selected.imageType
      });
      setCoverImageRemoved(false);
    }
    setBrowseMode(false);
    setBrowseSelection([]);
  };

  const handleBrowseCancel = () => {
    setBrowseMode(false);
    setBrowseSelection([]);
  };

  const currentCoverUrl = coverImage?.url;

  // 이미지 브라우저 모드
  if (browseMode) {
    return (
      <Dialog open={open} onClose={handleBrowseCancel} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Button size="small" startIcon={<ArrowBack />} onClick={handleBrowseCancel}>
              돌아가기
            </Button>
            <Typography variant="h6">커버 이미지 선택</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs value={browseTab} onChange={(e, v) => setBrowseTab(v)} sx={{ mb: 2 }}>
            <Tab label="업로드한 이미지" />
            <Tab label="생성한 이미지" />
          </Tabs>
          <MediaGrid
            key={`cover-select-${browseTab}`}
            type={browseTab === 0 ? 'uploaded' : 'generated'}
            queryKey={`coverImageSelect-${browseTab}`}
            selectable
            selectedItems={browseSelection}
            onSelectionChange={(sel) => setBrowseSelection(sel.slice(0, 1))}
            showSearch={false}
            showTags={false}
            readOnly
            pageSize={12}
            columns={{ xs: 6, sm: 4, md: 3 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBrowseCancel}>취소</Button>
          <Button
            variant="contained"
            onClick={handleBrowseConfirm}
            disabled={browseSelection.length === 0}
          >
            선택
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // 일반 편집 모드
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

        {/* 커버 이미지 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>커버 이미지</Typography>
        {currentCoverUrl ? (
          <Box sx={{ position: 'relative', mb: 2 }}>
            <Box
              component="img"
              src={currentCoverUrl}
              sx={{
                width: '100%',
                maxHeight: 200,
                objectFit: 'cover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}
            />
            <Button
              size="small"
              color="error"
              startIcon={<Close />}
              onClick={handleImageRemove}
              sx={{ mt: 1 }}
            >
              이미지 제거
            </Button>
            <Button
              size="small"
              startIcon={<ImageIcon />}
              onClick={() => setBrowseMode(true)}
              sx={{ mt: 1, ml: 1 }}
            >
              변경
            </Button>
          </Box>
        ) : (
          <Button
            variant="outlined"
            startIcon={<ImageIcon />}
            onClick={() => setBrowseMode(true)}
            sx={{ mb: 2 }}
          >
            이미지 선택
          </Button>
        )}

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

export default ProjectEditDialog;
