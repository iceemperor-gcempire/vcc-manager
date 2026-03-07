import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { serverAPI } from '../services/api';

function ModelListModal({
  open,
  onClose,
  serverId,
  selectedModel,
  onSelectModel
}) {
  const [checkpointModels, setCheckpointModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastFetched, setLastFetched] = useState(null);

  const fetchModels = useCallback(async (forceRefresh = false) => {
    if (!serverId) {
      setError('서버 ID가 없어 모델 목록을 불러올 수 없습니다.');
      return;
    }

    setError(null);
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await serverAPI.getCheckpointModels(serverId, forceRefresh ? { refresh: true } : undefined);
      const data = response.data?.data || {};
      setCheckpointModels(data.checkpointModels || []);
      setLastFetched(data.lastFetched || null);
    } catch (err) {
      console.error('Failed to fetch checkpoint models:', err);
      setError(err.response?.data?.message || '모델 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (open) {
      fetchModels();
    } else {
      setSearchQuery('');
    }
  }, [open, fetchModels]);

  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return checkpointModels;
    return checkpointModels.filter((modelPath) => modelPath.toLowerCase().includes(query));
  }, [checkpointModels, searchQuery]);

  const formatDate = (dateString) => {
    if (!dateString) return '없음';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const handleSelectModel = (modelPath) => {
    onSelectModel(modelPath);
    toast.success('체크포인트 모델이 선택되었습니다.');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">체크포인트 모델 목록</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            placeholder="모델 경로 검색..."
            sx={{ flexGrow: 1, minWidth: 240 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="outlined"
            onClick={() => fetchModels(true)}
            disabled={loading || refreshing || !serverId}
            startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshIcon />}
          >
            새로고침
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          마지막 갱신: {formatDate(lastFetched)} | 검색 결과 {filteredModels.length}개
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : filteredModels.length === 0 ? (
          <Alert severity="info">
            {searchQuery ? '검색 결과가 없습니다.' : '체크포인트 모델이 없습니다.'}
          </Alert>
        ) : (
          <Box sx={{ display: 'grid', gap: 1 }}>
            {filteredModels.map((modelPath) => (
              <Card key={modelPath} variant={selectedModel === modelPath ? 'elevation' : 'outlined'} elevation={selectedModel === modelPath ? 3 : 0}>
                <CardActionArea onClick={() => handleSelectModel(modelPath)}>
                  <CardContent sx={{ py: 1.5 }}>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {modelPath}
                    </Typography>
                    {selectedModel === modelPath && (
                      <Chip label="선택됨" size="small" color="primary" sx={{ mt: 1 }} />
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ModelListModal;
