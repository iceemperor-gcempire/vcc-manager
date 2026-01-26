import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Box,
  Chip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { workboardAPI } from '../services/api';
import toast from 'react-hot-toast';

function LoraListModal({ open, onClose, workboardId, onAddLora }) {
  const [loraModels, setLoraModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open && workboardId) {
      fetchLoraModels();
    }
  }, [open, workboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // 검색 필터링
    if (searchQuery.trim() === '') {
      setFilteredModels(loraModels);
    } else {
      const filtered = loraModels.filter(model =>
        model.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredModels(filtered);
    }
  }, [searchQuery, loraModels]);

  const fetchLoraModels = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await workboardAPI.getLoraModels(workboardId);
      setLoraModels(response.data.loraModels || []);
      setLastFetched(response.data.lastFetched);
      setFromCache(response.data.fromCache);
    } catch (error) {
      console.error('Failed to fetch LoRA models:', error);
      setError(error.response?.data?.message || 'LoRA 모델을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const refreshLoraModels = async () => {
    setRefreshing(true);
    setError(null);
    
    try {
      const response = await workboardAPI.refreshLoraModels(workboardId);
      setLoraModels(response.data.loraModels || []);
      setLastFetched(response.data.lastFetched);
      setFromCache(false);
      toast.success('LoRA 모델 목록이 갱신되었습니다.');
    } catch (error) {
      console.error('Failed to refresh LoRA models:', error);
      setError(error.response?.data?.message || 'LoRA 모델 갱신에 실패했습니다.');
      toast.error('LoRA 모델 갱신에 실패했습니다.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddLora = (modelName) => {
    // 확장자 제거
    const nameWithoutExt = modelName.replace(/\.[^/.]+$/, '');
    const loraString = `<lora:${nameWithoutExt}:1>`;
    
    if (onAddLora) {
      onAddLora(loraString);
    }
    
    toast.success(`${nameWithoutExt} LoRA가 프롬프트에 추가되었습니다.`);
  };

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const formatLastFetched = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">LoRA 모델 목록</Typography>
          {fromCache && (
            <Chip 
              label="캐시됨" 
              size="small" 
              color="info"
              variant="outlined"
            />
          )}
        </Box>
        <IconButton onClick={handleClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            placeholder="LoRA 모델 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            onClick={refreshLoraModels}
            disabled={refreshing || loading}
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          >
            갱신
          </Button>
        </Box>

        {lastFetched && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            마지막 갱신: {formatLastFetched(lastFetched)}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {filteredModels.length === 0 ? (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ textAlign: 'center', py: 4 }}
              >
                {searchQuery ? '검색 결과가 없습니다.' : 'LoRA 모델이 없습니다.'}
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  총 {filteredModels.length}개의 LoRA 모델
                  {searchQuery && ` (전체 ${loraModels.length}개 중)`}
                </Typography>
                <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                  {filteredModels.map((model, index) => (
                    <ListItem
                      key={index}
                      divider
                      sx={{
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <ListItemText
                        primary={model}
                        secondary={`파일명: ${model.replace(/\.[^/.]+$/, '')}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleAddLora(model)}
                          color="primary"
                          size="small"
                        >
                          <AddIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </>
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

export default LoraListModal;