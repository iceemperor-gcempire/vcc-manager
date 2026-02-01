import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userAPI } from '../services/api';
import toast from 'react-hot-toast';

function Settings() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    'userProfile',
    () => userAPI.getProfile(),
    { staleTime: 0 }
  );

  const updateMutation = useMutation(
    (preferences) => userAPI.updateProfile({ preferences }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('userProfile');
        toast.success('설정이 저장되었습니다');
      },
      onError: (error) => {
        toast.error('설정 저장 실패: ' + error.message);
      }
    }
  );

  const preferences = data?.data?.user?.preferences || {};

  const handleToggle = (key) => (event) => {
    updateMutation.mutate({
      [key]: event.target.checked
    });
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          설정을 불러오는 중 오류가 발생했습니다: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={4}>
        <SettingsIcon fontSize="large" color="primary" />
        <Typography variant="h4">
          설정
        </Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          삭제 동작 설정
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          작업 히스토리와 컨텐츠(이미지/동영상) 삭제 시의 동작을 설정합니다.
        </Typography>

        <Box sx={{ ml: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.deleteContentWithHistory || false}
                onChange={handleToggle('deleteContentWithHistory')}
                disabled={updateMutation.isLoading}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  작업 히스토리 삭제 시 연관 컨텐츠도 같이 삭제
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  이 옵션이 켜져 있으면 히스토리 삭제 시 생성된 이미지나 동영상도 같이 삭제됩니다. 삭제 전에 확인 창이 표시됩니다.
                </Typography>
              </Box>
            }
            sx={{ display: 'flex', alignItems: 'flex-start', my: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={preferences.deleteHistoryWithContent || false}
                onChange={handleToggle('deleteHistoryWithContent')}
                disabled={updateMutation.isLoading}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  컨텐츠 삭제 시 작업 히스토리도 같이 삭제
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  이 옵션이 켜져 있으면 이미지/동영상 삭제 시 해당 작업 히스토리도 같이 삭제됩니다. 삭제 전에 확인 창이 표시됩니다.
                </Typography>
              </Box>
            }
            sx={{ display: 'flex', alignItems: 'flex-start', my: 2 }}
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          작업 계속하기 설정
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          작업 히스토리에서 "계속하기" 기능 사용 시의 동작을 설정합니다.
        </Typography>

        <Box sx={{ ml: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={preferences.useRandomSeedOnContinue || false}
                onChange={handleToggle('useRandomSeedOnContinue')}
                disabled={updateMutation.isLoading}
              />
            }
            label={
              <Box>
                <Typography variant="body1">
                  계속하기 시 무조건 랜덤 시드 사용
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  이 옵션이 켜져 있으면 히스토리에서 "계속하기"로 작업판을 호출했을 때 랜덤 시드 스위치가 자동으로 켜집니다.
                </Typography>
              </Box>
            }
            sx={{ display: 'flex', alignItems: 'flex-start', my: 2 }}
          />
        </Box>
      </Paper>
    </Container>
  );
}

export default Settings;
