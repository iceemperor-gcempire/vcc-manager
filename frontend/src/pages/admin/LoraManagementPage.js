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
  Button,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  LinearProgress,
  Alert,
  Tooltip,
  Stack,
  Pagination as MuiPagination,
  Switch,
  FormControlLabel,
  Paper,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Save as SaveIcon,
  Key as KeyIcon,
  ViewModule as GridViewIcon,
  ViewList as ListViewIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI, adminAPI } from '../../services/api';

// LoRA 카드 컴포넌트
function LoraCard({ lora, expanded, onToggleExpand, onCopyTriggerWord, getBaseModelColor, nsfwFilter }) {
  const hasCivitai = lora.civitai?.found;

  // NSFW 필터링된 이미지 목록
  const filteredImages = (lora.civitai?.images || []).filter(img => !nsfwFilter || !img.nsfw);
  const previewImage = filteredImages[0]?.url;
  const name = lora.civitai?.name || lora.filename.replace(/\.[^/.]+$/, '');
  const trainedWords = lora.civitai?.trainedWords || [];

  const handleCopyFilename = () => {
    const nameWithoutExt = lora.filename.replace(/\.[^/.]+$/, '');
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

          {/* 해시 정보 */}
          {lora.hash && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              SHA256: {lora.hash.substring(0, 16)}...
            </Typography>
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
            onClick={handleCopyFilename}
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
function LoraListItem({ lora, onCopyTriggerWord, getBaseModelColor, nsfwFilter }) {
  const hasCivitai = lora.civitai?.found;
  const filteredImages = (lora.civitai?.images || []).filter(img => !nsfwFilter || !img.nsfw);
  const previewImage = filteredImages[0]?.url;
  const name = lora.civitai?.name || lora.filename.replace(/\.[^/.]+$/, '');
  const trainedWords = lora.civitai?.trainedWords || [];

  const handleCopyFilename = () => {
    const nameWithoutExt = lora.filename.replace(/\.[^/.]+$/, '');
    const loraString = `<lora:${nameWithoutExt}:1>`;
    navigator.clipboard.writeText(loraString);
    toast.success(`LoRA 태그가 복사되었습니다.`);
  };

  return (
    <ListItem
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        overflow: 'hidden',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
      }}
      secondaryAction={
        <Stack direction="row" spacing={0.5}>
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
            <IconButton size="small" onClick={handleCopyFilename} color="primary">
              <CopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      }
    >
      <ListItemAvatar>
        {previewImage ? (
          <Avatar
            variant="rounded"
            src={previewImage}
            sx={{ width: 56, height: 56 }}
          />
        ) : (
          <Avatar
            variant="rounded"
            sx={{ width: 56, height: 56, bgcolor: 'action.hover' }}
          >
            <Typography variant="caption" color="text.secondary">N/A</Typography>
          </Avatar>
        )}
      </ListItemAvatar>
      <ListItemText
        sx={{ ml: 1, overflow: 'hidden', minWidth: 0 }}
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', overflow: 'hidden' }}>
            <Typography variant="subtitle2" component="span" noWrap sx={{ maxWidth: '300px' }} title={name}>{name}</Typography>
            {lora.civitai?.baseModel && (
              <Chip
                label={lora.civitai.baseModel}
                size="small"
                color={getBaseModelColor(lora.civitai.baseModel)}
                variant="outlined"
              />
            )}
            {lora.civitai?.nsfw && (
              <Chip label="NSFW" size="small" color="error" variant="outlined" />
            )}
            {!hasCivitai && (
              <Chip label={lora.hash ? "미등록" : "메타데이터 없음"} size="small" variant="outlined" />
            )}
          </Box>
        }
        secondary={
          <Box sx={{ mt: 0.5, overflow: 'hidden' }}>
            <Typography variant="caption" color="text.secondary" display="block" noWrap title={lora.filename}>
              {lora.filename}
            </Typography>
            {trainedWords.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {trainedWords.slice(0, 5).map((word, i) => (
                  <Chip
                    key={i}
                    label={word}
                    size="small"
                    onClick={() => onCopyTriggerWord(word)}
                    sx={{ cursor: 'pointer', height: 20, fontSize: '0.7rem' }}
                  />
                ))}
                {trainedWords.length > 5 && (
                  <Chip label={`+${trainedWords.length - 5}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                )}
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  );
}

function LoraManagementPage() {
  const [selectedServerId, setSelectedServerId] = useState('');
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

  // 전역 설정 상태
  const [nsfwFilter, setNsfwFilter] = useState(true);
  const [nsfwLoraFilter, setNsfwLoraFilter] = useState(true);
  const [hasCivitaiApiKey, setHasCivitaiApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  const queryClient = useQueryClient();

  // 전역 설정 조회
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await adminAPI.getLoraSettings();
        if (response.data.success) {
          setNsfwFilter(response.data.data.nsfwFilter);
          setNsfwLoraFilter(response.data.data.nsfwLoraFilter ?? true);
          setHasCivitaiApiKey(response.data.data.hasCivitaiApiKey);
        }
      } catch (err) {
        console.error('Failed to fetch LoRA settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // NSFW 이미지 필터 토글
  const handleNsfwFilterToggle = async () => {
    const newValue = !nsfwFilter;
    setNsfwFilter(newValue);
    try {
      await adminAPI.updateLoraSettings({ nsfwFilter: newValue });
      toast.success(newValue ? 'NSFW 이미지가 숨겨집니다.' : 'NSFW 이미지가 표시됩니다.');
    } catch (err) {
      setNsfwFilter(!newValue); // 롤백
      toast.error('설정 저장에 실패했습니다.');
    }
  };

  // NSFW LoRA 필터 토글
  const handleNsfwLoraFilterToggle = async () => {
    const newValue = !nsfwLoraFilter;
    setNsfwLoraFilter(newValue);
    try {
      await adminAPI.updateLoraSettings({ nsfwLoraFilter: newValue });
      toast.success(newValue ? 'NSFW LoRA가 숨겨집니다.' : 'NSFW LoRA가 표시됩니다.');
    } catch (err) {
      setNsfwLoraFilter(!newValue); // 롤백
      toast.error('설정 저장에 실패했습니다.');
    }
  };

  // API 키 저장
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim() && !hasCivitaiApiKey) {
      toast.error('API 키를 입력해주세요.');
      return;
    }

    setSavingSettings(true);
    try {
      await adminAPI.updateLoraSettings({
        civitaiApiKey: apiKeyInput.trim() || null
      });
      setHasCivitaiApiKey(!!apiKeyInput.trim());
      setApiKeyInput('');
      setShowApiKeyInput(false);
      toast.success(apiKeyInput.trim() ? 'Civitai API 키가 저장되었습니다.' : 'API 키가 삭제되었습니다.');
    } catch (err) {
      toast.error('API 키 저장에 실패했습니다.');
    } finally {
      setSavingSettings(false);
    }
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

  // 동기화 상태 폴링
  useEffect(() => {
    let interval;
    if (syncing && selectedServerId) {
      interval = setInterval(async () => {
        try {
          const response = await serverAPI.getLorasSyncStatus(selectedServerId);
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
  }, [syncing, selectedServerId]);

  const fetchLoraModels = useCallback(async (page = 1) => {
    if (!selectedServerId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await serverAPI.getLoras(selectedServerId, {
        search: searchQuery,
        baseModel: baseModelFilter,
        page,
        limit: 24
      });
      const data = response.data.data;
      setLoraModels(data.loraModels || []);
      setPagination(data.pagination || { current: 1, pages: 0, total: 0 });
      setCacheInfo(data.cacheInfo);
    } catch (err) {
      console.error('Failed to fetch LoRA models:', err);
      setError(err.response?.data?.message || 'LoRA 모델을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedServerId, searchQuery, baseModelFilter]);

  // 서버 선택 시 LoRA 목록 및 동기화 상태 조회
  useEffect(() => {
    if (selectedServerId) {
      fetchLoraModels();
      // 동기화 상태 확인
      serverAPI.getLorasSyncStatus(selectedServerId)
        .then(response => {
          const status = response.data.data;
          setSyncStatus(status);
          if (status.status === 'fetching') {
            setSyncing(true);
          }
        })
        .catch(console.error);
    }
  }, [selectedServerId, fetchLoraModels]);

  // 검색어/필터 변경 시 debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedServerId) {
        fetchLoraModels(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, baseModelFilter]);

  const handleSync = async (forceRefresh = false) => {
    if (!selectedServerId) {
      toast.error('서버를 선택해주세요.');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      await serverAPI.syncLoras(selectedServerId, { forceRefresh });
      toast.success(forceRefresh
        ? 'LoRA 강제 새로고침이 시작되었습니다. (모든 메타데이터를 다시 가져옵니다)'
        : 'LoRA 동기화가 시작되었습니다.');
    } catch (err) {
      console.error('Failed to start sync:', err);
      setSyncing(false);
      toast.error('동기화 시작에 실패했습니다.');
    }
  };

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

  // 고유한 기본 모델 목록 추출
  const baseModels = [...new Set(loraModels
    .filter(l => l.civitai?.baseModel)
    .map(l => l.civitai.baseModel)
  )].sort();

  const selectedServer = comfyUIServers.find(s => s._id === selectedServerId);

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom>
        LoRA 관리
      </Typography>

      {/* 전역 설정 패널 */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SettingsIcon color="action" />
          <Typography variant="subtitle1" fontWeight="medium">
            전역 설정
          </Typography>
        </Box>

        <Grid container spacing={3} alignItems="center">
          {/* NSFW LoRA 필터 */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={nsfwLoraFilter}
                  onChange={handleNsfwLoraFilterToggle}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BlockIcon fontSize="small" />
                  <span>NSFW LoRA 숨기기</span>
                </Box>
              }
            />
          </Grid>

          {/* NSFW 이미지 필터 */}
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={nsfwFilter}
                  onChange={handleNsfwFilterToggle}
                  color="primary"
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {nsfwFilter ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  <span>NSFW 이미지 숨기기</span>
                </Box>
              }
            />
          </Grid>

          {/* Civitai API 키 */}
          <Grid item xs={12} sm={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <KeyIcon color="action" />
              <Typography variant="body2" color="text.secondary">
                Civitai API 키:
              </Typography>
              {hasCivitaiApiKey ? (
                <Chip
                  label="등록됨"
                  color="success"
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  label="미등록"
                  size="small"
                  variant="outlined"
                />
              )}
              <Button
                size="small"
                onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              >
                {showApiKeyInput ? '취소' : hasCivitaiApiKey ? '변경' : '등록'}
              </Button>
            </Box>

            {showApiKeyInput && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  type="password"
                  placeholder={hasCivitaiApiKey ? '새 API 키 입력 (빈칸: 삭제)' : 'API 키 입력'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  sx={{ flexGrow: 1, maxWidth: 400 }}
                  autoComplete="off"
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSaveApiKey}
                  disabled={savingSettings}
                  startIcon={savingSettings ? <CircularProgress size={16} /> : <SaveIcon />}
                >
                  저장
                </Button>
              </Box>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              API 키 등록 시 메타데이터 조회 속도가 5배 빨라집니다 (1초 → 0.2초 간격)
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* 서버 선택 */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth sx={{ maxWidth: 400 }}>
          <InputLabel>ComfyUI 서버 선택</InputLabel>
          <Select
            value={selectedServerId}
            label="ComfyUI 서버 선택"
            onChange={(e) => {
              setSelectedServerId(e.target.value);
              setLoraModels([]);
              setCacheInfo(null);
              setSyncStatus(null);
              setSearchQuery('');
              setBaseModelFilter('');
            }}
            disabled={serversLoading}
          >
            {comfyUIServers.map(server => (
              <MenuItem key={server._id} value={server._id}>
                {server.name} ({server.serverUrl})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {comfyUIServers.length === 0 && !serversLoading && (
          <Alert severity="info" sx={{ mt: 2 }}>
            등록된 ComfyUI 서버가 없습니다. 서버 관리에서 ComfyUI 서버를 추가해주세요.
          </Alert>
        )}
      </Box>

      {selectedServerId && (
        <>
          {/* 동기화 진행 표시 */}
          {syncing && syncStatus && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CircularProgress size={20} />
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

          {/* 검색 및 필터 영역 */}
          <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="LoRA 검색 (이름, 설명, 트리거 워드)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{ flexGrow: 1, minWidth: 250 }}
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
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, newMode) => newMode && setViewMode(newMode)}
              size="small"
            >
              <ToggleButton value="grid">
                <Tooltip title="그리드 보기">
                  <GridViewIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="list">
                <Tooltip title="리스트 보기">
                  <ListViewIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Button
              variant="contained"
              onClick={() => handleSync(false)}
              disabled={syncing || loading}
              startIcon={syncing ? <CircularProgress size={16} /> : <RefreshIcon />}
            >
              {syncStatus?.totalLoras > 0 ? '다시 동기화' : '동기화 시작'}
            </Button>
            {syncStatus?.totalLoras > 0 && (
              <Tooltip title="기존 캐시된 메타데이터를 무시하고 Civitai에서 모든 데이터를 새로 가져옵니다">
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => handleSync(true)}
                  disabled={syncing || loading}
                  size="small"
                >
                  강제 새로고침
                </Button>
              </Tooltip>
            )}
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
                  총 LoRA
                </Typography>
                <Typography variant="body2">
                  {syncStatus?.totalLoras || pagination.total || 0}개
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  메타데이터 있음
                </Typography>
                <Typography variant="body2">
                  {syncStatus?.lorasWithMetadata || 0}개
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="caption" color="text.secondary" display="block">
                  마지막 동기화
                </Typography>
                <Typography variant="body2">
                  {formatDate(cacheInfo?.lastCivitaiSync || syncStatus?.lastCivitaiSync)}
                </Typography>
              </Grid>
            </Grid>
            {cacheInfo?.loraInfoNodeAvailable === false && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                VCC LoRA Hash 노드가 설치되지 않아 Civitai 메타데이터를 조회할 수 없습니다.
                ComfyUI에 커스텀 노드를 설치해주세요.
              </Alert>
            )}
          </Box>

          {/* 에러 표시 */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* LoRA 목록 */}
          {(() => {
            // NSFW LoRA 필터링 적용
            const filteredLoraModels = nsfwLoraFilter
              ? loraModels.filter(lora => !lora.civitai?.nsfw)
              : loraModels;

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
                    {searchQuery || nsfwLoraFilter ? '검색 결과가 없습니다.' : 'LoRA 모델이 없습니다.'}
                  </Typography>
                  {!searchQuery && !nsfwLoraFilter && (
                    <Typography variant="body2" color="text.secondary">
                      "동기화 시작" 버튼을 클릭하여 서버에서 LoRA 목록을 가져오세요.
                    </Typography>
                  )}
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
                  // 그리드 뷰 (한 줄에 최대 5개, 최소 너비 200px)
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 2,
                      '& > *': {
                        maxWidth: 280
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
                          nsfwFilter={nsfwFilter}
                        />
                      </Box>
                    ))}
                  </Box>
                ) : (
                  // 리스트 뷰
                  <List disablePadding sx={{ width: '100%', overflow: 'hidden' }}>
                    {filteredLoraModels.map((lora, index) => (
                      <LoraListItem
                        key={lora.filename || index}
                        lora={lora}
                        onCopyTriggerWord={handleCopyTriggerWord}
                        getBaseModelColor={getBaseModelColor}
                        nsfwFilter={nsfwFilter}
                      />
                    ))}
                  </List>
                )}

                {/* 페이지네이션 */}
                {pagination.pages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <MuiPagination
                      count={pagination.pages}
                      page={pagination.current}
                      onChange={(e, page) => fetchLoraModels(page)}
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

export default LoraManagementPage;
