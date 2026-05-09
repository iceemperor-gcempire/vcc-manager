import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Chip,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  LinearProgress,
  Tooltip,
  Stack,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI, userAPI } from '../services/api';
import Pagination from './common/Pagination';

// ─── ModelThumbnail ──────────────────────────────────────────────
function ModelThumbnail({ image, alt, height = 140, width = '100%', sx = {} }) {
  if (!image?.url) return null;
  return (
    <Box
      component="img"
      src={image.url}
      alt={alt}
      sx={{
        width,
        height,
        objectFit: 'cover',
        display: 'block',
        ...sx
      }}
    />
  );
}

// ─── ModelCard ───────────────────────────────────────────────────
// ComfyUI checkpoint 와 SaaS provider 모델을 동일 카드로 렌더.
// ComfyUI: civitai.{name, baseModel, images, modelUrl}
// SaaS:    provider.{name, capabilities, contextWindow, description}
function ModelCard({ model, selected, onSelect, nsfwImageFilter }) {
  const civ = model.civitai || {};
  const prov = model.provider || {};

  const hasCivitai = civ.found === true;
  const hasProvider = prov.found === true;

  const filteredImages = nsfwImageFilter
    ? (civ.images || []).filter((img) => !img.nsfw)
    : (civ.images || []);
  const previewImage = filteredImages[0];

  // 표시 이름: civitai → provider → filename (확장자 제거)
  const displayName =
    civ.name ||
    prov.name ||
    model.filename.replace(/\.[^/.]+$/, '');

  const baseModel = civ.baseModel;
  const capabilities = prov.capabilities || [];
  const description = civ.description || prov.description;

  return (
    <Card
      variant={selected ? 'elevation' : 'outlined'}
      elevation={selected ? 8 : 0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        borderColor: selected ? 'primary.main' : undefined,
        borderWidth: selected ? 2 : 1,
        '&:hover': { borderColor: 'primary.main' }
      }}
      onClick={() => onSelect(model)}
    >
      {previewImage?.url ? (
        <ModelThumbnail image={previewImage} alt={displayName} />
      ) : (
        <Box
          sx={{
            height: 140,
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
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {selected && <CheckCircleIcon color="primary" fontSize="small" />}
          <Typography variant="subtitle2" noWrap title={displayName} sx={{ flexGrow: 1 }}>
            {displayName}
          </Typography>
        </Stack>

        {(hasCivitai || hasProvider) && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {model.filename}
          </Typography>
        )}

        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {baseModel && (
            <Chip label={baseModel} size="small" color="primary" variant="outlined" />
          )}
          {capabilities.slice(0, 3).map((c) => (
            <Chip key={c} label={c} size="small" variant="outlined" />
          ))}
          {!hasCivitai && !hasProvider && !model.hash && (
            <Tooltip title={model.hashError || '메타데이터 없음 — sync 가 아직 안 됐거나 Civitai/provider 미등록'}>
              <Chip label="메타데이터 없음" size="small" variant="outlined" />
            </Tooltip>
          )}
          {model.hash && !hasCivitai && (
            <Tooltip title="Civitai 미등록 (custom merge / private 모델)">
              <Chip label="미등록" size="small" variant="outlined" />
            </Tooltip>
          )}
        </Box>

        {prov.contextWindow && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            context: {prov.contextWindow.toLocaleString()} tokens
          </Typography>
        )}

        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{
              mt: 1,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {description}
          </Typography>
        )}
      </CardContent>

      {civ.modelUrl && (
        <CardActions sx={{ pt: 0 }}>
          <Tooltip title="Civitai 에서 보기">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                window.open(civ.modelUrl, '_blank');
              }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </CardActions>
      )}
    </Card>
  );
}

// ─── ModelPickerGrid ─────────────────────────────────────────────
// ComfyUI checkpoint + SaaS provider 모델 통합 picker.
// open / onClose / serverId / selectedModel (filename) / onSelectModel(filename) — drop-in 호환 props.
// `?detailed=true` 응답을 카드 그리드로 렌더, search + baseModel 필터 + 페이지네이션 + admin sync 트리거.
function ModelPickerGrid({
  open,
  onClose,
  serverId,
  selectedModel,
  onSelectModel,
  isAdmin = false,
  // 작업판이 허용하는 base 모델 타입 (#252).
  // 빈 배열 또는 미설정 = 제약 없음. 설정 시 해당 타입 매칭 모델 + baseModel 미상 모델만 노출.
  allowedModelTypes = []
}) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [baseModelFilter, setBaseModelFilter] = useState('');
  const [availableBaseModels, setAvailableBaseModels] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });

  const queryClient = useQueryClient();

  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile(), {
    enabled: open && !isAdmin
  });
  const userPreferences = profileData?.data?.user?.preferences || {};
  const nsfwImageFilter = isAdmin ? false : (userPreferences.nsfwImageFilter ?? true);

  const updatePreferencesMutation = useMutation(
    (preferences) => userAPI.updateProfile({ preferences }),
    {
      onSuccess: () => queryClient.invalidateQueries('userProfile')
    }
  );

  const handleNsfwToggle = () => {
    const newValue = !nsfwImageFilter;
    updatePreferencesMutation.mutate({ nsfwImageFilter: newValue });
  };

  const fetchModels = useCallback(
    async (page = 1) => {
      if (!serverId) return;
      setLoading(true);
      setError(null);
      try {
        const params = {
          search: searchQuery,
          baseModel: baseModelFilter,
          page,
          limit: 20
        };
        // 작업판 제약을 backend 로 전달 (server-side 필터 + 페이지네이션 정합).
        // baseModel 미상 모델은 backend 에서 항상 통과 처리됨.
        if (allowedModelTypes.length > 0) {
          params.allowedBaseModels = allowedModelTypes;
        }
        const response = await serverAPI.getDetailedModels(serverId, params);
        const data = response.data.data;
        setModels(data.models || []);
        setPagination(data.pagination || { current: 1, pages: 0, total: 0 });
        setCacheInfo(data.cacheInfo);
        if (data.availableBaseModels) {
          setAvailableBaseModels(data.availableBaseModels);
        }
      } catch (err) {
        console.error('Failed to fetch models:', err);
        setError(err.response?.data?.message || '모델 목록을 가져오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [serverId, searchQuery, baseModelFilter, allowedModelTypes]
  );

  // 동기화 상태 폴링
  useEffect(() => {
    let interval;
    if (syncing && serverId) {
      interval = setInterval(async () => {
        try {
          const response = await serverAPI.getModelsSyncStatus(serverId);
          const status = response.data.data;
          setSyncStatus(status);
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'idle') {
            setSyncing(false);
            if (status.status === 'completed') {
              toast.success('모델 동기화가 완료되었습니다.');
              fetchModels();
            } else if (status.status === 'failed') {
              toast.error(`동기화 실패: ${status.errorMessage || '알 수 없는 오류'}`);
            }
          }
        } catch (err) {
          console.error('Failed to get sync status:', err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [syncing, serverId, fetchModels]);

  // 모달 open 시 모델 fetch + 진행 중인 sync 확인
  useEffect(() => {
    if (open && serverId) {
      fetchModels();
      serverAPI.getModelsSyncStatus(serverId)
        .then((response) => {
          const status = response.data.data;
          setSyncStatus(status);
          if (status.status === 'fetching') {
            setSyncing(true);
          }
        })
        .catch(console.error);
    }
  }, [open, serverId, fetchModels]);

  // search/filter 변경 시 debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) fetchModels(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, baseModelFilter, open, fetchModels]);

  const handleSync = async (forceRefresh = false) => {
    if (!serverId) return;
    try {
      setSyncing(true);
      await serverAPI.syncModels(serverId, { forceRefresh });
      toast.success('모델 동기화를 시작했습니다.');
    } catch (err) {
      console.error('Sync failed:', err);
      toast.error(err.response?.data?.message || '동기화 시작 실패');
      setSyncing(false);
    }
  };

  const handleSelect = (model) => {
    onSelectModel(model.filename);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">모델 선택</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* 컨트롤 영역 */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField
            placeholder="이름 / 파일명 / 트리거워드 검색"
            size="small"
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          {availableBaseModels.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>베이스 모델</InputLabel>
              <Select
                value={baseModelFilter}
                label="베이스 모델"
                onChange={(e) => setBaseModelFilter(e.target.value)}
              >
                <MenuItem value="">전체</MenuItem>
                {(allowedModelTypes.length > 0
                  ? availableBaseModels.filter((bm) => allowedModelTypes.includes(bm))
                  : availableBaseModels
                ).map((bm) => (
                  <MenuItem key={bm} value={bm}>
                    {bm}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Tooltip title="모델 메타데이터 동기화 (관리자만)">
            <span>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => handleSync(false)}
                disabled={syncing || !isAdmin}
              >
                {syncing ? '동기화 중...' : '동기화'}
              </Button>
            </span>
          </Tooltip>
        </Stack>

        {!isAdmin && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={nsfwImageFilter}
                onChange={handleNsfwToggle}
                disabled={updatePreferencesMutation.isLoading}
              />
            }
            label={
              <Typography variant="caption">
                NSFW 미리보기 이미지 숨기기
              </Typography>
            }
            sx={{ mb: 1 }}
          />
        )}

        {/* 캐시 정보 */}
        {cacheInfo && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {cacheInfo.lastFetched && `마지막 조회: ${new Date(cacheInfo.lastFetched).toLocaleString('ko-KR')}`}
              {cacheInfo.lastMetadataSync && ` · 메타 동기화: ${new Date(cacheInfo.lastMetadataSync).toLocaleString('ko-KR')}`}
              {cacheInfo.hashNodeAvailable === false && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  ComfyUI 의 vcc-file-hash 노드가 설치되지 않아 해시 기반 메타데이터를 가져올 수 없습니다.
                </Alert>
              )}
            </Typography>
          </Box>
        )}

        {/* 동기화 진행 표시 */}
        {syncing && syncStatus && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption">
                {syncStatus.progress?.stage === 'checking_node' && '노드 확인 중...'}
                {syncStatus.progress?.stage === 'fetching_list' && '모델 목록 조회 중...'}
                {syncStatus.progress?.stage === 'fetching_metadata' && '메타데이터 가져오는 중...'}
              </Typography>
              {syncStatus.progress?.total > 0 && (
                <Typography variant="caption">
                  {syncStatus.progress.current} / {syncStatus.progress.total}
                </Typography>
              )}
            </Stack>
            <LinearProgress
              variant={syncStatus.progress?.total > 0 ? 'determinate' : 'indeterminate'}
              value={
                syncStatus.progress?.total > 0
                  ? (syncStatus.progress.current / syncStatus.progress.total) * 100
                  : 0
              }
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        ) : models.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              모델이 없습니다.
            </Typography>
            {isAdmin && (
              <Typography variant="caption" color="text.secondary">
                상단 "동기화" 버튼으로 모델 목록을 가져오세요.
              </Typography>
            )}
          </Box>
        ) : (
          <>
            {allowedModelTypes.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  작업판 허용 타입:
                </Typography>
                {allowedModelTypes.map((t) => (
                  <Chip key={t} label={t} size="small" color="primary" variant="outlined" />
                ))}
                <Typography variant="caption" color="text.secondary">
                  + 메타데이터 없는 모델
                </Typography>
              </Box>
            )}
            <Grid container spacing={2}>
              {models.map((model) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={model.filename}>
                  <ModelCard
                    model={model}
                    selected={selectedModel === model.filename}
                    onSelect={handleSelect}
                    nsfwImageFilter={nsfwImageFilter}
                  />
                </Grid>
              ))}
            </Grid>
            {pagination.pages > 1 && (
              <Box mt={2} display="flex" justifyContent="center">
                <Pagination
                  currentPage={pagination.current}
                  totalPages={pagination.pages}
                  totalItems={pagination.total}
                  onPageChange={(p) => fetchModels(p)}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ModelPickerGrid;
