import React, { useState, useEffect, useCallback } from 'react';
import {
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
  IconButton,
  Chip,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  Checkbox
} from '@mui/material';
import {
  Search,
  Download,
  Delete,
  MoreVert,
  Edit,
  Info,
  Close,
  Videocam,
  CheckCircle
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { imageAPI } from '../../services/api';
import Pagination from './Pagination';
import VideoViewerDialog from './VideoViewerDialog';
import ProjectTagChip from './ProjectTagChip';

function ImageDetailDialog({ image, open, onClose, type }) {
  if (!image) return null;

  const handleDownload = async () => {
    if (type === 'generated') {
      try {
        const response = await imageAPI.downloadGenerated(image._id);
        const blob = new Blob([response.data]);
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = image.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('다운로드 완료');

        setTimeout(() => { window.URL.revokeObjectURL(blobUrl); }, 1000);
      } catch (error) {
        console.error('Download error:', error);
        toast.error('다운로드 실패. 잠시 후 다시 시도해주세요.');
      }
    } else {
      try {
        const response = await fetch(image.url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = image.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('다운로드 완료');

        setTimeout(() => { window.URL.revokeObjectURL(blobUrl); }, 1000);
      } catch (error) {
        console.error('Download error:', error);
        toast.error('다운로드 실패. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'black', maxHeight: '90vh' } }}
    >
      <DialogTitle sx={{ color: 'white', pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">이미지 상세보기</Typography>
          <Box>
            <IconButton onClick={handleDownload} sx={{ color: 'white', mr: 1 }}><Download /></IconButton>
            <IconButton onClick={onClose} sx={{ color: 'white' }}><Close /></IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', p: 2, bgcolor: 'black' }}>
        <img
          src={image.url}
          alt={image.originalName}
          style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px' }}
        />
        <Box mt={2} sx={{ color: 'white' }}>
          <Typography variant="body2">{image.originalName}</Typography>
          {image.metadata && (
            <Typography variant="body2">크기: {image.metadata.width} x {image.metadata.height}</Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ImageCard({ image, type, onEdit, onDelete, onView, readOnly = false, showTags = true, bulkMode = false, bulkSelected = false, onBulkToggle }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDownload = async () => {
    if (type === 'generated') {
      try {
        const response = await imageAPI.downloadGenerated(image._id);
        const blob = new Blob([response.data]);
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = image.originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('다운로드 완료');
        setTimeout(() => { window.URL.revokeObjectURL(blobUrl); }, 1000);
      } catch (error) {
        toast.error('다운로드 실패. 잠시 후 다시 시도해주세요.');
      }
    }
    setAnchorEl(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card sx={{
      height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
      ...(bulkMode && bulkSelected && { border: '2px solid', borderColor: 'primary.main' })
    }}>
      {bulkMode && (
        <Checkbox
          checked={bulkSelected}
          onChange={(e) => { e.stopPropagation(); onBulkToggle?.(image._id); }}
          onClick={(e) => e.stopPropagation()}
          sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: 1, p: 0.5 }}
        />
      )}
      <CardMedia
        component="img"
        height="200"
        image={image.url}
        alt={image.originalName}
        sx={{ cursor: 'pointer' }}
        onClick={() => bulkMode ? onBulkToggle?.(image._id) : onView(image)}
      />
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography variant="subtitle2" noWrap gutterBottom>{image.originalName}</Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {image.metadata?.width && image.metadata?.height
            ? `${image.metadata.width}x${image.metadata.height}`
            : '크기 정보 없음'}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">{formatFileSize(image.size)}</Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {new Date(image.createdAt).toLocaleDateString()}
        </Typography>

        {showTags && image.tags?.length > 0 && (
          <Box mt={1}>
            {image.tags.slice(0, 2).map((tag) => (
              <ProjectTagChip key={tag._id || tag} tag={typeof tag === 'object' ? tag : { name: tag }} />
            ))}
            {image.tags.length > 2 && (
              <Chip label={`+${image.tags.length - 2}`} size="small" variant="outlined" />
            )}
          </Box>
        )}

        {type === 'uploaded' && image.isReferenced && (
          <Chip label="참조됨" color="primary" size="small" variant="outlined" sx={{ mt: 1 }} />
        )}
        {type === 'generated' && image.isPublic && (
          <Chip label="공개" color="success" size="small" variant="outlined" sx={{ mt: 1 }} />
        )}
      </CardContent>
      {!readOnly && !bulkMode && (
        <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
          <Button size="small" onClick={() => onView(image)} startIcon={<Info />}>상세보기</Button>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}><MoreVert /></IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={() => { onEdit(image); setAnchorEl(null); }}>
              <Edit sx={{ mr: 1 }} fontSize="small" />편집
            </MenuItem>
            {type === 'generated' && (
              <MenuItem onClick={handleDownload}>
                <Download sx={{ mr: 1 }} fontSize="small" />다운로드
              </MenuItem>
            )}
            <MenuItem onClick={() => { onDelete(image); setAnchorEl(null); }} sx={{ color: 'error.main' }}>
              <Delete sx={{ mr: 1 }} fontSize="small" />삭제
            </MenuItem>
          </Menu>
        </CardActions>
      )}
    </Card>
  );
}

function VideoCard({ video, onEdit, onDelete, onView, readOnly = false, showTags = true, bulkMode = false, bulkSelected = false, onBulkToggle }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleDownload = async () => {
    try {
      const response = await imageAPI.downloadVideo(video._id);
      const blob = new Blob([response.data]);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = video.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('다운로드 완료');
      setTimeout(() => { window.URL.revokeObjectURL(blobUrl); }, 1000);
    } catch (error) {
      toast.error('다운로드 실패');
    }
    setAnchorEl(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card sx={{
      height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
      ...(bulkMode && bulkSelected && { border: '2px solid', borderColor: 'primary.main' })
    }}>
      {bulkMode && (
        <Checkbox
          checked={bulkSelected}
          onChange={(e) => { e.stopPropagation(); onBulkToggle?.(video._id); }}
          onClick={(e) => e.stopPropagation()}
          sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, bgcolor: 'rgba(255,255,255,0.8)', borderRadius: 1, p: 0.5 }}
        />
      )}
      <Box
        sx={{
          position: 'relative', height: 200, bgcolor: 'black',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}
        onClick={() => bulkMode ? onBulkToggle?.(video._id) : onView(video)}
      >
        <video
          src={video.url}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          muted
          onMouseEnter={(e) => e.target.play()}
          onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
        />
        <Box sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.6)', borderRadius: 1, px: 1, py: 0.5 }}>
          <Videocam sx={{ color: 'white', fontSize: 20 }} />
        </Box>
      </Box>
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        <Typography variant="subtitle2" noWrap gutterBottom>{video.originalName}</Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {video.metadata?.width && video.metadata?.height
            ? `${video.metadata.width}x${video.metadata.height}`
            : '크기 정보 없음'}
        </Typography>
        <Typography variant="caption" color="textSecondary" display="block">{formatFileSize(video.size)}</Typography>
        <Typography variant="caption" color="textSecondary" display="block">
          {new Date(video.createdAt).toLocaleDateString()}
        </Typography>

        {showTags && video.tags?.length > 0 && (
          <Box mt={1}>
            {video.tags.slice(0, 2).map((tag) => (
              <ProjectTagChip key={tag._id || tag} tag={typeof tag === 'object' ? tag : { name: tag }} />
            ))}
            {video.tags.length > 2 && (
              <Chip label={`+${video.tags.length - 2}`} size="small" variant="outlined" />
            )}
          </Box>
        )}
        {video.isPublic && (
          <Chip label="공개" color="success" size="small" variant="outlined" sx={{ mt: 1 }} />
        )}
      </CardContent>
      {!readOnly && !bulkMode && (
        <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
          <Button size="small" onClick={() => onView(video)} startIcon={<Info />}>상세보기</Button>
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}><MoreVert /></IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem onClick={() => { onEdit(video); setAnchorEl(null); }}>
              <Edit sx={{ mr: 1 }} fontSize="small" />편집
            </MenuItem>
            <MenuItem onClick={handleDownload}>
              <Download sx={{ mr: 1 }} fontSize="small" />다운로드
            </MenuItem>
            <MenuItem onClick={() => { onDelete(video); setAnchorEl(null); }} sx={{ color: 'error.main' }}>
              <Delete sx={{ mr: 1 }} fontSize="small" />삭제
            </MenuItem>
          </Menu>
        </CardActions>
      )}
    </Card>
  );
}

function MediaGrid({
  type,
  fetchFn = null,
  queryKey,
  readOnly = false,
  showSearch = true,
  showTags = true,
  pageSize = 12,
  columns = { xs: 12, sm: 6, md: 4, lg: 3 },
  onEdit,
  onDelete,
  selectable = false,
  multiSelect = false,
  selectedItems = [],
  onSelectionChange,
  responseExtractor,
  bulkMode = false,
  bulkSelectedIds = new Set(),
  onBulkToggle,
  onStateChange
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Default fetch functions based on type
  const defaultFetchFn = (params) => {
    if (type === 'video') return imageAPI.getVideos(params);
    if (type === 'uploaded') return imageAPI.getUploaded(params);
    return imageAPI.getGenerated(params);
  };

  const actualFetchFn = fetchFn || defaultFetchFn;
  const actualQueryKey = queryKey || `media-${type}`;

  const { data, isLoading } = useQuery(
    [actualQueryKey, search, page, pageSize],
    () => actualFetchFn({ search: search || undefined, page, limit: pageSize }),
    { keepPreviousData: true }
  );

  const defaultExtractor = (data) => {
    const d = data?.data?.data || data?.data || {};
    let items;
    if (type === 'video') items = d.videos || [];
    else items = d.images || [];
    return { items, pagination: d.pagination || {} };
  };

  const extractor = responseExtractor || defaultExtractor;
  const { items, pagination } = extractor(data);

  // onStateChange 콜백
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ items, search, pagination });
    }
  }, [items, search, pagination]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleView = (media) => {
    if (selectable) {
      handleSelectItem(media);
      return;
    }
    setSelectedMedia(media);
    setTimeout(() => setDetailOpen(true), 10);
  };

  const handleSelectItem = (media) => {
    if (!onSelectionChange) return;
    const imageType = type === 'uploaded' ? 'UploadedImage' : 'GeneratedImage';
    const isSelected = selectedItems.some(item => item.imageId === media._id);

    if (multiSelect) {
      if (isSelected) {
        onSelectionChange(selectedItems.filter(item => item.imageId !== media._id));
      } else {
        onSelectionChange([...selectedItems, { imageId: media._id, imageType, image: media }]);
      }
    } else {
      if (isSelected) {
        onSelectionChange([]);
      } else {
        onSelectionChange([{ imageId: media._id, imageType, image: media }]);
      }
    }
  };

  const isItemSelected = (mediaId) => selectedItems.some(item => item.imageId === mediaId);

  return (
    <>
      {showSearch && (
        <Box mb={3}>
          <TextField
            fullWidth
            placeholder="이미지 이름이나 태그로 검색..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><Search /></InputAdornment>
              ),
            }}
            sx={{ maxWidth: 500 }}
          />
        </Box>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" mt={8}>
          <CircularProgress />
        </Box>
      ) : items.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : `${type === 'video' ? '생성된 동영상' : type === 'uploaded' ? '업로드된 이미지' : '생성된 이미지'}가 없습니다.`}
        </Alert>
      ) : (
        <>
          <Grid container spacing={selectable ? 2 : 3}>
            {items.map((item) => {
              if (selectable) {
                const isSelected = isItemSelected(item._id);
                return (
                  <Grid item {...columns} key={item._id}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? '3px solid' : '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'grey.300',
                        transition: 'all 0.2s',
                        position: 'relative',
                        '&:hover': { borderColor: 'primary.light', transform: 'scale(1.02)' }
                      }}
                      onClick={() => handleSelectItem(item)}
                    >
                      {isSelected && (
                        <CheckCircle
                          sx={{
                            position: 'absolute', top: 8, right: 8,
                            color: 'primary.main', bgcolor: 'white', borderRadius: '50%', zIndex: 1
                          }}
                        />
                      )}
                      <CardMedia
                        component="img"
                        height="120"
                        image={item.url}
                        alt={item.originalName || 'Image'}
                        sx={{ objectFit: 'cover' }}
                      />
                      <CardContent sx={{ p: 1 }}>
                        <Typography variant="caption" noWrap>
                          {item.originalName || new Date(item.createdAt).toLocaleDateString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              }

              return (
                <Grid item {...columns} key={item._id}>
                  {type === 'video' ? (
                    <VideoCard
                      video={item}
                      onView={handleView}
                      onEdit={onEdit || (() => {})}
                      onDelete={onDelete || (() => {})}
                      readOnly={readOnly}
                      showTags={showTags}
                      bulkMode={bulkMode}
                      bulkSelected={bulkSelectedIds.has(item._id)}
                      onBulkToggle={onBulkToggle}
                    />
                  ) : (
                    <ImageCard
                      image={item}
                      type={type}
                      onView={handleView}
                      onEdit={onEdit || (() => {})}
                      onDelete={onDelete || (() => {})}
                      readOnly={readOnly}
                      showTags={showTags}
                      bulkMode={bulkMode}
                      bulkSelected={bulkSelectedIds.has(item._id)}
                      onBulkToggle={onBulkToggle}
                    />
                  )}
                </Grid>
              );
            })}
          </Grid>

          {pagination.pages > 1 && (
            <Box mt={4}>
              <Pagination
                currentPage={page}
                totalPages={pagination.pages}
                totalItems={pagination.total}
                onPageChange={setPage}
                showInfo={false}
                showFirstLast={true}
                showGoToPage={true}
                maxVisible={3}
              />
            </Box>
          )}
        </>
      )}

      {/* Detail viewers (non-selectable mode) */}
      {!selectable && type === 'video' && (
        <VideoViewerDialog
          videos={selectedMedia ? [selectedMedia] : []}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title="동영상 상세보기"
        />
      )}
      {!selectable && type !== 'video' && (
        <ImageDetailDialog
          image={selectedMedia}
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          type={type}
        />
      )}
    </>
  );
}

export default MediaGrid;
