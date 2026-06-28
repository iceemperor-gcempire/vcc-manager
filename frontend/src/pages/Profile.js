import React, { useState } from 'react';
import { copyToClipboard } from '../utils/clipboard';
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
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Tooltip,
  InputAdornment
} from '@mui/material';
import {
  Save,
  Delete,
  Security,
  Warning,
  Person,
  Email,
  AdminPanelSettings,
  VpnKey,
  ContentCopy,
  Add
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { userAPI, apiKeyAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { MONO } from '../theme';
import { BRAND_GRADIENTS } from '../utils/brandGradients';

// v2 스탯 카드 — outlined + mono 숫자 (#564)
function StatCard({ title, value, subtitle }) {
  return (
    <Paper variant="outlined" sx={{ p: 4, height: '100%' }}>
      <Typography variant="caption" sx={{ color: 'text.tertiary', fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 800, fontFamily: MONO, mt: 0.5 }}>
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Paper>
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

  const updateMutation = useMutation({ mutationFn: userAPI.updateProfile,
      onSuccess: (data) => {
        updateProfile(data.data.user);
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        toast.success('프로필이 업데이트되었습니다');
        setIsDirty(false);
      },
      onError: (error) => {
        toast.error('업데이트 실패: ' + error.message);
      } });

  const onSubmit = (data) => {
    updateMutation.mutate(data);
  };

  return (
    <Paper variant="outlined" sx={{ p: 4 }}>
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
            disabled={!isDirty || updateMutation.isPending}
            startIcon={<Save />}
          >
            {updateMutation.isPending ? '저장 중...' : '변경사항 저장'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
}

function PasswordChange() {
  const { user } = useAuth();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm();

  const changeMutation = useMutation({
    mutationFn: userAPI.changePassword,
    onSuccess: () => { toast.success('비밀번호가 변경되었습니다'); reset(); },
    onError: (error) => { toast.error(error.response?.data?.message || '비밀번호 변경에 실패했습니다'); }
  });

  // 소셜 로그인 계정은 비밀번호가 없어 변경 불가 — 표시하지 않음 (#663)
  if (user?.authProvider && user.authProvider !== 'local') return null;

  const newPassword = watch('newPassword');
  const onSubmit = (data) => changeMutation.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword });

  return (
    <Paper variant="outlined" sx={{ p: 4 }}>
      <Typography variant="h6" gutterBottom>
        비밀번호 변경
      </Typography>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              type="password"
              label="현재 비밀번호"
              error={!!errors.currentPassword}
              helperText={errors.currentPassword?.message}
              {...register('currentPassword', { required: '현재 비밀번호를 입력해주세요' })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="password"
              label="새 비밀번호"
              error={!!errors.newPassword}
              helperText={errors.newPassword?.message}
              {...register('newPassword', {
                required: '새 비밀번호를 입력해주세요',
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/,
                  message: '8자 이상, 대·소문자·숫자·특수문자(!@#$%^&*) 포함'
                }
              })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              type="password"
              label="새 비밀번호 확인"
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: '새 비밀번호를 다시 입력해주세요',
                validate: (v) => v === newPassword || '새 비밀번호가 일치하지 않습니다'
              })}
            />
          </Grid>
        </Grid>
        <Box mt={3}>
          <Button type="submit" variant="contained" disabled={changeMutation.isPending}>
            {changeMutation.isPending ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
}

function SecuritySettings() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createKeyDialogOpen, setCreateKeyDialogOpen] = useState(false);
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  // API Key 목록 조회
  const { data: apiKeysData } = useQuery({ queryKey: ['apiKeys'], queryFn: () => apiKeyAPI.getAll() });
  const apiKeys = apiKeysData?.data?.data || [];
  const activeKeyCount = apiKeys.filter(k => !k.isRevoked).length;

  const deleteMutation = useMutation({ mutationFn: userAPI.deleteAccount,
      onSuccess: () => {
        toast.success('계정이 삭제되었습니다');
        logout();
      },
      onError: (error) => {
        toast.error('계정 삭제 실패: ' + error.message);
      } });

  const createKeyMutation = useMutation({ mutationFn: (data) => apiKeyAPI.create(data),
      onSuccess: (response) => {
        setCreatedKey(response.data.data);
        setCreateKeyDialogOpen(false);
        setShowKeyDialogOpen(true);
        setNewKeyName('');
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } });

  const revokeKeyMutation = useMutation({ mutationFn: (id) => apiKeyAPI.revoke(id),
      onSuccess: () => {
        toast.success('API Key가 파기되었습니다');
        setRevokeDialogOpen(false);
        setRevokeTarget(null);
        queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      } });

  const handleDeleteAccount = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    createKeyMutation.mutate({ name: newKeyName.trim() });
  };

  const handleCopyKey = () => {
    if (createdKey?.key) {
      copyToClipboard(createdKey.key);
      toast.success('API Key가 클립보드에 복사되었습니다');
    }
  };

  const handleRevokeKey = () => {
    if (revokeTarget) {
      revokeKeyMutation.mutate(revokeTarget._id);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <>
      <Paper variant="outlined" sx={{ p: 4 }}>
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

          {/* API Key 관리 */}
          <ListItem sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <Box display="flex" alignItems="center" mb={1}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <VpnKey />
              </ListItemIcon>
              <ListItemText
                primary="API Key 관리"
                secondary={`외부 프로그램에서 API에 접근할 때 사용합니다 (${activeKeyCount}/10)`}
              />
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setCreateKeyDialogOpen(true)}
                disabled={activeKeyCount >= 10}
              >
                생성
              </Button>
            </Box>

            {apiKeys.length > 0 && (
              <Box sx={{ ml: 5, mb: 1 }}>
                {apiKeys.map((apiKey) => (
                  <Box
                    key={apiKey._id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.75,
                      px: 1.5,
                      mb: 0.5,
                      borderRadius: 1,
                      bgcolor: apiKey.isRevoked ? 'action.disabledBackground' : 'action.hover'
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {apiKey.name}
                        </Typography>
                        {apiKey.isRevoked && (
                          <Chip label="파기됨" color="error" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {apiKey.prefix}... | 생성: {formatDate(apiKey.createdAt)}
                        {apiKey.lastUsedAt && ` | 마지막 사용: ${formatDate(apiKey.lastUsedAt)}`}
                        {apiKey.isRevoked && apiKey.revokedAt && ` | 파기: ${formatDate(apiKey.revokedAt)}`}
                      </Typography>
                    </Box>
                    {!apiKey.isRevoked && (
                      <Tooltip title="파기">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            setRevokeTarget(apiKey);
                            setRevokeDialogOpen(true);
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))}
              </Box>
            )}
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

      {/* API Key 생성 다이얼로그 */}
      <Dialog
        open={createKeyDialogOpen}
        onClose={() => { setCreateKeyDialogOpen(false); setNewKeyName(''); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>API Key 생성</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="키 이름"
            placeholder="예: My Script, CI/CD Pipeline"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            sx={{ mt: 1 }}
            inputProps={{ maxLength: 100 }}
            helperText="이 키를 식별할 수 있는 이름을 입력하세요"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCreateKeyDialogOpen(false); setNewKeyName(''); }}>
            취소
          </Button>
          <Button
            onClick={handleCreateKey}
            variant="contained"
            disabled={!newKeyName.trim() || createKeyMutation.isPending}
          >
            {createKeyMutation.isPending ? '생성 중...' : '생성'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Key 표시 다이얼로그 */}
      <Dialog
        open={showKeyDialogOpen}
        onClose={() => { setShowKeyDialogOpen(false); setCreatedKey(null); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>API Key 생성 완료</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            이 키는 다시 확인할 수 없습니다. 지금 안전한 곳에 복사해 두세요.
          </Alert>
          {createdKey && (
            <TextField
              fullWidth
              value={createdKey.key}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleCopyKey} edge="end">
                      <ContentCopy />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { fontFamily: 'monospace', fontSize: '0.85rem' }
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => { setShowKeyDialogOpen(false); setCreatedKey(null); }}
            variant="contained"
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* API Key 파기 확인 다이얼로그 */}
      <Dialog
        open={revokeDialogOpen}
        onClose={() => { setRevokeDialogOpen(false); setRevokeTarget(null); }}
      >
        <DialogTitle>API Key 파기</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            파기된 키는 더 이상 사용할 수 없습니다.
          </Alert>
          {revokeTarget && (
            <Typography>
              <strong>{revokeTarget.name}</strong> ({revokeTarget.prefix}...) 키를 파기하시겠습니까?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRevokeDialogOpen(false); setRevokeTarget(null); }}>
            취소
          </Button>
          <Button
            onClick={handleRevokeKey}
            color="error"
            variant="contained"
            disabled={revokeKeyMutation.isPending}
          >
            {revokeKeyMutation.isPending ? '파기 중...' : '파기'}
          </Button>
        </DialogActions>
      </Dialog>

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
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? '삭제 중...' : '계정 삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Profile() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);

  const { data: userStats, isLoading } = useQuery({ queryKey: ['userStats'], queryFn: userAPI.getStats });

  const stats = userStats?.data || {};

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(1) + ' MB';
  };

  return (
    <Container maxWidth="lg" sx={{ mb: 8 }}>
      <Box display="flex" alignItems="center" gap={4} mb={5}>
        <Avatar
          src={user?.avatar}
          sx={{ width: 72, height: 72, fontSize: 26, fontWeight: 800, background: BRAND_GRADIENTS[0] }}
        >
          {user?.nickname?.charAt(0).toUpperCase()}
        </Avatar>
        <Box>
          <Typography variant="h1">{user?.nickname || '사용자'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {user?.email} · 가입일 {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
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

      <AccountSettings />
      <Box mt={3}>
        <PasswordChange />
      </Box>
      <Box mt={3}>
        <SecuritySettings />
      </Box>
    </Container>
  );
}

export default Profile;