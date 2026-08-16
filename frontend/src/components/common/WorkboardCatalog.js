import React, { useState, useMemo } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import { Box, Paper, Typography, Chip, IconButton, Button, InputBase } from '@mui/material';
import { MONO } from '../../theme';
import { ToneChip } from './ToneChip';
import { relativeTime } from '../../utils/relativeTime';
import {
  Search,
  Close,
  SmartToy,
  Image as ImageIcon,
  Hexagon,
  Movie,
  MusicNote,
  AutoFixHigh,
  Edit,
  MoreVert,
  AccessTime,
  Info,
} from '@mui/icons-material';


// 작업판 종류(생성 엔진) — outputFormat + serverType 로 유도. 카드 좌측 아이콘.
// 틴트는 시맨틱 .light 토큰 — 라이트(솔리드 틴트)/다크(rgba) 자동 전환 (#562, v1 rgba 잔재 제거)
export const KIND_META = {
  'gpt-chat':  { icon: SmartToy,    label: '텍스트 생성', color: 'info.main',      tint: 'info.light' },
  'gpt-image': { icon: ImageIcon,   label: '이미지 (API)', color: 'secondary.main', tint: 'secondary.light' },
  'sdxl':      { icon: Hexagon,     label: 'SDXL',        color: 'primary.main',   tint: 'primary.light' },
  'i2v':       { icon: Movie,       label: '영상 (I2V)',  color: 'warning.main',   tint: 'warning.light' },
  'lora':      { icon: AutoFixHigh, label: 'LoRA 학습',    color: 'success.main',   tint: 'success.light' },
  'music':     { icon: MusicNote,   label: '오디오 생성',  color: 'error.main',     tint: 'error.light' },   // #805
};

export function deriveOut(wb) {
  return wb.outputFormat || 'image'; // image | video | audio | text
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
  if (out === 'audio') return 'music';   // #805
  const svc = deriveSvc(wb);
  return svc === 'comfy' ? 'sdxl' : 'gpt-image';
}

export const OUTPUT_AXIS = [
  { k: 'image', label: '이미지' },
  { k: 'video', label: '영상' },
  { k: 'audio', label: '오디오' },
  { k: 'text', label: '텍스트' },
];
export const SERVER_AXIS = [
  { k: 'comfy', label: 'ComfyUI' },
  { k: 'openai', label: 'OpenAI' },
  { k: 'gemini', label: 'Gemini' },
];
const OUT_TONE = { image: 'accent', video: 'warning', audio: 'error', text: 'info' };

// 원본 .chip--tag 톤 칩 — 은은한 틴트 배경 + 진한 글씨 (height 20, padding 0 7px, 11.5px).
// ToneChip 은 common/ToneChip 으로 승격 (#548) — 기존 import 호환 재export
export { ToneChip };

// 의미 색 없는 태그 칩 — 투명 배경 + 옅은 테두리 + 보조 글씨 (종류 라벨 등).
// 글씨는 grey.600 이었으나 라이트에서 3.79:1 로 AA 미달 → text.secondary 로 교체 (#727).
export function TagChip({ label, mono, sx }) {
  return (
    <Chip
      variant="outlined"
      label={label}
      sx={{
        height: 24, fontSize: mono ? '10.5px' : '11.5px', bgcolor: 'transparent',
        borderColor: 'divider', color: 'text.secondary',
        ...(mono && { fontFamily: MONO }),
        '& .MuiChip-label': { px: '11px' }, ...sx,
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
        <Box component="span" sx={{ fontSize: 10.5, fontFamily: MONO, color: active ? 'rgba(255,255,255,0.8)' : 'text.tertiary' }}>
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
          <Search fontSize="small" sx={{ color: 'text.tertiary', mr: 0.5 }} />
          <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="작업판 이름 · 설명 검색" sx={{ flex: 1, fontSize: 13 }} />
        </Paper>
        <Typography sx={{ fontSize: 12, color: 'text.tertiary', fontFamily: MONO, flex: '0 0 auto' }}>
          {shown === total ? `${total}개` : `${shown} / ${total}`}
        </Typography>
      </Box>

      {/* two axes */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2.5, sm: 4.5 }, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.tertiary' }}>출력</Typography>
          {OUTPUT_AXIS.map((o) => (
            <FilterToggle key={o.k} active={outSel.includes(o.k)} onClick={() => toggleOut(o.k)} count={counts.out[o.k] || 0}>{o.label}</FilterToggle>
          ))}
        </Box>
        <Box sx={{ width: '1px', height: 22, bgcolor: 'divider', display: { xs: 'none', sm: 'block' } }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.tertiary' }}>서버</Typography>
          {SERVER_AXIS.map((s) => (
            <FilterToggle key={s.k} active={svcSel.includes(s.k)} onClick={() => toggleSvc(s.k)} count={counts.svc[s.k] || 0}>{s.label}</FilterToggle>
          ))}
        </Box>
        {anyActive && (
          <>
            <Box sx={{ flex: 1 }} />
            <Button variant="text" startIcon={<Close />} onClick={onClear} sx={{ color: 'text.tertiary' }}>초기화</Button>
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
      {/* header — 제목은 단독 라인 (#823).
          아이콘·상태배지·출력칩과 한 줄을 나눠 쓰던 때는 제목에 카드 폭의 절반 남짓만 남아
          모델명을 담은 이름이 대부분 말줄임으로 잘렸다. 제목을 위로 올려 폭 전체를 주고
          나머지는 메타 행으로 내린다. 2줄 허용은 안 한다 — 카드 높이가 어긋난다. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} noWrap>{wb.name}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: 1.5, bgcolor: kind.tint, color: kind.color, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
            <KindIcon sx={{ fontSize: 14 }} />
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.tertiary', fontFamily: MONO, minWidth: 0 }} noWrap>
            {kind.label}{wb.version ? ` · v${wb.version}` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {admin && <WbStatusBadge isActive={wb.isActive} />}
          <ToneChip tone={OUT_TONE[out]} label={out} mono sx={{ flex: '0 0 auto' }} />
        </Box>
      </Box>

      {/* description — 없으면 자리만 비운다. 카드 높이 정렬을 위해 minHeight 는 유지하되
          "설명이 없습니다." 를 반복 노출하지 않는다 (#730) */}
      <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.5, textWrap: 'pretty', minHeight: 32,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {wb.description}
      </Typography>

      {/* admin: allowed groups */}
      {admin && groupNames && groupNames.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 10.5, color: 'text.tertiary' }}>허용</Typography>
          {groupNames.map((g) => (
            <TagChip key={g} label={g} />
          ))}
        </Box>
      )}

      {/* stats row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, pt: 2.5, mt: 'auto',
        borderTop: '1px solid', borderColor: 'divider', fontSize: 11, color: 'text.tertiary', fontFamily: MONO }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: archived ? 'text.tertiary' : 'success.main', flex: '0 0 auto' }} />
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
          <Typography sx={{ fontSize: 11, color: 'text.tertiary' }} noWrap>
            {relativeTime(wb.updatedAt)}{wb.createdBy?.nickname ? ` · ${wb.createdBy.nickname}` : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" startIcon={<Edit />} onClick={(e) => { e.stopPropagation(); onEdit && onEdit(wb); }}>편집</Button>
          <IconButton aria-label="더보기" size="small" onClick={(e) => { e.stopPropagation(); onMenu && onMenu(e, wb); }}><MoreVert fontSize="small" /></IconButton>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: -0.5 }}>
          {onInfo && (
            <Button variant="text" startIcon={<Info />} onClick={(e) => { e.stopPropagation(); onInfo(wb); }} sx={{ color: 'text.secondary' }}>
              상세정보
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <AccessTime sx={{ fontSize: 12, color: 'text.tertiary' }} />
          <Typography sx={{ fontSize: 11, color: 'text.tertiary', fontFamily: MONO }}>
            {relativeTime(wb.updatedAt)}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
