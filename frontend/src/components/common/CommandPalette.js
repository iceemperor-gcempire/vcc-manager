import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  Box,
  Typography,
  InputBase,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Folder as FolderIcon,
  ViewModule as WorkboardIcon,
  AccountTree as PipelineIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Image as ImageIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { projectAPI, workboardAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const KBD = ({ children }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      px: 0.5,
      borderRadius: 0.5,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 10,
      fontWeight: 600,
      color: 'text.secondary',
      lineHeight: 1,
    }}
  >
    {children}
  </Box>
);

export default function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const { data: projData, isLoading: projLoading } = useQuery(
    'cmdk-projects',
    () => projectAPI.getAll({ limit: 100 }),
    { enabled: open, staleTime: 60_000 }
  );
  const { data: wbData, isLoading: wbLoading } = useQuery(
    'cmdk-workboards',
    () => workboardAPI.getAll(),
    { enabled: open, staleTime: 60_000 }
  );

  const projects = projData?.data?.data?.projects || projData?.data?.projects || [];
  const workboards = wbData?.data?.workboards || wbData?.data?.data?.workboards || [];

  const commands = useMemo(() => {
    const items = [];
    projects.forEach((p) => {
      items.push({
        group: '프로젝트',
        icon: <FolderIcon fontSize="small" />,
        name: p.name,
        hint: p.description?.slice(0, 60),
        action: () => navigate(`/projects/${p._id}`),
      });
    });
    workboards.forEach((wb) => {
      items.push({
        group: '작업판',
        icon: <WorkboardIcon fontSize="small" />,
        name: wb.name,
        hint: `${wb.serverId?.name || ''}${wb.outputFormat ? ` · ${wb.outputFormat}` : ''}`.trim() || undefined,
        action: () => navigate(
          `${wb.outputFormat === 'text' ? '/prompt-generate' : '/generate'}/${wb._id}`
        ),
      });
    });
    items.push(
      {
        group: '명령',
        icon: <AddIcon fontSize="small" />,
        name: '새 프로젝트 만들기',
        action: () => navigate('/projects?new=1'),
      },
      {
        group: '명령',
        icon: <FolderIcon fontSize="small" />,
        name: '프로젝트 목록',
        action: () => navigate('/projects'),
      },
      {
        group: '명령',
        icon: <ImageIcon fontSize="small" />,
        name: '내 컨텐츠',
        action: () => navigate('/content'),
      },
      {
        group: '명령',
        icon: <PipelineIcon fontSize="small" />,
        name: '대시보드',
        action: () => navigate('/dashboard'),
      },
      {
        group: '명령',
        icon: <PersonIcon fontSize="small" />,
        name: '프로필 / 설정',
        kbd: ['⌘', ','],
        action: () => navigate('/profile'),
      },
    );
    if (isAdmin) {
      items.push({
        group: '명령',
        icon: <AdminIcon fontSize="small" />,
        name: '관리자 패널',
        action: () => navigate('/admin'),
      });
    }
    items.push({
      group: '명령',
      icon: <SettingsIcon fontSize="small" />,
      name: '작업 히스토리',
      action: () => navigate('/jobs'),
    });
    return items;
  }, [projects, workboards, isAdmin, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.name} ${c.hint || ''} ${c.group}`.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const groupOrder = ['프로젝트', '작업판', '명령'];
  const grouped = useMemo(() => {
    const acc = {};
    filtered.forEach((c) => {
      (acc[c.group] = acc[c.group] || []).push(c);
    });
    return acc;
  }, [filtered]);
  const groups = groupOrder.filter((g) => grouped[g]?.length > 0);
  const flat = groups.flatMap((g) => grouped[g]);

  useEffect(() => {
    setSel(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 키보드 nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        const target = flat[sel];
        if (target?.action) {
          target.action();
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, sel, onClose]);

  // 선택 항목이 보이도록 스크롤
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const isLoading = projLoading || wbLoading;

  let runningIdx = 0;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          mt: '12vh',
          alignSelf: 'flex-start',
          borderRadius: 1.5,
          overflow: 'hidden',
        },
      }}
      BackdropProps={{
        sx: { backdropFilter: 'blur(6px)', bgcolor: 'rgba(0,0,0,0.5)' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <SearchIcon sx={{ color: 'text.tertiary' }} />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="프로젝트 · 작업판 · 명령 검색…"
          sx={{ flex: 1, fontSize: 16 }}
        />
        <KBD>ESC</KBD>
      </Box>

      <Box ref={listRef} sx={{ maxHeight: 420, overflow: 'auto', p: 0.75 }}>
        {isLoading && flat.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={20} />
          </Box>
        ) : flat.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
            "{query}" 에 대한 결과가 없습니다.
          </Box>
        ) : (
          groups.map((g) => (
            <Box key={g}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  px: 1.5,
                  pt: 1,
                  pb: 0.5,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'text.secondary',
                }}
              >
                {g}
              </Typography>
              {grouped[g].map((c) => {
                const myIdx = runningIdx++;
                const active = sel === myIdx;
                return (
                  <Box
                    key={`${c.group}-${c.name}-${myIdx}`}
                    data-active={active}
                    onMouseEnter={() => setSel(myIdx)}
                    onClick={() => { c.action(); onClose(); }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: active ? 'action.selected' : 'transparent',
                    }}
                  >
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: 0.75,
                        bgcolor: active ? 'primary.main' : 'action.hover',
                        color: active ? 'primary.contrastText' : 'text.secondary',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {c.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                        {c.name}
                      </Typography>
                      {c.hint && (
                        <Typography variant="caption" color="text.secondary" noWrap display="block" sx={{ mt: 0.25 }}>
                          {c.hint}
                        </Typography>
                      )}
                    </Box>
                    {c.kbd && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {c.kbd.map((k, i) => (<KBD key={i}>{k}</KBD>))}
                      </Box>
                    )}
                    {active && <ArrowForwardIcon fontSize="small" sx={{ color: 'text.tertiary' }} />}
                  </Box>
                );
              })}
            </Box>
          ))
        )}
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          fontSize: 11,
          color: 'text.secondary',
        }}
      >
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <KBD>↑</KBD><KBD>↓</KBD> 이동
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <KBD>↵</KBD> 선택
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <KBD>⌘</KBD><KBD>K</KBD> 닫기
        </Box>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {flat.length}개 결과
        </Typography>
      </Box>
    </Dialog>
  );
}
