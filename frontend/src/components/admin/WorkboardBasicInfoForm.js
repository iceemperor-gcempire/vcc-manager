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
  Box
} from '@mui/material';
import { Controller, useWatch } from 'react-hook-form';
import { useQuery } from 'react-query';
import { serverAPI } from '../../services/api';

function WorkboardBasicInfoForm({ control, errors, showActiveSwitch = false, showTypeSelector = false, isDialogOpen = true }) {
  const apiFormat = useWatch({ control, name: 'apiFormat' }) || 'ComfyUI';

  const { data: serversData } = useQuery(
    ['servers', apiFormat],
    () => serverAPI.getServers({
      serverType: apiFormat === 'OpenAI Compatible' ? 'OpenAI Compatible' : 'ComfyUI'
    }),
    { enabled: isDialogOpen }
  );

  const servers = serversData?.data?.data?.servers || [];

  return (
    <Grid container spacing={2}>
      {showTypeSelector && (
        <>
          <Grid item xs={12} sm={6}>
            <Controller
              name="apiFormat"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>AI API 형식</InputLabel>
                  <Select
                    {...field}
                    label="AI API 형식"
                  >
                    <MenuItem value="ComfyUI">ComfyUI API</MenuItem>
                    <MenuItem value="OpenAI Compatible">OpenAI Compatible API</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
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
                  >
                    <MenuItem value="image">이미지</MenuItem>
                    <MenuItem value="video">비디오</MenuItem>
                    <MenuItem value="text">텍스트</MenuItem>
                  </Select>
                </FormControl>
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="caption" color="textSecondary">
              {apiFormat === 'OpenAI Compatible'
                ? 'OpenAI Compatible API를 사용하여 콘텐츠를 생성합니다.'
                : 'ComfyUI API를 사용하여 콘텐츠를 생성합니다.'}
            </Typography>
          </Grid>
        </>
      )}

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
                      {server.name} ({server.serverType === 'ComfyUI' ? 'ComfyUI API' : 'OpenAI Compatible API'})
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
            {apiFormat === 'OpenAI Compatible'
              ? '작업판을 생성하기 전에 서버 관리에서 OpenAI Compatible 서버를 등록해주세요.'
              : '작업판을 생성하기 전에 서버 관리에서 ComfyUI 서버를 등록해주세요.'}
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}

export default WorkboardBasicInfoForm;
