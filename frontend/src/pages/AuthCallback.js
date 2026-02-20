import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Container, Box, CircularProgress, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Error is still passed via query parameter (not sensitive)
      const queryError = searchParams.get('error');
      if (queryError) {
        setError(queryError);
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      // Token is now passed via URL fragment (#token=...) for security
      const hash = window.location.hash;
      let token = null;
      if (hash) {
        const hashParams = new URLSearchParams(hash.substring(1));
        token = hashParams.get('token');
      }

      if (token) {
        // Remove token from URL immediately to prevent exposure via history/referrer
        window.history.replaceState(null, '', window.location.pathname);

        try {
          login(token);
          navigate('/dashboard');
        } catch (err) {
          console.error('Login failed:', err);
          setError('login_failed');
          setTimeout(() => navigate('/login'), 3000);
        }
      } else {
        console.error('No token received');
        setError('no_token');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, login, navigate]);

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
