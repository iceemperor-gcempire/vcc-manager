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
  ButtonBase,
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
  Menu as MenuIcon,
  Search as SearchIcon,
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  BrightnessAuto as SystemModeIcon,
  Check as CheckIcon,
  Dns as DnsIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useColorScheme } from '../contexts/ColorSchemeContext';
import { serverAPI } from '../services/api';
import { MONO } from '../theme';
import { BRAND_GRADIENTS } from '../utils/brandGradients';
import NotificationsPopover from './common/NotificationsPopover';

// 탑바 필 공통 스타일 — v2 셸 (#558)
const pillSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: 999,
  boxShadow: 1,
};

// 서버 상태 필 — GET /servers (일반 사용자 접근 가능) 실데이터
function ServerStatusPill({ isAdmin }) {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['servers'], queryFn: () => serverAPI.getServers(),
    staleTime: 30000,
    refetchInterval: 60000, });
  const servers = data?.data?.data?.servers || [];
  if (!servers.length) return null;

  const healthy = servers.filter((s) => s.healthCheck?.status === 'healthy').length;
  const allOk = healthy === servers.length;

  return (
    <ButtonBase
      onClick={isAdmin ? () => navigate('/admin/servers') : undefined}
      disabled={!isAdmin}
      sx={{
        ...pillSx,
        gap: 1.5,
        px: 3,
        py: 1.25,
        bgcolor: allOk ? 'success.light' : 'warning.light',
        borderColor: 'transparent',
        boxShadow: 'none',
        display: { xs: 'none', sm: 'flex' },
      }}
      title={isAdmin ? '서버 관리로 이동' : undefined}
    >
      <DnsIcon sx={{ fontSize: 13, color: allOk ? 'success.main' : 'warning.main' }} />
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: allOk ? 'success.main' : 'warning.main' }}>
        서버 {healthy}/{servers.length} {allOk ? '정상' : '점검 필요'}
      </Typography>
    </ButtonBase>
  );
}

function Header({ onMobileToggle, onOpenPalette }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
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
    <AppBar position="static" sx={{ bgcolor: 'navbar.main' }}>
      <Toolbar sx={{ gap: 3 }}>
        {/* 모바일 메뉴 버튼 + 로고 (데스크탑 로고는 사이드바로 이동, #558) */}
        {isMobile && (
          <>
            {onMobileToggle && (
              <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={onMobileToggle}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography
              variant="h6"
              component="div"
              sx={{ cursor: 'pointer', fontWeight: 800 }}
              onClick={() => navigate('/dashboard')}
            >
              VCCM
            </Typography>
          </>
        )}

        {user && (
          <>
            {/* 검색 필 — 기존 ⌘K 명령 팔레트의 가시화 (프로젝트·작업판 검색 + 페이지 이동) */}
            {onOpenPalette && !isMobile && (
              <ButtonBase onClick={onOpenPalette} sx={{ ...pillSx, flexBasis: 320, px: 4, py: 1.75, justifyContent: 'flex-start' }}>
                <SearchIcon sx={{ fontSize: 15, color: 'text.tertiary' }} />
                <Typography sx={{ fontSize: 12.5, color: 'text.tertiary', flex: 1, textAlign: 'left' }}>
                  작업판 · 프로젝트 검색
                </Typography>
                <Box component="span" sx={{
                  fontFamily: MONO, fontSize: 10, color: 'text.tertiary',
                  border: 1, borderColor: 'divider', borderRadius: 1, px: 1.25, py: 0.25,
                }}>
                  ⌘K
                </Box>
              </ButtonBase>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
              <ServerStatusPill isAdmin={isAdmin} />

              {/* 모바일에선 검색 아이콘으로 대체 */}
              {onOpenPalette && isMobile && (
                <IconButton color="inherit" onClick={onOpenPalette} title="검색 (⌘K)">
                  <SearchIcon />
                </IconButton>
              )}

              {/* 알림 popover */}
              <NotificationsPopover />

              {/* 프로필 필 — 아바타 + 닉네임 + Admin 칩 (#558) */}
              <ButtonBase onClick={handleMenuOpen} sx={{ ...pillSx, gap: 2, pl: 1, pr: 3, py: 0.75 }}>
                {user.avatar ? (
                  <Avatar src={user.avatar} sx={{ width: 24, height: 24 }} />
                ) : (
                  <Avatar sx={{ width: 24, height: 24, background: BRAND_GRADIENTS[0] }}>
                    <AccountCircle sx={{ fontSize: 18 }} />
                  </Avatar>
                )}
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.primary', display: { xs: 'none', sm: 'block' } }}>
                  {user.nickname}
                </Typography>
                {isAdmin && (
                  <Box component="span" sx={{
                    fontSize: 10, fontWeight: 700, borderRadius: 999, px: 1.75, py: 0.25,
                    bgcolor: 'primary.light',
                    color: theme.palette.mode === 'dark' ? 'primary.main' : 'primary.dark',
                  }}>
                    Admin
                  </Box>
                )}
              </ButtonBase>
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

              {/* 다크모드 설정 (Phase 7) */}
              {[
                { v: 'system', label: '시스템 설정 따름', icon: <SystemModeIcon fontSize="small" /> },
                { v: 'light',  label: '라이트',          icon: <LightModeIcon fontSize="small" /> },
                { v: 'dark',   label: '다크',            icon: <DarkModeIcon fontSize="small" /> },
              ].map((opt) => (
                <MenuItem
                  key={opt.v}
                  onClick={(e) => { e.stopPropagation(); setColorMode(opt.v); }}
                  selected={colorMode === opt.v}
                >
                  <ListItemIcon>{opt.icon}</ListItemIcon>
                  <ListItemText>{opt.label}</ListItemText>
                  {colorMode === opt.v && <CheckIcon fontSize="small" sx={{ color: 'primary.main' }} />}
                </MenuItem>
              ))}

              <Divider />

              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                <ListItemText>로그아웃</ListItemText>
              </MenuItem>
            </Menu>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default Header;
