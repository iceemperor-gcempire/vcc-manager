import React, { useState, useMemo } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { Box, Paper, Typography, Chip, IconButton, Button, InputBase } from '@mui/material';
import { MONO } from '../../theme';
import { ToneChip } from './ToneChip';
import {
  Search,
  Close,
  SmartToy,
  Image as ImageIcon,
  Hexagon,
  Movie,
  AutoFixHigh,
  Edit,
  MoreVert,
  AccessTime,
  Info,
} from '@mui/icons-material';


// 작업판 종류(생성 엔진) — outputFormat + serverType 로 유도. 카드 좌측 아이콘.
export const KIND_META = {
  'gpt-chat':  { icon: SmartToy,    label: '텍스트 생성', color: 'info.main',     tint: 'rgba(47,119,228,0.12)' },
  'gpt-image': { icon: ImageIcon,   label: '이미지 (API)', color: '#5B2DBF',      tint: 'rgba(91,45,191,0.10)' },
  'sdxl':      { icon: Hexagon,     label: 'SDXL',        color: 'primary.main',  tint: 'rgba(91,91,214,0.10)' },
  'i2v':       { icon: Movie,       label: '영상 (I2V)',  color: 'warning.main',  tint: 'rgba(190,116,21,0.14)' },
  'lora':      { icon: AutoFixHigh, label: 'LoRA 학습',    color: 'success.main',  tint: 'rgba(31,157,85,0.12)' },
};

export function deriveOut(wb) {
  return wb.outputFormat || 'image'; // image | video | text
}
export function deriveSvc(wb) {
  const t = wb.serverId?.serverType || wb.serverType || '';
  if (t === 'Gemini') return 'gemini';
  if (t.startsWith('OpenAI')) return 'openai';
  if (t === 'ComfyUI') return 'comfy';
  return 'other';
}
export function deriveKind(wb) {
  const out = deriveOut(wb);
  if (out === 'text') return 'gpt-chat';
  if (out === 'video') return 'i2v';
  const svc = deriveSvc(wb);
  return svc === 'comfy' ? 'sdxl' : 'gpt-image';
}

export const OUTPUT_AXIS = [
  { k: 'image', label: '이미지' },
  { k: 'video', label: '영상' },
  { k: 'text', label: '텍스트' },
];
export const SERVER_AXIS = [
  { k: 'comfy', label: 'ComfyUI' },
  { k: 'openai', label: 'OpenAI' },
  { k: 'gemini', label: 'Gemini' },
];
const OUT_TONE = { image: 'accent', video: 'warning', text: 'info' };

// 원본 .chip--tag 톤 칩 — 은은한 틴트 배경 + 진한 글씨 (height 20, padding 0 7px, 11.5px).
// ToneChip 은 common/ToneChip 으로 승격 (#548) — 기존 import 호환 재export
export { ToneChip };

// 의미 색 없는 태그 칩 — 투명 배경 + 옅은 테두리 + tertiary 글씨 (종류 라벨 등).
export function TagChip({ label, mono, sx }) {
  return (
    <Chip
      variant="outlined"
      label={label}
      sx={{
        height: 22, fontSize: mono ? '10.5px' : '11.5px', bgcolor: 'transparent',
        borderColor: 'divider', color: 'grey.600',
        ...(mono && { fontFamily: MONO }),
        '& .MuiChip-label': { px: '9px' }, ...sx,
      }}
    />
  );
}

// ── 필터 로직 훅 ─────────────────────────────────────────────
// persistKey 를 주면 검색어·필터 선택을 localStorage 에 유지한다 (#510) — 작업판에 들어갔다 나와도 보존.
export function useWorkboardFilter(workboards, persistKey) {
  const [q, setQ] = usePersistedState(persistKey ? `${persistKey}.q` : null, '');
  const [outSel, setOutSel] = usePersistedState(persistKey ? `${persistKey}.out` : null, []);
  const [svcSel, setSvcSel] = usePersistedState(persistKey ? `${persistKey}.svc` : null, []);

  const toggleOut = (k) => setOutSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const toggleSvc = (k) => setSvcSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const clear = () => { setQ(''); setOutSel([]); setSvcSel([]); };

  const counts = useMemo(() => {
    const out = {}, svc = {};
    workboards.forEach((w) => {
      const o = deriveOut(w), s = deriveSvc(w);
      out[o] = (out[o] || 0) + 1;
      svc[s] = (svc[s] || 0) + 1;
    });
    return { out, svc };
  }, [workboards]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return workboards.filter((w) => {
      if (outSel.length && !outSel.includes(deriveOut(w))) return false;
      if (svcSel.length && !svcSel.includes(deriveSvc(w))) return false;
      if (needle && !(`${w.name} ${w.description || ''}`).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [workboards, q, outSel, svcSel]);

  return { q, setQ, outSel, svcSel, toggleOut, toggleSvc, clear, counts, filtered };
}

function FilterToggle({ active, onClick, children, count }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px',
        height: 28, px: '11px', borderRadius: 999, fontSize: 12.5, fontWeight: 500,
        bgcolor: active ? 'primary.main' : 'background.paper',
        color: active ? 'primary.contrastText' : 'text.secondary',
        border: '1px solid', borderColor: active ? 'primary.main' : 'divider',
        transition: 'all 120ms',
      }}
    >
      {children}
      {count != null && (
        <Box component="span" sx={{ fontSize: 10.5, fontFamily: MONO, color: active ? 'rgba(255,255,255,0.8)' : 'text.disabled' }}>
          {count}
        </Box>
      )}
    </Box>
  );
}

// ── 2축 필터 바 ─────────────────────────────────────────────
export function WorkboardFilters({ q, setQ, outSel, toggleOut, svcSel, toggleSvc, counts, total, shown, onClear }) {
  const anyActive = outSel.length > 0 || svcSel.length > 0 || q.trim().length > 0;
  return (
    <Paper
      variant="outlined"
      sx={{ bgcolor: 'background.default', p: { xs: 3, sm: '12px 14px' }, mb: 4.5, display: 'flex', flexDirection: 'column', gap: 2.75 }}
    >
      {/* search */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
        <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', px: 1, height: 34, bgcolor: 'background.paper' }}>
          <Search fontSize="small" sx={{ color: 'text.disabled', mr: 0.5 }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="작업판 이름 · 설명 검색" sx={{ flex: 1, fontSize: 13 }} />
        </Paper>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', fontFamily: MONO, flex: '0 0 auto' }}>
          {shown === total ? `${total}개` : `${shown} / ${total}`}
        </Typography>
      </Box>

      {/* two axes */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2.5, sm: 4.5 }, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled' }}>출력</Typography>
          {OUTPUT_AXIS.map((o) => (
            <FilterToggle key={o.k} active={outSel.includes(o.k)} onClick={() => toggleOut(o.k)} count={counts.out[o.k] || 0}>{o.label}</FilterToggle>
          ))}
        </Box>
        <Box sx={{ width: '1px', height: 22, bgcolor: 'divider', display: { xs: 'none', sm: 'block' } }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled' }}>서버</Typography>
          {SERVER_AXIS.map((s) => (
            <FilterToggle key={s.k} active={svcSel.includes(s.k)} onClick={() => toggleSvc(s.k)} count={counts.svc[s.k] || 0}>{s.label}</FilterToggle>
          ))}
        </Box>
        {anyActive && (
          <>
            <Box sx={{ flex: 1 }} />
            <Button variant="text" startIcon={<Close />} onClick={onClear} sx={{ color: 'text.disabled' }}>초기화</Button>
          </>
        )}
      </Box>
    </Paper>
  );
}

function WbStatusBadge({ isActive }) {
  return <ToneChip tone={isActive ? 'success' : 'neutral'} label={isActive ? '게시됨' : '보관'} />;
}

// ── 공유 카드 ───────────────────────────────────────────────
export function WorkboardCard({ wb, admin, onClick, onEdit, onMenu, onInfo, groupNames }) {
  const kind = KIND_META[deriveKind(wb)] || KIND_META['gpt-image'];
  const KindIcon = kind.icon;
  const out = deriveOut(wb);
  const archived = admin && !wb.isActive;
  const serverName = wb.serverId?.name || '서버 미설정';

  return (
    <Paper
      variant="outlined"
      onClick={admin ? undefined : onClick}
      sx={{
        p: 3.5, display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%',
        cursor: admin ? 'default' : 'pointer', opacity: archived ? 0.72 : 1,
        transition: 'border-color 150ms, box-shadow 150ms',
        '&:hover': admin ? {} : { borderColor: 'primary.main', boxShadow: 2 },
      }}
    >
      {/* header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: 1.5, bgcolor: kind.tint, color: kind.color, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
          <KindIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>{wb.name}</Typography>
            {admin && <WbStatusBadge isActive={wb.isActive} />}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: MONO, mt: 0.25 }} noWrap>
            {kind.label}{wb.version ? ` · v${wb.version}` : ''}
          </Typography>
        </Box>
        <ToneChip tone={OUT_TONE[out]} label={out} mono sx={{ flex: '0 0 auto' }} />
      </Box>

      {/* description */}
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.5, textWrap: 'pretty', minHeight: 32,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {wb.description || '설명이 없습니다.'}
      </Typography>

      {/* admin: allowed groups */}
      {admin && groupNames && groupNames.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 10.5, color: 'text.disabled' }}>허용</Typography>
          {groupNames.map((g) => (
            <TagChip key={g} label={g} />
          ))}
        </Box>
      )}

      {/* stats row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, pt: 2.5, mt: 'auto',
        borderTop: '1px solid', borderColor: 'divider', fontSize: 11, color: 'text.disabled', fontFamily: MONO }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: archived ? 'text.disabled' : 'success.main', flex: '0 0 auto' }} />
          <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{serverName}</Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        {admin ? (
          <Box component="span">필드 {wb.additionalInputFields?.length ?? 0}</Box>
        ) : (
          <Box component="span">{wb.usageCount || 0}회</Box>
        )}
      </Box>

      {/* footer */}
      {admin ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }} noWrap>
            {wb.updatedAt ? new Date(wb.updatedAt).toLocaleDateString() : ''}{wb.createdBy?.nickname ? ` · ${wb.createdBy.nickname}` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<Edit />} onClick={(e) => { e.stopPropagation(); onEdit && onEdit(wb); }}>편집</Button>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onMenu && onMenu(e, wb); }}><MoreVert fontSize="small" /></IconButton>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: -0.5 }}>
          {onInfo && (
            <Button variant="text" startIcon={<Info />} onClick={(e) => { e.stopPropagation(); onInfo(wb); }} sx={{ color: 'text.secondary' }}>
              상세정보
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <AccessTime sx={{ fontSize: 12, color: 'text.disabled' }} />
          <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: MONO }}>
            {wb.updatedAt ? new Date(wb.updatedAt).toLocaleDateString() : ''}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
