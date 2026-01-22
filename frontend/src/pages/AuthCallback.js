import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (token) {
        try {
          login(token);
          navigate('/dashboard');
        } catch (error) {
          console.error('Login failed:', error);
          setTimeout(() => navigate('/login'), 3000);
        }
      } else {
        console.error('No token received');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

  const error = searchParams.get('error');

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        gap={2}
      >
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>
              로그인 중 오류가 발생했습니다: {error}
            </Alert>
            <Typography variant="body2" color="textSecondary">
              잠시 후 로그인 페이지로 이동합니다...
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress size={60} />
            <Typography variant="h6" gutterBottom>
              로그인 중...
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Google 계정으로 로그인을 처리하고 있습니다.
            </Typography>
          </>
        )}
      </Box>
    </Container>
  );
}

export default AuthCallback;