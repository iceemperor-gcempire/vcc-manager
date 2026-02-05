import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  Pagination as MuiPagination,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  AutoFixHigh,
  VisibilityOff as VisibilityOffIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI, userAPI } from '../services/api';

// LoRA 카드 컴포넌트
function LoraCard({ lora, expanded, onToggleExpand, onCopyTriggerWord, getBaseModelColor, nsfwImageFilter }) {
  const hasCivitai = lora.civitai?.found;

  // NSFW 필터링된 이미지 목록
  const filteredImages = nsfwImageFilter
    ? (lora.civitai?.images || []).filter(img => !img.nsfw)
    : (lora.civitai?.images || []);
  const previewImage = filteredImages[0]?.url;
  const name = lora.civitai?.name || lora.filename.replace(/\.[^/.]+$/, '');
  const trainedWords = lora.civitai?.trainedWords || [];

  const handleCopyLoraTag = () => {
    // 경로에서 파일명만 추출 후 확장자 제거
    const basename = lora.filename.split(/[/\\]/).pop();
    const nameWithoutExt = basename.replace(/\.[^/.]+$/, '');
    const loraString = `<lora:${nameWithoutExt}:1>`;
    navigator.clipboard.writeText(loraString);
    toast.success(`LoRA 태그가 복사되었습니다.`);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': { borderColor: 'primary.main' }
      }}
    >
      {/* 미리보기 이미지 */}
      {previewImage ? (
        <CardMedia
          component="img"
          height="160"
          image={previewImage}
          alt={name}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            미리보기 없음
          </Typography>
        </Box>
      )}

      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* 이름 */}
        <Typography variant="subtitle1" noWrap title={name} fontWeight="medium">
          {name}
        </Typography>

        {/* 파일명 (Civitai 정보가 있을 경우) */}
        {hasCivitai && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {lora.filename}
          </Typography>
        )}

        {/* 기본 모델 배지 */}
        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {lora.civitai?.baseModel && (
            <Chip
              label={lora.civitai.baseModel}
              size="small"
              color={getBaseModelColor(lora.civitai.baseModel)}
              variant="outlined"
            />
          )}
          {!hasCivitai && !lora.hash && (
            <Tooltip title={lora.hashError || '해시 정보 없음'}>
              <Chip
                icon={<InfoIcon />}
                label="메타데이터 없음"
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )}
          {lora.hash && !hasCivitai && (
            <Tooltip title="Civitai에서 찾을 수 없음">
              <Chip
                label="미등록"
                size="small"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Box>

        {/* 트리거 워드 */}
        {trainedWords.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              트리거 워드 (클릭시 복사):
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {trainedWords.slice(0, expanded ? undefined : 3).map((word, i) => (
                <Chip
                  key={i}
                  label={word}
                  size="small"
                  onClick={() => onCopyTriggerWord(word)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
              {!expanded && trainedWords.length > 3 && (
                <Chip
                  label={`+${trainedWords.length - 3}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      {/* 확장 영역 */}
      <Collapse in={expanded}>
        <CardContent sx={{ pt: 0 }}>
          {lora.civitai?.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                maxHeight: 100,
                overflow: 'auto',
                mb: 1,
                '& p': { margin: 0 }
              }}
              dangerouslySetInnerHTML={{
                __html: lora.civitai.description.substring(0, 500)
              }}
            />
          )}

          {/* 추가 미리보기 이미지 */}
          {filteredImages.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1, overflow: 'auto', mt: 1 }}>
              {filteredImages.slice(1).map((img, i) => (
                <Box
                  key={i}
                  component="img"
                  src={img.url}
                  alt={`Preview ${i + 2}`}
                  sx={{
                    width: 60,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 1
                  }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Collapse>

      <CardActions sx={{ justifyContent: 'space-between', pt: 0 }}>
        <Stack direction="row" spacing={0.5}>
          {hasCivitai && (
            <IconButton
              size="small"
              onClick={onToggleExpand}
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
          {lora.civitai?.modelUrl && (
            <Tooltip title="Civitai에서 보기">
              <IconButton
                size="small"
                href={lora.civitai.modelUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Tooltip title="LoRA 태그 복사">
          <IconButton
            size="small"
            onClick={handleCopyLoraTag}
            color="primary"
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

// LoRA 리스트 아이템 컴포넌트
function LoraListItem({ lora, onCopyTriggerWord, getBaseModelColor, nsfwImageFilter }) {
  const hasCivitai = lora.civitai?.found;
  const filteredImages = nsfwImageFilter
    ? (lora.civitai?.images || []).filter(img => !img.nsfw)
    : (lora.civitai?.images || []);
  const previewImage = filteredImages[0]?.url;
  const name = lora.civitai?.name || lora.filename.replace(/\.[^/.]+$/, '');
  const trainedWords = lora.civitai?.trainedWords || [];

  const handleCopyLoraTag = () => {
    // 경로에서 파일명만 추출 후 확장자 제거
    const basename = lora.filename.split(/[/\\]/).pop();
    const nameWithoutExt = basename.replace(/\.[^/.]+$/, '');
    const loraString = `<lora:${nameWithoutExt}:1>`;
    navigator.clipboard.writeText(loraString);
    toast.success(`LoRA 태그가 복사되었습니다.`);
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        p: 1.5,
        overflow: 'hidden',
        width: '100%',
        boxSizing: 'border-box',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, overflow: 'hidden', width: '100%' }}>
        {/* 썸네일 */}
        {previewImage ? (
          <Avatar
            variant="rounded"
            src={previewImage}
            sx={{ width: 48, height: 48, flexShrink: 0 }}
          />
        ) : (
          <Avatar
            variant="rounded"
            sx={{ width: 48, height: 48, bgcolor: 'action.hover', flexShrink: 0 }}
          >
            <Typography variant="caption" color="text.secondary">N/A</Typography>
          </Avatar>
        )}

        {/* 콘텐츠 영역 */}
        <Box sx={{ flex: '1 1 0', width: 0, overflow: 'hidden' }}>
          {/* 이름 + 버튼 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: '1 1 0', width: 0, overflow: 'hidden' }}>
              <Typography
                variant="subtitle2"
                component="div"
                noWrap
                title={name}
              >
                {name}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
                noWrap
                title={lora.filename}
              >
                {lora.filename}
              </Typography>
            </Box>

            {/* 액션 버튼 */}
            <Stack direction="row" spacing={0.5} flexShrink={0}>
              {lora.civitai?.modelUrl && (
                <Tooltip title="Civitai에서 보기">
                  <IconButton
                    size="small"
                    href={lora.civitai.modelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="LoRA 태그 복사">
                <IconButton size="small" onClick={handleCopyLoraTag} color="primary">
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* 배지들 */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {lora.civitai?.baseModel && (
              <Chip
                label={lora.civitai.baseModel}
                size="small"
                color={getBaseModelColor(lora.civitai.baseModel)}
                variant="outlined"
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
            {!hasCivitai && (
              <Chip label={lora.hash ? "미등록" : "메타데이터 없음"} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
          </Box>

          {/* 트리거 워드 */}
          {trainedWords.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {trainedWords.slice(0, 5).map((word, i) => (
                <Chip
                  key={i}
                  label={word}
                  size="small"
                  onClick={() => onCopyTriggerWord(word)}
                  title={word}
                  sx={{
                    cursor: 'pointer',
                    height: 20,
                    fontSize: '0.7rem',
                    maxWidth: 150,
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }
                  }}
                />
              ))}
              {trainedWords.length > 5 && (
                <Chip label={`+${trainedWords.length - 5}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function LoraList() {
  const [selectedServerId, setSelectedServerId] = useState('');
  const [loraModels, setLoraModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLora, setExpandedLora] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });
  const [baseModelFilter, setBaseModelFilter] = useState('');
  const [availableBaseModels, setAvailableBaseModels] = useState([]);

  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const queryClient = useQueryClient();

  // 사용자 설정 조회
  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile());
  const userPreferences = profileData?.data?.user?.preferences || {};
  const nsfwLoraFilter = userPreferences.nsfwLoraFilter ?? true;
  const nsfwImageFilter = userPreferences.nsfwImageFilter ?? true;

  // 사용자 설정 업데이트 mutation
  const updatePreferencesMutation = useMutation(
    (preferences) => userAPI.updateProfile({ preferences }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userProfile');
      },
      onError: (error) => {
        toast.error('설정 저장 실패: ' + error.message);
      }
    }
  );

  // NSFW LoRA 필터 토글
  const handleNsfwLoraFilterToggle = () => {
    const newValue = !nsfwLoraFilter;
    updatePreferencesMutation.mutate({ nsfwLoraFilter: newValue });
    toast.success(newValue ? 'NSFW LoRA가 숨겨집니다.' : 'NSFW LoRA가 표시됩니다.');
  };

  // NSFW 이미지 필터 토글
  const handleNsfwImageFilterToggle = () => {
    const newValue = !nsfwImageFilter;
    updatePreferencesMutation.mutate({ nsfwImageFilter: newValue });
    toast.success(newValue ? 'NSFW 이미지가 숨겨집니다.' : 'NSFW 이미지가 표시됩니다.');
  };

  // ComfyUI 서버 목록 조회
  const { data: serversData, isLoading: serversLoading } = useQuery(
    ['servers'],
    () => serverAPI.getServers({ includeInactive: false }),
    {
      onSuccess: (data) => {
        const servers = data?.data?.data?.servers || [];
        const comfyUIServers = servers.filter(s => s.serverType === 'ComfyUI');
        // 첫 번째 ComfyUI 서버 자동 선택
        if (comfyUIServers.length > 0 && !selectedServerId) {
          setSelectedServerId(comfyUIServers[0]._id);
        }
      }
    }
  );

  const servers = serversData?.data?.data?.servers || [];
  const comfyUIServers = servers.filter(s => s.serverType === 'ComfyUI');

  // LoRA 모델 fetch 함수
  const fetchLoraModels = useCallback(async (serverId, search, baseModel, page = 1) => {
    if (!serverId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await serverAPI.getLoras(serverId, {
        search,
        baseModel,
        page,
        limit: 24
      });
      const data = response.data.data;
      setLoraModels(data.loraModels || []);
      setPagination(data.pagination || { current: 1, pages: 0, total: 0 });
      setCacheInfo(data.cacheInfo);
      // 서버에서 받은 전체 기본 모델 목록 설정
      if (data.availableBaseModels) {
        setAvailableBaseModels(data.availableBaseModels);
      }
    } catch (err) {
      console.error('Failed to fetch LoRA models:', err);
      setError(err.response?.data?.message || 'LoRA 모델을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 서버/검색어/필터 변경 시 debounce로 단일 fetch
  useEffect(() => {
    if (!selectedServerId) return;

    const timer = setTimeout(() => {
      fetchLoraModels(selectedServerId, searchQuery, baseModelFilter, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedServerId, searchQuery, baseModelFilter, fetchLoraModels]);

  const handleCopyTriggerWord = (word) => {
    navigator.clipboard.writeText(word);
    toast.success(`"${word}" 복사됨`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '없음';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getBaseModelColor = (baseModel) => {
    if (!baseModel) return 'default';
    if (baseModel.includes('SDXL')) return 'primary';
    if (baseModel.includes('SD 1.5') || baseModel.includes('SD1')) return 'secondary';
    if (baseModel.includes('Pony')) return 'warning';
    if (baseModel.includes('Flux')) return 'info';
    return 'default';
  };

  // NSFW LoRA 필터링 적용 (클라이언트 사이드)
  const filteredLoraModels = nsfwLoraFilter
    ? loraModels.filter(lora => !lora.civitai?.nsfw)
    : loraModels;

  const selectedServer = comfyUIServers.find(s => s._id === selectedServerId);

  return (
    <Container maxWidth="xl" sx={{ py: 3, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <AutoFixHigh fontSize="large" color="primary" />
        <Typography variant="h5">
          LoRA 목록
        </Typography>
      </Box>

      {/* 서버 선택 */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth>
          <InputLabel>ComfyUI 서버 선택</InputLabel>
          <Select
            value={selectedServerId}
            label="ComfyUI 서버 선택"
            onChange={(e) => {
              setSelectedServerId(e.target.value);
              setLoraModels([]);
              setCacheInfo(null);
              setSearchQuery('');
              setBaseModelFilter('');
              setAvailableBaseModels([]);
            }}
            disabled={serversLoading}
          >
            {comfyUIServers.map(server => (
              <MenuItem key={server._id} value={server._id}>
                <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {server.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {comfyUIServers.length === 0 && !serversLoading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            등록된 ComfyUI 서버가 없습니다.
          </Alert>
        )}
      </Box>

      {selectedServerId && (
        <>
          {/* NSFW 필터 설정 */}
          <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={nsfwLoraFilter}
                    onChange={handleNsfwLoraFilterToggle}
                    disabled={updatePreferencesMutation.isLoading}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <BlockIcon fontSize="small" />
                    <span>NSFW LoRA 숨기기</span>
                  </Box>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={nsfwImageFilter}
                    onChange={handleNsfwImageFilterToggle}
                    disabled={updatePreferencesMutation.isLoading}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <VisibilityOffIcon fontSize="small" />
                    <span>NSFW 이미지 숨기기</span>
                  </Box>
                }
              />
            </Box>
          </Box>

          {/* 검색 및 필터 영역 */}
          <Box sx={{ mb: 3 }}>
            {/* 검색창 */}
            <TextField
              placeholder="LoRA 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              fullWidth
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            {/* 필터 및 뷰 모드 */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              {availableBaseModels.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>기본 모델</InputLabel>
                  <Select
                    value={baseModelFilter}
                    label="기본 모델"
                    onChange={(e) => setBaseModelFilter(e.target.value)}
                  >
                    <MenuItem value="">전체</MenuItem>
                    {availableBaseModels.map(model => (
                      <MenuItem key={model} value={model}>{model}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="grid">
                  <GridViewIcon />
                </ToggleButton>
                <ToggleButton value="list">
                  <ListViewIcon />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* 상태 정보 */}
          <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  서버
                </Typography>
                <Typography variant="body2">
                  {selectedServer?.name}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  검색 결과
                </Typography>
                <Typography variant="body2">
                  {pagination.total || 0}개
                  {nsfwLoraFilter && loraModels.length !== filteredLoraModels.length && (
                    <span style={{ color: '#666' }}> (NSFW {loraModels.length - filteredLoraModels.length}개 숨김)</span>
                  )}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  마지막 동기화
                </Typography>
                <Typography variant="body2">
                  {formatDate(cacheInfo?.lastCivitaiSync)}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {/* 에러 표시 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* LoRA 목록 */}
          {(() => {
            if (loading) {
              return (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              );
            }

            if (filteredLoraModels.length === 0) {
              return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    {searchQuery || baseModelFilter || nsfwLoraFilter ? '검색 결과가 없습니다.' : 'LoRA 모델이 없습니다.'}
                  </Typography>
                  {nsfwLoraFilter && loraModels.length > 0 && filteredLoraModels.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      NSFW 필터가 활성화되어 일부 LoRA가 숨겨졌습니다.
                    </Typography>
                  )}
                </Box>
              );
            }

            return (
              <>
                {viewMode === 'grid' ? (
                  // 그리드 뷰
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(auto-fill, minmax(150px, 1fr))',
                        sm: 'repeat(auto-fill, minmax(200px, 1fr))'
                      },
                      gap: 2,
                      '& > *': {
                        maxWidth: { xs: 'none', sm: 280 }
                      }
                    }}
                  >
                    {filteredLoraModels.map((lora, index) => (
                      <Box key={lora.filename || index}>
                        <LoraCard
                          lora={lora}
                          expanded={expandedLora === lora.filename}
                          onToggleExpand={() => setExpandedLora(
                            expandedLora === lora.filename ? null : lora.filename
                          )}
                          onCopyTriggerWord={handleCopyTriggerWord}
                          getBaseModelColor={getBaseModelColor}
                          nsfwImageFilter={nsfwImageFilter}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  // 리스트 뷰
                  <Box sx={{ width: '100%', overflow: 'hidden' }}>
                    {filteredLoraModels.map((lora, index) => (
                      <LoraListItem
                        key={lora.filename || index}
                        lora={lora}
                        onCopyTriggerWord={handleCopyTriggerWord}
                        getBaseModelColor={getBaseModelColor}
                        nsfwImageFilter={nsfwImageFilter}
                      />
                    ))}
                  </Box>
                )}

                {/* 페이지네이션 */}
                {pagination.pages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <MuiPagination
                      count={pagination.pages}
                      page={pagination.current}
                      onChange={(e, page) => fetchLoraModels(selectedServerId, searchQuery, baseModelFilter, page)}
                      color="primary"
                      size="large"
                    />
                  </Box>
                )}
              </>
            );
          })()}
        </>
      )}
    </Container>
  );
}

export default LoraList;
