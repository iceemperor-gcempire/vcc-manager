import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Workboards from './pages/Workboards';
import PromptWorkboards from './pages/PromptWorkboards';
import ImageGeneration from './pages/ImageGeneration';
import PromptGeneration from './pages/PromptGeneration';
import MyImages from './pages/MyImages';
import JobHistory from './pages/JobHistory';
import PromptDataList from './pages/PromptDataList';
import Profile from './pages/Profile';
import TagSearch from './pages/TagSearch';
import TagManagement from './pages/TagManagement';
import {
  AdminDashboardPage,
  UserManagementPage,
  WorkboardManagementPage,
  ServerManagementPage,
  SystemStatsPage
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

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <div className="App">
              <Toaster position="top-right" />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const queryClient = useQueryClient();

  // 특정 메뉴 선택 시 쿼리 무효화 (작업 히스토리, 내 이미지)
  useEffect(() => {
    const refreshPaths = ['/jobs', '/images'];
    if (refreshPaths.includes(location.pathname)) {
      queryClient.invalidateQueries('recentJobs');
      queryClient.invalidateQueries('generatedImages');
      queryClient.invalidateQueries('uploadedImages');
    }
  }, [location.pathname, queryClient]);

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onMobileToggle={handleMobileToggle} />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <Sidebar mobileOpen={mobileOpen} onMobileToggle={handleMobileToggle} />
        <Box component="main" sx={{ 
          flexGrow: 1, 
          p: 3, 
          backgroundColor: '#f5f5f5',
          minHeight: 'calc(100vh - 64px)'
        }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/workboards" element={<Workboards />} />
            <Route path="/prompt-workboards" element={<PromptWorkboards />} />
            <Route path="/generate/:id" element={<ImageGeneration />} />
            <Route path="/prompt-generate/:workboardId" element={<PromptGeneration />} />
            <Route path="/images" element={<MyImages />} />
            <Route path="/jobs" element={<JobHistory />} />
            <Route path="/prompt-data" element={<PromptDataList />} />
            <Route path="/tags" element={<TagSearch />} />
            <Route path="/tags/manage" element={<TagManagement />} />
            <Route path="/profile" element={<Profile />} />
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
              path="/admin/servers"
              element={
                <AdminRoute>
                  <ServerManagementPage />
                </AdminRoute>
              }
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