import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Avatar,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Card,
  CardContent,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Save,
  Delete,
  Security,
  Palette,
  Language,
  Info,
  Warning,
  Person,
  Email,
  AdminPanelSettings
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { userAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

function StatCard({ title, value, subtitle }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center' }}>
        <Typography variant="h4" component="div" gutterBottom>
          {value}
        </Typography>
        <Typography color="textSecondary" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function AccountSettings() {
  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);

  const { control, handleSubmit, formState: { errors }, watch } = useForm({
    defaultValues: {
      nickname: user?.nickname || '',
      preferences: {
        language: user?.preferences?.language || 'ko',
        theme: user?.preferences?.theme || 'light'
      }
    }
  });

  // 폼 값 변경 감지
  const watchedValues = watch();
  React.useEffect(() => {
    const hasChanges = 
      watchedValues.nickname !== user?.nickname ||
      watchedValues.preferences?.language !== user?.preferences?.language ||
      watchedValues.preferences?.theme !== user?.preferences?.theme;
    setIsDirty(hasChanges);
  }, [watchedValues, user]);

  const updateMutation = useMutation(
    userAPI.updateProfile,
    {
      onSuccess: (data) => {
        updateProfile(data.data.user);
        queryClient.invalidateQueries('userProfile');
        toast.success('프로필이 업데이트되었습니다');
        setIsDirty(false);
      },
      onError: (error) => {
        toast.error('업데이트 실패: ' + error.message);
      }
    }
  );

  const onSubmit = (data) => {
    updateMutation.mutate(data);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        계정 설정
      </Typography>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>
          {/* 기본 정보 */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              기본 정보
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="이메일"
              value={user?.email || ''}
              disabled
              helperText="이메일은 변경할 수 없습니다"
              InputProps={{
                startAdornment: <Email sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="nickname"
              control={control}
              rules={{ 
                required: '닉네임을 입력해주세요',
                minLength: { value: 2, message: '닉네임은 2자 이상이어야 합니다' }
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="닉네임"
                  error={!!errors.nickname}
                  helperText={errors.nickname?.message}
                  InputProps={{
                    startAdornment: <Person sx={{ mr: 1, color: 'action.active' }} />
                  }}
                />
              )}
            />
          </Grid>

          {/* 환경설정 */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>
              환경설정
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="preferences.language"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>언어</InputLabel>
                  <Select {...field} label="언어">
                    <MenuItem value="ko">한국어</MenuItem>
                    <MenuItem value="en">English</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="preferences.theme"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>테마</InputLabel>
                  <Select {...field} label="테마">
                    <MenuItem value="light">라이트</MenuItem>
                    <MenuItem value="dark">다크</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>

          {/* 관리자 상태 표시 */}
          {user?.isAdmin && (
            <Grid item xs={12}>
              <Alert severity="info" icon={<AdminPanelSettings />}>
                관리자 권한을 가지고 있습니다. 관리자 패널에서 시스템을 관리할 수 있습니다.
              </Alert>
            </Grid>
          )}
        </Grid>

        <Box mt={3}>
          <Button
            type="submit"
            variant="contained"
            disabled={!isDirty || updateMutation.isLoading}
            startIcon={<Save />}
          >
            {updateMutation.isLoading ? '저장 중...' : '변경사항 저장'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
}

function SecuritySettings() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    userAPI.deleteAccount,
    {
      onSuccess: () => {
        toast.success('계정이 삭제되었습니다');
        logout();
      },
      onError: (error) => {
        toast.error('계정 삭제 실패: ' + error.message);
      }
    }
  );

  const handleDeleteAccount = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          보안 설정
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <Security />
            </ListItemIcon>
            <ListItemText
              primary="Google OAuth 인증"
              secondary="Google 계정으로 안전하게 로그인됩니다"
            />
          </ListItem>
          
          <Divider />
          
          <ListItem>
            <ListItemIcon>
              <Warning color="error" />
            </ListItemIcon>
            <ListItemText
              primary="계정 삭제"
              secondary="계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다"
            />
            <Button
              color="error"
              variant="outlined"
              onClick={() => setDeleteDialogOpen(true)}
              startIcon={<Delete />}
            >
              계정 삭제
            </Button>
          </ListItem>
        </List>
      </Paper>

      {/* 계정 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>계정 삭제 확인</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            이 작업은 되돌릴 수 없습니다!
          </Alert>
          <Typography paragraph>
            계정을 삭제하면 다음 데이터가 모두 삭제됩니다:
          </Typography>
          <ul>
            <li>프로필 정보</li>
            <li>업로드한 모든 이미지</li>
            <li>생성한 모든 이미지</li>
            <li>작업 히스토리</li>
          </ul>
          <Typography variant="body2" color="error">
            정말로 계정을 삭제하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            취소
          </Button>
          <Button
            onClick={handleDeleteAccount}
            color="error"
            variant="contained"
            disabled={deleteMutation.isLoading}
          >
            {deleteMutation.isLoading ? '삭제 중...' : '계정 삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Profile() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);

  const { data: userStats, isLoading } = useQuery(
    'userStats',
    userAPI.getStats
  );

  const stats = userStats?.data || {};

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(1) + ' MB';
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <Avatar
          src={user?.avatar}
          sx={{ width: 80, height: 80, mr: 3 }}
        >
          {user?.nickname?.charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h4" gutterBottom>
            {user?.nickname || '사용자'}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            {user?.email}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            가입일: {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
          </Typography>
        </Box>
      </Box>

      {/* 통계 카드 */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="전체 작업"
            value={stats.jobs?.total || 0}
            subtitle="완료된 이미지 생성 작업"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="생성된 이미지"
            value={stats.images?.generated || 0}
            subtitle="AI로 생성한 이미지"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="업로드한 이미지"
            value={stats.images?.uploaded || 0}
            subtitle="참고용으로 업로드한 이미지"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="처리 중인 작업"
            value={stats.jobs?.processing || 0}
            subtitle="현재 진행 중인 작업"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <AccountSettings />
        </Grid>
        <Grid item xs={12} md={4}>
          <SecuritySettings />
        </Grid>
      </Grid>
    </Container>
  );
}

export default Profile;