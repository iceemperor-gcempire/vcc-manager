import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard,
  ViewModule,
  Image,
  History,
  AdminPanelSettings,
  People,
  Storage,
  BarChart,
  Apps,
  TextSnippet,
  LocalOffer,
  Settings,
  Backup,
  AutoFixHigh,
  FolderSpecial,
  Group
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BRAND_GRADIENTS } from '../utils/brandGradients';

const DRAWER_WIDTH = 236;

// v2 셸 (#558) — 섹션 재편: 작업 / 자료 / 관리자, 설정은 하단 고정
const workItems = [
  { text: '대시보드', path: '/dashboard', icon: <Dashboard /> },
  { text: '작업판', path: '/workboards', icon: <ViewModule /> },
  { text: '프로젝트', path: '/projects', icon: <FolderSpecial /> },
  { text: '내 컨텐츠', path: '/content', icon: <Image /> },
  { text: '작업 히스토리', path: '/jobs', icon: <History /> },
];

const dataItems = [
  { text: '프롬프트 데이터', path: '/prompt-data', icon: <TextSnippet /> },
  { text: '태그', path: '/tags', icon: <LocalOffer /> },
];

const adminMenuItems = [
  { text: '관리자 대시보드', path: '/admin/dashboard', icon: <AdminPanelSettings /> },
  { text: '사용자 관리', path: '/admin/users', icon: <People /> },
  { text: '작업판 관리', path: '/admin/workboards', icon: <Apps /> },
  { text: '서버 관리', path: '/admin/servers', icon: <Storage /> },
  { text: '모델 관리', path: '/admin/models', icon: <AutoFixHigh /> },
  { text: '그룹 관리', path: '/admin/groups', icon: <Group /> },
  { text: '시스템 통계', path: '/admin/stats', icon: <BarChart /> },
  { text: '백업 / 복구', path: '/admin/backup', icon: <Backup /> },
];

const settingsItem = { text: '설정', path: '/settings', icon: <Settings /> };

function SectionLabel({ children }) {
  return (
    <Typography variant="overline" sx={{ display: 'block', px: 3, pt: 3.5, pb: 1, color: 'text.tertiary' }}>
      {children}
    </Typography>
  );
}

function Sidebar({ mobileOpen, onMobileToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleNavigation = (path) => {
    navigate(path);
    if (isMobile && onMobileToggle) {
      onMobileToggle();
    }
  };

  const isPathActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const renderItem = (item) => {
    const active = isPathActive(item.path);
    return (
      <ListItem key={item.text} disablePadding>
        <ListItemButton
          onClick={() => handleNavigation(item.path)}
          sx={{
            borderRadius: '9px',
            mb: 0.25,
            py: isMobile ? 1.5 : 1,
            px: 3,
            // 활성 = surface 픽 + 그림자 (라이트) / 민트 틴트 표면 (다크) — v2 셸 시안
            bgcolor: active ? 'navbar.light' : 'transparent',
            boxShadow: active ? 1 : 'none',
            color: active
              ? (theme.palette.mode === 'dark' ? 'primary.main' : 'primary.dark')
              : 'navbar.contrastText',
            '&:hover': { bgcolor: 'navbar.light' },
          }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 36, '& svg': { fontSize: 19 } }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            sx={{
              '& .MuiListItemText-primary': {
                fontSize: isMobile ? '1rem' : '0.85rem',
                fontWeight: active ? 700 : 500,
              },
            }}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'navbar.main', color: 'navbar.contrastText' }}>
      {/* 로고 블록 — 탑바에서 사이드바로 이동 (#558) */}
      <Box
        onClick={() => handleNavigation('/dashboard')}
        sx={{ display: 'flex', alignItems: 'center', gap: 2.5, px: 3.5, pt: 4, pb: 2, cursor: 'pointer' }}
      >
        <Box sx={{
          width: 28, height: 28, borderRadius: 2, background: BRAND_GRADIENTS[0],
          color: 'common.white', display: 'grid', placeItems: 'center',
          fontSize: 13, fontWeight: 800,
        }}>
          V
        </Box>
        <Typography sx={{ fontSize: 14.5, fontWeight: 800 }}>VCC Manager</Typography>
      </Box>

      <SectionLabel>작업</SectionLabel>
      <List sx={{ px: 2, py: 0 }}>{workItems.map(renderItem)}</List>

      <SectionLabel>자료</SectionLabel>
      <List sx={{ px: 2, py: 0 }}>{dataItems.map(renderItem)}</List>

      {isAdmin && (
        <>
          <SectionLabel>관리자</SectionLabel>
          <List sx={{ px: 2, py: 0 }}>{adminMenuItems.map(renderItem)}</List>
        </>
      )}

      {/* 설정 — 하단 고정 */}
      <Box sx={{ mt: 'auto' }}>
        <List sx={{ px: 2, py: 2 }}>{renderItem(settingsItem)}</List>
      </Box>
    </Box>
  );

  // 라이트: 배경과 한 몸(보더 없음) / 다크: 콘솔 레일 + 보더 — v2 셸 시안
  const paperSx = {
    boxSizing: 'border-box',
    width: DRAWER_WIDTH,
    bgcolor: 'navbar.main',
    borderRight: (t) => (t.palette.mode === 'dark' ? `1px solid ${t.palette.divider}` : 'none'),
  };

  return (
    <Box
      component="nav"
      sx={{
        width: { md: DRAWER_WIDTH },
        flexShrink: { md: 0 },
        // 사이드바 영역 자체의 배경색을 drawer paper 와 동일하게 — 컨텐츠 짧을 때 / 스크롤 시 흰 영역 노출 방지 (PC 도)
        bgcolor: { md: 'navbar.main' },
      }}
    >
      {/* 모바일용 temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileToggle}
        ModalProps={{
          keepMounted: true, // 성능 향상
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': paperSx, // 컨텐츠가 Paper 높이를 초과할 때 하단 흰색 노출 방지 (#327)
        }}
      >
        {drawer}
      </Drawer>

      {/* 데스크탑용 permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { ...paperSx, position: 'relative', height: '100%' },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
}

export default Sidebar;
