import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  Box,
  TextField,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Search,
  PlayArrow,
  Edit,
  Delete,
  MoreVert,
  Image as ImageIcon,
  ContentCopy
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import Pagination from './Pagination';
import ImageViewerDialog from './ImageViewerDialog';
import ProjectTagChip from './ProjectTagChip';

function PromptDataPanel({
  fetchFn,
  queryKey,
  readOnly = false,
  showSearch = true,
  showCreateButton = true,
  pageSize = 12,
  responseExtractor,
  onEdit,
  onDelete,
  onQuickGenerate,
  onCopyPrompt,
  onCreate
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuPromptData, setMenuPromptData] = useState(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState('');

  const { data, isLoading, error } = useQuery(
    [queryKey, page, pageSize, search],
    () => fetchFn({ page, limit: pageSize, search: search || undefined }),
    { keepPreviousData: true }
  );

  const defaultExtractor = (data) => {
    const d = data?.data?.data || data?.data || {};
    return {
      items: d.promptDataList || [],
      pagination: d.pagination || { total: 0, pages: 1 }
    };
  };

  const extractor = responseExtractor || defaultExtractor;
  const { items: promptDataList, pagination } = extractor(data);

  const handleMenuOpen = (event, promptData) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setMenuPromptData(promptData);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuPromptData(null);
  };

  const handleImageClick = (imageUrl, e) => {
    e.stopPropagation();
    setViewerImageUrl(imageUrl);
    setImageViewerOpen(true);
  };

  if (error) {
    return <Alert severity="error">프롬프트 데이터를 불러올 수 없습니다.</Alert>;
  }

  return (
    <>
      {(showSearch || (showCreateButton && !readOnly)) && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={2}>
          {showSearch && (
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
          )}
          {showCreateButton && !readOnly && onCreate && (
            <Button
              variant="contained"
              onClick={onCreate}
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              새 프롬프트
            </Button>
          )}
        </Box>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : promptDataList.length === 0 ? (
        <Alert severity="info">
          {search ? '검색 결과가 없습니다.' : '저장된 프롬프트 데이터가 없습니다.'}
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
                      {!readOnly && (
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, item)}
                        >
                          <MoreVert />
                        </IconButton>
                      )}
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
                      {item.tags?.slice(0, 3).map((tag) => (
                        <ProjectTagChip
                          key={tag._id || tag}
                          tag={typeof tag === 'object' ? tag : { name: tag }}
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
                  {!readOnly && (
                    <CardActions>
                      {onQuickGenerate && (
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          onClick={() => onQuickGenerate(item)}
                        >
                          생성
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => onEdit(item)}
                        >
                          수정
                        </Button>
                      )}
                    </CardActions>
                  )}
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

      {!readOnly && (
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          {onQuickGenerate && (
            <MenuItem onClick={() => { onQuickGenerate(menuPromptData); handleMenuClose(); }}>
              <ListItemIcon><PlayArrow fontSize="small" /></ListItemIcon>
              <ListItemText>이미지 생성</ListItemText>
            </MenuItem>
          )}
          {onCopyPrompt && (
            <MenuItem onClick={() => { onCopyPrompt(menuPromptData); handleMenuClose(); }}>
              <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
              <ListItemText>프롬프트 복사</ListItemText>
            </MenuItem>
          )}
          {onEdit && (
            <MenuItem onClick={() => { onEdit(menuPromptData); handleMenuClose(); }}>
              <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
              <ListItemText>수정</ListItemText>
            </MenuItem>
          )}
          {onDelete && (
            <MenuItem onClick={() => { onDelete(menuPromptData?._id); handleMenuClose(); }}>
              <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
              <ListItemText sx={{ color: 'error.main' }}>삭제</ListItemText>
            </MenuItem>
          )}
        </Menu>
      )}

      <ImageViewerDialog
        images={viewerImageUrl ? [{ url: viewerImageUrl }] : []}
        open={imageViewerOpen}
        onClose={() => setImageViewerOpen(false)}
        title="대표 이미지"
        showNavigation={false}
        showMetadata={false}
      />
    </>
  );
}

export default PromptDataPanel;
