import React, { useState } from 'react';
import {
  Paper,
  Box,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Key as KeyIcon
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';

// 모델 관리 (베이스 모델 / LoRA 탭) 의 공용 헤더 (#337).
// 서버 선택기 / NSFW 이미지 토글 / Civitai API key 를 한 곳에서 관리.
// 동기화 버튼은 각 탭의 페이지에 남겨둠 (탭별로 캐시가 다르므로).
//
// props:
//   selectedServerId, onServerChange — 부모 (MetadataManagementPage) 가 상위에서 보유
//   eligibleServers                 — 현재 탭에 해당하는 서버 목록 (모델 탭: 4종, LoRA 탭: ComfyUI 만)
//   nsfwFilter, onNsfwFilterChange   — global systemSettings 와 동기화
//   hasCivitaiApiKey, onApiKeyChange — 저장 결과 콜백 (저장 후 has 갱신)
function CivitaiAdminHeader({
  selectedServerId,
  onServerChange,
  eligibleServers,
  nsfwFilter,
  onNsfwFilterChange,
  hasCivitaiApiKey,
  onApiKeySaved
}) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const handleNsfwToggle = async () => {
    const newValue = !nsfwFilter;
    try {
      await adminAPI.updateLoraSettings({ nsfwFilter: newValue });
      onNsfwFilterChange(newValue);
      toast.success(newValue ? 'NSFW 이미지가 숨겨집니다.' : 'NSFW 이미지가 표시됩니다.');
    } catch (_e) {
      toast.error('설정 저장에 실패했습니다.');
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim() && !hasCivitaiApiKey) {
      toast.error('API 키를 입력해주세요.');
      return;
    }
    setSavingKey(true);
    try {
      await adminAPI.updateLoraSettings({ civitaiApiKey: apiKeyInput.trim() || null });
      onApiKeySaved(!!apiKeyInput.trim());
      setApiKeyInput('');
      setShowApiKeyInput(false);
      toast.success(apiKeyInput.trim() ? 'Civitai API 키가 저장되었습니다.' : 'API 키가 삭제되었습니다.');
    } catch (_e) {
      toast.error('API 키 저장에 실패했습니다.');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ md: 'center' }}
        sx={{ flexWrap: 'wrap' }}
      >
        {/* 서버 선택기 */}
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>서버</InputLabel>
          <Select
            value={selectedServerId || ''}
            label="서버"
            onChange={(e) => onServerChange(e.target.value)}
          >
            {eligibleServers.length === 0 ? (
              <MenuItem value="" disabled>
                현재 탭에 호환되는 서버 없음
              </MenuItem>
            ) : (
              eligibleServers.map((s) => (
                <MenuItem key={s._id} value={s._id}>
                  {s.name} ({s.serverType})
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>

        {/* NSFW 이미지 토글 */}
        <FormControlLabel
          control={
            <Switch
              checked={nsfwFilter}
              onChange={handleNsfwToggle}
              color="primary"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {nsfwFilter ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              <Typography variant="body2">NSFW 이미지 숨기기</Typography>
            </Box>
          }
        />

        {/* API 키 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <KeyIcon color="action" fontSize="small" />
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Civitai API 키:
          </Typography>
          {hasCivitaiApiKey ? (
            <Chip label="등록됨" color="success" size="small" variant="outlined" />
          ) : (
            <Chip label="미등록" size="small" variant="outlined" />
          )}
          <Button size="small" onClick={() => setShowApiKeyInput(!showApiKeyInput)}>
            {showApiKeyInput ? '취소' : hasCivitaiApiKey ? '변경' : '등록'}
          </Button>
        </Box>
      </Stack>

      {showApiKeyInput && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            type="password"
            placeholder={hasCivitaiApiKey ? '새 API 키 (빈칸=삭제)' : 'API 키 입력'}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            sx={{ flex: '1 1 200px', minWidth: 150, maxWidth: 400 }}
            autoComplete="off"
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveApiKey}
            disabled={savingKey}
            startIcon={savingKey ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            저장
          </Button>
        </Box>
      )}
    </Paper>
  );
}

export default CivitaiAdminHeader;
