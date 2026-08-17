import React, { createContext, useCallback, useContext, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Button, Box } from '@mui/material';
import { WarningAmberRounded } from '@mui/icons-material';

// 공용 확인 다이얼로그 (#728) — 네이티브 window.confirm 대체.
//
// window.confirm 은 테마·다크모드·모바일 어디에도 맞지 않고, 경고를 '\n\n' 줄바꿈으로
// 표현할 수밖에 없어 "되돌릴 수 없음" 이 본문과 같은 무게로 보였다.
// 여기서는 결과(description)를 본문으로, 되돌릴 수 없는 동작은 danger 로 분리해 표기한다.
//
// 사용:
//   const confirm = useConfirm();
//   if (await confirm({ title: '삭제하시겠습니까?', description: '...', danger: true })) { ... }
//
// 문자열 하나만 넘기면 title 로 취급한다 — confirm('삭제하시겠습니까?')

const ConfirmContext = createContext(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm 은 ConfirmProvider 안에서만 쓸 수 있습니다');
  return ctx;
}

// 단일 버튼 알림 (#842) — 업로드 거부처럼 **사용자가 원인을 읽어야 하는 오류**용.
// 토스트는 우상단에서 수 초 만에 사라져 "왜 실패했는지" 를 추출할 틈이 없다.
// confirm 과 같은 다이얼로그를 쓰되 취소 버튼이 없고, 어떻게 닫아도 resolve 된다.
//
//   const alert = useAlert();
//   await alert({ title: '업로드 실패', description: serverMessage, severity: 'error' });
export function useAlert() {
  const confirm = useConfirm();
  return useCallback(
    (options) => confirm({ ...(typeof options === 'string' ? { title: options } : options || {}), alert: true }),
    [confirm]
  );
}

export function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        setPending({ opts: typeof options === 'string' ? { title: options } : options || {}, resolve });
      }),
    []
  );

  const settle = (result) => {
    setPending((cur) => {
      cur?.resolve(result);
      return null;
    });
  };

  const o = pending?.opts || {};
  const danger = !!o.danger;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!pending}
        onClose={() => settle(!!o.alert)}
        maxWidth="xs"
        fullWidth
        aria-labelledby="confirm-dialog-title"
      >
        <DialogTitle id="confirm-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          {(danger || o.severity === 'error') && (
            <WarningAmberRounded fontSize="small" sx={{ color: 'error.main' }} />
          )}
          {o.title}
        </DialogTitle>
        <DialogContent>
          {o.description && <DialogContentText sx={{ textWrap: 'pretty' }}>{o.description}</DialogContentText>}
          {danger && (
            <Box
              sx={{
                mt: o.description ? 2.5 : 0,
                px: 2.5,
                py: 2,
                borderRadius: 2,
                bgcolor: 'error.light',
                color: (theme) => (theme.palette.mode === 'light' ? 'error.dark' : 'error.main'),
                fontSize: 12.5,
                fontWeight: 600,
              }}
            >
              {o.dangerNote || '이 작업은 되돌릴 수 없습니다.'}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {/* alert 모드(#842)는 선택지가 없으므로 취소 버튼을 두지 않는다 */}
          {!o.alert && (
            /* 파괴적 동작에서는 취소가 기본 포커스 — Enter 오폭 방지 */
            <Button onClick={() => settle(false)} autoFocus={danger}>
              {o.cancelLabel || '취소'}
            </Button>
          )}
          <Button
            variant="contained"
            color={danger ? 'error' : 'primary'}
            onClick={() => settle(true)}
            autoFocus={!danger}
          >
            {o.confirmLabel || '확인'}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export default ConfirmProvider;
