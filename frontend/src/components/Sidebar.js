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
  AdminPanelSettings
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
    text: '작업판 선택',
    path: '/workboards',
    icon: <ViewModule />,
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
  }
];

const adminMenuItems = [
  {
    text: '관리자 패널',
    path: '/admin',
    icon: <AdminPanelSettings />,
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
                    fontSize: '0.9rem'
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
                        fontSize: '0.9rem',
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
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileToggle}
          ModalProps={{
            keepMounted: true,
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
      ) : (
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
      )}
    </Box>
  );
}

export default Sidebar;