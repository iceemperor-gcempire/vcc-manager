import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CleaningServices as CleanupIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';
import PageHeader from '../common/PageHeader';
import ToneChip from '../common/ToneChip';
import { MONO } from '../../theme';

// 데이터 정합성 리포트 + 정제 (#662 P2).
// 진단은 읽기전용 — 버튼을 눌러야 실행 (자동 조회 없음, DB 전 컬렉션 스캔이라).
// 정제는 개인 콘텐츠 orphan 만 — dry-run 결과 확인 후 경고 모달 거쳐 실행.
function IntegrityReport() {
  const [includeFiles, setIncludeFiles] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const {
    data: reportData,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['adminIntegrity', includeFiles],
    queryFn: () => adminAPI.getIntegrity({ files: includeFiles }),
    enabled: false, // 수동 실행 전용
  });
  const report = reportData?.data?.data;

  const dryRunMutation = useMutation({
    mutationFn: () => adminAPI.cleanupOwnerOrphans(false),
    onSuccess: (res) => {
      setCleanupResult(res.data.data);
      const total = res.data.data.results.reduce((s, r) => s + r.matched, 0);
      if (total === 0) {
        toast.success('정제할 orphan 이 없습니다.');
      } else {
        setConfirmOpen(true);
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || '정제 dry-run 실패'),
  });

  const applyMutation = useMutation({
    mutationFn: () => adminAPI.cleanupOwnerOrphans(true),
    onSuccess: (res) => {
      setCleanupResult(res.data.data);
      setConfirmOpen(false);
      const total = res.data.data.results.reduce((s, r) => s + r.deleted, 0);
      toast.success(`orphan ${total}건을 정리했습니다.`);
      refetch();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'orphan 정제 실패'),
  });

  const userContentTotal = report
    ? report.owners.userContent.reduce((s, r) => s + r.count, 0)
    : 0;
  const dryRunTotal = cleanupResult
    ? cleanupResult.results.reduce((s, r) => s + r.matched, 0)
    : 0;

  const renderOrphanTable = (rows, ownerLabel) => (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>컬렉션</TableCell>
          <TableCell align="right">orphan 문서</TableCell>
          <TableCell>{ownerLabel}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={`${r.collection}-${r.field}`}>
            <TableCell sx={{ fontFamily: MONO }}>{r.collection}</TableCell>
            <TableCell align="right">
              {r.count > 0 ? <ToneChip tone="warning" label={`${r.count}건`} /> : '0건'}
            </TableCell>
            <TableCell sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>
              {r.orphanOwners.slice(0, 3).join(', ') || '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <Box>
      <PageHeader
        title="데이터 정합성"
        description="삭제된 사용자를 가리키는 문서, 끊긴 참조, 파일↔DB 불일치를 점검하고 정리합니다."
      />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Button
          variant="contained"
          startIcon={isFetching ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          진단 실행
        </Button>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={includeFiles}
              onChange={(e) => setIncludeFiles(e.target.checked)}
            />
          }
          label={<Typography variant="caption">파일↔DB 정합성 포함 (파일이 많으면 느림)</Typography>}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          color="warning"
          startIcon={<CleanupIcon />}
          onClick={() => dryRunMutation.mutate()}
          disabled={dryRunMutation.isPending || applyMutation.isPending}
        >
          orphan 정제
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        진단은 읽기전용입니다. 정제는 <strong>개인 콘텐츠의 소유자 orphan 만</strong> 대상이며,
        실행 전 대상 수를 확인하는 단계를 거칩니다. 정제 전 백업을 권장합니다
        (백업에는 orphan 이 그대로 담기므로 되돌림 안전망이 됩니다).
      </Alert>

      {!report && !isFetching && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            "진단 실행"을 눌러 정합성 점검을 시작하세요.
          </Typography>
        </Paper>
      )}

      {report && (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2">개인 콘텐츠 — 소유자 orphan</Typography>
              {userContentTotal > 0
                ? <ToneChip tone="warning" label={`총 ${userContentTotal}건`} />
                : <ToneChip tone="success" label="이상 없음" />}
            </Stack>
            {renderOrphanTable(report.owners.userContent, 'orphan 소유자 (일부)')}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2">구조 리소스 — 소유자 orphan</Typography>
              <ToneChip tone="neutral" label="리포트 전용" />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              작업판·서버·그룹 등은 소유권 이전 정책이 별개라 자동 정제하지 않습니다.
              발견 시 소유자 재지정 또는 개별 판단이 필요합니다.
            </Typography>
            {renderOrphanTable(report.owners.structural, 'orphan 소유자 (일부)')}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2">끊긴 작업 참조 (jobId)</Typography>
              <ToneChip tone="neutral" label="리포트 전용" />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              작업 삭제 시 콘텐츠를 보존하는 설계에서 참조는 정상적으로 해제(null)됩니다 —
              값이 남은 채 작업이 없으면 비정상입니다.
            </Typography>
            {report.danglingJobRefs.map((r) => (
              <Typography key={r.collection} variant="body2" sx={{ fontFamily: MONO }}>
                {r.collection}: {r.count > 0 ? `⚠️ ${r.count}건` : '0건'}
              </Typography>
            ))}
          </Paper>

          {report.files && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>파일↔DB 정합성</Typography>
              <Typography variant="body2">
                DB가 가리키는데 디스크에 없는 파일: {report.files.missingCount > 0 ? `⚠️ ${report.files.missingCount}건` : '0건'}
              </Typography>
              <Typography variant="body2">
                DB 참조 없는 고아 파일: {report.files.orphanFileCount > 0 ? `⚠️ ${report.files.orphanFileCount}건` : '0건'}
              </Typography>
              {report.files.orphanFileCount > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  고아 파일 정리는 CLI(src/scripts/integrityCheck.js --files)로 목록 확인 후 수동으로 진행하세요.
                </Typography>
              )}
            </Paper>
          )}

          <Typography variant="caption" color="text.secondary">
            점검 시각: {report.checkedAt ? new Date(report.checkedAt).toLocaleString('ko-KR') : '—'}
          </Typography>
        </Stack>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>orphan 정제 실행</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            삭제된 사용자를 가리키는 개인 콘텐츠 <strong>{dryRunTotal}건</strong>을 삭제합니다.
            <br /><br />
            {cleanupResult?.results.filter((r) => r.matched > 0).map((r) => (
              <Typography key={r.collection} variant="body2" sx={{ fontFamily: MONO }}>
                · {r.collection}: {r.matched}건
              </Typography>
            ))}
            <br />
            이 작업은 되돌릴 수 없습니다. <strong>정제 전 백업을 권장합니다.</strong> 계속할까요?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={applyMutation.isPending}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending}
            startIcon={applyMutation.isPending ? <CircularProgress size={16} /> : <CleanupIcon />}
          >
            {dryRunTotal}건 삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default IntegrityReport;
