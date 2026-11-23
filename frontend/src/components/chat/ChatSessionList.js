import React, { useState } from 'react';
import {
  Box, Button, List, ListItemButton, Typography, IconButton, Menu, MenuItem, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import { Add, MoreHoriz } from '@mui/icons-material';
import { relativeTime } from '../../utils/relativeTime';

// 채팅 화면 왼쪽 — 대화 목록 (#1288). 새 대화, 지난 대화 열기, 제목 바꾸기, 삭제.
export default function ChatSessionList({ sessions, activeId, loading, onSelect, onNew, onRename, onDelete }) {
  const [menu, setMenu] = useState(null);       // { anchor, session }
  const [renaming, setRenaming] = useState(null); // { session, title }

  const submitRename = () => {
    const title = renaming.title.trim();
    if (!title) return;
    onRename(renaming.session, title);
    setRenaming(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ p: 3 }}>
        <Button fullWidth variant="contained" startIcon={<Add />} onClick={onNew}>새 대화</Button>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, pb: 2 }}>
        {loading && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress size={20} /></Box>
        )}
        {!loading && sessions.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.tertiary', textAlign: 'center', py: 6 }}>
            아직 대화가 없습니다.
          </Typography>
        )}
        <List disablePadding>
          {sessions.map((s) => {
            const active = s._id === activeId;
            return (
              <ListItemButton
                key={s._id}
                selected={active}
                onClick={() => onSelect(s)}
                sx={{ borderRadius: '9px', mb: 0.5, py: 2, pl: 3, pr: 1, alignItems: 'flex-start', gap: 1 }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontSize: 13.5, fontWeight: active ? 700 : 500 }}>
                    {s.title || '제목 없는 대화'}
                  </Typography>
                  <Typography noWrap variant="caption" sx={{ color: 'text.tertiary', display: 'block' }}>
                    {[s.status === 'processing' ? '응답 중' : relativeTime(s.updatedAt), s.workboardId?.name].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={`${s.title || '대화'} 메뉴`}
                  onClick={(e) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget, session: s }); }}
                >
                  <MoreHoriz fontSize="small" />
                </IconButton>
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setRenaming({ session: menu.session, title: menu.session.title || '' }); setMenu(null); }}>
          제목 바꾸기
        </MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { const s = menu.session; setMenu(null); onDelete(s); }}>
          삭제
        </MenuItem>
      </Menu>

      <Dialog open={!!renaming} onClose={() => setRenaming(null)} maxWidth="xs" fullWidth>
        <DialogTitle>제목 바꾸기</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth size="small" sx={{ mt: 1 }}
            label="제목"
            value={renaming?.title || ''}
            inputProps={{ maxLength: 200 }}
            onChange={(e) => setRenaming((r) => ({ ...r, title: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitRename(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenaming(null)}>취소</Button>
          <Button variant="contained" disabled={!renaming?.title.trim()} onClick={submitRename}>저장</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
