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
  Chat,
  LocalOffer
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
    text: '이미지 작업판',
    path: '/workboards',
    icon: <ViewModule />,
    roles: ['user', 'admin']
  },
  {
    text: '프롬프트 작업판',
    path: '/prompt-workboards',
    icon: <Chat />,
    roles: ['user', 'admin']
  },
  {
    text: '내 이미지',
    path: '/images',
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
    text: '태그 검색',
    path: '/tags',
    icon: <LocalOffer />,
    roles: ['user', 'admin']
  },
  {
    text: '내 태그 관리',
    path: '/tags/manage',
    icon: <LocalOffer />,
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
    text: '시스템 통계',
    path: '/admin/stats',
    icon: <BarChart />,
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
    <Box sx={{ height: '100%', backgroundColor: '#2c3e50', color: 'white' }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ color: '#ecf0f1', fontWeight: 'bold' }}>
          메뉴
        </Typography>
      </Box>
      
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
      
      <List sx={{ px: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                py: isMobile ? 1.5 : 1, // 모바일에서 터치하기 더 쉽게
                backgroundColor: isPathActive(item.path) ? '#34495e' : 'transparent',
                '&:hover': {
                  backgroundColor: '#34495e'
                }
              }}
            >
              <ListItemIcon sx={{ color: '#ecf0f1', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text}
                sx={{ 
                  '& .MuiListItemText-primary': {
                    fontSize: isMobile ? '1rem' : '0.9rem', // 모바일에서 더 큰 텍스트
                    fontWeight: isMobile ? 500 : 400
                  }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {isAdmin && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />
          
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ color: '#bdc3c7' }}>
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
                    py: isMobile ? 1.5 : 1, // 모바일에서 터치하기 더 쉽게
                    backgroundColor: isPathActive(item.path) ? '#34495e' : 'transparent',
                    '&:hover': {
                      backgroundColor: '#34495e'
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: '#e74c3c', minWidth: 40 }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    sx={{ 
                      '& .MuiListItemText-primary': {
                        fontSize: isMobile ? '1rem' : '0.9rem', // 모바일에서 더 큰 텍스트
                        fontWeight: isMobile ? 500 : 400,
                        color: '#e74c3c'
                      }
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
      sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
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
            height: '100%'
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