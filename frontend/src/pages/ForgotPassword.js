import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  TextField,
  Link,
  InputAdornment,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Email,
  ArrowBack
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';

function ForgotPassword() {
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const { control, handleSubmit, formState: { errors } } = useForm();

  const forgotPasswordMutation = useMutation(
    (email) => authAPI.requestPasswordReset(email),
    {
      onSuccess: (response, email) => {
        setEmailSent(true);
        setSentEmail(email);
        toast.success('비밀번호 재설정 이메일이 발송되었습니다');
      },
      onError: (error) => {
        const message = error.response?.data?.message || '요청 처리 중 오류가 발생했습니다';
        toast.error(message);
      }
    }
  );

  const onSubmit = (data) => {
    forgotPasswordMutation.mutate(data.email);
  };

  if (emailSent) {
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
              <Typography variant="h4" gutterBottom>
                이메일 발송 완료
              </Typography>
            </Box>

            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>{sentEmail}</strong>로 비밀번호 재설정 링크를 발송했습니다.
              </Typography>
            </Alert>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정해주세요.
              링크는 1시간 동안 유효합니다.
            </Typography>

            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.
            </Typography>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/login')}
              sx={{ mt: 2 }}
            >
              로그인 페이지로 돌아가기
            </Button>
          </Paper>
        </Box>
      </Container>
    );
  }

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
              비밀번호 찾기
            </Typography>
            <Typography variant="body1" color="textSecondary">
              가입하신 이메일 주소를 입력해주세요
            </Typography>
          </Box>

          <form onSubmit={handleSubmit(onSubmit)}>
            <Box mb={3}>
              <Controller
                name="email"
                control={control}
                defaultValue=""
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
                    autoFocus
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

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                비밀번호 재설정 링크가 포함된 이메일을 보내드립니다.
                Google 계정으로 가입하신 경우 이메일/비밀번호 재설정을 사용하실 수 없습니다.
              </Typography>
            </Alert>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={forgotPasswordMutation.isLoading}
              sx={{ mb: 3, py: 1.5 }}
            >
              {forgotPasswordMutation.isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                '비밀번호 재설정 이메일 발송'
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

export default ForgotPassword;
