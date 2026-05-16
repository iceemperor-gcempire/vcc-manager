import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  LinearProgress,
  Alert,
  Tooltip,
  Stack,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  RestartAlt as RestartAltIcon,
  DeleteSweep as DeleteSweepIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  ViewStream as ImageListIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import Pagination from '../common/Pagination';
import MetadataItemCard from '../common/MetadataItemCard';
import MetadataItemGrid from '../common/MetadataItemGrid';
import MetadataDetailDialog from '../common/MetadataDetailDialog';
import MetadataImageListItem from './MetadataImageListItem';
import { normalizeLora, normalizeModel } from '../../utils/metadataItem';
import { serverAPI } from '../../services/api';

const VIEW_MODE_KEY_PREFIX = 'vcc.metadataAdmin.viewMode.';
const PAGE_SIZE = 24;

// kind 별 API / 정규화 / 라벨 어댑터 (#344)
const ADAPTERS = {
  model: {
    fetch: (serverId, params) => serverAPI.getDetailedModels(serverId, params),
    sync: (serverId) => serverAPI.syncModels(serverId, { forceRefresh: true }),
    getStatus: (serverId) => serverAPI.getModelsSyncStatus(serverId),
    resetSync: (serverId) => serverAPI.resetModelsSync(serverId),
    clearCache: (serverId) => serverAPI.clearModelCache(serverId),
    extractList: (data) => data?.models || [],
    extractPagination: (data) => data?.pagination || { current: 1, pages: 0, total: 0 },
    extractCacheInfo: (data) => data?.cacheInfo || null,
    extractAvailableBaseModels: (data) => data?.availableBaseModels || [],
    extractTotal: (status, pagination) => status?.totalModels || pagination?.total || 0,
    extractMetaCount: (status) => status?.modelsWithMetadata,
    extractLastSync: (info, status) => info?.lastMetadataSync || status?.lastMetadataSync,
    normalize: (raw, serverType) => normalizeModel(raw, { serverType }),
    label: '베이스 모델',
    searchPlaceholder: '모델 검색...',
    cacheDialogTitle: '베이스 모델 캐시 완전 삭제',
    cacheDialogBody: '선택한 서버의 모델 캐시를 모두 비웁니다. 다음 동기화부터 hash 부터 재계산됩니다.',
    emptyMessage: '베이스 모델이 없습니다.',
  },
  lora: {
    fetch: (serverId, params) => serverAPI.getLoras(serverId, params),
    sync: (serverId) => serverAPI.syncLoras(serverId, { forceRefresh: true }),
    getStatus: (serverId) => serverAPI.getLorasSyncStatus(serverId),
    resetSync: (serverId) => serverAPI.resetLorasSync(serverId),
    clearCache: (serverId) => serverAPI.clearLoraCache(serverId),
    extractList: (data) => data?.loraModels || [],
    extractPagination: (data) => data?.pagination || { current: 1, pages: 0, total: 0 },
    extractCacheInfo: (data) => data?.cacheInfo || null,
    extractAvailableBaseModels: (data) => data?.availableBaseModels || [],
    extractTotal: (status, pagination) => status?.totalLoras || pagination?.total || 0,
    extractMetaCount: (status) => status?.lorasWithMetadata,
    extractLastSync: (info, status) => info?.lastCivitaiSync || status?.lastCivitaiSync,
    normalize: (raw) => normalizeLora(raw),
    label: 'LoRA',
    searchPlaceholder: 'LoRA 검색...',
    cacheDialogTitle: 'LoRA 캐시 완전 삭제',
    cacheDialogBody: '선택한 서버의 LoRA 캐시를 모두 비웁니다. 다음 동기화부터 hash 부터 재계산됩니다.',
    emptyMessage: 'LoRA 가 없습니다.',
  }
};

function formatDate(dateString) {
  if (!dateString) return '없음';
  return new Date(dateString).toLocaleString('ko-KR');
}

// 베이스 모델 / LoRA admin 페이지 공용 본문 (#344).
// 검색 + view mode 토글 + 동기화 / 캐시 삭제 / 리셋 + 캐시 info + 결과 (3종 view mode).
function MetadataManagementBody({ kind, selectedServerId, selectedServer, nsfwModelFilter = true }) {
  // adapter 가 없으면 빈 객체로 fallback — hook order 보존을 위해 조건부 return 사용 안 함.
  const adapter = ADAPTERS[kind] || ADAPTERS.model;

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });
  const [cacheInfo, setCacheInfo] = useState(null);
  const [availableBaseModels, setAvailableBaseModels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [baseModelFilter, setBaseModelFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [clearCacheConfirmOpen, setClearCacheConfirmOpen] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  // view mode 는 kind 별 localStorage 영속화
  const viewModeKey = `${VIEW_MODE_KEY_PREFIX}${kind}`;
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(viewModeKey) || 'grid');
  useEffect(() => { localStorage.setItem(viewModeKey, viewMode); }, [viewModeKey, viewMode]);

  // 데이터 fetch
  const fetchItems = useCallback(async (page = 1) => {
    if (!selectedServerId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await adapter.fetch(selectedServerId, {
        search: searchQuery,
        baseModel: baseModelFilter,
        page,
        limit: PAGE_SIZE
      });
      const data = response.data?.data || response.data || {};
      setItems(adapter.extractList(data));
      setPagination(adapter.extractPagination(data));
      setCacheInfo(adapter.extractCacheInfo(data));
      const avail = adapter.extractAvailableBaseModels(data);
      if (avail) setAvailableBaseModels(avail);
    } catch (err) {
      console.error(`Failed to fetch ${kind}:`, err);
      setError(err.response?.data?.message || `${adapter.label} 목록을 가져오는데 실패했습니다.`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServerId, searchQuery, baseModelFilter, kind]);

  // sync 폴링
  useEffect(() => {
    if (!syncing || !selectedServerId) return undefined;
    const interval = setInterval(async () => {
      try {
        const r = await adapter.getStatus(selectedServerId);
        const status = r.data.data;
        setSyncStatus(status);
        if (['completed', 'failed', 'idle'].includes(status.status)) {
          setSyncing(false);
          if (status.status === 'completed') {
            toast.success(`${adapter.label} 동기화가 완료되었습니다.`);
            fetchItems(1);
          } else if (status.status === 'failed') {
            toast.error(`동기화 실패: ${status.errorMessage || '알 수 없는 오류'}`);
          }
        }
      } catch (err) {
        console.error('Failed to get sync status:', err);
      }
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing, selectedServerId, kind]);

  // 서버 변경 시 reset + fetch
  useEffect(() => {
    if (!selectedServerId) {
      setItems([]);
      setCacheInfo(null);
      setSyncStatus(null);
      setAvailableBaseModels([]);
      setPagination({ current: 1, pages: 0, total: 0 });
      return;
    }
    fetchItems(1);
    adapter.getStatus(selectedServerId)
      .then((r) => {
        const status = r.data.data;
        setSyncStatus(status);
        if (status.status === 'fetching') setSyncing(true);
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServerId, kind]);

  // search/filter debounce
  useEffect(() => {
    if (!selectedServerId) return undefined;
    const timer = setTimeout(() => fetchItems(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, baseModelFilter]);

  const handleSync = async () => {
    if (!selectedServerId) {
      toast.error('서버를 선택해주세요.');
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      await adapter.sync(selectedServerId);
      toast.success(`${adapter.label} 동기화가 시작되었습니다.`);
    } catch (err) {
      setSyncing(false);
      toast.error(err.response?.data?.message || '동기화 시작 실패');
    }
  };

  const handleResetSync = async () => {
    if (!selectedServerId) return;
    try {
      await adapter.resetSync(selectedServerId);
      toast.success('동기화 상태가 초기화되었습니다.');
      const r = await adapter.getStatus(selectedServerId);
      setSyncStatus(r.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || '리셋 실패');
    }
  };

  const handleClearCache = async () => {
    if (!selectedServerId) return;
    setClearingCache(true);
    try {
      await adapter.clearCache(selectedServerId);
      toast.success(`${adapter.label} 캐시를 비웠습니다. 다음 동기화부터 hash 부터 재계산됩니다.`);
      setClearCacheConfirmOpen(false);
      setItems([]);
      setCacheInfo(null);
      setAvailableBaseModels([]);
      setPagination({ current: 1, pages: 0, total: 0 });
      const r = await adapter.getStatus(selectedServerId);
      setSyncStatus(r.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || '캐시 삭제 실패');
    } finally {
      setClearingCache(false);
    }
  };

  // NSFW 모델 필터
  const filteredItems = useMemo(() => {
    if (!nsfwModelFilter) return items;
    return items.filter((it) => !it?.civitai?.nsfw);
  }, [items, nsfwModelFilter]);

  // 정규화된 아이템 리스트 (렌더 시점에 normalize)
  const renderItems = filteredItems.map((raw) => {
    const item = adapter.normalize(raw, selectedServer?.serverType);
    return { raw, item };
  }).filter(({ item }) => !!item);

  if (!selectedServerId) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        호환되는 서버를 먼저 선택해주세요.
      </Alert>
    );
  }

  return (
    <Box sx={{ overflow: 'hidden' }}>
      {/* 동기화 진행 표시 */}
      {syncing && syncStatus && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              동기화 중: {syncStatus.progress?.stage || 'processing'}
              {syncStatus.progress?.total > 0 && ` (${syncStatus.progress.current}/${syncStatus.progress.total})`}
            </Typography>
          </Box>
          {syncStatus.progress?.total > 0 && (
            <LinearProgress
              variant="determinate"
              value={(syncStatus.progress.current / syncStatus.progress.total) * 100}
            />
          )}
        </Box>
      )}

      {/* 검색 + 필터 + 액션 */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder={adapter.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flex: '1 1 200px', minWidth: 200 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
          }}
        />
        {availableBaseModels.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>베이스 모델</InputLabel>
            <Select
              value={baseModelFilter}
              label="베이스 모델"
              onChange={(e) => setBaseModelFilter(e.target.value)}
            >
              <MenuItem value="">전체</MenuItem>
              {availableBaseModels.map((bm) => (
                <MenuItem key={bm} value={bm}>{bm}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
        >
          <ToggleButton value="grid" title="이미지 그리드">
            <GridViewIcon />
          </ToggleButton>
          <ToggleButton value="image-list" title="이미지 리스트">
            <ImageListIcon />
          </ToggleButton>
          <ToggleButton value="list" title="텍스트 리스트">
            <ListViewIcon />
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={`${adapter.label} 메타데이터 동기화`}>
          <span>
            <Button
              variant="contained"
              size="small"
              startIcon={syncing ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={handleSync}
              disabled={!selectedServerId || syncing}
            >
              동기화
            </Button>
          </span>
        </Tooltip>
        {syncStatus?.status === 'failed' && (
          <Tooltip title={`강제 리셋 — 오류: ${syncStatus.errorMessage || '알 수 없음'}`}>
            <Button variant="outlined" color="warning" size="small" startIcon={<RestartAltIcon />} onClick={handleResetSync}>
              리셋
            </Button>
          </Tooltip>
        )}
        <Tooltip title="모든 hash + civitai 메타데이터 삭제 (다음 동기화는 시간이 오래 걸림)">
          <span>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteSweepIcon />}
              onClick={() => setClearCacheConfirmOpen(true)}
              disabled={!selectedServerId || syncing || clearingCache}
            >
              캐시 삭제
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* 캐시 info 패널 */}
      {cacheInfo && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">서버</Typography>
              <Typography variant="body2">{selectedServer?.name || '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">총 {adapter.label}</Typography>
              <Typography variant="body2">{adapter.extractTotal(syncStatus, pagination)}개</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">메타데이터 있음</Typography>
              <Typography variant="body2">{adapter.extractMetaCount(syncStatus) ?? '-'}개</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">마지막 메타 동기화</Typography>
              <Typography variant="body2">{formatDate(adapter.extractLastSync(cacheInfo, syncStatus))}</Typography>
            </Box>
          </Stack>
          {cacheInfo?.hashNodeAvailable === false && selectedServer?.serverType === 'ComfyUI' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              ComfyUI 의 vcc-file-hash 노드가 설치되지 않아 해시 기반 메타데이터를 가져올 수 없습니다.
            </Alert>
          )}
        </Paper>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
        </Box>
      ) : renderItems.length === 0 ? (
        <Box textAlign="center" py={4}>
          <Typography variant="body2" color="text.secondary">
            {searchQuery || baseModelFilter ? '검색 결과가 없습니다.' : adapter.emptyMessage}
          </Typography>
        </Box>
      ) : (
        <>
          {viewMode === 'grid' && (
            <MetadataItemGrid
              items={renderItems}
              getKey={({ raw }, index) => raw?.filename || index}
              renderItem={({ item }) => (
                <MetadataItemCard
                  item={item}
                  onDetailClick={() => setDetailItem(item)}
                  nsfwImageFilter={false}
                />
              )}
            />
          )}

          {viewMode === 'image-list' && (
            <Box>
              {renderItems.map(({ raw, item }, idx) => (
                <MetadataImageListItem
                  key={raw?.filename || idx}
                  item={item}
                  onDetailClick={() => setDetailItem(item)}
                  nsfwImageFilter={false}
                />
              ))}
            </Box>
          )}

          {viewMode === 'list' && (
            <Box>
              {renderItems.map(({ raw, item }, idx) => (
                <Box
                  key={raw?.filename || idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 1,
                    px: 1.5,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                    <Typography variant="body2" noWrap title={item.displayName} sx={{ fontWeight: 500 }}>
                      {item.displayName}
                      {item.versionName && (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          ({item.versionName})
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap title={item.filename} sx={{ fontFamily: 'monospace' }}>
                      {item.filename}
                    </Typography>
                  </Box>
                  {item.baseModel && (
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {item.baseModel}
                    </Typography>
                  )}
                  {!item.hasMetadata && (
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontStyle: 'italic' }}>
                      {item.hash ? '미등록' : '메타 없음'}
                    </Typography>
                  )}
                  <Button size="small" onClick={() => setDetailItem(item)}>상세</Button>
                </Box>
              ))}
            </Box>
          )}

          {pagination.pages > 1 && (
            <Box mt={2} display="flex" justifyContent="center">
              <Pagination
                currentPage={pagination.current}
                totalPages={pagination.pages}
                totalItems={pagination.total}
                onPageChange={(p) => fetchItems(p)}
              />
            </Box>
          )}
        </>
      )}

      <MetadataDetailDialog
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        nsfwImageFilter={false}
      />

      <Dialog open={clearCacheConfirmOpen} onClose={() => setClearCacheConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{adapter.cacheDialogTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {adapter.cacheDialogBody}
            <br /><br />
            • 모든 hash, civitai 메타데이터가 삭제됩니다.<br />
            • 다음 동기화는 hash 부터 다시 계산하므로 시간이 오래 걸릴 수 있습니다.<br />
            • 일반 "동기화" 는 hash 를 재사용하므로 빠릅니다 — 이 작업은 처음부터 다시 받아야 할 때만 사용하세요.<br /><br />
            계속하시겠어요?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearCacheConfirmOpen(false)} disabled={clearingCache}>취소</Button>
          <Button
            onClick={handleClearCache}
            color="error"
            variant="contained"
            disabled={clearingCache}
            startIcon={clearingCache ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
          >
            캐시 삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MetadataManagementBody;
