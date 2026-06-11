import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
  Stack,
  Paper
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  HelpOutline,
  CheckCircle,
  Error,
  Refresh,
  Storage,
  TextFields,
  Computer,
  Sync as SyncIcon,
  CloudSync as CloudSyncIcon,
  RestartAlt as RestartAltIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI, jobAPI } from '../../services/api';
import { getServerTypeColor } from '../../templates/capabilities';
import { ToneChip, TagChip } from '../common/WorkboardCatalog';
import { MONO } from '../../theme';
import PageHeader from '../common/PageHeader';
import EmptyState from '../common/EmptyState';

// 공식 base URL 이 알려진 provider — 서버 추가 시 자동 입력 (사용자 입력 우선)
const KNOWN_SERVER_URLS = {
  OpenAI: 'https://api.openai.com',
  Gemini: 'https://generativelanguage.googleapis.com',
};

function ServerCard({
  server,
  onEdit,
  onDelete,
  onHealthCheck,
  onLoraSync,
  loraSyncStatus,
  onLoraResetSync,
  onModelSync,
  modelSyncStatus,
  onModelResetSync,
}) {
  const [healthChecking, setHealthChecking] = useState(false);
  const isComfyUI = server.serverType === 'ComfyUI';
  const isLoraSyncing = loraSyncStatus?.status === 'fetching';
  const isModelSyncing = modelSyncStatus?.status === 'fetching';
  const loraFailed = loraSyncStatus?.status === 'failed';
  const modelFailed = modelSyncStatus?.status === 'failed';
  const supportsModelSync = ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'].includes(server.serverType);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'unhealthy':
        return <Error color="error" />;
      default:
        return <HelpOutline color="disabled" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (serverType) => {
    switch (serverType) {
      case 'ComfyUI':
        return <Computer />;
      case 'OpenAI':
      case 'OpenAI Compatible':
      case 'GPT Image':
        return <TextFields />;
      case 'Gemini':
        return <Storage />;
      default:
        return <Storage />;
    }
  };

  const getServerTypeLabel = (serverType) => {
    switch (serverType) {
      case 'ComfyUI':
        return 'ComfyUI API';
      case 'OpenAI':
        return 'OpenAI API';
      case 'OpenAI Compatible':
        return 'OpenAI Compatible API';
      case 'Gemini':
        return 'Gemini API';
      case 'GPT Image':
        return 'GPT Image API (deprecated)';
      default:
        return serverType;
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    try {
      await onHealthCheck(server._id);
    } finally {
      setHealthChecking(false);
    }
  };

  const statusKey = server.healthCheck?.status;
  const statusChip = statusKey === 'healthy'
    ? { tone: 'success', label: 'online' }
    : statusKey === 'unhealthy' ? { tone: 'error', label: 'offline' } : { tone: 'neutral', label: 'unknown' };
  const typeColor = getServerTypeColor(server.serverType);
  const abbr = ((server.serverType || 'SRV').replace(/[^A-Za-z]/g, '').slice(0, 3) || 'SRV').toUpperCase();
  const lastSync = modelSyncStatus?.lastMetadataSync || loraSyncStatus?.lastCivitaiSync || server.healthCheck?.lastChecked;

  return (
    <Paper variant="outlined" sx={{ p: '14px 16px', opacity: server.isActive ? 1 : 0.7 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, flex: '0 0 auto', bgcolor: typeColor, color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: MONO }}>
          {abbr}
        </Box>
        <Box sx={{ flex: 1, minWidth: 180 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{server.name}</Typography>
            <TagChip label={getServerTypeLabel(server.serverType)} />
            <ToneChip tone={statusChip.tone} label={statusChip.label} mono />
            {!server.isActive && <ToneChip tone="neutral" label="비활성" />}
          </Box>
          <Typography sx={{ fontSize: 12, color: 'text.disabled', fontFamily: MONO, mt: 0.25 }} noWrap>{server.serverUrl}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: '0 0 auto' }}>
        <Tooltip title="헬스체크">
          <span>
            <IconButton
              size="small"
              onClick={handleHealthCheck}
              disabled={healthChecking}
            >
              {healthChecking ? <CircularProgress size={20} /> : <Refresh />}
            </IconButton>
          </span>
        </Tooltip>
        {isComfyUI && (
          <Tooltip title={isLoraSyncing ? `LoRA 동기화 중... (${loraSyncStatus?.progress?.current || 0}/${loraSyncStatus?.progress?.total || 0})` : 'LoRA 동기화'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onLoraSync(server._id)}
                disabled={isLoraSyncing}
                color={loraSyncStatus?.totalLoras > 0 ? 'primary' : 'default'}
              >
                {isLoraSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        {isComfyUI && loraFailed && onLoraResetSync && (
          <Tooltip title={`LoRA 동기화 강제 리셋 (실패 상태 해제)\n오류: ${loraSyncStatus?.errorMessage || '알 수 없음'}`}>
            <span>
              <IconButton size="small" onClick={() => onLoraResetSync(server._id)} color="warning">
                <RestartAltIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {supportsModelSync && (
          <Tooltip title={isModelSyncing ? `모델 동기화 중... (${modelSyncStatus?.progress?.current || 0}/${modelSyncStatus?.progress?.total || 0})` : '모델 동기화'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onModelSync(server._id)}
                disabled={isModelSyncing}
                color={modelSyncStatus?.totalModels > 0 ? 'primary' : 'default'}
              >
                {isModelSyncing ? <CircularProgress size={20} /> : <CloudSyncIcon />}
              </IconButton>
            </span>
          </Tooltip>
        )}
        {supportsModelSync && modelFailed && onModelResetSync && (
          <Tooltip title={`모델 동기화 강제 리셋 (실패 상태 해제)\n오류: ${modelSyncStatus?.errorMessage || '알 수 없음'}`}>
            <span>
              <IconButton size="small" onClick={() => onModelResetSync(server._id)} color="warning">
                <RestartAltIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title="편집">
          <IconButton size="small" onClick={() => onEdit(server)}>
            <Edit />
          </IconButton>
        </Tooltip>
        <Tooltip title="삭제">
          <IconButton size="small" onClick={() => onDelete(server)} color="error">
            <Delete />
          </IconButton>
        </Tooltip>
        </Box>
      </Box>

      {/* sync summary */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap', fontSize: 11.5, color: 'text.secondary', fontFamily: MONO }}>
        {supportsModelSync && (
          <Box component="span">모델 {modelSyncStatus?.totalModels ? `${modelSyncStatus.modelsWithMetadata}/${modelSyncStatus.totalModels}` : '동기화 필요'}</Box>
        )}
        {isComfyUI && (
          <Box component="span">LoRA {loraSyncStatus?.totalLoras ? `${loraSyncStatus.lorasWithMetadata}/${loraSyncStatus.totalLoras}` : '동기화 필요'}</Box>
        )}
        {lastSync && <Box component="span" sx={{ ml: 'auto' }}>마지막 동기화 {new Date(lastSync).toLocaleString()}</Box>}
      </Box>
      {server.healthCheck?.errorMessage && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>오류: {server.healthCheck.errorMessage}</Typography>
      )}
    </Paper>
  );
}

function ServerDialog({ open, onClose, server, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serverType: 'ComfyUI',
    serverUrl: '',
    isActive: true,
    configuration: {
      apiKey: '',
      timeout: 300000
    }
  });

  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (server) {
      setFormData({
        name: server.name || '',
        description: server.description || '',
        serverType: server.serverType || 'ComfyUI',
        serverUrl: server.serverUrl || '',
        isActive: server.isActive !== undefined ? server.isActive : true,
        configuration: {
          apiKey: server.configuration?.apiKey || '',
          timeout: server.configuration?.timeout || 300000
        }
      });
    } else {
      setFormData({
        name: '',
        description: '',
        serverType: 'ComfyUI',
        serverUrl: '',
        isActive: true,
        configuration: {
          apiKey: '',
          timeout: 300000
        }
      });
    }
    setErrors({});
  }, [server, open]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '서버 이름을 입력하세요.';
    }
    
    if (!formData.serverUrl.trim()) {
      newErrors.serverUrl = '서버 URL을 입력하세요.';
    } else {
      try {
        new URL(formData.serverUrl);
      } catch {
        newErrors.serverUrl = '올바른 URL 형식을 입력하세요.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleConfigChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [field]: value
      }
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {server ? '서버 편집' : '새 서버 추가'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Grid container spacing={3}>
            {/* 기본 정보 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>기본 정보</Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="서버 이름"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>AI API 형식</InputLabel>
                <Select
                  value={formData.serverType}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      serverType: newType,
                      // 알려진 provider 면 URL 비어있을 때만 자동 입력
                      serverUrl: prev.serverUrl || KNOWN_SERVER_URLS[newType] || '',
                    }));
                  }}
                  label="AI API 형식"
                >
                  <MenuItem value="ComfyUI">ComfyUI API</MenuItem>
                  <MenuItem value="OpenAI">OpenAI API</MenuItem>
                  <MenuItem value="OpenAI Compatible">OpenAI Compatible API</MenuItem>
                  <MenuItem value="Gemini">Gemini API</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="설명"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="서버 URL"
                value={formData.serverUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, serverUrl: e.target.value }))}
                error={!!errors.serverUrl}
                helperText={errors.serverUrl}
                placeholder={
                  formData.serverType === 'Gemini'
                    ? 'https://generativelanguage.googleapis.com'
                    : formData.serverType === 'OpenAI'
                      ? 'https://api.openai.com'
                      : 'http://localhost:8188'
                }
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                }
                label="활성화"
              />
            </Grid>

            {/* 고급 설정 */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>고급 설정</Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="API 키"
                type="password"
                value={formData.configuration.apiKey}
                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                helperText="필요한 경우에만 입력하세요"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="타임아웃 (ms)"
                type="number"
                value={formData.configuration.timeout}
                onChange={(e) => handleConfigChange('timeout', parseInt(e.target.value) || 300000)}
                helperText="요청 타임아웃 시간"
              />
            </Grid>

          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        <Button onClick={handleSubmit} variant="contained">
          {server ? '수정' : '생성'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ServerManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [loraSyncStatuses, setLoraSyncStatuses] = useState({});
  const [modelSyncStatuses, setModelSyncStatuses] = useState({});

  const queryClient = useQueryClient();

  // 서버 목록 조회 (admin: 비활성 포함)
  const { data: serversData, isLoading } = useQuery(
    ['servers', { includeInactive: true }],
    () => serverAPI.getServers({ includeInactive: true }),
    { refetchInterval: 30000 } // 30초마다 갱신
  );

  // ComfyUI 서버들의 LoRA 동기화 상태 조회
  const servers = serversData?.data?.data?.servers || [];

  // 요약: 온라인 수 + 전체 큐(서버별 큐 수집 데이터가 없어 전체 큐로 표시)
  const { data: queueStatsData } = useQuery(
    'serverQueueStats',
    () => jobAPI.getQueueStats(),
    { refetchInterval: 10000 }
  );
  const queueStats = queueStatsData?.data?.stats || {};
  const onlineCount = servers.filter((s) => s.healthCheck?.status === 'healthy').length;
  const activeQueue = (queueStats.active || 0) + (queueStats.waiting || 0);
  const comfyUIServers = servers.filter(s => s.serverType === 'ComfyUI');
  const modelSyncSupportedServers = servers.filter(s =>
    ['ComfyUI', 'OpenAI', 'OpenAI Compatible', 'Gemini'].includes(s.serverType)
  );

  useQuery(
    ['loraSyncStatuses', comfyUIServers.map(s => s._id).join(',')],
    async () => {
      const statuses = {};
      for (const server of comfyUIServers) {
        try {
          const response = await serverAPI.getLorasSyncStatus(server._id);
          statuses[server._id] = response.data?.data;
        } catch (error) {
          statuses[server._id] = null;
        }
      }
      return statuses;
    },
    {
      enabled: comfyUIServers.length > 0,
      refetchInterval: (data) => {
        // 동기화 중인 서버가 있으면 3초마다, 아니면 30초마다
        const hasSyncing = data && Object.values(data).some(s => s?.status === 'fetching');
        return hasSyncing ? 3000 : 30000;
      },
      onSuccess: (data) => {
        setLoraSyncStatuses(data || {});
      }
    }
  );

  // 모델 동기화 상태 조회 (4종 serverType)
  useQuery(
    ['modelSyncStatuses', modelSyncSupportedServers.map(s => s._id).join(',')],
    async () => {
      const statuses = {};
      for (const server of modelSyncSupportedServers) {
        try {
          const response = await serverAPI.getModelsSyncStatus(server._id);
          statuses[server._id] = response.data?.data;
        } catch (error) {
          statuses[server._id] = null;
        }
      }
      return statuses;
    },
    {
      enabled: modelSyncSupportedServers.length > 0,
      refetchInterval: (data) => {
        const hasSyncing = data && Object.values(data).some(s => s?.status === 'fetching');
        return hasSyncing ? 3000 : 30000;
      },
      onSuccess: (data) => {
        setModelSyncStatuses(data || {});
      }
    }
  );

  // 서버 생성/수정 mutation
  const serverMutation = useMutation(
    async (serverData) => {
      if (selectedServer) {
        return serverAPI.updateServer(selectedServer._id, serverData);
      } else {
        return serverAPI.createServer(serverData);
      }
    },
    {
      onSuccess: () => {
        toast.success(selectedServer ? '서버가 수정되었습니다.' : '서버가 생성되었습니다.');
        setDialogOpen(false);
        setSelectedServer(null);
        queryClient.invalidateQueries(['servers']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '서버 저장에 실패했습니다.');
      }
    }
  );

  // 서버 삭제 mutation
  const deleteMutation = useMutation(
    (id) => serverAPI.deleteServer(id),
    {
      onSuccess: () => {
        toast.success('서버가 삭제되었습니다.');
        setDeleteConfirmOpen(false);
        setServerToDelete(null);
        queryClient.invalidateQueries(['servers']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '서버 삭제에 실패했습니다.');
      }
    }
  );

  // 헬스체크 mutation
  const healthCheckMutation = useMutation(
    (id) => serverAPI.checkServerHealth(id),
    {
      onSuccess: () => {
        toast.success('헬스체크가 완료되었습니다.');
        queryClient.invalidateQueries(['servers']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '헬스체크에 실패했습니다.');
      }
    }
  );

  // 전체 헬스체크 mutation
  const allHealthCheckMutation = useMutation(
    () => serverAPI.checkAllServersHealth(),
    {
      onSuccess: (response) => {
        const { data } = response.data;
        toast.success(`${data.total}개 서버 헬스체크 완료 (성공: ${data.success}, 실패: ${data.failed})`);
        queryClient.invalidateQueries(['servers']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '헬스체크에 실패했습니다.');
      }
    }
  );

  // LoRA 동기화 mutation
  const loraSyncMutation = useMutation(
    (serverId) => serverAPI.syncLoras(serverId),
    {
      onSuccess: () => {
        toast.success('LoRA 동기화가 시작되었습니다.');
        queryClient.invalidateQueries(['loraSyncStatuses']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'LoRA 동기화에 실패했습니다.');
      }
    }
  );

  // 모델 동기화 mutation (4종 serverType — 각각 dispatch 는 backend 가 처리)
  const modelSyncMutation = useMutation(
    (serverId) => serverAPI.syncModels(serverId),
    {
      onSuccess: () => {
        toast.success('모델 동기화가 시작되었습니다.');
        queryClient.invalidateQueries(['modelSyncStatuses']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '모델 동기화에 실패했습니다.');
      }
    }
  );

  // LoRA / 모델 sync 상태 강제 리셋 mutation (#256)
  const loraResetMutation = useMutation(
    (serverId) => serverAPI.resetLorasSync(serverId),
    {
      onSuccess: () => {
        toast.success('LoRA 동기화 상태가 초기화되었습니다.');
        queryClient.invalidateQueries(['loraSyncStatuses']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '리셋 실패');
      }
    }
  );
  const modelResetMutation = useMutation(
    (serverId) => serverAPI.resetModelsSync(serverId),
    {
      onSuccess: () => {
        toast.success('모델 동기화 상태가 초기화되었습니다.');
        queryClient.invalidateQueries(['modelSyncStatuses']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '리셋 실패');
      }
    }
  );

  const handleAddServer = () => {
    setSelectedServer(null);
    setDialogOpen(true);
  };

  const handleEditServer = (server) => {
    setSelectedServer(server);
    setDialogOpen(true);
  };

  const handleDeleteServer = (server) => {
    setServerToDelete(server);
    setDeleteConfirmOpen(true);
  };

  const handleHealthCheck = (serverId) => {
    healthCheckMutation.mutate(serverId);
  };

  const handleAllHealthCheck = () => {
    allHealthCheckMutation.mutate();
  };

  const handleLoraSync = (serverId) => {
    loraSyncMutation.mutate(serverId);
  };

  const handleModelSync = (serverId) => {
    modelSyncMutation.mutate(serverId);
  };

  const handleLoraResetSync = (serverId) => {
    loraResetMutation.mutate(serverId);
  };

  const handleModelResetSync = (serverId) => {
    modelResetMutation.mutate(serverId);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="서버 관리"
        description="ComfyUI / OpenAI / Gemini / Compatible 백엔드 등록 및 모델 동기화."
        sx={{ mb: 4 }}
        actions={(
          <>
            <Button variant="outlined" startIcon={<Refresh />} onClick={handleAllHealthCheck} disabled={allHealthCheckMutation.isLoading}>전체 헬스체크</Button>
            <Button variant="contained" startIcon={<Add />} onClick={handleAddServer}>서버 추가</Button>
          </>
        )}
      />

      {/* 요약 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, mb: 4.5 }}>
        {[
          { label: '서버', value: servers.length, suffix: '등록' },
          { label: '온라인', value: `${onlineCount} / ${servers.length}`, color: 'success.main' },
          { label: '실행 중 큐', value: activeQueue },
        ].map((st) => (
          <Paper key={st.label} variant="outlined" sx={{ p: 3.5 }}>
            <Typography sx={{ fontSize: 11, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 700, mt: 0.5, color: st.color }}>
              {st.value}{st.suffix && <Box component="span" sx={{ fontSize: 12, color: 'text.disabled', ml: 0.5 }}>{st.suffix}</Box>}
            </Typography>
          </Paper>
        ))}
      </Box>

      {servers.length === 0 ? (
        <EmptyState description="등록된 서버가 없습니다. 서버를 추가해주세요." />
      ) : (
        <Stack spacing={2.5}>
          {servers.map((server) => (
            <ServerCard
              key={server._id}
              server={server}
              onEdit={handleEditServer}
              onDelete={handleDeleteServer}
              onHealthCheck={handleHealthCheck}
              onLoraSync={handleLoraSync}
              loraSyncStatus={loraSyncStatuses[server._id]}
              onLoraResetSync={handleLoraResetSync}
              onModelSync={handleModelSync}
              modelSyncStatus={modelSyncStatuses[server._id]}
              onModelResetSync={handleModelResetSync}
            />
          ))}
        </Stack>
      )}

      {/* 서버 추가/편집 다이얼로그 */}
      <ServerDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedServer(null);
        }}
        server={selectedServer}
        onSubmit={(data) => serverMutation.mutate(data)}
      />

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>서버 삭제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            '{serverToDelete?.name}' 서버를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            이 서버를 사용하는 워크보드가 있으면 삭제할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>취소</Button>
          <Button
            onClick={() => deleteMutation.mutate(serverToDelete._id)}
            color="error"
            variant="contained"
            disabled={deleteMutation.isLoading}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ServerManagement;
