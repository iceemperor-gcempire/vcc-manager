import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, FormControlLabel, IconButton, Link, Paper, Radio, RadioGroup, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { modelLicenseAPI, serverAPI } from '../../services/api';
import {
  COMMERCIAL_USE, COMMERCIAL_USE_COLORS, COMMERCIAL_USE_LABELS, MODEL_LICENSE_LIMITS,
} from '../../constants/modelLicense';
import { MONO } from '../../theme';

// 모델 라이선스 등록 (#1073) — 관리자가 라이선스를 적고 모델 폴더·파일에 붙인다.
// 라이선스 조건을 제품에 미리 넣어 두지 않는다. 경로 맞춰 보기(어느 모델에 붙는지)는 서버가 한다.

const EMPTY = { name: '', url: '', commercialUse: 'conditional', note: '', targets: [] };

// 이 서버 모델 목록에서 고를 거리 — 폴더(끝이 /)와 파일. 입력 편의일 뿐 판정에 쓰지 않는다
function suggestionsFrom(models) {
  const folders = new Set();
  const files = [];
  for (const m of models) {
    const f = String(m.filename || '');
    if (!f) continue;
    files.push(f);
    const parts = f.split(/[/\\]/);
    for (let i = 1; i < parts.length; i++) folders.add(`${parts.slice(0, i).join('/')}/`);
  }
  return [...[...folders].sort(), ...files.sort()];
}

function ModelLicenseDialog({ open, onClose, serverId, onChanged }) {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [form, setForm] = useState(null); // null 이면 목록, 아니면 { id?, ...값 }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await modelLicenseAPI.getAll();
      setLicenses(res.data.data.licenses || []);
    } catch (e) {
      toast.error(e.response?.data?.message || '라이선스 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(null);
    load();
    if (serverId) {
      serverAPI.getDetailedModels(serverId, { limit: 1000 })
        .then((res) => setSuggestions(suggestionsFrom(res.data.data.models || [])))
        .catch(() => setSuggestions([]));
    }
  }, [open, serverId, load]);

  const startEdit = (lic) => {
    setFormError('');
    setForm(lic
      ? { id: lic._id, name: lic.name, url: lic.url || '', commercialUse: lic.commercialUse, note: lic.note || '', targets: (lic.targets || []).map((t) => t.match) }
      : { ...EMPTY });
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    const { id, ...body } = form;
    try {
      if (id) await modelLicenseAPI.update(id, body);
      else await modelLicenseAPI.create(body);
      toast.success(id ? '라이선스를 수정했습니다.' : '라이선스를 등록했습니다.');
      setForm(null);
      await load();
      onChanged?.();
    } catch (e) {
      setFormError(e.response?.data?.message || '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await modelLicenseAPI.delete(deleting._id);
      toast.success('라이선스를 삭제했습니다.');
      setDeleting(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.message || '삭제하지 못했습니다.');
    }
  };

  const takenByOthers = useMemo(() => {
    const m = new Map();
    for (const l of licenses) {
      if (form?.id && l._id === form.id) continue;
      for (const t of l.targets || []) m.set(t.match.toLowerCase(), l.name);
    }
    return m;
  }, [licenses, form]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>모델 라이선스</DialogTitle>
        <DialogContent>
          <DialogContentText variant="body2" sx={{ mb: 2 }}>
            라이선스를 등록하고 모델 폴더나 파일에 붙이면 모델 선택기와 생성 화면에 보입니다. 붙지 않은 모델은 "라이선스 미등록"으로 보입니다.
            라이선스 조건은 원문을 직접 확인해서 적어 주세요.
          </DialogContentText>

          {form ? (
            <Stack spacing={2}>
              {formError && <Alert severity="error">{formError}</Alert>}
              <TextField label="라이선스 이름" required value={form.name} onChange={set('name')} inputProps={{ maxLength: MODEL_LICENSE_LIMITS.name }} placeholder="예: MiniMax H3 Community License" />
              <TextField label="원문 링크" value={form.url} onChange={set('url')} inputProps={{ maxLength: MODEL_LICENSE_LIMITS.url }} placeholder="https://" />
              <Box>
                <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>상업적 이용</Typography>
                <RadioGroup row value={form.commercialUse} onChange={set('commercialUse')}>
                  {COMMERCIAL_USE.map((v) => (
                    <FormControlLabel key={v} value={v} control={<Radio size="small" />} label={COMMERCIAL_USE_LABELS[v].replace('상업적 이용 ', '')} />
                  ))}
                </RadioGroup>
              </Box>
              <TextField label="메모" value={form.note} onChange={set('note')} inputProps={{ maxLength: MODEL_LICENSE_LIMITS.note }} placeholder="예: 월 사용자 1억 명 이상이면 별도 계약" helperText="한 줄로 — 원문을 대신하지 않습니다" />
              <Autocomplete
                multiple
                freeSolo
                options={suggestions}
                value={form.targets}
                onChange={(_, v) => setForm((f) => ({ ...f, targets: v.map((x) => String(x).trim()).filter(Boolean) }))}
                filterSelectedOptions
                renderTags={(value, getTagProps) => value.map((t, i) => {
                  const owner = takenByOthers.get(t.replace(/\\/g, '/').toLowerCase());
                  return (
                    <Chip {...getTagProps({ index: i })} key={t} label={t} color={owner ? 'error' : 'default'} title={owner ? `이미 "${owner}" 에 붙어 있음` : t} sx={{ fontFamily: MONO, maxWidth: '100%' }} />
                  );
                })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="붙일 폴더·파일"
                    placeholder="minimax\  또는  model.safetensors"
                    helperText="끝이 / 나 \ 이면 폴더(그 아래 전부), 아니면 파일 하나. 파일로 붙인 것이 폴더보다 우선합니다. 입력 후 Enter"
                  />
                )}
              />
            </Stack>
          ) : (
            <>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
              ) : licenses.length === 0 ? (
                <Alert severity="info">등록된 라이선스가 없습니다. 모든 모델이 "라이선스 미등록"으로 보입니다.</Alert>
              ) : (
                <Stack spacing={1}>
                  {licenses.map((lic) => (
                    <Paper key={lic._id} variant="outlined" sx={{ p: 1.5, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                        <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" sx={{ wordBreak: 'break-word' }}>{lic.name}</Typography>
                            <Chip label={COMMERCIAL_USE_LABELS[lic.commercialUse]} color={COMMERCIAL_USE_COLORS[lic.commercialUse]} variant="outlined" sx={{ height: 20, fontSize: '11px' }} />
                            {lic.url && (
                              <Link href={lic.url} target="_blank" rel="noopener noreferrer" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                                원문 <OpenInNewIcon sx={{ fontSize: 12 }} />
                              </Link>
                            )}
                          </Box>
                          {lic.note && <Typography variant="caption" color="text.secondary" display="block">{lic.note}</Typography>}
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                            {(lic.targets || []).length === 0
                              ? <Typography variant="caption" color="text.secondary">붙인 폴더·파일 없음</Typography>
                              : lic.targets.map((t) => <Chip key={t.match} label={t.match} title={t.match} variant="outlined" sx={{ height: 20, fontSize: '11px', fontFamily: MONO, maxWidth: '100%' }} />)}
                          </Box>
                        </Box>
                        <Tooltip title="수정"><IconButton size="small" onClick={() => startEdit(lic)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="삭제"><IconButton size="small" onClick={() => setDeleting(lic)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {form ? (
            <>
              <Button onClick={() => setForm(null)} disabled={saving}>취소</Button>
              <Button variant="contained" onClick={save} disabled={saving || !form.name.trim()}>
                {saving ? <CircularProgress size={18} /> : '저장'}
              </Button>
            </>
          ) : (
            <>
              <Button startIcon={<AddIcon />} onClick={() => startEdit(null)}>새 라이선스</Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button onClick={onClose}>닫기</Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)}>
        <DialogTitle>라이선스 삭제</DialogTitle>
        <DialogContent>
          <DialogContentText>
            "{deleting?.name}" 을 지웁니다. 붙어 있던 모델은 "라이선스 미등록"으로 돌아갑니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>취소</Button>
          <Button color="error" variant="contained" onClick={remove}>삭제</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ModelLicenseDialog;
