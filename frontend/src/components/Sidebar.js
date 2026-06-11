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
  Divider,
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

const DRAWER_WIDTH = 250;

const menuItems = [
  {
    text: '대시보드',
    path: '/dashboard',
    icon: <Dashboard />,
    roles: ['user', 'admin']
  },
  {
    text: '작업판',
    path: '/workboards',
    icon: <ViewModule />,
    roles: ['user', 'admin']
  },
  {
    text: '프로젝트',
    path: '/projects',
    icon: <FolderSpecial />,
    roles: ['user', 'admin']
  },
  {
    text: '내 컨텐츠',
    path: '/content',
    icon: <Image />,
    roles: ['user', 'admin']
  },
  {
    text: '작업 히스토리',
    path: '/jobs',
    icon: <History />,
    roles: ['user', 'admin']
  },
  {
    text: '프롬프트 데이터',
    path: '/prompt-data',
    icon: <TextSnippet />,
    roles: ['user', 'admin']
  },
  {
    text: '태그',
    path: '/tags',
    icon: <LocalOffer />,
    roles: ['user', 'admin']
  },
  {
    text: '설정',
    path: '/settings',
    icon: <Settings />,
    roles: ['user', 'admin']
  }
];

const adminMenuItems = [
  {
    text: '관리자 대시보드',
    path: '/admin/dashboard',
    icon: <AdminPanelSettings />,
    roles: ['admin']
  },
  {
    text: '사용자 관리',
    path: '/admin/users',
    icon: <People />,
    roles: ['admin']
  },
  {
    text: '작업판 관리',
    path: '/admin/workboards',
    icon: <Apps />,
    roles: ['admin']
  },
  {
    text: '서버 관리',
    path: '/admin/servers',
    icon: <Storage />,
    roles: ['admin']
  },
  {
    text: '모델 관리',
    path: '/admin/models',
    icon: <AutoFixHigh />,
    roles: ['admin']
  },
  {
    text: '그룹 관리',
    path: '/admin/groups',
    icon: <Group />,
    roles: ['admin']
  },
  {
    text: '시스템 통계',
    path: '/admin/stats',
    icon: <BarChart />,
    roles: ['admin']
  },
  {
    text: '백업 / 복구',
    path: '/admin/backup',
    icon: <Backup />,
    roles: ['admin']
  }
];

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

  const drawer = (
    <Box sx={{ height: '100%', bgcolor: 'navbar.main', color: 'navbar.contrastText' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ color: 'navbar.contrastText', fontWeight: 'bold' }}>
          메뉴
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'divider' }} />

      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                py: isMobile ? 1.5 : 1,
                bgcolor: isPathActive(item.path) ? 'navbar.light' : 'transparent',
                '&:hover': { bgcolor: 'navbar.light' },
              }}
            >
              <ListItemIcon sx={{ color: 'navbar.contrastText', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{
                  '& .MuiListItemText-primary': {
                    fontSize: isMobile ? '1rem' : '0.9rem',
                    fontWeight: isMobile ? 500 : 400,
                  },
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {isAdmin && (
        <>
          <Divider sx={{ borderColor: 'divider', my: 1 }} />

          <Box sx={{ px: 2, py: 1 }}>
            {/* 관리자 구분은 색이 아닌 섹션 라벨로 (#542 — 빨강 일괄 적용 제거, 핸드오프 중립 스타일) */}
            <Typography variant="overline" sx={{ color: 'grey.500', letterSpacing: '0.06em' }}>
              관리자 메뉴
            </Typography>
          </Box>

          <List sx={{ px: 1 }}>
            {adminMenuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    py: isMobile ? 1.5 : 1,
                    bgcolor: isPathActive(item.path) ? 'navbar.light' : 'transparent',
                    '&:hover': { bgcolor: 'navbar.light' },
                  }}
                >
                  <ListItemIcon sx={{ color: 'navbar.contrastText', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontSize: isMobile ? '1rem' : '0.9rem',
                        fontWeight: isMobile ? 500 : 400,
                      },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Box>
  );

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
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            bgcolor: 'navbar.main',  // 컨텐츠가 Paper 높이를 초과할 때 하단 흰색 노출 방지 (#327)
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* 데스크탑용 permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            position: 'relative',
            height: '100%',
            bgcolor: 'navbar.main',  // 컨텐츠가 Paper 높이를 초과할 때 하단 흰색 노출 방지 (#327)
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
}

export default Sidebar;