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
  Close as CloseIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI, workboardAPI, userAPI } from '../../services/api';
import Pagination from './Pagination';
import MetadataItemCard from './MetadataItemCard';
import MetadataItemGrid from './MetadataItemGrid';
import { normalizeLora, normalizeModel } from '../../utils/metadataItem';

// ─── Per-kind API adapters ────────────────────────────────────────
// kind 별 fetch / sync / status / normalize / 응답 필드명을 한 곳에서 관리.
// 안정적인 빈 배열 reference — `allowedModelTypes = []` default 가 매 render 마다 새 array 를
// 만들어 useCallback / useEffect 의존성을 깨면서 무한 fetch loop 를 일으키던 버그 수정.
const EMPTY_ALLOWED_MODEL_TYPES = Object.freeze([]);

const KIND_ADAPTERS = {
  lora: {
    fetch: ({ serverId, workboardId, search, baseModel, page, limit }) => {
      if (serverId) {
        // workboardId 전달 시 backend 가 작업판의 loraExposurePolicy / loraWhitelist 적용 (#198 Phase D)
        const params = { search, baseModel, page, limit };
        if (workboardId) params.workboardId = workboardId;
        return serverAPI.getLoras(serverId, params);
      }
      return workboardAPI.getLoraModels(workboardId);
    },
    extractList: (responseData) => responseData?.loraModels || [],
    extractPagination: (responseData) => responseData?.pagination || { current: 1, pages: 0, total: 0 },
    extractCacheInfo: (responseData, fallback = false) => {
      if (fallback) {
        return {
          lastFetched: responseData?.lastFetched,
          lastCivitaiSync: responseData?.lastCivitaiSync,
          hashNodeAvailable: responseData?.loraInfoNodeAvailable
        };
      }
      return responseData?.cacheInfo || null;
    },
    extractAvailableBaseModels: (responseData) => responseData?.availableBaseModels || null,
    sync: (serverId) => serverAPI.syncLoras(serverId),
    getStatus: (serverId) => serverAPI.getLorasSyncStatus(serverId),
    normalize: normalizeLora,
    label: 'LoRA',
    listLabel: 'LoRA',
    nsfwItemPreference: 'nsfwLoraFilter',  // 사용자 preferences key — NSFW LoRA item 자체 숨김
  },
  model: {
    fetch: ({ serverId, workboardId, search, baseModel, allowedBaseModels, page, limit }) => {
      const params = { search, baseModel, page, limit };
      if (allowedBaseModels && allowedBaseModels.length > 0) {
        params.allowedBaseModels = allowedBaseModels;
      }
      // workboardId 전달 시 backend 가 작업판의 modelExposurePolicy / modelWhitelist 적용 (#198 Phase D)
      if (workboardId) params.workboardId = workboardId;
      return serverAPI.getDetailedModels(serverId, params);
    },
    extractList: (responseData) => responseData?.models || [],
    extractPagination: (responseData) => responseData?.pagination || { current: 1, pages: 0, total: 0 },
    extractCacheInfo: (responseData) => responseData?.cacheInfo || null,
    extractAvailableBaseModels: (responseData) => responseData?.availableBaseModels || null,
    sync: (serverId) => serverAPI.syncModels(serverId),
    getStatus: (serverId) => serverAPI.getModelsSyncStatus(serverId),
    normalize: normalizeModel,
    label: '베이스 모델',
    listLabel: '베이스 모델',
    nsfwItemPreference: null  // model 은 현재 NSFW item 필터 없음
  }
};

/**
 * 공통 메타데이터 picker modal — LoRA / Model 양쪽 사용.
 *
 * @param {Object} props
 * @param {'lora'|'model'} props.kind
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.serverId]
 * @param {string} [props.workboardId] — LoRA fallback (server 정보 없는 사용자 컨텍스트)
 * @param {boolean} [props.isAdmin]
 * @param {'select-single'|'multi-add'|'prompt-insert'} [props.mode]
 * @param {string} [props.selectedItem] — select-single 강조용 (filename)
 * @param {(rawItem) => void} props.onPrimary — 카드 primary 액션 콜백
 * @param {(word, rawItem) => void} [props.onTrainedWordClick] — prompt-insert 모드의 트리거 워드 클릭
 * @param {string[]} [props.allowedModelTypes] — Model picker 의 작업판 제약 (#252)
 * @param {string} [props.title] — 다이얼로그 제목 (기본: "<label> 선택")
 */
function MetadataPickerModal({
  kind,
  open,
  onClose,
  serverId,
  workboardId,
  isAdmin = false,
  mode = 'select-single',
  selectedItem,
  onPrimary,
  onTrainedWordClick,
  allowedModelTypes = EMPTY_ALLOWED_MODEL_TYPES,
  title
}) {
  // 잘못된 kind 는 internal API 위반 — KIND_ADAPTERS 에 없으면 빈 객체로 fallback,
  // hook order 보장 위해 early return 사용 안 함. 호출자가 잘못된 kind 를 넘기면
  // adapter.fetch 등 호출이 실패하면서 사용자에게 에러로 표시됨.
  const adapter = KIND_ADAPTERS[kind] || {};

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [baseModelFilter, setBaseModelFilter] = useState('');
  const [availableBaseModels, setAvailableBaseModels] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });
  const [expandedId, setExpandedId] = useState(null);

  const queryClient = useQueryClient();

  const { data: profileData } = useQuery('userProfile', () => userAPI.getProfile(), {
    enabled: open && !isAdmin
  });
  const userPreferences = profileData?.data?.user?.preferences || {};
  const nsfwImageFilter = isAdmin ? false : (userPreferences.nsfwImageFilter ?? true);
  const nsfwItemFilter = !isAdmin && adapter.nsfwItemPreference
    ? (userPreferences[adapter.nsfwItemPreference] ?? true)
    : false;

  const updatePreferencesMutation = useMutation(
    (preferences) => userAPI.updateProfile({ preferences }),
    {
      onSuccess: () => queryClient.invalidateQueries('userProfile')
    }
  );

  const handleNsfwImageToggle = () => {
    updatePreferencesMutation.mutate({ nsfwImageFilter: !nsfwImageFilter });
  };

  const handleNsfwItemToggle = () => {
    if (!adapter.nsfwItemPreference) return;
    updatePreferencesMutation.mutate({ [adapter.nsfwItemPreference]: !nsfwItemFilter });
  };

  const fetchItems = useCallback(
    async (page = 1) => {
      if (!serverId && !workboardId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await adapter.fetch({
          serverId,
          workboardId,
          search: searchQuery,
          baseModel: baseModelFilter,
          allowedBaseModels: allowedModelTypes,
          page,
          limit: 20
        });
        // serverAPI 는 response.data.data, workboardAPI 는 response.data 구조
        const responseData = response.data?.data || response.data;
        setItems(adapter.extractList(responseData));
        setPagination(adapter.extractPagination(responseData));
        const isWorkboardFallback = !serverId && !!workboardId;
        setCacheInfo(adapter.extractCacheInfo(responseData, isWorkboardFallback));
        const bm = adapter.extractAvailableBaseModels(responseData);
        if (bm) setAvailableBaseModels(bm);
      } catch (err) {
        console.error(`Failed to fetch ${kind}:`, err);
        setError(err.response?.data?.message || `${adapter.listLabel} 목록을 가져오는데 실패했습니다.`);
      } finally {
        setLoading(false);
      }
    },
    [serverId, workboardId, searchQuery, baseModelFilter, allowedModelTypes, kind, adapter]
  );

  // sync 폴링
  useEffect(() => {
    let interval;
    if (syncing && serverId) {
      interval = setInterval(async () => {
        try {
          const response = await adapter.getStatus(serverId);
          const status = response.data.data;
          setSyncStatus(status);
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'idle') {
            setSyncing(false);
            if (status.status === 'completed') {
              toast.success(`${adapter.label} 동기화가 완료되었습니다.`);
              fetchItems();
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
  }, [syncing, serverId, adapter, fetchItems]);

  // 모달 open 시 fetch + 진행 중 sync 확인
  useEffect(() => {
    if (open && (serverId || workboardId)) {
      fetchItems();
      if (serverId) {
        adapter.getStatus(serverId)
          .then((response) => {
            const status = response.data.data;
            setSyncStatus(status);
            if (status.status === 'fetching') setSyncing(true);
          })
          .catch(console.error);
      }
    }
  }, [open, serverId, workboardId, fetchItems, adapter]);

  // search/filter 변경 debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) fetchItems(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, baseModelFilter, open, fetchItems]);

  const handleSync = async () => {
    if (!serverId) return;
    try {
      setSyncing(true);
      await adapter.sync(serverId);
      toast.success(`${adapter.label} 동기화를 시작했습니다.`);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncing(false);
      toast.error(err.response?.data?.message || '동기화 시작 실패');
    }
  };

  const handlePrimary = (rawItem) => {
    if (onPrimary) onPrimary(rawItem);
    if (mode === 'select-single' && onClose) onClose();
  };

  // NSFW item filter (LoRA 의 NSFW LoRA 자체 숨김)
  const filteredItems = nsfwItemFilter
    ? items.filter((raw) => !raw.civitai?.nsfw)
    : items;

  // dropdown 의 baseModel 옵션을 allowedModelTypes 와 교집합 (Model 의 작업판 제약)
  const dropdownBaseModels = allowedModelTypes.length > 0
    ? availableBaseModels.filter((bm) => allowedModelTypes.includes(bm))
    : availableBaseModels;

  const cardPrimaryVariant = mode === 'prompt-insert' ? 'insert' : (mode === 'multi-add' ? 'add' : 'select');
  const cardClickable = mode === 'select-single';

  const resolvedTitle = title || `${adapter.label} 선택`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{resolvedTitle}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
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
          {dropdownBaseModels.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>베이스 모델</InputLabel>
              <Select
                value={baseModelFilter}
                label="베이스 모델"
                onChange={(e) => setBaseModelFilter(e.target.value)}
              >
                <MenuItem value="">전체</MenuItem>
                {dropdownBaseModels.map((bm) => (
                  <MenuItem key={bm} value={bm}>
                    {bm}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {serverId && (
            <Tooltip title={isAdmin ? `${adapter.label} 메타데이터 동기화` : `${adapter.label} 메타데이터 동기화 (관리자만)`}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={handleSync}
                  disabled={syncing || !isAdmin}
                >
                  {syncing ? '동기화 중...' : '동기화'}
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>

        {!isAdmin && (
          <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={nsfwImageFilter}
                  onChange={handleNsfwImageToggle}
                  disabled={updatePreferencesMutation.isLoading}
                />
              }
              label={<Typography variant="caption">NSFW 미리보기 이미지 숨기기</Typography>}
            />
            {adapter.nsfwItemPreference && (
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={nsfwItemFilter}
                    onChange={handleNsfwItemToggle}
                    disabled={updatePreferencesMutation.isLoading}
                  />
                }
                label={<Typography variant="caption">NSFW {adapter.label} 숨기기</Typography>}
              />
            )}
          </Stack>
        )}

        {cacheInfo && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {cacheInfo.lastFetched && `마지막 조회: ${new Date(cacheInfo.lastFetched).toLocaleString('ko-KR')}`}
              {(cacheInfo.lastMetadataSync || cacheInfo.lastCivitaiSync) && ` · 메타 동기화: ${new Date(cacheInfo.lastMetadataSync || cacheInfo.lastCivitaiSync).toLocaleString('ko-KR')}`}
            </Typography>
            {cacheInfo.hashNodeAvailable === false && (
              <Alert severity="info" sx={{ mt: 1 }}>
                ComfyUI 의 vcc-file-hash 노드가 설치되지 않아 해시 기반 메타데이터를 가져올 수 없습니다.
              </Alert>
            )}
          </Box>
        )}

        {/* 작업판 허용 모델 타입 안내 (Model 만) */}
        {kind === 'model' && allowedModelTypes.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              작업판 허용 타입:
            </Typography>
            {allowedModelTypes.map((t) => (
              <Chip key={t} label={t} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        )}

        {syncing && syncStatus && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption">
                {syncStatus.progress?.stage === 'checking_node' && '노드 확인 중...'}
                {syncStatus.progress?.stage === 'fetching_list' && '목록 조회 중...'}
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
        ) : filteredItems.length === 0 ? (
          <Box textAlign="center" py={4}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {adapter.listLabel} 항목이 없습니다.
            </Typography>
            {isAdmin && serverId && (
              <Typography variant="caption" color="text.secondary">
                상단 "동기화" 버튼으로 목록을 가져오세요.
              </Typography>
            )}
            {nsfwItemFilter && items.length > 0 && (
              <Typography variant="caption" color="text.secondary" display="block">
                ({items.length - filteredItems.length}개 NSFW 숨김)
              </Typography>
            )}
          </Box>
        ) : (
          <>
            <MetadataItemGrid
              items={filteredItems}
              getKey={(rawItem, index) => rawItem.filename || index}
              renderItem={(rawItem) => {
                const item = adapter.normalize(rawItem);
                if (!item) return null;
                return (
                  <MetadataItemCard
                    item={item}
                    selected={selectedItem === item.filename}
                    expanded={expandedId === item.id}
                    onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onPrimary={() => handlePrimary(rawItem)}
                    primaryVariant={cardPrimaryVariant}
                    cardClickable={cardClickable}
                    onTrainedWordClick={onTrainedWordClick ? (word) => onTrainedWordClick(word, rawItem) : undefined}
                    trainedWordInsertMode={mode === 'prompt-insert'}
                    nsfwImageFilter={nsfwImageFilter}
                  />
                );
              }}
            />
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default MetadataPickerModal;
