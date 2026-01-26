import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  IconButton,
  Box,
  Chip,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  AccountCircle,
  Settings,
  Logout,
  AdminPanelSettings,
  Dashboard,
  Menu as MenuIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Header({ onMobileToggle }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfile = () => {
    navigate('/profile');
    handleMenuClose();
  };

  const handleAdmin = () => {
    navigate('/admin');
    handleMenuClose();
  };

  const handleDashboard = () => {
    navigate('/dashboard');
    handleMenuClose();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    handleMenuClose();
  };

  return (
    <AppBar position="static" sx={{ backgroundColor: '#34495e' }}>
      <Toolbar>
        {/* 모바일 메뉴 버튼 */}
        {isMobile && onMobileToggle && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMobileToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        
        <Typography 
          variant="h6" 
          component="div" 
          sx={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          {isMobile ? 'VCCM' : 'Visual Content Creator'}
        </Typography>
        
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isAdmin && (
              <Chip
                label="Admin"
                color="secondary"
                size="small"
                variant="outlined"
                sx={{ color: 'white', borderColor: 'white' }}
              />
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
                {user.nickname}
              </Typography>
              <IconButton
                size="large"
                onClick={handleMenuOpen}
                color="inherit"
              >
                {user.avatar ? (
                  <Avatar src={user.avatar} sx={{ width: 32, height: 32 }} />
                ) : (
                  <AccountCircle />
                )}
              </IconButton>
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              onClick={handleMenuClose}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    ml: -0.5,
                    mr: 1,
                  },
                },
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {!isMobile && (
                <MenuItem onClick={handleDashboard}>
                  <ListItemIcon>
                    <Dashboard fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>대시보드</ListItemText>
                </MenuItem>
              )}
              
              <MenuItem onClick={handleProfile}>
                <ListItemIcon>
                  <Settings fontSize="small" />
                </ListItemIcon>
                <ListItemText>프로필 설정</ListItemText>
              </MenuItem>
              
              {isAdmin && (
                <MenuItem onClick={handleAdmin}>
                  <ListItemIcon>
                    <AdminPanelSettings fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>관리자 패널</ListItemText>
                </MenuItem>
              )}
              
              <Divider />
              
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText>로그아웃</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Header;