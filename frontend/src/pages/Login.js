import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Divider,
  Link,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress
} from '@mui/material';
import {
  Google as GoogleIcon,
  Visibility,
  VisibilityOff,
  Email,
  Lock
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/dashboard';

  const { control, handleSubmit, formState: { errors } } = useForm();

  const signinMutation = useMutation(
    authAPI.signin,
    {
      onSuccess: async (response) => {
        console.log('🔐 Login success, token received:', !!response.data.token);
        
        try {
          // 토큰을 저장하고 사용자 정보를 가져온 후 리다이렉트
          await login(response.data.token);
          
          console.log('✅ User authenticated, navigating to:', from);
          toast.success(response.data.message);
          
          // React state가 업데이트될 때까지 잠시 기다린 후 navigation
          setTimeout(() => {
            navigate(from, { replace: true });
          }, 100);
        } catch (error) {
          console.error('❌ Login process failed:', error);
          toast.error('로그인 처리 중 오류가 발생했습니다.');
        }
      },
      onError: (error) => {
        console.error('❌ Login failed:', error.response?.data);
        toast.error(error.response?.data?.message || '로그인 실패');
      }
    }
  );

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const onSubmit = (data) => {
    signinMutation.mutate(data);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box textAlign="center" mb={4}>
            <Typography variant="h4" gutterBottom>
              Visual Content Creator
            </Typography>
            <Typography variant="body1" color="textSecondary">
              AI 이미지 생성 도구에 액세스하려면 로그인하세요
            </Typography>
          </Box>

          {/* Email/Password Login Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box mb={3}>
              <Controller
                name="email"
                control={control}
                rules={{
                  required: '이메일을 입력해주세요',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: '올바른 이메일 형식을 입력해주세요'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="이메일"
                    type="email"
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Box>

            <Box mb={3}>
              <Controller
                name="password"
                control={control}
                rules={{
                  required: '비밀번호를 입력해주세요'
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="비밀번호"
                    type={showPassword ? 'text' : 'password'}
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={togglePasswordVisibility}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={signinMutation.isLoading}
              sx={{ mb: 3, py: 1.5 }}
            >
              {signinMutation.isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '로그인'
              )}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="textSecondary">
              또는
            </Typography>
          </Divider>

          {/* Google Login */}
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            sx={{ mb: 3, py: 1.5 }}
          >
            Google로 로그인
          </Button>

          {/* Sign Up Link */}
          <Box textAlign="center">
            <Typography variant="body2" color="textSecondary">
              계정이 없으신가요?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/signup')}
                sx={{ cursor: 'pointer' }}
              >
                회원가입
              </Link>
            </Typography>
          </Box>

          <Typography variant="caption" display="block" mt={3} textAlign="center" color="textSecondary">
            로그인함으로써 서비스 약관 및 개인정보 보호정책에 동의합니다
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login;