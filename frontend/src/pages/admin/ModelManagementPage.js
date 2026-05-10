import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Button,
  Grid,
  Chip,
  CircularProgress,
  LinearProgress,
  Alert,
  Tooltip,
  Stack,
  Paper,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';
import { useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI } from '../../services/api';
import Pagination from '../../components/common/Pagination';
import MetadataItemCard from '../../components/common/MetadataItemCard';
import MetadataItemGrid from '../../components/common/MetadataItemGrid';
import { normalizeModel } from '../../utils/metadataItem';

// 모델 동기화를 지원하는 serverType 목록 (#200 의 모든 4종)
const SUPPORTED_SERVER_TYPES = ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'];

function ModelManagementPage() {
  const [selectedServerId, setSelectedServerId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [baseModelFilter, setBaseModelFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });
  const [models, setModels] = useState([]);
  const [availableBaseModels, setAvailableBaseModels] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // 서버 목록 (4종 serverType) 조회
  const { data: serversData } = useQuery(
    ['servers', { includeInactive: false }],
    () => serverAPI.getServers({ includeInactive: false }),
    {
      onSuccess: (data) => {
        const all = data?.data?.data?.servers || [];
        const supported = all.filter((s) => SUPPORTED_SERVER_TYPES.includes(s.serverType));
        if (supported.length > 0 && !selectedServerId) {
          setSelectedServerId(supported[0]._id);
        }
      }
    }
  );

  const allServers = serversData?.data?.data?.servers || [];
  const supportedServers = allServers.filter((s) => SUPPORTED_SERVER_TYPES.includes(s.serverType));
  const selectedServer = supportedServers.find((s) => s._id === selectedServerId);

  // 모델 목록 fetch
  const fetchModels = useCallback(
    async (page = 1) => {
      if (!selectedServerId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await serverAPI.getDetailedModels(selectedServerId, {
          search: searchQuery,
          baseModel: baseModelFilter,
          page,
          limit: 24
        });
        const data = response.data?.data || {};
        setModels(data.models || []);
        setPagination(data.pagination || { current: 1, pages: 0, total: 0 });
        setCacheInfo(data.cacheInfo || null);
        if (data.availableBaseModels) setAvailableBaseModels(data.availableBaseModels);
      } catch (err) {
        console.error('Failed to fetch models:', err);
        setError(err.response?.data?.message || '모델 목록을 가져오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [selectedServerId, searchQuery, baseModelFilter]
  );

  // sync 폴링
  useEffect(() => {
    let interval;
    if (syncing && selectedServerId) {
      interval = setInterval(async () => {
        try {
          const response = await serverAPI.getModelsSyncStatus(selectedServerId);
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
  }, [syncing, selectedServerId, fetchModels]);

  // 서버 변경 또는 페이지 진입 시 fetch
  useEffect(() => {
    if (selectedServerId) {
      fetchModels(1);
      serverAPI.getModelsSyncStatus(selectedServerId)
        .then((response) => {
          const status = response.data.data;
          setSyncStatus(status);
          if (status.status === 'fetching') setSyncing(true);
        })
        .catch(console.error);
    }
  }, [selectedServerId, fetchModels]);

  // search/filter debounce
  useEffect(() => {
    const timer = setTimeout(() => fetchModels(1), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, baseModelFilter, fetchModels]);

  const handleSync = async () => {
    if (!selectedServerId) return;
    try {
      setSyncing(true);
      await serverAPI.syncModels(selectedServerId);
      toast.success('모델 동기화를 시작했습니다.');
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncing(false);
      toast.error(err.response?.data?.message || '동기화 시작 실패');
    }
  };

  const handleResetSync = async () => {
    if (!selectedServerId) return;
    try {
      await serverAPI.resetModelsSync(selectedServerId);
      toast.success('모델 동기화 상태가 초기화되었습니다.');
      const response = await serverAPI.getModelsSyncStatus(selectedServerId);
      setSyncStatus(response.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || '리셋 실패');
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} mb={3}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            ComfyUI / OpenAI / Gemini 서버의 베이스 모델 메타데이터 (Civitai / provider) 를 동기화하고 검색합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>서버</InputLabel>
            <Select
              value={selectedServerId}
              label="서버"
              onChange={(e) => setSelectedServerId(e.target.value)}
            >
              {supportedServers.map((s) => (
                <MenuItem key={s._id} value={s._id}>
                  {s.name} ({s.serverType})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="모델 메타데이터 동기화">
            <span>
              <Button
                variant="contained"
                startIcon={syncing ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleSync}
                disabled={!selectedServerId || syncing}
              >
                {syncing ? '동기화 중...' : '동기화'}
              </Button>
            </span>
          </Tooltip>
          {syncStatus?.status === 'failed' && (
            <Tooltip title={`강제 리셋 — 오류: ${syncStatus.errorMessage || '알 수 없음'}`}>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<RestartAltIcon />}
                onClick={handleResetSync}
              >
                리셋
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {/* 캐시 정보 + 진행률 */}
      {cacheInfo && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
            <Typography variant="caption" color="text.secondary">
              {cacheInfo.lastFetched && `마지막 조회: ${new Date(cacheInfo.lastFetched).toLocaleString('ko-KR')}`}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {cacheInfo.lastMetadataSync && `메타 동기화: ${new Date(cacheInfo.lastMetadataSync).toLocaleString('ko-KR')}`}
            </Typography>
            {syncStatus?.totalModels > 0 && (
              <Typography variant="caption" color="text.secondary">
                {syncStatus.modelsWithMetadata}/{syncStatus.totalModels}개 메타데이터 보유
              </Typography>
            )}
          </Stack>
          {cacheInfo.hashNodeAvailable === false && selectedServer?.serverType === 'ComfyUI' && (
            <Alert severity="info" sx={{ mt: 1 }}>
              ComfyUI 의 vcc-file-hash 노드가 설치되지 않아 해시 기반 메타데이터를 가져올 수 없습니다.
            </Alert>
          )}
        </Paper>
      )}

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

      <Divider sx={{ mb: 2 }} />

      {/* 검색 + 필터 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          placeholder="이름 / 파일명 / 트리거워드 / capability 검색"
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
              {availableBaseModels.map((bm) => (
                <MenuItem key={bm} value={bm}>
                  {bm}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!selectedServerId ? (
        <Alert severity="info">서버를 선택하세요.</Alert>
      ) : loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300}>
          <CircularProgress />
        </Box>
      ) : models.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            모델이 없습니다.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            상단 "동기화" 버튼으로 모델 목록을 가져오세요.
          </Typography>
        </Box>
      ) : (
        <>
          <MetadataItemGrid
            items={models}
            getKey={(rawModel, index) => rawModel.filename || index}
            renderItem={(rawModel) => {
              const item = normalizeModel(rawModel, { serverType: selectedServer?.serverType });
              if (!item) return null;
              return (
                <MetadataItemCard
                  item={item}
                  expanded={expandedId === item.id}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  nsfwImageFilter={false}
                />
              );
            }}
          />
          {pagination.pages > 1 && (
            <Box mt={3} display="flex" justifyContent="center">
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
    </Box>
  );
}

export default ModelManagementPage;
