import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  Typography,
  Divider,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { updatelogAPI } from '../../services/api';
import { needsActionAlert, noticeTitle } from '../../utils/updateNotice';

// 새 버전이 배포된 뒤 처음 접속하면 그 버전의 업데이트 내역을 한 번 띄운다 (#999).
// 닫으면 계정에 "현재 버전까지 봤다"고 기록되어 다른 기기에서도 다시 안 뜬다.
// 무엇을 보여줄지는 백엔드가 정한다 — 이 컴포넌트는 띄우고 닫기만 한다.
function UpdateNoticeDialog() {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery({
    queryKey: ['updateNotice'],
    queryFn: () => updatelogAPI.notice(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const notice = data?.data?.data;
  const sections = notice?.sections || [];

  const seenMutation = useMutation({
    mutationFn: () => updatelogAPI.markNoticeSeen(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['updateNotice'] }),
  });

  const handleClose = () => {
    setDismissed(true); // 기록이 실패해도 지금은 닫는다 — 다음 접속 때 다시 뜬다
    seenMutation.mutate();
  };

  const open = Boolean(notice?.show) && sections.length > 0 && !dismissed;
  if (!open) return null;

  return (
    <Dialog open onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{noticeTitle(sections)}</DialogTitle>
      <DialogContent dividers>
        {needsActionAlert(sections) && (
          <Alert severity="warning" sx={{ mb: 4 }}>
            이번 업데이트에는 기존 사용자가 직접 해야 할 일이 있어요. 아래 <strong>기존 사용자가 할 일</strong>을 꼭 확인해 주세요.
          </Alert>
        )}
        {sections.map((section, i) => (
          <Box key={section.version}>
            {i > 0 && <Divider sx={{ my: 4 }} />}
            <Box sx={{ '& h2': { fontSize: '18px', mt: 0, mb: 2 }, '& h3': { fontSize: '15px', mt: 4, mb: 1 }, '& li': { mb: 1 } }}>
              <ReactMarkdown>{section.markdown}</ReactMarkdown>
            </Box>
          </Box>
        ))}
        {notice?.truncated && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
            더 이전 내역은 대시보드의 업데이트 내역에서 볼 수 있어요.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={handleClose}>확인했어요</Button>
      </DialogActions>
    </Dialog>
  );
}

export default UpdateNoticeDialog;
