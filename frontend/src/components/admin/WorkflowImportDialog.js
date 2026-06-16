import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Box, Typography, Stack, Alert, Chip, MenuItem, CircularProgress, Divider,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workboardAPI, serverAPI } from '../../services/api';
import { MONO } from '../../theme';

/**
 * ComfyUI 워크플로(API 포맷)를 붙여넣어 작업판 초안을 생성하고,
 * 생성된 작업판 편집기로 이동한다 (#612 — Epic #609 프론트 연결).
 */
export default function WorkflowImportDialog({ open, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('input'); // 'input' | 'result'
  const [workflowText, setWorkflowText] = useState('');
  const [serverId, setServerId] = useState('');
  const [name, setName] = useState('');
  const [outputFormat, setOutputFormat] = useState('image');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { draft, notes, analysis, serverWarning }

  const { data: serversData } = useQuery({
    queryKey: ['servers', 'comfyui-pick'],
    queryFn: () => serverAPI.getServers({ includeInactive: false }),
    enabled: open,
  });
  const comfyServers = (serversData?.data?.data?.servers || []).filter((s) => s.serverType === 'ComfyUI');

  const reset = () => {
    setStep('input'); setWorkflowText(''); setServerId(''); setName('');
    setOutputFormat('image'); setLoading(false); setResult(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleAnalyze = async () => {
    let parsed;
    try {
      parsed = JSON.parse(workflowText);
    } catch {
      toast.error('워크플로 JSON 파싱 실패 — 올바른 JSON 인지 확인하세요.');
      return;
    }
    setLoading(true);
    try {
      const res = await workboardAPI.draftFromWorkflow(parsed, serverId || undefined);
      setResult(res.data.data);
      setStep('result');
    } catch (e) {
      toast.error(e.response?.data?.message || '워크플로 분석에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('작업판 이름을 입력하세요.'); return; }
    if (!serverId) { toast.error('ComfyUI 서버를 선택하세요.'); return; }
    setLoading(true);
    try {
      const res = await workboardAPI.create({
        name: name.trim(),
        description: '',
        outputFormat,
        serverId,
        workflowData: result.draft.workflowData,
        additionalInputFields: result.draft.additionalInputFields,
      });
      const newId = res.data?.workboard?._id;
      toast.success('작업판 초안이 생성되었습니다. 편집기에서 다듬어 주세요.');
      handleClose();
      if (newId) navigate(`/admin/workboards/${newId}/edit`);
    } catch (e) {
      toast.error(e.response?.data?.message || '작업판 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fields = result?.draft?.additionalInputFields || [];
  const missing = result?.analysis?.missingNodes;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>ComfyUI 워크플로에서 작업판 만들기</DialogTitle>
      <DialogContent dividers>
        {step === 'input' && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              ComfyUI 에서 <strong>"Save (API Format)"</strong> 로 저장한 워크플로 JSON 을 붙여넣으세요.
              필요한 입력이 자동으로 변수로 추출된 작업판 초안이 만들어집니다.
            </Alert>
            <TextField
              select
              label="검사할 ComfyUI 서버 (선택 — 빠진 노드 확인용)"
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              fullWidth
              helperText={comfyServers.length ? '서버를 고르면 필요한 커스텀 노드 설치 여부를 확인합니다.' : '등록된 ComfyUI 서버가 없습니다.'}
            >
              <MenuItem value="">선택 안 함</MenuItem>
              {comfyServers.map((s) => (
                <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="워크플로 JSON (API 포맷)"
              value={workflowText}
              onChange={(e) => setWorkflowText(e.target.value)}
              placeholder='{ "3": { "class_type": "KSampler", "inputs": { ... } }, ... }'
              multiline minRows={10} maxRows={20} fullWidth
              InputProps={{ sx: { fontFamily: MONO, fontSize: 12 } }}
            />
          </Stack>
        )}

        {step === 'result' && result && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {Array.isArray(missing) && missing.length > 0 && (
              <Alert severity="warning">
                이 서버에 없는 커스텀 노드 {missing.length}개 — 설치하지 않으면 실행이 실패합니다:
                <Box sx={{ mt: 0.5, fontFamily: MONO, fontSize: 12 }}>{missing.join(', ')}</Box>
              </Alert>
            )}
            {Array.isArray(missing) && missing.length === 0 && (
              <Alert severity="success">필요한 노드가 모두 서버에 설치되어 있습니다.</Alert>
            )}
            {result.serverWarning && <Alert severity="info">{result.serverWarning}</Alert>}
            {(result.notes || []).map((n, i) => (
              <Alert key={i} severity="info" variant="outlined">{n}</Alert>
            ))}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>추출된 변수 ({fields.length})</Typography>
              {fields.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  자동 추출된 변수가 없습니다. 편집기에서 직접 지정해야 합니다.
                </Typography>
              ) : (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {fields.map((f) => (
                    <Chip key={f.name} label={`${f.label || f.name} · ${f.type}`} variant="outlined" />
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="작업판 이름" value={name} onChange={(e) => setName(e.target.value)}
                required fullWidth autoFocus
              />
              <TextField
                select label="출력 형식" value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)} sx={{ minWidth: 140 }}
              >
                <MenuItem value="image">이미지</MenuItem>
                <MenuItem value="video">비디오</MenuItem>
              </TextField>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              초안 생성 후 편집기로 이동합니다. 변수·기본값·노출 항목을 거기서 다듬을 수 있습니다.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        {step === 'input' && (
          <Button variant="contained" onClick={handleAnalyze} disabled={!workflowText.trim() || loading}>
            {loading ? <CircularProgress size={20} /> : '초안 생성'}
          </Button>
        )}
        {step === 'result' && (
          <>
            <Button onClick={() => setStep('input')} disabled={loading}>뒤로</Button>
            <Button variant="contained" onClick={handleCreate} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : '작업판 만들기'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
