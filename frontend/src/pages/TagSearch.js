import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Chip,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
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
  DialogActions
} from '@mui/material';
import {
  LocalOffer,
  Image as ImageIcon,
  TextSnippet,
  Edit,
  Delete,
  Add,
  Search,
  Label
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { tagAPI } from '../services/api';
import TagInput from '../components/common/TagInput';

function SearchTabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

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

function TagSearch() {
  const [mainTab, setMainTab] = useState(0);
  const [searchTabValue, setSearchTabValue] = useState(0);

  // --- 태그 검색 state ---
  const [selectedTags, setSelectedTags] = useState([]);

  // --- 태그 관리 state ---
  const [editTag, setEditTag] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmTag, setDeleteConfirmTag] = useState(null);
  const queryClient = useQueryClient();

  // 태그 검색 query
  const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery(
    ['tagSearch', selectedTags.map(t => t._id).join(',')],
    () => tagAPI.search({ tags: selectedTags.map(t => t._id).join(',') }),
    { enabled: selectedTags.length > 0 }
  );

  // 태그 관리 query
  const { data: myTagsData, isLoading: myTagsLoading, error: myTagsError } = useQuery(
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

  // 검색 결과
  const results = searchData?.data?.results || {};
  const generatedImages = results.generatedImages || [];
  const uploadedImages = results.uploadedImages || [];
  const promptData = results.promptData || [];
  const totalResults = generatedImages.length + uploadedImages.length + promptData.length;

  // 태그 관리 데이터
  const tags = myTagsData?.data?.tags || [];
  const totalTags = myTagsData?.data?.totalTags || 0;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <LocalOffer color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4">태그</Typography>
      </Box>

      <Tabs
        value={mainTab}
        onChange={(e, v) => setMainTab(v)}
        sx={{ mb: 3 }}
      >
        <Tab icon={<Search />} label="태그 검색" iconPosition="start" />
        <Tab icon={<Label />} label="내 태그 관리" iconPosition="start" />
      </Tabs>

      {/* 태그 검색 탭 */}
      {mainTab === 0 && (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              검색할 태그를 선택하세요
            </Typography>
            <TagInput
              value={selectedTags}
              onChange={setSelectedTags}
              label="태그 선택"
              placeholder="태그를 검색하거나 선택..."
            />
          </Paper>

          {selectedTags.length === 0 ? (
            <Alert severity="info">
              태그를 선택하면 해당 태그가 붙은 이미지, 프롬프트 데이터를 검색합니다.
            </Alert>
          ) : searchLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : searchError ? (
            <Alert severity="error">검색 중 오류가 발생했습니다.</Alert>
          ) : totalResults === 0 ? (
            <Alert severity="warning">선택한 태그에 해당하는 항목이 없습니다.</Alert>
          ) : (
            <Paper sx={{ p: 2 }}>
              <Tabs value={searchTabValue} onChange={(e, v) => setSearchTabValue(v)}>
                <Tab
                  icon={<ImageIcon />}
                  label={`생성 이미지 (${generatedImages.length})`}
                  iconPosition="start"
                />
                <Tab
                  icon={<ImageIcon />}
                  label={`업로드 이미지 (${uploadedImages.length})`}
                  iconPosition="start"
                />
                <Tab
                  icon={<TextSnippet />}
                  label={`프롬프트 (${promptData.length})`}
                  iconPosition="start"
                />
              </Tabs>

              <SearchTabPanel value={searchTabValue} index={0}>
                {generatedImages.length === 0 ? (
                  <Typography color="textSecondary">결과 없음</Typography>
                ) : (
                  <Grid container spacing={2}>
                    {generatedImages.map((img) => (
                      <Grid item xs={6} sm={4} md={3} key={img._id}>
                        <Card>
                          <CardMedia
                            component="img"
                            height="150"
                            image={img.url}
                            alt={img.originalName}
                            sx={{ objectFit: 'cover' }}
                          />
                          <CardContent sx={{ p: 1 }}>
                            <Typography variant="caption" noWrap display="block">
                              {img.generationParams?.prompt?.substring(0, 50)}...
                            </Typography>
                            <Box mt={0.5}>
                              {img.tags?.map(tag => (
                                <Chip
                                  key={tag._id}
                                  size="small"
                                  label={tag.name}
                                  sx={{ bgcolor: tag.color, color: 'white', mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                                />
                              ))}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </SearchTabPanel>

              <SearchTabPanel value={searchTabValue} index={1}>
                {uploadedImages.length === 0 ? (
                  <Typography color="textSecondary">결과 없음</Typography>
                ) : (
                  <Grid container spacing={2}>
                    {uploadedImages.map((img) => (
                      <Grid item xs={6} sm={4} md={3} key={img._id}>
                        <Card>
                          <CardMedia
                            component="img"
                            height="150"
                            image={img.url}
                            alt={img.originalName}
                            sx={{ objectFit: 'cover' }}
                          />
                          <CardContent sx={{ p: 1 }}>
                            <Typography variant="caption" noWrap display="block">
                              {img.originalName}
                            </Typography>
                            <Box mt={0.5}>
                              {img.tags?.map(tag => (
                                <Chip
                                  key={tag._id}
                                  size="small"
                                  label={tag.name}
                                  sx={{ bgcolor: tag.color, color: 'white', mr: 0.5, mb: 0.5, fontSize: '0.7rem' }}
                                />
                              ))}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </SearchTabPanel>

              <SearchTabPanel value={searchTabValue} index={2}>
                {promptData.length === 0 ? (
                  <Typography color="textSecondary">결과 없음</Typography>
                ) : (
                  <Grid container spacing={2}>
                    {promptData.map((pd) => (
                      <Grid item xs={12} sm={6} key={pd._id}>
                        <Card>
                          <Box sx={{ display: 'flex' }}>
                            {pd.representativeImage?.url ? (
                              <CardMedia
                                component="img"
                                sx={{ width: 100, height: 100, objectFit: 'cover' }}
                                image={pd.representativeImage.url}
                                alt={pd.name}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 100,
                                  height: 100,
                                  bgcolor: 'grey.200',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <TextSnippet sx={{ color: 'grey.400', fontSize: 40 }} />
                              </Box>
                            )}
                            <CardContent sx={{ flex: 1, py: 1 }}>
                              <Typography variant="subtitle1" noWrap>{pd.name}</Typography>
                              <Typography variant="body2" color="textSecondary" sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {pd.prompt}
                              </Typography>
                              <Box mt={0.5}>
                                {pd.tags?.map(tag => (
                                  <Chip
                                    key={tag._id}
                                    size="small"
                                    label={tag.name}
                                    sx={{ bgcolor: tag.color, color: 'white', mr: 0.5, fontSize: '0.7rem' }}
                                  />
                                ))}
                              </Box>
                            </CardContent>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </SearchTabPanel>
            </Paper>
          )}
        </>
      )}

      {/* 내 태그 관리 탭 */}
      {mainTab === 1 && (
        <>
          {myTagsLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : myTagsError ? (
            <Alert severity="error">태그를 불러오는 중 오류가 발생했습니다.</Alert>
          ) : (
            <>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Chip label={`총 ${totalTags}개`} size="small" />
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
            </>
          )}
        </>
      )}
    </Container>
  );
}

export default TagSearch;
