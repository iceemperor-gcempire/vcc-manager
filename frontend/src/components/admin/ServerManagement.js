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
  Stack
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
  Sync as SyncIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { serverAPI } from '../../services/api';

function ServerCard({ server, onEdit, onDelete, onHealthCheck, onLoraSync, loraSyncStatus }) {
  const [healthChecking, setHealthChecking] = useState(false);
  const isComfyUI = server.serverType === 'ComfyUI';
  const isSyncing = loraSyncStatus?.status === 'fetching';

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
      case 'OpenAI Compatible':
        return <TextFields />;
      default:
        return <Storage />;
    }
  };

  const getOutputTypeColor = (outputType) => {
    return outputType === 'Image' ? 'primary' : 'secondary';
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    try {
      await onHealthCheck(server._id);
    } finally {
      setHealthChecking(false);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* 서버 이름 및 상태 */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {server.name}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {server.description || '설명 없음'}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {!server.isActive && <Chip label="비활성" size="small" color="default" />}
            <Chip 
              icon={getStatusIcon(server.healthCheck?.status)}
              label={server.healthCheck?.status || 'unknown'}
              size="small"
              color={getStatusColor(server.healthCheck?.status)}
            />
          </Box>
        </Box>

        {/* 서버 정보 */}
        <Stack spacing={1}>
          <Box display="flex" alignItems="center" gap={1}>
            {getTypeIcon(server.serverType)}
            <Typography variant="body2">
              <strong>타입:</strong> {server.serverType}
            </Typography>
          </Box>
          
          <Typography variant="body2">
            <strong>URL:</strong> {server.serverUrl}
          </Typography>
          
          <Box display="flex" alignItems="center" gap={1}>
            <Chip 
              label={server.outputType}
              size="small" 
              color={getOutputTypeColor(server.outputType)}
              variant="outlined"
            />
          </Box>

          {/* 헬스체크 정보 */}
          {server.healthCheck?.lastChecked && (
            <Box>
              <Typography variant="caption" color="textSecondary">
                마지막 확인: {new Date(server.healthCheck.lastChecked).toLocaleString()}
              </Typography>
              {server.healthCheck.responseTime && (
                <Typography variant="caption" color="textSecondary" display="block">
                  응답시간: {server.healthCheck.responseTime}ms
                </Typography>
              )}
              {server.healthCheck.errorMessage && (
                <Typography variant="caption" color="error" display="block">
                  오류: {server.healthCheck.errorMessage}
                </Typography>
              )}
            </Box>
          )}

          {/* LoRA 동기화 정보 (ComfyUI 서버만) */}
          {isComfyUI && loraSyncStatus && (
            <Box>
              {loraSyncStatus.totalLoras > 0 ? (
                <>
                  <Typography variant="caption" color="textSecondary">
                    LoRA: {loraSyncStatus.lorasWithMetadata}/{loraSyncStatus.totalLoras}개 (메타데이터 있음)
                  </Typography>
                  {loraSyncStatus.lastCivitaiSync && (
                    <Typography variant="caption" color="textSecondary" display="block">
                      마지막 동기화: {new Date(loraSyncStatus.lastCivitaiSync).toLocaleString()}
                    </Typography>
                  )}
                </>
              ) : (
                <Typography variant="caption" color="textSecondary">
                  LoRA: 동기화 필요
                </Typography>
              )}
            </Box>
          )}
        </Stack>
      </CardContent>
      
      <CardActions>
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
          <Tooltip title={isSyncing ? `LoRA 동기화 중... (${loraSyncStatus?.progress?.current || 0}/${loraSyncStatus?.progress?.total || 0})` : 'LoRA 동기화'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onLoraSync(server._id)}
                disabled={isSyncing}
                color={loraSyncStatus?.totalLoras > 0 ? 'primary' : 'default'}
              >
                {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
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
      </CardActions>
    </Card>
  );
}

function ServerDialog({ open, onClose, server, onSubmit }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    serverType: 'ComfyUI',
    serverUrl: '',
    outputType: 'Image',
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
        outputType: server.outputType || 'Image',
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
        outputType: 'Image',
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
                <InputLabel>서버 타입</InputLabel>
                <Select
                  value={formData.serverType}
                  onChange={(e) => setFormData(prev => ({ ...prev, serverType: e.target.value }))}
                  label="서버 타입"
                >
                  <MenuItem value="ComfyUI">ComfyUI</MenuItem>
                  <MenuItem value="OpenAI Compatible">OpenAI Compatible</MenuItem>
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
            
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                label="서버 URL"
                value={formData.serverUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, serverUrl: e.target.value }))}
                error={!!errors.serverUrl}
                helperText={errors.serverUrl}
                placeholder="http://localhost:8188"
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>출력 타입</InputLabel>
                <Select
                  value={formData.outputType}
                  onChange={(e) => setFormData(prev => ({ ...prev, outputType: e.target.value }))}
                  label="출력 타입"
                >
                  <MenuItem value="Image">Image</MenuItem>
                  <MenuItem value="Text">Text</MenuItem>
                </Select>
              </FormControl>
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

  const queryClient = useQueryClient();

  // 서버 목록 조회
  const { data: serversData, isLoading } = useQuery(
    ['servers'],
    () => serverAPI.getServers({ includeInactive: true }),
    { refetchInterval: 30000 } // 30초마다 갱신
  );

  // ComfyUI 서버들의 LoRA 동기화 상태 조회
  const servers = serversData?.data?.data?.servers || [];
  const comfyUIServers = servers.filter(s => s.serverType === 'ComfyUI');

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

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">서버 관리</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleAllHealthCheck}
            disabled={allHealthCheckMutation.isLoading}
          >
            전체 헬스체크
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleAddServer}
          >
            서버 추가
          </Button>
        </Box>
      </Box>

      {servers.length === 0 ? (
        <Alert severity="info">
          등록된 서버가 없습니다. 서버를 추가해주세요.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {servers.map((server) => (
            <Grid item xs={12} md={6} lg={4} key={server._id}>
              <ServerCard
                server={server}
                onEdit={handleEditServer}
                onDelete={handleDeleteServer}
                onHealthCheck={handleHealthCheck}
                onLoraSync={handleLoraSync}
                loraSyncStatus={loraSyncStatuses[server._id]}
              />
            </Grid>
          ))}
        </Grid>
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