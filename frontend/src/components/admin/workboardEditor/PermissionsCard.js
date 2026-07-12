// 권한 / 노출 설정 카드 (#713 R3) — 구 PermissionsAndExposurePanel 의 레일 카드 버전.
// 아코디언 3개 → 한 카드 안의 섹션 스택 (내용·로직 불변, #198).
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
  Divider,
} from '@mui/material';
import { Controller } from 'react-hook-form';
import { WhitelistField } from './shared';

function SectionLabel({ children }) {
  return (
    <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.6, mt: 1.5 }}>
      {children}
    </Typography>
  );
}

function PermissionsCard({ control, isComfyUI, serverId, outputFormat, groups, modelExposurePolicyValue, loraExposurePolicyValue }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>권한 / 노출</Typography>

      <SectionLabel>접근 그룹</SectionLabel>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        비워두면 admin 외 접근 불가. admin 은 그룹과 무관하게 접근 가능.
      </Typography>
      <Controller
        name="allowedGroupIds"
        control={control}
        render={({ field }) => (
          <Autocomplete
            multiple
            size="small"
            options={groups.map((g) => g._id)}
            value={field.value || []}
            onChange={(_, newValue) => field.onChange(newValue)}
            getOptionLabel={(option) => {
              const g = groups.find((x) => x._id === option);
              return g ? `${g.name}${g.isDefault ? ' (기본)' : ''}` : `삭제된 그룹 (${String(option).slice(-6)})`;
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const g = groups.find((x) => x._id === option);
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={option}
                    label={g ? `${g.name}${g.isDefault ? ' (기본)' : ''}` : `삭제된 그룹 (${String(option).slice(-6)})`}
                    color={g ? 'primary' : 'warning'}
                    variant="outlined"
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={groups.length === 0 ? '그룹 없음 — 그룹 관리에서 먼저 생성' : '그룹 선택'}
              />
            )}
          />
        )}
      />

      <Divider sx={{ my: 3 }} />

      <SectionLabel>모델 노출 정책</SectionLabel>
      <Controller
        name="modelExposurePolicy"
        control={control}
        render={({ field }) => (
          <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
            <InputLabel>정책</InputLabel>
            <Select {...field} label="정책">
              <MenuItem value="full">전체 노출 (서버의 모든 모델)</MenuItem>
              <MenuItem value="whitelist">화이트리스트 (지정 모델만)</MenuItem>
            </Select>
          </FormControl>
        )}
      />
      {modelExposurePolicyValue === 'whitelist' && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            노출할 모델 식별자 (ComfyUI=파일 경로, OpenAI/Gemini=모델 ID) · "선택" 으로 서버에서 직접 추가
          </Typography>
          <WhitelistField
            name="modelWhitelist"
            control={control}
            kind="model"
            serverId={serverId}
            outputFormat={outputFormat}
            placeholder="예: SDXL/illustrious_v6.safetensors"
            showPicker
          />
        </Box>
      )}

      {isComfyUI && (
        <>
          <Divider sx={{ my: 3 }} />
          <SectionLabel>LoRA 노출 정책</SectionLabel>
          <Controller
            name="loraExposurePolicy"
            control={control}
            render={({ field }) => (
              <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                <InputLabel>정책</InputLabel>
                <Select {...field} label="정책">
                  <MenuItem value="full">전체 노출</MenuItem>
                  <MenuItem value="whitelist">화이트리스트</MenuItem>
                </Select>
              </FormControl>
            )}
          />
          {loraExposurePolicyValue === 'whitelist' && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                노출할 LoRA 식별자 (파일 경로 또는 hash) · "선택" 으로 서버에서 직접 추가
              </Typography>
              <WhitelistField
                name="loraWhitelist"
                control={control}
                kind="lora"
                serverId={serverId}
                placeholder="예: character/style_v2.safetensors"
                showPicker
              />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}

export default PermissionsCard;
