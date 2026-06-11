import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { buildVccTheme } from './theme';
import { ColorSchemeProvider, useColorScheme } from './contexts/ColorSchemeContext';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import CommandPalette from './components/common/CommandPalette';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Workboards from './pages/Workboards';
import ImageGeneration from './pages/ImageGeneration';
import PromptGeneration from './pages/PromptGeneration';
import MyImages from './pages/MyImages';
import JobHistory from './pages/JobHistory';
import PromptDataList from './pages/PromptDataList';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import TagSearch from './pages/TagSearch';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import {
  AdminDashboardPage,
  UserManagementPage,
  WorkboardManagementPage,
  WorkboardEditorPage,
  WorkboardCreatePage,
  ServerManagementPage,
  SystemStatsPage,
  BackupRestorePage,
  MetadataManagementPage,
  GroupManagementPage
} from './pages/admin';
import AuthCallback from './pages/AuthCallback';

import './App.css';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function ThemedApp({ children }) {
  // ColorScheme 변화에 반응해 light/dark theme 재계산
  const { effective } = useColorScheme();
  const theme = useMemo(() => createTheme(buildVccTheme(effective)), [effective]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ColorSchemeProvider>
        <ThemedApp>
          <AuthProvider>
            <Router>
              <div className="App">
                <Toaster position="top-right" />
                <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </div>
          </Router>
          </AuthProvider>
        </ThemedApp>
      </ColorSchemeProvider>
    </QueryClientProvider>
  );
}

function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();

  // 특정 메뉴 선택 시 쿼리 무효화 (작업 히스토리, 내 컨텐츠)
  useEffect(() => {
    const refreshPaths = ['/jobs', '/content'];
    if (refreshPaths.includes(location.pathname)) {
      queryClient.invalidateQueries('historyJobs');
      queryClient.invalidateQueries('generatedImages');
      queryClient.invalidateQueries('uploadedImages');
      queryClient.invalidateQueries('generatedVideos');
    }
  }, [location.pathname, queryClient]);

  // ⌘K / Ctrl+K 로 명령 팔레트 열기 (Phase 6)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onMobileToggle={handleMobileToggle} onOpenPalette={() => setPaletteOpen(true)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <Sidebar mobileOpen={mobileOpen} onMobileToggle={handleMobileToggle} />
        <Box component="main" sx={{
          flexGrow: 1,
          minWidth: 0, // flex item 이 content intrinsic width 로 늘어나 body 가로 스크롤 유발하는 것 방지 (#383)
          overflowX: 'hidden',
          // 디자인 .vcc-body: padding 24px 32px 48px (모바일 16px). theme.spacing=4 → px/4.
          pt: { xs: 4, sm: 6 },   // 16 / 24px
          px: { xs: 4, sm: 8 },   // 16 / 32px
          pb: { xs: 4, sm: 12 },  // 16 / 48px
          bgcolor: 'background.default',
          minHeight: 'calc(100vh - 64px)'
        }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workboards" element={<Workboards />} />
            <Route path="/prompt-workboards" element={<Navigate to="/workboards" replace />} />
            <Route path="/generate/:id" element={<ImageGeneration />} />
            <Route path="/prompt-generate/:workboardId" element={<PromptGeneration />} />
            <Route path="/content" element={<MyImages />} />
            <Route path="/images" element={<Navigate to="/content" replace />} />
            <Route path="/jobs" element={<JobHistory />} />
            <Route path="/prompt-data" element={<PromptDataList />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/tags" element={<TagSearch />} />
            {/* LoRA 목록 메뉴 제거 — 이제 작업판 실행 화면에서만 조회. 직접 접근은 작업판으로 리다이렉트 */}
            <Route path="/loras" element={<Navigate to="/workboards" replace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/workboards"
              element={
                <AdminRoute>
                  <WorkboardManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/workboards/new"
              element={
                <AdminRoute>
                  <WorkboardCreatePage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/workboards/:id/edit"
              element={
                <AdminRoute>
                  <WorkboardEditorPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/servers"
              element={
                <AdminRoute>
                  <ServerManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/models"
              element={
                <AdminRoute>
                  <MetadataManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <AdminRoute>
                  <GroupManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/loras"
              element={<Navigate to="/admin/models" replace />}
            />
            <Route
              path="/admin/stats"
              element={
                <AdminRoute>
                  <SystemStatsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/backup"
              element={
                <AdminRoute>
                  <BackupRestorePage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
          </Routes>
        </Box>
      </Box>
    </Box>
  );
}

export default App;