import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  Lock,
  Visibility,
  VisibilityOff,
  ArrowBack,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from 'react-query';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

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

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm();
  const watchedPassword = watch('password');

  // Verify token on page load
  const { data: tokenData, isLoading: isVerifying, isError: isTokenError } = useQuery(
    ['verifyResetToken', token],
    () => authAPI.verifyResetToken(token),
    {
      retry: false,
      refetchOnWindowFocus: false
    }
  );

  const resetPasswordMutation = useMutation(
    (data) => authAPI.resetPassword({ token, ...data }),
    {
      onSuccess: () => {
        setResetSuccess(true);
        toast.success('비밀번호가 성공적으로 변경되었습니다');
      },
      onError: (error) => {
        const message = error.response?.data?.message || '비밀번호 재설정 중 오류가 발생했습니다';
        toast.error(message);
      }
    }
  );

  const onSubmit = (data) => {
    resetPasswordMutation.mutate(data);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Token verification loading state
  if (isVerifying) {
    return (
      <Container maxWidth="sm">
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%', textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>토큰 검증 중...</Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Invalid or expired token
  if (isTokenError || (tokenData && !tokenData.data?.valid)) {
    return (
      <Container maxWidth="sm">
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
            <Box textAlign="center" mb={3}>
              <Typography variant="h4" gutterBottom color="error">
                링크 만료
              </Typography>
            </Box>

            <Alert severity="error" sx={{ mb: 3 }}>
              <Typography variant="body2">
                비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.
              </Typography>
            </Alert>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              비밀번호 재설정 링크는 1시간 동안만 유효합니다.
              새로운 링크를 요청하려면 아래 버튼을 클릭해주세요.
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/forgot-password')}
              sx={{ mb: 2 }}
            >
              새 링크 요청하기
            </Button>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/login')}
            >
              로그인 페이지로 돌아가기
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Reset success state
  if (resetSuccess) {
    return (
      <Container maxWidth="sm">
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
            <Box textAlign="center" mb={3}>
              <CheckCircle color="success" sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h4" gutterBottom>
                비밀번호 변경 완료
              </Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                비밀번호가 성공적으로 변경되었습니다.
              </Typography>
            </Alert>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              새 비밀번호로 로그인해주세요.
            </Typography>

            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ py: 1.5 }}
            >
              로그인 페이지로 이동
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Password reset form
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
              새 비밀번호 설정
            </Typography>
            <Typography variant="body1" color="textSecondary">
              새로운 비밀번호를 입력해주세요
            </Typography>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Box mb={3}>
              <Controller
                name="password"
                control={control}
                defaultValue=""
                rules={{
                  required: '비밀번호를 입력해주세요',
                  minLength: {
                    value: 8,
                    message: '비밀번호는 최소 8자 이상이어야 합니다'
                  },
                  validate: (value) => {
                    const { requirements, score } = validatePassword(value);

                    if (!requirements.length) {
                      return '비밀번호는 최소 8자 이상이어야 합니다';
                    }
                    if (!requirements.uppercase) {
                      return '비밀번호에 대문자를 포함해야 합니다';
                    }
                    if (!requirements.lowercase) {
                      return '비밀번호에 소문자를 포함해야 합니다';
                    }
                    if (!requirements.number) {
                      return '비밀번호에 숫자를 포함해야 합니다';
                    }
                    if (!requirements.special) {
                      return '비밀번호에 특수문자(!@#$%^&*)를 포함해야 합니다';
                    }

                    return score >= 4 || '비밀번호 조건을 모두 만족해야 합니다';
                  }
                }}
                render={({ field }) => (
                  <Box>
                    <TextField
                      {...field}
                      fullWidth
                      label="새 비밀번호"
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
                defaultValue=""
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
              disabled={resetPasswordMutation.isLoading}
              sx={{ mb: 3, py: 1.5 }}
            >
              {resetPasswordMutation.isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '비밀번호 변경'
              )}
            </Button>
          </form>

          <Box textAlign="center">
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/login')}
              sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}
            >
              <ArrowBack fontSize="small" />
              로그인 페이지로 돌아가기
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default ResetPassword;
