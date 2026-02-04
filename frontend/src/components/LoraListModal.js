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
  CardMedia,
  CardActions,
  Grid,
  IconButton,
  Collapse,
  LinearProgress,
  Tooltip,
  Stack,
  Pagination as MuiPagination,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { workboardAPI, serverAPI } from '../services/api';
import toast from 'react-hot-toast';

function LoraListModal({ open, onClose, workboardId, serverId, onAddLora }) {
  const [loraModels, setLoraModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLora, setExpandedLora] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 0, total: 0 });
  const [baseModelFilter, setBaseModelFilter] = useState('');

  // 동기화 상태 폴링
  useEffect(() => {
    let interval;
    if (syncing && serverId) {
      interval = setInterval(async () => {
        try {
          const response = await serverAPI.getLorasSyncStatus(serverId);
          const status = response.data.data;
          setSyncStatus(status);

          if (status.status === 'completed' || status.status === 'failed' || status.status === 'idle') {
            setSyncing(false);
            if (status.status === 'completed') {
              toast.success('LoRA 동기화가 완료되었습니다.');
              fetchLoraModels();
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
  }, [syncing, serverId]);

  const fetchLoraModels = useCallback(async (page = 1) => {
    if (!workboardId && !serverId) return;

    setLoading(true);
    setError(null);

    try {
      let response;
      if (serverId) {
        response = await serverAPI.getLoras(serverId, {
          search: searchQuery,
          baseModel: baseModelFilter,
          page,
          limit: 20
        });
        const data = response.data.data;
        setLoraModels(data.loraModels || []);
        setPagination(data.pagination || { current: 1, pages: 0, total: 0 });
        setCacheInfo(data.cacheInfo);
      } else {
        response = await workboardAPI.getLoraModels(workboardId);
        const data = response.data;
        setLoraModels(data.loraModels || []);
        setPagination(data.pagination || { current: 1, pages: 0, total: 0 });
        setCacheInfo({
          lastFetched: data.lastFetched,
          lastCivitaiSync: data.lastCivitaiSync,
          loraInfoNodeAvailable: data.loraInfoNodeAvailable
        });
      }
    } catch (err) {
      console.error('Failed to fetch LoRA models:', err);
      setError(err.response?.data?.message || 'LoRA 모델을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [workboardId, serverId, searchQuery, baseModelFilter]);

  useEffect(() => {
    if (open) {
      fetchLoraModels();
      // 동기화 상태 확인
      if (serverId) {
        serverAPI.getLorasSyncStatus(serverId)
          .then(response => {
            const status = response.data.data;
            setSyncStatus(status);
            if (status.status === 'fetching') {
              setSyncing(true);
            }
          })
          .catch(console.error);
      }
    }
  }, [open, fetchLoraModels, serverId]);

  // 검색어 변경 시 debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) {
        fetchLoraModels(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, baseModelFilter]);

  const handleSync = async () => {
    if (!serverId) {
      toast.error('서버 ID가 필요합니다.');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      await serverAPI.syncLoras(serverId);
      toast.success('LoRA 동기화가 시작되었습니다.');
    } catch (err) {
      console.error('Failed to start sync:', err);
      setSyncing(false);
      toast.error('동기화 시작에 실패했습니다.');
    }
  };

  const handleAddLora = (lora) => {
    const filename = lora.filename || lora;
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const loraString = `<lora:${nameWithoutExt}:1>`;

    if (onAddLora) {
      onAddLora(loraString);
    }

    const displayName = lora.civitai?.name || nameWithoutExt;
    toast.success(`${displayName} LoRA가 프롬프트에 추가되었습니다.`);
  };

  const handleCopyTriggerWord = (word) => {
    navigator.clipboard.writeText(word);
    toast.success(`"${word}" 복사됨`);
  };

  const handleClose = () => {
    setSearchQuery('');
    setExpandedLora(null);
    setBaseModelFilter('');
    onClose();
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

  // 고유한 기본 모델 목록 추출
  const baseModels = [...new Set(loraModels
    .filter(l => l.civitai?.baseModel)
    .map(l => l.civitai.baseModel)
  )].sort();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">LoRA 모델 목록</Typography>
          {cacheInfo?.loraInfoNodeAvailable === false && (
            <Tooltip title="LoraInfo 노드가 설치되지 않아 Civitai 메타데이터를 조회할 수 없습니다.">
              <Chip
                icon={<WarningIcon />}
                label="메타데이터 제한"
                size="small"
                color="warning"
                variant="outlined"
              />
            </Tooltip>
          )}
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* 동기화 진행 표시 */}
      {syncing && syncStatus && (
        <Box sx={{ px: 3, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              동기화 중: {syncStatus.progress?.stage || 'processing'}
              {syncStatus.progress?.total > 0 &&
                ` (${syncStatus.progress.current}/${syncStatus.progress.total})`}
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

      <DialogContent dividers sx={{ pt: 2 }}>
        {/* 검색 및 필터 영역 */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="LoRA 검색 (이름, 설명, 트리거 워드)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          {baseModels.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>기본 모델</InputLabel>
              <Select
                value={baseModelFilter}
                label="기본 모델"
                onChange={(e) => setBaseModelFilter(e.target.value)}
              >
                <MenuItem value="">전체</MenuItem>
                {baseModels.map(model => (
                  <MenuItem key={model} value={model}>{model}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button
            variant="outlined"
            onClick={handleSync}
            disabled={syncing || loading || !serverId}
            startIcon={syncing ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            동기화
          </Button>
        </Box>

        {/* 캐시 정보 */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            마지막 목록 갱신: {formatDate(cacheInfo?.lastFetched)}
          </Typography>
          {cacheInfo?.lastCivitaiSync && (
            <Typography variant="caption" color="text.secondary">
              | Civitai 동기화: {formatDate(cacheInfo?.lastCivitaiSync)}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            | 총 {pagination.total}개
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : loraModels.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {searchQuery ? '검색 결과가 없습니다.' : 'LoRA 모델이 없습니다.'}
            </Typography>
            {!searchQuery && (
              <Typography variant="body2" color="text.secondary">
                "동기화" 버튼을 클릭하여 서버에서 LoRA 목록을 가져오세요.
              </Typography>
            )}
          </Box>
        ) : (
          <>
            <Grid container spacing={2}>
              {loraModels.map((lora, index) => (
                <Grid item xs={12} sm={6} md={4} key={lora.filename || index}>
                  <LoraCard
                    lora={lora}
                    expanded={expandedLora === lora.filename}
                    onToggleExpand={() => setExpandedLora(
                      expandedLora === lora.filename ? null : lora.filename
                    )}
                    onAddLora={handleAddLora}
                    onCopyTriggerWord={handleCopyTriggerWord}
                    getBaseModelColor={getBaseModelColor}
                  />
                </Grid>
              ))}
            </Grid>

            {/* 페이지네이션 */}
            {pagination.pages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <MuiPagination
                  count={pagination.pages}
                  page={pagination.current}
                  onChange={(e, page) => fetchLoraModels(page)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

// LoRA 카드 컴포넌트
function LoraCard({ lora, expanded, onToggleExpand, onAddLora, onCopyTriggerWord, getBaseModelColor }) {
  const hasCivitai = lora.civitai?.found;
  const previewImage = lora.civitai?.images?.[0]?.url;
  const name = lora.civitai?.name || lora.filename.replace(/\.[^/.]+$/, '');
  const trainedWords = lora.civitai?.trainedWords || [];

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
          height="140"
          image={previewImage}
          alt={name}
          sx={{ objectFit: 'cover' }}
        />
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
        {/* 이름 */}
        <Typography variant="subtitle2" noWrap title={name}>
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
              트리거 워드:
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
          {lora.civitai?.images?.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1, overflow: 'auto', mt: 1 }}>
              {lora.civitai.images.slice(1).map((img, i) => (
                <Box
                  key={i}
                  component="img"
                  src={img.url}
                  alt={`Preview ${i + 2}`}
                  sx={{
                    width: 60,
                    height: 60,
                    objectFit: 'cover',
                    borderRadius: 1,
                    opacity: img.nsfw ? 0.3 : 1
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
                onClick={() => window.open(lora.civitai.modelUrl, '_blank')}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onAddLora(lora)}
        >
          추가
        </Button>
      </CardActions>
    </Card>
  );
}

export default LoraListModal;
