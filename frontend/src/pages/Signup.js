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
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Google as GoogleIcon,
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  Person,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from 'react-query';
import { debounce } from 'lodash';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const validatePassword = (password) => {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password)
  };

  const score = Object.values(requirements).filter(Boolean).length;
  return { requirements, score };
};

function PasswordStrengthIndicator({ password }) {
  const { requirements, score } = validatePassword(password || '');
  
  const getColor = () => {
    if (score < 2) return 'error';
    if (score < 4) return 'warning';
    if (score < 5) return 'info';
    return 'success';
  };

  const getLabel = () => {
    if (score < 2) return '약함';
    if (score < 4) return '보통';
    if (score < 5) return '강함';
    return '매우 강함';
  };

  return (
    <Box mt={1}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="caption">비밀번호 강도</Typography>
        <Typography variant="caption" color={`${getColor()}.main`}>
          {getLabel()}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(score / 5) * 100}
        color={getColor()}
        sx={{ height: 6, borderRadius: 3 }}
      />
      <Box mt={1}>
        {Object.entries(requirements).map(([key, met]) => (
          <Typography
            key={key}
            variant="caption"
            display="block"
            color={met ? 'success.main' : 'text.secondary'}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            {met ? <CheckCircle sx={{ fontSize: 12 }} /> : <ErrorIcon sx={{ fontSize: 12 }} />}
            {key === 'length' && '8자 이상'}
            {key === 'uppercase' && '대문자 포함'}
            {key === 'lowercase' && '소문자 포함'}
            {key === 'number' && '숫자 포함'}
            {key === 'special' && '특수문자 포함 (!@#$%^&*)'}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/dashboard';

  const { control, handleSubmit, watch, formState: { errors } } = useForm();
  const watchedEmail = watch('email');
  const watchedNickname = watch('nickname');
  const watchedPassword = watch('password');
  const watchedConfirmPassword = watch('confirmPassword');

  // Debounced email check
  const debouncedEmailCheck = debounce(async (email) => {
    if (email && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      return authAPI.checkEmail(email);
    }
    return null;
  }, 500);

  // Debounced nickname check
  const debouncedNicknameCheck = debounce(async (nickname) => {
    if (nickname && nickname.length >= 2) {
      return authAPI.checkNickname(nickname);
    }
    return null;
  }, 500);

  const signupMutation = useMutation(
    authAPI.signup,
    {
      onSuccess: (response) => {
        login(response.data.token);
        toast.success(response.data.message);
        navigate('/dashboard');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '회원가입 실패');
      }
    }
  );

  const handleGoogleSignup = () => {
    window.location.href = '/api/auth/google';
  };

  const onSubmit = (data) => {
    // 서버에서 전체 검증을 수행하므로 모든 데이터를 전송
    signupMutation.mutate(data);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        py={4}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box textAlign="center" mb={4}>
            <Typography variant="h4" gutterBottom>
              회원가입
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Visual Content Creator에 오신 것을 환영합니다
            </Typography>
          </Box>

          {/* Email/Password Signup Form */}
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
                name="nickname"
                control={control}
                rules={{
                  required: '닉네임을 입력해주세요',
                  minLength: {
                    value: 2,
                    message: '닉네임은 최소 2자 이상이어야 합니다'
                  },
                  maxLength: {
                    value: 50,
                    message: '닉네임은 50자를 초과할 수 없습니다'
                  },
                  pattern: {
                    value: /^[a-zA-Z0-9가-힣_\s]+$/,
                    message: '닉네임은 한글, 영문, 숫자, 밑줄, 공백만 사용할 수 있습니다'
                  }
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="닉네임"
                    error={!!errors.nickname}
                    helperText={errors.nickname?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person />
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
                  required: '비밀번호를 입력해주세요',
                  minLength: {
                    value: 8,
                    message: '비밀번호는 최소 8자 이상이어야 합니다'
                  },
                  validate: (value) => {
                    const { score } = validatePassword(value);
                    return score >= 4 || '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다';
                  }
                }}
                render={({ field }) => (
                  <Box>
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
                    {watchedPassword && (
                      <PasswordStrengthIndicator password={watchedPassword} />
                    )}
                  </Box>
                )}
              />
            </Box>

            <Box mb={3}>
              <Controller
                name="confirmPassword"
                control={control}
                rules={{
                  required: '비밀번호 확인을 입력해주세요',
                  validate: (value) => 
                    value === watchedPassword || '비밀번호가 일치하지 않습니다'
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="비밀번호 확인"
                    type={showConfirmPassword ? 'text' : 'password'}
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={toggleConfirmPasswordVisibility}
                            edge="end"
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
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
              disabled={signupMutation.isLoading}
              sx={{ mb: 3, py: 1.5 }}
            >
              {signupMutation.isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '회원가입'
              )}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="textSecondary">
              또는
            </Typography>
          </Divider>

          {/* Google Signup */}
          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignup}
            sx={{ mb: 3, py: 1.5 }}
          >
            Google로 회원가입
          </Button>

          {/* Sign In Link */}
          <Box textAlign="center">
            <Typography variant="body2" color="textSecondary">
              이미 계정이 있으신가요?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/login')}
                sx={{ cursor: 'pointer' }}
              >
                로그인
              </Link>
            </Typography>
          </Box>

          <Typography variant="caption" display="block" mt={3} textAlign="center" color="textSecondary">
            회원가입함으로써 서비스 약관 및 개인정보 보호정책에 동의합니다
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}

export default Signup;