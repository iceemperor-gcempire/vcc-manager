import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import { FileUpload, CheckCircle, Warning } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { workboardAPI } from '../../services/api';
import WorkboardBasicInfoForm from './WorkboardBasicInfoForm';

// 편집기 본체는 workboardEditor/ 디렉토리로 이동 (#713 R3) — 이 파일은 생성 폼 + 가져오기만 유지

// 새 작업판 생성 폼 (#709 — 구 WorkboardCreateDialog). 페이지 전용: WorkboardCreatePage 가 wrap.
export function WorkboardCreateForm({ onSave, onCancel }) {
  const handleCancel = onCancel;
  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      outputFormat: 'image',
      serverId: '',
      serverType: '',
      isActive: true
    }
  });

  useEffect(() => {
    reset({
      name: '',
      description: '',
      outputFormat: 'image',
      serverId: '',
      serverType: '',
      isActive: true
    });
  }, [reset]);

  const onSubmit = (data) => {
    onSave(data);
  };

  return (
    <>
      <Box sx={{
          position: 'sticky', top: 0, zIndex: 10,
          bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider',
          py: 2, mb: 2,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}>
          <Button onClick={handleCancel} sx={{ flexShrink: 0 }}>← 작업판 관리</Button>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>새 작업판</Typography>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCancel}>취소</Button>
          <Button form="wbCreateForm" type="submit" variant="contained">생성</Button>
      </Box>
      <form id="wbCreateForm" onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ px: 6, py: 5 }}>
          <WorkboardBasicInfoForm
            control={control}
            setValue={setValue}
            errors={errors}
            showActiveSwitch={false}
            showTypeSelector={true}
            isDialogOpen
          />

          <Alert severity="info" sx={{ mt: 2 }}>
            기본 작업판 구조가 생성됩니다. 상세 설정(AI 모델, 입력 필드 등)은
            생성 후 편집에서 추가할 수 있습니다.
          </Alert>
        </Box>
      </form>
    </>
  );
}

export function WorkboardImportDialog({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importName, setImportName] = useState('');
  const [needsServer, setNeedsServer] = useState(false);
  const [availableServers, setAvailableServers] = useState([]);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [preview, setPreview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const resetState = () => {
    setFile(null);
    setParsedData(null);
    setParseError('');
    setImportName('');
    setNeedsServer(false);
    setAvailableServers([]);
    setSelectedServerId('');
    setPreview(null);
    setWarnings([]);
    setImporting(false);
    setDragOver(false);
  };

  useEffect(() => {
    if (!open) resetState();
  }, [open]);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.json')) {
      setParseError('JSON 파일만 지원합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data._exportVersion || !data.workboard) {
          setParseError('올바른 작업판 백업 파일이 아닙니다.');
          return;
        }
        setFile(selectedFile);
        setParsedData(data);
        setImportName(data.workboard.name || '');
        setParseError('');
      } catch {
        setParseError('JSON 파일을 파싱할 수 없습니다.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setImporting(true);
    try {
      // 이름이 변경되었다면 반영
      const dataToSend = {
        ...parsedData,
        workboard: { ...parsedData.workboard, name: importName || parsedData.workboard.name }
      };

      const response = await workboardAPI.import(dataToSend, selectedServerId || undefined);
      const result = response.data;

      if (result.needsServer) {
        setNeedsServer(true);
        setAvailableServers(result.servers || []);
        setPreview(result.preview);
        setWarnings(result.warnings || []);
        setImporting(false);
        return;
      }

      toast.success(result.message || '작업판을 가져왔습니다.');
      if (result.warnings?.length > 0) {
        result.warnings.forEach(w => toast(w, { icon: '⚠️' }));
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>작업판 가져오기</DialogTitle>
      <DialogContent>
        {!parsedData ? (
          <Box
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'grey.400',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              bgcolor: dragOver ? 'action.hover' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => document.getElementById('workboard-import-file').click()}
          >
            <FileUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              JSON 파일을 드래그하거나 클릭하여 선택
            </Typography>
            <Typography variant="caption" color="text.secondary">
              작업판 내보내기로 생성된 .json 파일
            </Typography>
            <input
              id="workboard-import-file"
              type="file"
              accept=".json"
              hidden
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
          </Box>
        ) : (
          <Box>
            {/* 미리보기 */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">작업판 정보</Typography>
              <Typography variant="body2">
                서버: {parsedData.server?.serverType || '?'} / 출력: {parsedData.workboard.outputFormat || 'image'}
              </Typography>
              {parsedData.server && (
                <Typography variant="body2">
                  원본 서버: {parsedData.server.name} ({parsedData.server.serverType})
                </Typography>
              )}
              {parsedData.exportedAt && (
                <Typography variant="caption" color="text.secondary">
                  내보낸 날짜: {new Date(parsedData.exportedAt).toLocaleString()}
                </Typography>
              )}
            </Alert>

            {warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ mb: 1 }}>{w}</Alert>
            ))}

            {/* 이름 변경 */}
            <TextField
              fullWidth
              label="작업판 이름"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              sx={{ mb: 2 }}
            />

            {/* 서버 매칭 상태 */}
            {needsServer ? (
              <Box sx={{ mb: 2 }}>
                <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
                  원본 서버를 찾을 수 없습니다. 서버를 선택해주세요.
                  {preview?.server && (
                    <Typography variant="caption" display="block">
                      원본: {preview.server.name} ({preview.server.serverType})
                    </Typography>
                  )}
                </Alert>
                <FormControl fullWidth>
                  <InputLabel>서버 선택</InputLabel>
                  <Select
                    value={selectedServerId}
                    label="서버 선택"
                    onChange={(e) => setSelectedServerId(e.target.value)}
                  >
                    {availableServers.map((s) => (
                      <MenuItem key={s._id} value={s._id}>
                        {s.name} ({s.serverType})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            ) : parsedData.server ? (
              <Alert severity="success" icon={<CheckCircle />} sx={{ mb: 2 }}>
                서버 자동 매칭 대기: "{parsedData.server.name}" ({parsedData.server.serverType})
              </Alert>
            ) : null}
          </Box>
        )}

        {parseError && (
          <Alert severity="error" sx={{ mt: 2 }}>{parseError}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>취소</Button>
        {parsedData && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || (needsServer && !selectedServerId)}
            startIcon={importing ? <CircularProgress size={16} /> : <FileUpload />}
          >
            {importing ? '가져오는 중...' : '가져오기'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

