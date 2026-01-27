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
  Alert
} from '@mui/material';
import { Controller } from 'react-hook-form';
import { useQuery } from 'react-query';
import { serverAPI } from '../../services/api';

function WorkboardBasicInfoForm({ control, errors, showActiveSwitch = false, isDialogOpen = true }) {
  const { data: serversData } = useQuery(
    ['servers'],
    () => serverAPI.getServers({ serverType: 'ComfyUI', outputType: 'Image' }),
    { enabled: isDialogOpen }
  );
  
  const servers = serversData?.data?.data?.servers || [];

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
      
      <Grid item xs={12}>
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
                  <MenuItem disabled>
                    사용 가능한 서버가 없습니다
                  </MenuItem>
                ) : (
                  servers.map((server) => (
                    <MenuItem key={server._id} value={server._id}>
                      {server.name} ({server.serverType}) - {server.outputType}
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
            작업판을 생성하기 전에 서버 관리에서 ComfyUI 서버를 등록해주세요.
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}

export default WorkboardBasicInfoForm;
