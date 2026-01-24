import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box } from '@mui/material';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute check:', { 
    path: location.pathname, 
    hasUser: !!user, 
    loading,
    userEmail: user?.email 
  });

  if (loading) {
    console.log('⏳ Still loading auth state');
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    console.log('❌ No user found, redirecting to login');
    // Store the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('✅ User authenticated, allowing access');
  return children;
}

export default ProtectedRoute;