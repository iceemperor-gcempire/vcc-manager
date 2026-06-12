import React, { useState } from 'react';
import { copyToClipboard } from '../../utils/clipboard';
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
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { textAPI } from '../../services/api';
import Pagination from './Pagination';
import TagInput from './TagInput';

const MAX_CONTENT_LENGTH = 1_000_000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const PREVIEW_CHARS = 200;

// 파일명에서 확장자 제거 (마지막 dot 기준)
function stripExtension(filename) {
  const idx = filename.lastIndexOf('.');
  return idx > 0 ? filename.slice(0, idx) : filename;
}

// 텍스트 컨텐츠 패널 (#387).
// kind: 'uploaded' (직접 작성, 편집/생성 가능) | 'generated' (대화에서 저장, 태그/삭제만 가능).
// defaultTags: 새 항목 생성 시 기본 태그 (프로젝트 맥락에서 프로젝트 태그 자동 추가용).
function TextContentPanel({ kind = 'uploaded', defaultTags = [], filterTags = [], title }) {
  const isUploaded = kind === 'uploaded';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewerItem, setViewerItem] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();

  const queryKey = isUploaded ? 'uploadedTexts' : 'generatedTexts';
  const listFn = isUploaded ? textAPI.getUploaded : textAPI.getGenerated;
  const updateFn = isUploaded ? textAPI.updateUploaded : textAPI.updateGenerated;
  const deleteFn = isUploaded ? textAPI.deleteUploaded : textAPI.deleteGenerated;
  const createFn = textAPI.createUploaded;

  const tagIds = (filterTags || []).map((t) => t._id || t).filter(Boolean);
  const { data, isLoading, error } = useQuery({ queryKey: [queryKey, page, search, tagIds.join(',')], queryFn: () => {
      const params = { page, limit: 20, search };
      if (tagIds.length > 0) params.tags = tagIds.join(',');
      return listFn(params);
    }, placeholderData: keepPreviousData });

  const items = data?.data?.data?.items || [];
  const pagination = data?.data?.data?.pagination || { current: 1, pages: 0, total: 0 };

  const upsertMutation = useMutation({ mutationFn: (payload) => {
      if (payload._id) return updateFn(payload._id, { title: payload.title, content: payload.content, tags: (payload.tags || []).map((t) => t._id || t) });
      return createFn({ title: payload.title, content: payload.content, tags: (payload.tags || []).map((t) => t._id || t) });
    },
      onSuccess: () => {
        toast.success('저장되었습니다.');
        queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
        setEditorOpen(false);
        setEditingItem(null);
      },
      onError: (err) => toast.error(err.response?.data?.message || '저장 실패'), });

  const updateTagsMutation = useMutation({ mutationFn: ({ id, tags }) => updateFn(id, { tags: tags.map((t) => t._id || t) }),
      onSuccess: () => {
        toast.success('태그가 갱신되었습니다.');
        queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
      },
      onError: (err) => toast.error(err.response?.data?.message || '태그 갱신 실패'), });

  const deleteMutation = useMutation({ mutationFn: (id) => deleteFn(id),
      onSuccess: () => {
        toast.success('삭제되었습니다.');
        queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
        setViewerItem(null);
      },
      onError: (err) => toast.error(err.response?.data?.message || '삭제 실패'), });

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
      await copyToClipboard(content);
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
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }} alignItems={{ sm: 'center' }}>
        <TextField
          placeholder={isUploaded ? '제목 / 본문 검색...' : '본문 검색...'}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ width: { xs: '100%', sm: 320 } }}
        />
        {isUploaded && (
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setUploadOpen(true)}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}
          >
            파일 업로드
          </Button>
        )}
      </Stack>

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
                      sx={{ backgroundColor: t.color, color: '#fff' }}
                    />
                  ))}
                  {!isUploaded && item.model && (
                    <Chip label={item.model} variant="outlined" />
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
            disabled={!editingItem?.content?.trim() || upsertMutation.isPending}
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
                    sx={{ backgroundColor: t.color, color: '#fff' }}
                  />
                ))}
                {!isUploaded && viewerItem.model && (
                  <Chip label={viewerItem.model} variant="outlined" />
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

      <TextFileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultTags={defaultTags}
        onComplete={() => queryClient.invalidateQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] })}
      />
    </Box>
  );
}

// .txt / .md 파일을 클라이언트에서 읽어 UploadedText 로 일괄 저장 (#389).
function TextFileUploadDialog({ open, onClose, defaultTags = [], onComplete }) {
  const [files, setFiles] = useState([]); // [{ file, status, error, content }]
  const [tags, setTags] = useState(defaultTags);
  const [uploading, setUploading] = useState(false);

  // 다이얼로그 닫을 때마다 초기화
  const handleClose = () => {
    if (uploading) return;
    setFiles([]);
    setTags(defaultTags);
    onClose();
  };

  const onDrop = (accepted) => {
    const next = accepted.map((file) => {
      let error = null;
      if (file.size > MAX_FILE_SIZE) {
        error = `파일이 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB 를 초과합니다`;
      }
      return { file, status: error ? 'error' : 'pending', error };
    });
    setFiles((prev) => [...prev, ...next]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'], 'text/markdown': ['.md', '.markdown'] },
    maxSize: MAX_FILE_SIZE,
    disabled: uploading,
  });

  const removeFile = (idx) => {
    if (uploading) return;
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('파일 읽기 실패'));
      reader.readAsText(file, 'utf-8');
    });

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    const tagIds = (tags || []).map((t) => t._id || t);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status === 'error' || entry.status === 'done') continue;
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'reading' } : f)));
      try {
        const text = await readFileAsText(entry.file);
        if (text.length > MAX_CONTENT_LENGTH) {
          throw new Error(`본문이 ${MAX_CONTENT_LENGTH.toLocaleString()}자 초과`);
        }
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading' } : f)));
        await textAPI.createUploaded({
          title: stripExtension(entry.file.name),
          content: text,
          tags: tagIds,
        });
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'done' } : f)));
        successCount += 1;
      } catch (err) {
        const msg = err.response?.data?.message || err.message || '실패';
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: 'error', error: msg } : f)));
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast.success(`${successCount}개 파일이 업로드되었습니다.`);
      onComplete?.();
    }
  };

  const allDone = files.length > 0 && files.every((f) => f.status === 'done');
  const anyPending = files.some((f) => f.status === 'pending' || f.status === 'reading' || f.status === 'uploading');

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>텍스트 파일 업로드</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box
            {...getRootProps()}
            sx={{
              p: 3,
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'divider',
              borderRadius: 1,
              textAlign: 'center',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              cursor: uploading ? 'not-allowed' : 'pointer',
            }}
          >
            <input {...getInputProps()} />
            <UploadFileIcon sx={{ fontSize: 40, color: 'action.active', mb: 1 }} />
            <Typography variant="body2">
              {isDragActive ? '여기에 놓으세요' : '클릭 또는 드래그해 텍스트 파일 추가 (.txt, .md, 최대 5MB)'}
            </Typography>
          </Box>

          {files.length > 0 && (
            <Stack spacing={1}>
              {files.map((entry, idx) => (
                <Box
                  key={idx}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
                >
                  <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={entry.file.name}>
                      {entry.file.name}
                    </Typography>
                    <Typography variant="caption" color={entry.status === 'error' ? 'error' : 'text.secondary'}>
                      {entry.status === 'pending' && `${(entry.file.size / 1024).toFixed(1)} KB · 대기`}
                      {entry.status === 'reading' && '읽는 중...'}
                      {entry.status === 'uploading' && '업로드 중...'}
                      {entry.status === 'done' && '완료'}
                      {entry.status === 'error' && `오류: ${entry.error}`}
                    </Typography>
                  </Box>
                  {(entry.status === 'reading' || entry.status === 'uploading') && <CircularProgress size={16} />}
                  {!uploading && entry.status !== 'done' && (
                    <IconButton size="small" onClick={() => removeFile(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Stack>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              모든 업로드 항목에 적용될 태그
            </Typography>
            <TagInput value={tags} onChange={setTags} />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>{allDone ? '닫기' : '취소'}</Button>
        <Button
          variant="contained"
          onClick={handleUpload}
          disabled={uploading || files.length === 0 || !anyPending}
        >
          {uploading ? '업로드 중...' : `${files.filter((f) => f.status === 'pending').length}개 업로드`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TextContentPanel;
