import React, { useEffect, useMemo, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Search, Clear } from '@mui/icons-material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { workboardAPI } from '../../services/api';

// 백엔드 목록 API 의 limit 상한 — 이보다 많으면 많이 쓴 순으로 잘린다
export const WORKBOARD_SELECT_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 250;

// 서버 검색(이름·설명 정규식, 대소문자 무시)과 같은 기준으로 받아 둔 목록을 바로 거른다.
// 서버 응답을 기다리는 동안에도 입력한 대로 바로 줄어들게 하려는 것이다.
export const matchesWorkboardSearch = (workboard, term) => {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [workboard.name, workboard.description].some((v) => (v || '').toLowerCase().includes(q));
};

function WorkboardSelectDialog({ open, onClose, onSelect }) {
  // 본 다이얼로그는 image / video 작업판으로 다른 작업판 이어가기 용. text 작업판은 제외.
  // 작업판이 많으면 50개 밖의 판은 목록에 안 나오므로, 검색어를 서버에도 넘겨 전체에서 찾는다 (#1192).
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) {
      setInput('');
      setSearch('');
    }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['workboards', { limit: WORKBOARD_SELECT_LIMIT, isActive: true, search }],
    queryFn: () => workboardAPI.getAll({ isActive: true, limit: WORKBOARD_SELECT_LIMIT, ...(search ? { search } : {}) }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const allWorkboards = useMemo(() => data?.data?.workboards || [], [data]);
  const total = data?.data?.pagination?.total ?? allWorkboards.length;
  const truncated = total > allWorkboards.length;
  const workboards = useMemo(
    () => allWorkboards
      .filter((wb) => (wb.outputFormat || 'image') !== 'text')
      .filter((wb) => matchesWorkboardSearch(wb, input)),
    [allWorkboards, input]
  );
  const searching = input.trim() !== '';

  const handleKeyDown = (e) => {
    // 한글 조합 중 Enter 는 조합 확정이라 선택으로 보지 않는다
    if (e.key === 'Enter' && !e.nativeEvent?.isComposing && workboards.length > 0) {
      e.preventDefault();
      onSelect(workboards[0]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>작업판 선택</DialogTitle>
      <Box sx={{ px: 6, pb: 2 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="작업판 이름·설명으로 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          inputProps={{ 'aria-label': '작업판 검색' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {isFetching && !isLoading && <CircularProgress size={16} sx={{ mr: 1 }} />}
                {input && (
                  <IconButton size="small" aria-label="검색어 지우기" onClick={() => setInput('')}>
                    <Clear fontSize="small" />
                  </IconButton>
                )}
              </InputAdornment>
            )
          }}
        />
        {truncated && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {searching
              ? `검색 결과가 많아 ${WORKBOARD_SELECT_LIMIT}개까지만 보입니다. 검색어를 더 입력하세요.`
              : `많이 쓴 순으로 ${WORKBOARD_SELECT_LIMIT}개까지만 보입니다. 찾는 판이 없으면 검색하세요.`}
          </Typography>
        )}
      </Box>
      <DialogContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : workboards.length === 0 ? (
          searching
            ? (isFetching
              ? <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>
              : <Alert severity="info">"{input.trim()}" 에 맞는 작업판이 없습니다.</Alert>)
            : <Alert severity="info">사용 가능한 작업판이 없습니다.</Alert>
        ) : (
          <Grid container spacing={2}>
            {workboards.map((workboard) => (
              <Grid item xs={12} key={workboard._id}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                  onClick={() => onSelect(workboard)}
                >
                  <CardContent>
                    <Typography variant="subtitle1">{workboard.name}</Typography>
                    {workboard.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        title={workboard.description}
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {workboard.description}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
      </DialogActions>
    </Dialog>
  );
}

export default WorkboardSelectDialog;
