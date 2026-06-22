import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  Tooltip,
  TextField,
  CircularProgress
} from '@mui/material';
import {
  Backup,
  Restore,
  Download,
  Delete,
  CloudUpload,
  CheckCircle,
  Error,
  Pending,
  Refresh
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { backupAPI } from '../../services/api';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/common/PageHeader';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index} style={{ paddingTop: 16 }}>
      {value === index && children}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ko-KR');
}

function getStatusChip(status) {
  const statusConfig = {
    pending: { label: '대기중', color: 'default', icon: <Pending /> },
    processing: { label: '진행중', color: 'warning', icon: <CircularProgress size={16} /> },
    validating: { label: '검증중', color: 'info', icon: <CircularProgress size={16} /> },
    completed: { label: '완료', color: 'success', icon: <CheckCircle /> },
    failed: { label: '실패', color: 'error', icon: <Error /> }
  };

  const config = statusConfig[status] || statusConfig.pending;
  return (
    <Chip
      label={config.label}
      color={config.color}
      icon={config.icon}
    />
  );
}

function BackupRestorePage() {
  const [tabValue, setTabValue] = useState(0);
  const [backupPage, setBackupPage] = useState(1);
  const [restorePage, setRestorePage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreOptions, setRestoreOptions] = useState({
    overwriteExisting: false,
    skipFiles: false,
    skipDatabase: false,
    cleanRestore: false, // 완전 교체 모드 (#646)
    skipSnapshot: false  // 복원 전 자동 스냅샷 생략 (대용량/빈 DB 이전 시) (#646)
  });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  // 진행 중인 작업 종류 — 폴링 대상 API 를 현재 탭이 아니라 작업 종류로 결정 (#648)
  const [activeJobType, setActiveJobType] = useState(null); // 'backup' | 'restore'
  const [restoreMode, setRestoreMode] = useState('server'); // 'server' | 'upload' (#634)
  const [selectedServerFile, setSelectedServerFile] = useState('');
  const fileInputRef = useRef(null);

  // 업로드 무한 상태 방어: 큰 파일은 브라우저 업로드 대신 서버 백업 방식으로 유도 (#634)
  const UPLOAD_SOFT_LIMIT = 2 * 1024 * 1024 * 1024; // 2GB

  // 백업 목록 조회
  const { data: backupData, isLoading: backupsLoading, refetch: refetchBackups } = useQuery({ queryKey: ['backups', backupPage], queryFn: () => backupAPI.list({ page: backupPage, limit: 10 }), refetchInterval: activeJobId ? 2000 : false });

  // 복구 목록 조회
  const { data: restoreData, isLoading: restoresLoading, refetch: refetchRestores } = useQuery({ queryKey: ['restores', restorePage], queryFn: () => backupAPI.listRestores({ page: restorePage, limit: 10 }), refetchInterval: activeJobId ? 2000 : false });

  // 진행 중인 작업 상태 polling
  useEffect(() => {
    if (!activeJobId) return;

    const checkStatus = async () => {
      try {
        // 폴링 대상은 현재 탭이 아니라 진행 중인 작업의 종류로 결정 (#648)
        const response = activeJobType === 'backup'
          ? await backupAPI.getStatus(activeJobId)
          : await backupAPI.getRestoreStatus(activeJobId);

        const job = response.data.data;
        if (job.status === 'completed' || job.status === 'failed') {
          setActiveJobId(null);
          setActiveJobType(null);
          if (job.status === 'completed') {
            toast.success(activeJobType === 'backup' ? '백업이 완료되었습니다!' : '복구가 완료되었습니다!');
          } else {
            toast.error(job.error?.message || '작업이 실패했습니다.');
          }
          refetchBackups();
          refetchRestores();
        }
      } catch (error) {
        console.error('상태 확인 오류:', error);
      }
    };

    const interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [activeJobId, activeJobType, refetchBackups, refetchRestores]);

  // 백업 생성
  const createBackupMutation = useMutation({ mutationFn: () => backupAPI.create(),
      onSuccess: (response) => {
        const jobId = response.data.data.jobId;
        setActiveJobId(jobId);
        setActiveJobType('backup');
        toast.success('백업이 시작되었습니다.');
        refetchBackups();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '백업 생성에 실패했습니다.');
      } });

  // 백업 삭제
  const deleteBackupMutation = useMutation({ mutationFn: (id) => backupAPI.delete(id),
      onSuccess: () => {
        toast.success('백업이 삭제되었습니다.');
        setDeleteDialogOpen(false);
        setSelectedBackup(null);
        refetchBackups();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '백업 삭제에 실패했습니다.');
      } });

  // 파일 검증
  const validateMutation = useMutation({ mutationFn: (file) => backupAPI.validate(file),
      onSuccess: (response) => {
        setValidationResult(response.data.data);
        if (response.data.data.validationResult.isValid) {
          toast.success('백업 파일이 유효합니다.');
        } else {
          toast.error('백업 파일 검증에 실패했습니다.');
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '파일 검증에 실패했습니다.');
        setUploadedFile(null);
      } });

  // 복구 실행
  const restoreMutation = useMutation({ mutationFn: ({ jobId, options }) => backupAPI.restore({ jobId, options }),
      onSuccess: (response) => {
        const jobId = response.data.data.jobId;
        setActiveJobId(jobId);
        setActiveJobType('restore');
        toast.success('복구가 시작되었습니다.');
        setRestoreDialogOpen(false);
        setUploadedFile(null);
        setValidationResult(null);
        refetchRestores();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || '복구 실행에 실패했습니다.');
      } });

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // 대용량은 브라우저 업로드가 실패/무한 상태를 유발 → 서버 백업 방식으로 안내 (#634)
      if (file.size > UPLOAD_SOFT_LIMIT) {
        toast.error('파일이 너무 큽니다. 대용량 백업은 서버에 올린 뒤 "서버 백업" 탭에서 복원하세요. (scripts/upload-backup-file.sh)');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setUploadedFile(file);
      setValidationResult(null);
      validateMutation.mutate(file);
    }
  };

  // 서버 백업 파일 목록 (서버 탭에서만 조회) (#634)
  const { data: serverFilesData, refetch: refetchServerFiles } = useQuery({
    queryKey: ['serverBackupFiles'],
    queryFn: () => backupAPI.listServerBackupFiles(),
    enabled: restoreDialogOpen && restoreMode === 'server',
  });
  const serverBackupFiles = serverFilesData?.data?.data?.files || [];

  const validateServerMutation = useMutation({
    mutationFn: (fileName) => backupAPI.validateServerBackup(fileName),
    onSuccess: (response) => {
      setValidationResult(response.data.data);
      if (response.data.data.validationResult?.isValid) toast.success('백업 파일이 유효합니다.');
      else toast.error('백업 파일 검증에 실패했습니다.');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || '서버 백업 검증에 실패했습니다.');
    },
  });

  const handleDownload = async (backupId) => {
    try {
      // signed URL 발급 후 브라우저 네이티브 다운로드 — 큰 백업의 메모리 버퍼링 회피 (#241).
      const response = await backupAPI.getSignedDownloadUrl(backupId);
      const { url, fileName } = response.data?.data || {};
      if (!url) {
        throw new Error('signed URL not returned');
      }
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || `backup-${backupId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  const handleDeleteClick = (backup) => {
    setSelectedBackup(backup);
    setDeleteDialogOpen(true);
  };

  const handleRestoreExecute = () => {
    if (!validationResult) return;

    restoreMutation.mutate({
      jobId: validationResult.jobId,
      options: restoreOptions
    });
  };

  const backups = backupData?.data?.data?.backups || [];
  const backupPagination = backupData?.data?.data?.pagination;
  const restores = restoreData?.data?.data?.restores || [];
  const restorePagination = restoreData?.data?.data?.pagination;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3, mb: 4.5 }}>
        <Box>
          <Typography variant="h1">백업 / 복구 관리</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            온디맨드 백업 생성 · 다운로드 · ZIP 복원
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => {
              refetchBackups();
              refetchRestores();
            }}
          >
            새로고침
          </Button>
          <Button
            variant="contained"
            startIcon={<Backup />}
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending || !!activeJobId}
          >
            백업 생성
          </Button>
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={() => setRestoreDialogOpen(true)}
            disabled={!!activeJobId}
          >
            복구하기
          </Button>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ p: 4 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="백업 목록" />
          <Tab label="복구 히스토리" />
        </Tabs>

        {/* 백업 목록 */}
        <TabPanel value={tabValue} index={0}>
          {backupsLoading ? (
            <LinearProgress />
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>파일명</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>파일 크기</TableCell>
                      <TableCell>생성자</TableCell>
                      <TableCell>생성일시</TableCell>
                      <TableCell>만료일</TableCell>
                      <TableCell align="center">액션</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {backups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          백업이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      backups.map((backup) => (
                        <TableRow key={backup._id}>
                          <TableCell>
                            {backup.fileName || '-'}
                            {backup.status === 'processing' && backup.progress && (
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={(backup.progress.current / backup.progress.total) * 100}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {backup.progress.stage}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>{getStatusChip(backup.status)}</TableCell>
                          <TableCell>{formatBytes(backup.fileSize)}</TableCell>
                          <TableCell>{backup.createdBy?.nickname || '-'}</TableCell>
                          <TableCell>{formatDate(backup.createdAt)}</TableCell>
                          <TableCell>{formatDate(backup.expiresAt)}</TableCell>
                          <TableCell align="center">
                            {backup.status === 'completed' && (
                              <>
                                <Tooltip title="다운로드">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDownload(backup._id)}
                                  >
                                    <Download />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="삭제">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteClick(backup)}
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {backupPagination && backupPagination.pages > 1 && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    currentPage={backupPage}
                    totalPages={backupPagination.pages}
                    onPageChange={setBackupPage}
                  />
                </Box>
              )}
            </>
          )}
        </TabPanel>

        {/* 복구 히스토리 */}
        <TabPanel value={tabValue} index={1}>
          {restoresLoading ? (
            <LinearProgress />
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>백업 파일</TableCell>
                      <TableCell>상태</TableCell>
                      <TableCell>옵션</TableCell>
                      <TableCell>복구된 항목</TableCell>
                      <TableCell>실행자</TableCell>
                      <TableCell>실행일시</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {restores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          복구 히스토리가 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      restores.map((restore) => (
                        <TableRow key={restore._id}>
                          <TableCell>
                            {restore.backupFileName}
                            {(restore.status === 'processing' || restore.status === 'validating') && restore.progress && (
                              <Box sx={{ mt: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={(restore.progress.current / restore.progress.total) * 100}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {restore.progress.stage}
                                </Typography>
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>{getStatusChip(restore.status)}</TableCell>
                          <TableCell>
                            {restore.options && (
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {restore.options.cleanRestore && (
                                  <Chip label="완전 교체" color="error" />
                                )}
                                {restore.options.overwriteExisting && (
                                  <Chip label="덮어쓰기" />
                                )}
                                {restore.options.skipFiles && (
                                  <Chip label="파일 제외" />
                                )}
                                {restore.options.skipDatabase && (
                                  <Chip label="DB 제외" />
                                )}
                                {restore.options.skipSnapshot && (
                                  <Chip label="스냅샷 생략" />
                                )}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell>
                            {restore.statistics?.collectionsRestored && (
                              <Typography variant="caption">
                                컬렉션: {Object.values(restore.statistics.collectionsRestored).reduce((a, b) => a + b, 0)}개,
                                파일: {
                                  (restore.statistics.filesRestored?.generated || 0) +
                                  (restore.statistics.filesRestored?.reference || 0) +
                                  (restore.statistics.filesRestored?.videos || 0)
                                }개
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{restore.createdBy?.nickname || '-'}</TableCell>
                          <TableCell>{formatDate(restore.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {restorePagination && restorePagination.pages > 1 && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    currentPage={restorePage}
                    totalPages={restorePagination.pages}
                    onPageChange={setRestorePage}
                  />
                </Box>
              )}
            </>
          )}
        </TabPanel>
      </Paper>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>백업 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            "{selectedBackup?.fileName}" 백업을 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>취소</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => deleteBackupMutation.mutate(selectedBackup._id)}
            disabled={deleteBackupMutation.isPending}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      {/* 복구 다이얼로그 */}
      <Dialog
        open={restoreDialogOpen}
        onClose={() => {
          setRestoreDialogOpen(false);
          setUploadedFile(null);
          setValidationResult(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Restore />
            백업 복구
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            {/* 복원 방식 선택: 서버 백업(권장) / 파일 업로드 (#634) */}
            <Tabs
              value={restoreMode}
              onChange={(e, v) => { setRestoreMode(v); setValidationResult(null); setUploadedFile(null); setSelectedServerFile(''); }}
              sx={{ mb: 2 }}
            >
              <Tab value="server" label="서버 백업 (권장)" />
              <Tab value="upload" label="파일 업로드" />
            </Tabs>

            {restoreMode === 'server' && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  서버에 올려둔 백업 파일을 선택해 복원합니다. 대용량 백업은 <code>scripts/upload-backup-file.sh</code> 로 올리세요.
                </Typography>
                {serverBackupFiles.length === 0 ? (
                  <Alert severity="info">서버에 백업 파일이 없습니다. <code>./scripts/upload-backup-file.sh &lt;파일.zip&gt;</code> 로 올린 뒤 새로고침하세요.</Alert>
                ) : (
                  <TextField
                    select fullWidth size="small" label="서버 백업 파일"
                    value={selectedServerFile}
                    onChange={(e) => { setSelectedServerFile(e.target.value); setValidationResult(null); }}
                    SelectProps={{ native: true }} InputLabelProps={{ shrink: true }}
                  >
                    <option value="">— 선택 —</option>
                    {serverBackupFiles.map((f) => (
                      <option key={f.fileName} value={f.fileName}>
                        {f.fileName} ({(f.size / 1024 / 1024).toFixed(0)}MB)
                      </option>
                    ))}
                  </TextField>
                )}
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => refetchServerFiles()}>목록 새로고침</Button>
                  <Button
                    size="small" variant="outlined"
                    disabled={!selectedServerFile || validateServerMutation.isPending}
                    onClick={() => { setValidationResult(null); validateServerMutation.mutate(selectedServerFile); }}
                  >
                    검증
                  </Button>
                </Box>
                {validateServerMutation.isPending && (
                  <Box sx={{ mt: 2 }}><LinearProgress /><Typography variant="caption" color="text.secondary">검증 중...</Typography></Box>
                )}
              </Box>
            )}

            {restoreMode === 'upload' && (
              <Box>
                <input
                  type="file"
                  accept=".zip"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<CloudUpload />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={validateMutation.isPending}
                >
                  {uploadedFile ? uploadedFile.name : '백업 파일 선택 (.zip)'}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  2GB 이하 백업만 업로드 가능합니다. 더 큰 백업은 "서버 백업" 탭을 사용하세요.
                </Typography>
                {validateMutation.isPending && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress />
                    <Typography variant="caption" color="text.secondary">파일 검증 중...</Typography>
                  </Box>
                )}
              </Box>
            )}

            {/* 검증 결과 */}
            {validationResult && (
              <Box sx={{ mt: 2 }}>
                {validationResult.validationResult.isValid ? (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    백업 파일이 유효합니다.
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">검증 실패</Typography>
                    {validationResult.validationResult.errors?.map((err, i) => (
                      <Typography key={i} variant="body2">• {err}</Typography>
                    ))}
                  </Alert>
                )}

                {validationResult.validationResult.warnings?.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">경고</Typography>
                    {validationResult.validationResult.warnings.map((warn, i) => (
                      <Typography key={i} variant="body2">• {warn}</Typography>
                    ))}
                  </Alert>
                )}

                {/* 메타데이터 정보 */}
                {validationResult.backupMetadata && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>백업 정보</Typography>
                    <Typography variant="body2">
                      버전: {validationResult.backupMetadata.version}
                    </Typography>
                    <Typography variant="body2">
                      생성일: {formatDate(validationResult.backupMetadata.createdAt)}
                    </Typography>
                    <Typography variant="body2">
                      컬렉션: {validationResult.backupMetadata.collections &&
                        Object.entries(validationResult.backupMetadata.collections)
                          .map(([k, v]) => `${k}(${v})`)
                          .join(', ')}
                    </Typography>
                    <Typography variant="body2">
                      파일: 생성({validationResult.backupMetadata.files?.generated || 0}),
                      참조({validationResult.backupMetadata.files?.reference || 0}),
                      비디오({validationResult.backupMetadata.files?.videos || 0})
                    </Typography>
                  </Paper>
                )}

                {/* 복구 옵션 */}
                {validationResult.validationResult.isValid && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>복구 옵션</Typography>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={restoreOptions.cleanRestore}
                          onChange={(e) => setRestoreOptions({
                            ...restoreOptions,
                            cleanRestore: e.target.checked,
                            // 완전 교체 시 덮어쓰기는 의미 없으므로 함께 해제
                            overwriteExisting: e.target.checked ? false : restoreOptions.overwriteExisting
                          })}
                        />
                      }
                      label="기존 데이터를 모두 지우고 완전히 교체 (새 서버 이전 시 권장)"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={restoreOptions.overwriteExisting}
                          disabled={restoreOptions.cleanRestore}
                          onChange={(e) => setRestoreOptions({
                            ...restoreOptions,
                            overwriteExisting: e.target.checked
                          })}
                        />
                      }
                      label="기존 데이터 덮어쓰기"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={restoreOptions.skipDatabase}
                          onChange={(e) => setRestoreOptions({
                            ...restoreOptions,
                            skipDatabase: e.target.checked
                          })}
                        />
                      }
                      label="데이터베이스 복구 건너뛰기"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={restoreOptions.skipFiles}
                          onChange={(e) => setRestoreOptions({
                            ...restoreOptions,
                            skipFiles: e.target.checked
                          })}
                        />
                      }
                      label="파일 복구 건너뛰기"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={restoreOptions.skipSnapshot}
                          onChange={(e) => setRestoreOptions({
                            ...restoreOptions,
                            skipSnapshot: e.target.checked
                          })}
                        />
                      }
                      label="복원 전 자동 스냅샷 생략 (대용량·빈 서버 이전 시 빠름)"
                    />

                    {restoreOptions.cleanRestore ? (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <Typography variant="subtitle2">완전 교체 모드</Typography>
                        <Typography variant="body2">
                          백업에 포함된 컬렉션의 <strong>현재 데이터를 모두 삭제</strong>하고 백업으로 교체합니다.
                          새 서버로 이전(빈 DB)할 때 사용하세요. 복원 후에는 <strong>백업에 들어있던 계정/비밀번호</strong>로 로그인해야 합니다.
                        </Typography>
                      </Alert>
                    ) : (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          복구를 실행하면 선택한 옵션에 따라 기존 데이터가 영향을 받을 수 있습니다.
                          신중하게 진행해주세요.
                        </Typography>
                      </Alert>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRestoreDialogOpen(false);
            setUploadedFile(null);
            setValidationResult(null);
          }}>
            취소
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRestoreExecute}
            disabled={
              !validationResult?.validationResult?.isValid ||
              restoreMutation.isPending ||
              (restoreOptions.skipDatabase && restoreOptions.skipFiles)
            }
            startIcon={<Restore />}
          >
            복구 실행
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default BackupRestorePage;
