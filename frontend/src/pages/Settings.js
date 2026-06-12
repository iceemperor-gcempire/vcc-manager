import React from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Switch,
  Alert,
  CircularProgress
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userAPI } from '../services/api';
import PageHeader from '../components/common/PageHeader';
import toast from 'react-hot-toast';

// 설정 행 — 좌측 라벨+설명, 우측 스위치 (v2, #564)
function SettingRow({ label, caption, checked, onChange, disabled }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4,
      px: 4, py: 3, '& + &': { borderTop: 1, borderColor: 'divider' },
    }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textWrap: 'pretty' }}>
          {caption}
        </Typography>
      </Box>
      <Switch checked={checked} onChange={onChange} disabled={disabled} sx={{ flexShrink: 0, mt: -0.5 }} />
    </Box>
  );
}

// 설정 섹션 카드 — outlined + 헤더 라인 (v2)
function SettingCard({ title, description, children }) {
  return (
    <Paper variant="outlined" sx={{ mb: 4, overflow: 'hidden' }}>
      <Box sx={{ px: 4, py: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">{title}</Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      {children}
    </Paper>
  );
}

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
  const busy = updateMutation.isLoading;

  const handleToggle = (key) => (event) => {
    updateMutation.mutate({
      [key]: event.target.checked
    });
  };

  if (isLoading) {
    return (
      <Container maxWidth="md">
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Alert severity="error">
          설정을 불러오는 중 오류가 발생했습니다: {error.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mb: 8 }}>
      <PageHeader title="설정" description="삭제 동작, 계속하기, NSFW 필터, 작업판 검색 조건의 기본 동작을 설정합니다." />

      <SettingCard title="삭제 동작" description="작업 히스토리와 컨텐츠(이미지/동영상) 삭제 시의 연동 동작">
        <SettingRow
          label="작업 히스토리 삭제 시 연관 컨텐츠도 같이 삭제"
          caption="이 옵션이 켜져 있으면 히스토리 삭제 시 생성된 이미지나 동영상도 같이 삭제됩니다. 삭제 전에 확인 창이 표시됩니다."
          checked={preferences.deleteContentWithHistory || false}
          onChange={handleToggle('deleteContentWithHistory')}
          disabled={busy}
        />
        <SettingRow
          label="컨텐츠 삭제 시 작업 히스토리도 같이 삭제"
          caption="이 옵션이 켜져 있으면 이미지/동영상 삭제 시 해당 작업 히스토리도 같이 삭제됩니다. 삭제 전에 확인 창이 표시됩니다."
          checked={preferences.deleteHistoryWithContent || false}
          onChange={handleToggle('deleteHistoryWithContent')}
          disabled={busy}
        />
      </SettingCard>

      <SettingCard title="작업 계속하기" description='작업 히스토리에서 "계속하기" 사용 시의 동작'>
        <SettingRow
          label="계속하기 시 무조건 랜덤 시드 사용"
          caption='이 옵션이 켜져 있으면 히스토리에서 "계속하기"로 작업판을 호출했을 때 랜덤 시드 스위치가 자동으로 켜집니다.'
          checked={preferences.useRandomSeedOnContinue || false}
          onChange={handleToggle('useRandomSeedOnContinue')}
          disabled={busy}
        />
      </SettingCard>

      <SettingCard title="LoRA NSFW 필터" description="LoRA 목록에서 NSFW(성인용) 콘텐츠의 표시 여부">
        <SettingRow
          label="NSFW LoRA 숨기기"
          caption="이 옵션이 켜져 있으면 NSFW로 분류된 LoRA 모델이 목록에서 숨겨집니다."
          checked={preferences.nsfwLoraFilter ?? true}
          onChange={handleToggle('nsfwLoraFilter')}
          disabled={busy}
        />
        <SettingRow
          label="NSFW 미리보기 이미지 숨기기"
          caption="이 옵션이 켜져 있으면 LoRA 카드에서 NSFW로 분류된 미리보기 이미지가 숨겨집니다."
          checked={preferences.nsfwImageFilter ?? true}
          onChange={handleToggle('nsfwImageFilter')}
          disabled={busy}
        />
      </SettingCard>

      <SettingCard title="작업판 검색" description="작업판 목록의 검색 필터 조건 보존 여부">
        <SettingRow
          label="작업판 출력 형식 검색 조건 보존하지 않음"
          caption="이 옵션이 켜져 있으면 작업판 목록에 진입할 때 출력 형식 필터가 '전체'로 초기화됩니다."
          checked={preferences.resetWorkboardOutputFormat || false}
          onChange={handleToggle('resetWorkboardOutputFormat')}
          disabled={busy}
        />
        <SettingRow
          label="작업판 서버 타입 검색 조건 보존하지 않음"
          caption="이 옵션이 켜져 있으면 작업판 목록에 진입할 때 서버 타입 필터가 '전체'로 초기화됩니다."
          checked={preferences.resetWorkboardApiFormat || false}
          onChange={handleToggle('resetWorkboardApiFormat')}
          disabled={busy}
        />
      </SettingCard>
    </Container>
  );
}

export default Settings;
