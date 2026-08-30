import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItemButton,
  ListItemText,
  Checkbox,
  CircularProgress,
  TextField,
  InputAdornment,
  Tabs,
  Tab
} from '@mui/material';
import { Search, MusicNote } from '@mui/icons-material';
import { imageAPI } from '../../services/api';
import Pagination from './Pagination';
import { MONO } from '../../theme';

// 오디오는 분 단위가 흔해 mm:ss 로 보여준다 (비디오 목록의 "N초" 표기와 다른 이유).
const formatDuration = (seconds) => {
  if (seconds == null) return '길이 미상';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// 참조 오디오 선택 다이얼로그 (#772) — VideoSelectDialog 와 대칭이지만 그리드가 아닌 목록이다.
// 오디오는 썸네일이 없어 MediaGrid 를 쓸 수 없다. 파일명·길이로 식별하고 인라인 재생으로 확인한다.
//
// 생성한 오디오 탭 (#841): v4.0.0 에서 오디오가 출력 형식이 되면서(MiniMax Music 3) 만든 곡을
// 참조로 다시 쓰는 흐름이 생겼다. Video 다이얼로그와 같은 두 탭 구조. 선택 결과의 `audioType` 은
// 소비처가 필요하면 쓰도록 넣어 두었고, 백엔드는 id 로 업로드본→생성물 순으로 찾는다.
function AudioSelectDialog({
  open,
  onClose,
  onSelect,
  title = '오디오 선택',
  multiple = false,
  maxAudios = 1,
  initialSelected = []
}) {
  const [selected, setSelected] = useState([]);
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);   // 0 업로드한 · 1 생성한 (#841)

  useEffect(() => {
    if (open) {
      setSelected(initialSelected);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchAudios = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10, search };
      const res = tab === 0 ? await imageAPI.getUploadedAudios(params) : await imageAPI.getAudios(params);
      setAudios(res.data.audios || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch {
      setAudios([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, tab]);

  useEffect(() => {
    if (open) fetchAudios();
  }, [open, fetchAudios]);

  const isSelected = (audio) => selected.some((s) => s.audioId === audio._id);

  const toggle = (audio) => {
    const entry = { audioId: audio._id, audio, audioType: tab === 0 ? 'uploaded' : 'generated' };
    if (isSelected(audio)) {
      setSelected(selected.filter((s) => s.audioId !== audio._id));
    } else if (multiple) {
      if (selected.length < maxAudios) setSelected([...selected, entry]);
    } else {
      setSelected([entry]);
    }
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onSelect(multiple ? selected : selected[0]);
    onClose();
    setSelected([]);
  };

  const handleClose = () => {
    onClose();
    setSelected([]);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {title}
        {multiple && (
          <Typography variant="body2" color="text.secondary">
            {selected.length}/{maxAudios} 선택됨
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={(e, v) => { setTab(v); setPage(1); }} sx={{ mb: 2 }}>
          <Tab label="업로드한 오디오" />
          <Tab label="생성한 오디오" />
        </Tabs>
        <TextField
          fullWidth
          size="small"
          placeholder="파일명으로 검색"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            )
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : audios.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <MusicNote sx={{ fontSize: 40, opacity: 0.4, mb: 1 }} />
            <Typography variant="body2">
              {search ? '검색 결과가 없습니다' : (tab === 0 ? '업로드한 오디오가 없습니다' : '생성한 오디오가 없습니다')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {audios.map((audio) => (
              <ListItemButton
                key={audio._id}
                onClick={() => toggle(audio)}
                selected={isSelected(audio)}
                sx={{ borderRadius: 1, mb: 0.5, alignItems: 'flex-start' }}
              >
                <Checkbox
                  edge="start"
                  checked={isSelected(audio)}
                  tabIndex={-1}
                  disableRipple
                  sx={{ mt: 0.5 }}
                />
                <ListItemText
                  primary={audio.originalName || audio.filename}
                  secondary={
                    <Box component="span" sx={{ display: 'block' }}>
                      <Typography component="span" variant="caption" sx={{ fontFamily: MONO }}>
                        {formatDuration(audio.metadata?.duration)}
                        {audio.metadata?.channels ? ` · ${audio.metadata.channels}ch` : ''}
                        {audio.metadata?.sampleRate ? ` · ${Math.round(audio.metadata.sampleRate / 1000)}kHz` : ''}
                      </Typography>
                      <Box
                        component="audio"
                        controls
                        preload="none"
                        src={audio.url}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ display: 'block', width: '100%', mt: 0.5, height: 32 }}
                      />
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {totalPages > 1 && (
          <Box sx={{ mt: 2 }}>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={selected.length === 0}>
          선택
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AudioSelectDialog;
