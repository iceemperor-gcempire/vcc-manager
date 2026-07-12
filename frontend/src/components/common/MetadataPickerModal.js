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
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  ViewStream as ImageListIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userAPI } from '../../services/api';
import Pagination from './Pagination';
import MetadataItemCard from './MetadataItemCard';
import MetadataItemGrid from './MetadataItemGrid';
import MetadataDetailDialog from './MetadataDetailDialog';
import MetadataImageListItem from '../admin/MetadataImageListItem';
import { METADATA_ADAPTERS } from '../../utils/metadataAdapters';
import useMetadataSyncPolling, { checkInitialSyncStatus } from '../../hooks/useMetadataSyncPolling';

const VIEW_MODE_KEY_PREFIX = 'vcc.picker.viewMode.';

// 안정적인 빈 배열 reference — `allowedModelTypes = []` default 가 매 render 마다 새 array 를
// 만들어 useCallback / useEffect 의존성을 깨면서 무한 fetch loop 를 일으키던 버그 수정.
const EMPTY_ALLOWED_MODEL_TYPES = Object.freeze([]);

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
  outputFormat,
  isAdmin = false,
  mode = 'select-single',
  selectedItem,
  selectedItems = EMPTY_ALLOWED_MODEL_TYPES,  // multi-add 모드의 현재 선택 목록 (#277)
  onPrimary,
  onTrainedWordClick,
  allowedModelTypes = EMPTY_ALLOWED_MODEL_TYPES,
  title
}) {
  // 잘못된 kind 는 internal API 위반 — METADATA_ADAPTERS 에 없으면 빈 객체로 fallback,
  // hook order 보장 위해 early return 사용 안 함. 호출자가 잘못된 kind 를 넘기면
  // adapter.fetch 등 호출이 실패하면서 사용자에게 에러로 표시됨.
  const adapter = METADATA_ADAPTERS[kind] || {};

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
  const [detailItem, setDetailItem] = useState(null);

  // view mode 는 kind 별 localStorage 영속화 (#346)
  const viewModeKey = `${VIEW_MODE_KEY_PREFIX}${kind}`;
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(viewModeKey) || 'grid');
  useEffect(() => { localStorage.setItem(viewModeKey, viewMode); }, [viewModeKey, viewMode]);

  const queryClient = useQueryClient();

  const { data: profileData } = useQuery({ queryKey: ['userProfile'], queryFn: () => userAPI.getProfile(),
    enabled: open && !isAdmin });
  const userPreferences = profileData?.data?.user?.preferences || {};
  const nsfwImageFilter = isAdmin ? false : (userPreferences.nsfwImageFilter ?? true);
  // nsfwModelFilter 우선, 없으면 legacy nsfwLoraFilter fallback (#346)
  const nsfwItemFilter = !isAdmin && adapter.nsfwItemPreference
    ? (userPreferences[adapter.nsfwItemPreference] ?? userPreferences.nsfwLoraFilter ?? true)
    : false;

  const updatePreferencesMutation = useMutation({ mutationFn: (preferences) => userAPI.updateProfile({ preferences }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userProfile'] }) });

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
          outputFormat,
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
    [serverId, workboardId, searchQuery, baseModelFilter, allowedModelTypes, outputFormat, kind, adapter]
  );

  // sync 폴링 — 공용 hook (#697)
  useMetadataSyncPolling({
    adapter,
    serverId,
    syncing,
    setSyncing,
    setSyncStatus,
    onCompleted: () => fetchItems(),
  });

  // 모달 open 시 fetch + 진행 중 sync 확인
  useEffect(() => {
    if (open && (serverId || workboardId)) {
      fetchItems();
      if (serverId) {
        checkInitialSyncStatus(adapter, serverId, { setSyncStatus, setSyncing });
      }
    }
  }, [open, serverId, workboardId, fetchItems, adapter]);

  // search / baseModel 변경 시 debounce fetch. `open` 은 의존성에서 제외 —
  // 모달 open 시 최초 fetch 는 위 useEffect 가 담당하며, 여기 포함하면 중복 fetch 로
  // 카드 그리드가 잠깐 깜박임 (#324).
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => fetchItems(1), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, baseModelFilter, fetchItems]);

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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        // 검색 입력 시 결과 영역 height 변화로 다이얼로그 전체가 덜컹거리는 문제 방지 (#354)
        sx: { height: '85vh' }
      }}
    >
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
        </Stack>

        {/* multi-add 모드 선택 카운트 안내 (#277) */}
        {mode === 'multi-add' && (
          <Box sx={{ mb: 1.5 }}>
            <Chip
              label={`${selectedItems.length}개 선택됨`}
              color={selectedItems.length > 0 ? 'primary' : 'default'}
              variant="outlined"
            />
          </Box>
        )}

        {!isAdmin && (
          <Stack direction="row" spacing={2} sx={{ mb: 1, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={nsfwImageFilter}
                  onChange={handleNsfwImageToggle}
                  disabled={updatePreferencesMutation.isPending}
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
                    disabled={updatePreferencesMutation.isPending}
                  />
                }
                label={<Typography variant="caption">{adapter.nsfwItemLabel || `NSFW ${adapter.label} 숨기기`}</Typography>}
              />
            )}
          </Stack>
        )}

        {cacheInfo && (cacheInfo.lastFetched || cacheInfo.lastMetadataSync || cacheInfo.lastCivitaiSync) && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {cacheInfo.lastFetched && `마지막 조회: ${new Date(cacheInfo.lastFetched).toLocaleString('ko-KR')}`}
              {(cacheInfo.lastMetadataSync || cacheInfo.lastCivitaiSync) && ` · 메타 동기화: ${new Date(cacheInfo.lastMetadataSync || cacheInfo.lastCivitaiSync).toLocaleString('ko-KR')}`}
            </Typography>
            {/* vcc-file-hash 미설치 안내는 admin 페이지에만 (#354) — picker 에선 ComfyUI 인지 즉시 알 수 없어 OpenAI 서버에도 잘못 노출되던 문제. */}
          </Box>
        )}

        {/* 작업판 허용 모델 타입 안내 (Model 만) */}
        {kind === 'model' && allowedModelTypes.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              작업판 허용 타입:
            </Typography>
            {allowedModelTypes.map((t) => (
              <Chip key={t} label={t} color="primary" variant="outlined" />
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
            {viewMode === 'grid' && (
              <MetadataItemGrid
                items={filteredItems}
                getKey={(rawItem, index) => rawItem.filename || index}
                renderItem={(rawItem) => {
                  const item = adapter.normalize(rawItem);
                  if (!item) return null;
                  return (
                    <MetadataItemCard
                      item={item}
                      selected={mode === 'multi-add' ? selectedItems.includes(item.filename) : selectedItem === item.filename}
                      onDetailClick={() => setDetailItem(item)}
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
            )}

            {viewMode === 'image-list' && (
              <Box>
                {filteredItems.map((rawItem, idx) => {
                  const item = adapter.normalize(rawItem);
                  if (!item) return null;
                  return (
                    <MetadataImageListItem
                      key={rawItem?.filename || idx}
                      item={item}
                      selected={mode === 'multi-add' ? selectedItems.includes(item.filename) : selectedItem === item.filename}
                      onDetailClick={() => setDetailItem(item)}
                      onPrimary={() => handlePrimary(rawItem)}
                      primaryVariant={cardPrimaryVariant}
                      cardClickable={cardClickable}
                      onTrainedWordClick={onTrainedWordClick ? (word) => onTrainedWordClick(word, rawItem) : undefined}
                      trainedWordInsertMode={mode === 'prompt-insert'}
                      nsfwImageFilter={nsfwImageFilter}
                    />
                  );
                })}
              </Box>
            )}

            {viewMode === 'list' && (
              <Box sx={{ width: '100%', overflow: 'hidden' }}>
                {filteredItems.map((rawItem, idx) => {
                  const item = adapter.normalize(rawItem);
                  if (!item) return null;
                  const isSelected = mode === 'multi-add' ? selectedItems.includes(item.filename) : selectedItem === item.filename;
                  return (
                    <Box
                      key={rawItem?.filename || idx}
                      onClick={cardClickable ? () => handlePrimary(rawItem) : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1,
                        px: 1.5,
                        width: '100%',
                        minWidth: 0,
                        overflow: 'hidden',
                        borderBottom: 1,
                        borderColor: 'divider',
                        cursor: cardClickable ? 'pointer' : 'default',
                        bgcolor: isSelected ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <Box sx={{ flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
                        <Typography variant="body2" noWrap title={item.displayName} sx={{ fontWeight: isSelected ? 600 : 500 }}>
                          {item.displayName}
                          {item.versionName && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              ({item.versionName})
                            </Typography>
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap title={item.filename} sx={{ fontFamily: 'monospace', display: 'block' }}>
                          {item.filename}
                        </Typography>
                      </Box>
                      {item.baseModel && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 1, minWidth: 0, maxWidth: { xs: 80, sm: 160 }, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.baseModel}
                        </Typography>
                      )}
                      <Button onClick={(e) => { e.stopPropagation(); setDetailItem(item); }} sx={{ flexShrink: 0, minWidth: 'auto' }}>상세</Button>
                      {!cardClickable && (
                        <Button variant={mode === 'prompt-insert' ? 'contained' : 'text'} onClick={(e) => { e.stopPropagation(); handlePrimary(rawItem); }} sx={{ flexShrink: 0, minWidth: 'auto' }}>
                          {mode === 'prompt-insert' ? '추가' : mode === 'multi-add' ? (isSelected ? '제거' : '추가') : '선택'}
                        </Button>
                      )}
                    </Box>
                  );
                })}
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
      <MetadataDetailDialog
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
        nsfwImageFilter={nsfwImageFilter}
      />
    </Dialog>
  );
}

export default MetadataPickerModal;
