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
  ToggleButton,
  ToggleButtonGroup,
  Box
} from '@mui/material';
import { Image, Chat } from '@mui/icons-material';
import { Controller, useWatch } from 'react-hook-form';
import { useQuery } from 'react-query';
import { serverAPI } from '../../services/api';

function WorkboardBasicInfoForm({ control, errors, showActiveSwitch = false, showTypeSelector = false, isDialogOpen = true }) {
  const workboardType = useWatch({ control, name: 'workboardType' }) || 'image';
  
  const { data: serversData } = useQuery(
    ['servers', workboardType],
    () => serverAPI.getServers({ 
      outputType: workboardType === 'prompt' ? 'Text' : 'Image' 
    }),
    { enabled: isDialogOpen }
  );
  
  const servers = serversData?.data?.data?.servers || [];

  return (
    <Grid container spacing={2}>
      {showTypeSelector && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            작업판 유형
          </Typography>
          <Controller
            name="workboardType"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                {...field}
                exclusive
                onChange={(e, value) => value && field.onChange(value)}
                fullWidth
                sx={{ mb: 1 }}
              >
                <ToggleButton value="image">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Image />
                    <span>이미지 작업판</span>
                  </Box>
                </ToggleButton>
                <ToggleButton value="prompt">
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chat />
                    <span>프롬프트 작업판</span>
                  </Box>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
          />
          <Typography variant="caption" color="textSecondary">
            {workboardType === 'prompt' 
              ? '텍스트 생성 API를 사용하여 프롬프트를 생성합니다.' 
              : 'ComfyUI를 사용하여 이미지를 생성합니다.'}
          </Typography>
        </Grid>
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
            {workboardType === 'prompt' 
              ? '작업판을 생성하기 전에 서버 관리에서 Text 출력 타입의 서버(OpenAI Compatible 등)를 등록해주세요.'
              : '작업판을 생성하기 전에 서버 관리에서 ComfyUI 서버를 등록해주세요.'}
          </Alert>
        </Grid>
      )}
    </Grid>
  );
}

export default WorkboardBasicInfoForm;
