import React from 'react';
import { Box, Chip, Link, Tooltip, Typography } from '@mui/material';
import { Gavel as GavelIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { modelLicenseAPI } from '../../services/api';
import { COMMERCIAL_USE_COLORS, COMMERCIAL_USE_LABELS, UNREGISTERED_LICENSE_LABEL } from '../../constants/modelLicense';

// 모델 라이선스 표시 (#1073). 어느 모델에 어느 라이선스가 붙는지는 백엔드가 판정해 준다
// (모델 목록 응답의 license, 또는 /model-licenses/resolve) — 여기서 경로를 맞춰 보지 않는다.

const tooltipOf = (license) => (license
  ? [COMMERCIAL_USE_LABELS[license.commercialUse], license.note].filter(Boolean).join(' · ')
  : '관리자가 아직 이 모델의 라이선스를 등록하지 않았습니다');

/**
 * 모델 선택기 항목 옆의 짧은 라벨. license 가 undefined 면(LoRA 등 대상 아님) 그리지 않는다.
 * @param {{ license: object|null|undefined, dense?: boolean }} props
 */
export function ModelLicenseChip({ license, dense = false }) {
  if (license === undefined) return null;
  return (
    <Tooltip title={tooltipOf(license)}>
      <Chip
        icon={<GavelIcon />}
        label={license ? license.name : UNREGISTERED_LICENSE_LABEL}
        color={license ? COMMERCIAL_USE_COLORS[license.commercialUse] || 'default' : 'default'}
        variant="outlined"
        sx={{ maxWidth: '100%', ...(dense ? { height: 20, fontSize: '11px', '& .MuiChip-icon': { fontSize: 13 } } : {}) }}
      />
    </Tooltip>
  );
}

/**
 * 생성 화면에서 고른 모델 아래 한 줄 — 라이선스 이름 · 상업적 이용 · 원문 링크.
 * 저장된 값(파일 이름)만 알 때가 많아 서버에 판정을 묻는다.
 */
export function ModelLicenseLine({ filename }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['modelLicense', filename],
    queryFn: async () => (await modelLicenseAPI.resolve(filename)).data.data.license,
    enabled: Boolean(filename),
    staleTime: 5 * 60 * 1000,
  });
  if (!filename || isLoading || isError) return null;
  const license = data || null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.75, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">라이선스</Typography>
      <ModelLicenseChip license={license} dense />
      {license && (
        <Typography variant="caption" color="text.secondary">{COMMERCIAL_USE_LABELS[license.commercialUse]}</Typography>
      )}
      {license?.url && (
        <Link href={license.url} target="_blank" rel="noopener noreferrer" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
          원문 <OpenInNewIcon sx={{ fontSize: 12 }} />
        </Link>
      )}
    </Box>
  );
}

export default ModelLicenseChip;
