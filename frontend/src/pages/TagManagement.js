import React, { useState } from 'react';
import {
  Container,
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  LocalOffer
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { tagAPI } from '../services/api';

function TagEditDialog({ open, onClose, tag }) {
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || '#1976d2');
  const queryClient = useQueryClient();

  const updateMutation = useMutation(
    (data) => tagAPI.update(tag._id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('myTags');
        queryClient.invalidateQueries('tags');
        toast.success('태그가 수정되었습니다');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '수정 실패');
      }
    }
  );

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('태그 이름을 입력해주세요');
      return;
    }
    updateMutation.mutate({ name: name.trim(), color });
  };

  React.useEffect(() => {
    if (tag) {
      setName(tag.name || '');
      setColor(tag.color || '#1976d2');
    }
  }, [tag]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>태그 수정</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="태그 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <Box display="flex" alignItems="center" gap={2}>
          <TextField
            label="색상"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            sx={{ width: 100 }}
            InputProps={{ sx: { height: 56 } }}
          />
          <Chip
            label={name || '미리보기'}
            sx={{ bgcolor: color, color: 'white' }}
          />
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

function TagCreateDialog({ open, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#1976d2');
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    (data) => tagAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('myTags');
        queryClient.invalidateQueries('tags');
        toast.success('태그가 생성되었습니다');
        setName('');
        setColor('#1976d2');
        onClose();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '생성 실패');
      }
    }
  );

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('태그 이름을 입력해주세요');
      return;
    }
    createMutation.mutate({ name: name.trim(), color });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>새 태그 생성</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="태그 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <Box display="flex" alignItems="center" gap={2}>
          <TextField
            label="색상"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            sx={{ width: 100 }}
            InputProps={{ sx: { height: 56 } }}
          />
          <Chip
            label={name || '미리보기'}
            sx={{ bgcolor: color, color: 'white' }}
          />
        </Box>
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

function TagManagement() {
  const [editTag, setEditTag] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmTag, setDeleteConfirmTag] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    'myTags',
    () => tagAPI.getMy()
  );

  const deleteMutation = useMutation(
    (id) => tagAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('myTags');
        queryClient.invalidateQueries('tags');
        toast.success('태그가 삭제되었습니다');
        setDeleteConfirmTag(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '삭제 실패');
      }
    }
  );

  const tags = data?.data?.tags || [];
  const totalTags = data?.data?.totalTags || 0;

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">태그를 불러오는 중 오류가 발생했습니다.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={1}>
          <LocalOffer color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h4">내 태그</Typography>
          <Chip label={`총 ${totalTags}개`} size="small" />
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setCreateDialogOpen(true)}
        >
          새 태그
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>태그</TableCell>
              <TableCell align="center">사용 횟수</TableCell>
              <TableCell align="center">생성일</TableCell>
              <TableCell align="center">액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  등록된 태그가 없습니다
                </TableCell>
              </TableRow>
            ) : (
              tags.map((tag) => (
                <TableRow key={tag._id}>
                  <TableCell>
                    <Chip
                      label={tag.name}
                      sx={{ bgcolor: tag.color, color: 'white' }}
                    />
                  </TableCell>
                  <TableCell align="center">{tag.usageCount}</TableCell>
                  <TableCell align="center">
                    {new Date(tag.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => setEditTag(tag)}
                      title="수정"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteConfirmTag(tag)}
                      title="삭제"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TagEditDialog
        open={!!editTag}
        onClose={() => setEditTag(null)}
        tag={editTag}
      />

      <TagCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

      <Dialog
        open={!!deleteConfirmTag}
        onClose={() => setDeleteConfirmTag(null)}
      >
        <DialogTitle>태그 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            <Chip
              label={deleteConfirmTag?.name}
              sx={{ bgcolor: deleteConfirmTag?.color, color: 'white', mr: 1 }}
            />
            태그를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            이 태그는 모든 이미지, 프롬프트 데이터에서 제거됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmTag(null)}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteMutation.mutate(deleteConfirmTag._id)}
            disabled={deleteMutation.isLoading}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TagManagement;
