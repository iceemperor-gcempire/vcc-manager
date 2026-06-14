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
import { useTheme } from '@mui/material/styles';
import {
  Google as GoogleIcon,
  Visibility,
  VisibilityOff,
  Email,
  Lock
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout, { AuthTitle } from '../components/auth/AuthLayout';

function Login() {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/dashboard';
  
  // URL 파라미터에서 오류 확인 (Google OAuth 리디렉션용)
  React.useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const error = urlParams.get('error');
    
    if (error === 'pending') {
      toast.error('아직 관리자가 승인하지 않았습니다. 승인 완료까지 기다려주세요.', {
        duration: 6000,
        icon: '⏳',
      });
    } else if (error === 'rejected') {
      toast.error('가입이 거절되었습니다. 관리자에게 문의하시기 바랍니다.', {
        duration: 6000,
        icon: '❌',
      });
    } else if (error === 'auth_failed') {
      toast.error('인증 처리 중 오류가 발생했습니다.');
    }
    
    // URL에서 오류 파라미터 제거
    if (error) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search]);

  const { control, handleSubmit, formState: { errors } } = useForm();

  const signinMutation = useMutation({ mutationFn: authAPI.signin,
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
        const errorData = error.response?.data;
        
        if (errorData?.approvalStatus === 'pending') {
          toast.error('아직 관리자가 승인하지 않았습니다. 승인 완료까지 기다려주세요.', {
            duration: 6000,
            icon: '⏳',
          });
        } else if (errorData?.approvalStatus === 'rejected') {
          toast.error('가입이 거절되었습니다. 관리자에게 문의하시기 바랍니다.', {
            duration: 6000,
            icon: '❌',
            style: {
              background: theme.palette.error.light,
              color: theme.palette.error.main,
            },
          });
        } else {
          toast.error(errorData?.message || '로그인 실패');
        }
      } });

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
    <AuthLayout>
      <AuthTitle title="로그인" sub="VCC Manager 계정으로 계속하기" />

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

            <Box mb={2}>
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

            <Box textAlign="right" mb={3}>
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={() => navigate('/forgot-password')}
                sx={{ cursor: 'pointer' }}
              >
                비밀번호를 잊으셨나요?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={signinMutation.isPending}
              sx={{ mb: 3, py: 1.5 }}
            >
              {signinMutation.isPending ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '로그인'
              )}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
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
            <Typography variant="body2" color="text.secondary">
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

      <Typography variant="caption" display="block" mt={4} textAlign="center" color="text.secondary">
        로그인함으로써 서비스 약관 및 개인정보 보호정책에 동의합니다
      </Typography>
    </AuthLayout>
  );
}

export default Login;