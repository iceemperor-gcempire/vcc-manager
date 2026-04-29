import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Alert,
} from '@mui/material';
import { Controller, useWatch } from 'react-hook-form';
import { useQuery } from 'react-query';
import { serverAPI } from '../../services/api';
import {
  getCapableOutputFormats,
  getOutputFormatLabel,
  getServerTypeLabel,
} from '../../templates/capabilities';

function WorkboardBasicInfoForm({ control, setValue, errors, showActiveSwitch = false, showTypeSelector = false, isDialogOpen = true }) {
  const selectedServerId = useWatch({ control, name: 'serverId' });
  const outputFormat = useWatch({ control, name: 'outputFormat' }) || 'image';

  const { data: serversData } = useQuery(
    'servers-all-active',
    () => serverAPI.getServers({}),
    { enabled: isDialogOpen }
  );

  const servers = serversData?.data?.data?.servers || [];
  const selectedServer = servers.find((s) => s._id === selectedServerId);
  const selectedServerType = selectedServer?.serverType;
  const capableOutputFormats = selectedServerType ? getCapableOutputFormats(selectedServerType) : [];

  // 서버가 바뀌면 폼의 serverType 을 동기화하고, 현재 outputFormat 이 capability 에 없으면 첫 옵션으로 보정.
  React.useEffect(() => {
    if (!setValue) return;
    setValue('serverType', selectedServerType || '');
    if (selectedServerType && capableOutputFormats.length > 0 && !capableOutputFormats.includes(outputFormat)) {
      setValue('outputFormat', capableOutputFormats[0]);
    }
  }, [setValue, selectedServerType, capableOutputFormats, outputFormat]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Controller
          name="name"
          control={control}
          rules={{ required: '작업판 이름을 입력해주세요' }}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              label="작업판 이름"
              error={!!errors.name}
              helperText={errors.name?.message}
            />
          )}
        />
      </Grid>

      <Grid item xs={12}>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              fullWidth
              multiline
              rows={3}
              label="설명"
              placeholder="작업판에 대한 설명을 입력하세요..."
            />
          )}
        />
      </Grid>

      <Grid item xs={12} sm={showTypeSelector ? 6 : 12}>
        <Controller
          name="serverId"
          control={control}
          rules={{ required: '서버를 선택해주세요' }}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.serverId}>
              <InputLabel>서버 선택</InputLabel>
              <Select
                {...field}
                label="서버 선택"
                disabled={servers.length === 0}
              >
                {servers.length === 0 ? (
                  <MenuItem disabled>사용 가능한 서버가 없습니다</MenuItem>
                ) : (
                  servers.map((server) => (
                    <MenuItem key={server._id} value={server._id}>
                      {server.name} ({getServerTypeLabel(server.serverType)})
                    </MenuItem>
                  ))
                )}
              </Select>
              {errors.serverId && (
                <Typography variant="caption" color="error">
                  {errors.serverId.message}
                </Typography>
              )}
            </FormControl>
          )}
        />
      </Grid>

      {showTypeSelector && (
        <Grid item xs={12} sm={6}>
          <Controller
            name="outputFormat"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>출력 형식</InputLabel>
                <Select
                  {...field}
                  label="출력 형식"
                  value={capableOutputFormats.includes(outputFormat) ? outputFormat : (capableOutputFormats[0] || '')}
                  disabled={!selectedServerType || capableOutputFormats.length <= 1}
                >
                  {capableOutputFormats.length === 0 ? (
                    <MenuItem value="" disabled>먼저 서버를 선택하세요</MenuItem>
                  ) : (
                    capableOutputFormats.map((fmt) => (
                      <MenuItem key={fmt} value={fmt}>{getOutputFormatLabel(fmt)}</MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            )}
          />
        </Grid>
      )}

      {showTypeSelector && selectedServerType && (
        <Grid item xs={12}>
          <Typography variant="caption" color="textSecondary">
            선택된 서버 타입: <strong>{getServerTypeLabel(selectedServerType)}</strong> · 지원 출력 형식: {capableOutputFormats.map(getOutputFormatLabel).join(', ') || '없음'}
          </Typography>
        </Grid>
      )}

      {showActiveSwitch && (
        <Grid item xs={12}>
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch {...field} checked={field.value} />}
                label="활성 상태"
              />
            )}
          />
        </Grid>
      )}

      {servers.length === 0 && (
        <Grid item xs={12}>
          <Alert severity="warning">
            작업판을 생성하기 전에 서버 관리에서 사용할 서버를 등록해주세요.
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}

export default WorkboardBasicInfoForm;
