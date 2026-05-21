import React from 'react';
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Stack,
  Tooltip,
} from '@mui/material';
import { Public as PublicIcon } from '@mui/icons-material';
import { useQuery } from 'react-query';
import { projectAPI } from '../../services/api';

// 작업판 실행 시 프로젝트 컨텍스트 / 세계관 사용 토글 (#396).
// 프로젝트 선택 시 백엔드가 그 프로젝트의 세계관 텍스트들을 system 메시지의
// [배경 / 사전 컨텍스트] 섹션으로 주입한다.
function ProjectContextSelector({
  projectId,
  useWorldview,
  onProjectChange,
  onUseWorldviewChange,
  disabled = false,
}) {
  const { data: projectsData } = useQuery('projects', () => projectAPI.getAll({ limit: 200 }));
  const projects = projectsData?.data?.data?.projects || projectsData?.data?.projects || [];

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: { sm: 140 } }}>
          <PublicIcon fontSize="small" color="action" />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            프로젝트 컨텍스트
          </Typography>
        </Stack>
        <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>
          <InputLabel>프로젝트 선택</InputLabel>
          <Select
            value={projectId || ''}
            label="프로젝트 선택"
            onChange={(e) => onProjectChange(e.target.value || '')}
            disabled={disabled}
          >
            <MenuItem value=""><em>없음</em></MenuItem>
            {projects.map((p) => (
              <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="ON 이면 선택한 프로젝트의 세계관 텍스트를 LLM 에 사전 컨텍스트로 주입">
          <FormControlLabel
            control={
              <Switch
                checked={!!useWorldview && !!projectId}
                onChange={(e) => onUseWorldviewChange(e.target.checked)}
                disabled={disabled || !projectId}
              />
            }
            label="세계관 사용"
          />
        </Tooltip>
      </Stack>
    </Paper>
  );
}

export default ProjectContextSelector;
