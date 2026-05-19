import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Fab,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { textAPI } from '../../services/api';
import Pagination from './Pagination';
import TagInput from './TagInput';

const MAX_CONTENT_LENGTH = 1_000_000;
const PREVIEW_CHARS = 200;

// 텍스트 컨텐츠 패널 (#387).
// kind: 'uploaded' (직접 작성, 편집/생성 가능) | 'generated' (대화에서 저장, 태그/삭제만 가능).
// defaultTags: 새 항목 생성 시 기본 태그 (프로젝트 맥락에서 프로젝트 태그 자동 추가용).
function TextContentPanel({ kind = 'uploaded', defaultTags = [] }) {
  const isUploaded = kind === 'uploaded';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewerItem, setViewerItem] = useState(null);
  const queryClient = useQueryClient();

  const queryKey = isUploaded ? 'uploadedTexts' : 'generatedTexts';
  const listFn = isUploaded ? textAPI.getUploaded : textAPI.getGenerated;
  const updateFn = isUploaded ? textAPI.updateUploaded : textAPI.updateGenerated;
  const deleteFn = isUploaded ? textAPI.deleteUploaded : textAPI.deleteGenerated;
  const createFn = textAPI.createUploaded;

  const { data, isLoading, error } = useQuery(
    [queryKey, page, search],
    () => listFn({ page, limit: 20, search }),
    { keepPreviousData: true }
  );

  const items = data?.data?.data?.items || [];
  const pagination = data?.data?.data?.pagination || { current: 1, pages: 0, total: 0 };

  const upsertMutation = useMutation(
    (payload) => {
      if (payload._id) return updateFn(payload._id, { title: payload.title, content: payload.content, tags: (payload.tags || []).map((t) => t._id || t) });
      return createFn({ title: payload.title, content: payload.content, tags: (payload.tags || []).map((t) => t._id || t) });
    },
    {
      onSuccess: () => {
        toast.success('저장되었습니다.');
        queryClient.invalidateQueries(queryKey);
        setEditorOpen(false);
        setEditingItem(null);
      },
      onError: (err) => toast.error(err.response?.data?.message || '저장 실패'),
    }
  );

  const updateTagsMutation = useMutation(
    ({ id, tags }) => updateFn(id, { tags: tags.map((t) => t._id || t) }),
    {
      onSuccess: () => {
        toast.success('태그가 갱신되었습니다.');
        queryClient.invalidateQueries(queryKey);
      },
      onError: (err) => toast.error(err.response?.data?.message || '태그 갱신 실패'),
    }
  );

  const deleteMutation = useMutation(
    (id) => deleteFn(id),
    {
      onSuccess: () => {
        toast.success('삭제되었습니다.');
        queryClient.invalidateQueries(queryKey);
        setViewerItem(null);
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'),
    }
  );

  const openCreate = () => {
    setEditingItem({ title: '', content: '', tags: defaultTags });
    setEditorOpen(true);
  };

  const openEdit = (item) => {
    setEditingItem({ ...item, tags: item.tags || [] });
    setEditorOpen(true);
  };

  const handleCopy = async (content) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('복사되었습니다.');
    } catch {
      toast.error('복사 실패');
    }
  };

  if (isLoading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }
  if (error) {
    return <Alert severity="error">불러오기 실패: {error.message}</Alert>;
  }

  return (
    <Box>
      <TextField
        size="small"
        placeholder={isUploaded ? '제목 / 본문 검색...' : '본문 검색...'}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
      />

      {items.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            {isUploaded ? '아직 작성한 텍스트가 없습니다. 우측 하단의 + 버튼으로 작성하세요.' : '저장된 LLM 응답이 없습니다. 대화 상세에서 메시지를 저장하세요.'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Card key={item._id} variant="outlined">
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  {item.title ? (
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mr: 1 }}>
                      {item.title}
                    </Typography>
                  ) : (
                    <Typography variant="subtitle2" sx={{ fontStyle: 'italic', color: 'text.secondary', mr: 1 }}>
                      (제목 없음)
                    </Typography>
                  )}
                  {(item.tags || []).map((t) => (
                    <Chip
                      key={t._id || t}
                      label={t.name || t}
                      size="small"
                      sx={{ backgroundColor: t.color, color: '#fff' }}
                    />
                  ))}
                  {!isUploaded && item.model && (
                    <Chip label={item.model} size="small" variant="outlined" />
                  )}
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.createdAt).toLocaleString('ko-KR')}
                  </Typography>
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {item.content?.slice(0, PREVIEW_CHARS)}
                  {item.content?.length > PREVIEW_CHARS && '…'}
                </Typography>
                {item.content?.length > PREVIEW_CHARS && (
                  <Typography variant="caption" color="text.secondary">
                    총 {item.content.length.toLocaleString()}자
                  </Typography>
                )}
              </CardContent>
              <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                <Tooltip title="복사">
                  <IconButton size="small" onClick={() => handleCopy(item.content)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="상세">
                  <IconButton size="small" onClick={() => setViewerItem(item)}>
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {isUploaded && (
                  <Tooltip title="편집">
                    <IconButton size="small" onClick={() => openEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="삭제">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      if (window.confirm('삭제하시겠습니까?')) deleteMutation.mutate(item._id);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}

      {pagination.pages > 1 && (
        <Box mt={2} display="flex" justifyContent="center">
          <Pagination
            currentPage={pagination.current}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            onPageChange={setPage}
          />
        </Box>
      )}

      {isUploaded && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 24, right: 24 }}
          onClick={openCreate}
        >
          <AddIcon />
        </Fab>
      )}

      {/* 편집 / 생성 다이얼로그 (uploaded 만) */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingItem?._id ? '텍스트 편집' : '새 텍스트'}</DialogTitle>
        <DialogContent dividers>
          {editingItem && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="제목 (선택)"
                size="small"
                value={editingItem.title || ''}
                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                inputProps={{ maxLength: 200 }}
              />
              <TextField
                label="본문"
                multiline
                minRows={10}
                value={editingItem.content || ''}
                onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                inputProps={{ maxLength: MAX_CONTENT_LENGTH }}
                helperText={`${(editingItem.content || '').length.toLocaleString()} / ${MAX_CONTENT_LENGTH.toLocaleString()}자`}
              />
              <TagInput
                value={editingItem.tags || []}
                onChange={(tags) => setEditingItem({ ...editingItem, tags })}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>취소</Button>
          <Button
            variant="contained"
            onClick={() => upsertMutation.mutate(editingItem)}
            disabled={!editingItem?.content?.trim() || upsertMutation.isLoading}
          >
            저장
          </Button>
        </DialogActions>
      </Dialog>

      {/* 상세 보기 다이얼로그 */}
      <Dialog open={!!viewerItem} onClose={() => setViewerItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {viewerItem?.title || '(제목 없음)'}
        </DialogTitle>
        <DialogContent dividers>
          {viewerItem && (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                {(viewerItem.tags || []).map((t) => (
                  <Chip
                    key={t._id || t}
                    label={t.name || t}
                    size="small"
                    sx={{ backgroundColor: t.color, color: '#fff' }}
                  />
                ))}
                {!isUploaded && viewerItem.model && (
                  <Chip label={viewerItem.model} size="small" variant="outlined" />
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {new Date(viewerItem.createdAt).toLocaleString('ko-KR')}
                </Typography>
              </Stack>
              {!isUploaded && viewerItem.sourcePrompt && (
                <Box sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block">원본 프롬프트</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{viewerItem.sourcePrompt}</Typography>
                </Box>
              )}
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {viewerItem.content}
              </Typography>
              {/* 태그 편집 — generated 도 가능 */}
              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>태그</Typography>
                <TagInput
                  value={viewerItem.tags || []}
                  onChange={(tags) => {
                    updateTagsMutation.mutate({ id: viewerItem._id, tags });
                    setViewerItem({ ...viewerItem, tags });
                  }}
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleCopy(viewerItem?.content || '')}>복사</Button>
          {isUploaded && (
            <Button onClick={() => { setViewerItem(null); openEdit(viewerItem); }}>편집</Button>
          )}
          <Button onClick={() => setViewerItem(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TextContentPanel;
