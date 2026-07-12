// 프로젝트 가져오기 다이얼로그 (#404 P1) — export JSON 으로 프로젝트+작업판+문서+파이프라인 일괄 생성.
// admin 전용 진입 (ProjectList). 서버 자동 매핑 실패 시 작업판별 서버 선택 단계 표시.
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { FileUpload } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { projectAPI } from '../../services/api';

function ProjectImportDialog({ open, onClose, onSuccess }) {
  const [parsed, setParsed] = useState(null);
  const [name, setName] = useState('');
  const [tagName, setTagName] = useState('');
  const [mapping, setMapping] = useState(null); // needsMapping 응답 { workboards, servers }
  const [serverMapping, setServerMapping] = useState({});
  const [importing, setImporting] = useState(false);

  const resetAndClose = () => {
    setParsed(null); setName(''); setTagName('');
    setMapping(null); setServerMapping({}); setImporting(false);
    onClose();
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.projectExportVersion !== 1) {
          toast.error('올바른 프로젝트 내보내기 파일이 아닙니다.');
          return;
        }
        setParsed(data);
        setName(data.project?.name || '');
        setMapping(null);
        setServerMapping({});
      } catch {
        toast.error('JSON 파싱에 실패했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!tagName.trim()) {
      toast.error('태그명을 입력해주세요.');
      return;
    }
    setImporting(true);
    try {
      const res = await projectAPI.import({ data: parsed, name: name.trim(), tagName: tagName.trim(), serverMapping });
      if (res.data.needsMapping) {
        // 자동 해석된 항목은 기본값으로 채워 두기
        const initial = {};
        res.data.workboards.forEach((w) => { if (w.resolvedServerId) initial[w.index] = w.resolvedServerId; });
        setServerMapping((prev) => ({ ...initial, ...prev }));
        setMapping(res.data);
        toast('일부 작업판의 대상 서버를 선택해주세요.', { icon: '🔗' });
      } else {
        toast.success(`프로젝트를 가져왔습니다 (작업판 ${res.data.summary.workboards} · 문서 ${res.data.summary.documents} · 파이프라인 ${res.data.summary.pipelines})`);
        onSuccess?.(res.data.projectId);
        resetAndClose();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || '프로젝트 가져오기에 실패했습니다.');
    } finally {
      setImporting(false);
    }
  };

  const allMapped = !mapping || mapping.workboards.every((w) => serverMapping[w.index]);

  return (
    <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
      <DialogTitle>프로젝트 가져오기</DialogTitle>
      <DialogContent>
        {!parsed ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Button variant="outlined" component="label" startIcon={<FileUpload />}>
              내보내기 파일 선택 (.json)
              <input type="file" accept=".json,application/json" hidden onChange={handleFile} />
            </Button>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
              프로젝트 상세의 "내보내기" 로 만든 파일을 선택하세요.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Chip label={`작업판 ${parsed.workboards?.length || 0}`} variant="outlined" />
              <Chip label={`문서 ${parsed.documents?.length || 0}`} variant="outlined" />
              <Chip label={`파이프라인 ${parsed.pipelines?.length || 0}`} variant="outlined" />
            </Box>
            <TextField label="프로젝트 이름" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              label="태그명 (필수)"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              fullWidth
              helperText="이 프로젝트의 콘텐츠를 묶을 전용 태그 — 기존 태그와 겹치지 않게"
            />

            {mapping && (
              <Box>
                <Alert severity="info" sx={{ mb: 1.5 }}>
                  작업판별 대상 서버를 선택하세요. 같은 종류의 서버가 여러 개라 자동으로 정하지 못했습니다.
                </Alert>
                {mapping.workboards.map((w) => (
                  <Box key={w.index} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{w.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        원본: {w.server ? `${w.server.name} (${w.server.serverType})` : '정보 없음'}
                      </Typography>
                    </Box>
                    <FormControl size="small" sx={{ width: 220, flexShrink: 0 }}>
                      <InputLabel>대상 서버</InputLabel>
                      <Select
                        value={serverMapping[w.index] || ''}
                        label="대상 서버"
                        onChange={(e) => setServerMapping((prev) => ({ ...prev, [w.index]: e.target.value }))}
                      >
                        {mapping.servers.map((sv) => (
                          <MenuItem key={sv._id} value={sv._id}>{sv.name} ({sv.serverType})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={resetAndClose} disabled={importing}>취소</Button>
        {parsed && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={importing || !tagName.trim() || !allMapped}
            startIcon={importing ? <CircularProgress size={16} /> : <FileUpload />}
          >
            가져오기
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ProjectImportDialog;
