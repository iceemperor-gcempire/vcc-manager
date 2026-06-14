// VCC Manager design tokens v2 — MUI ThemeOptions (#554).
//
// 디자인 시스템 단일 진입점. createTheme(buildVccTheme(mode)) 로 light/dark 적용.
// v2 방향 (2026-06-12 확정): 라이트 "Warm Studio" / 다크 "Console" — 이중 포인트.
//   - 구조 토큰(radius/타입/간격)은 모드 공통, 컬러 팔레트만 모드별
//   - 라이트: 페이퍼 배경 + 테라코타 포인트, 부드러운 그림자
//   - 다크: 딥 차콜 + 민트 포인트, 보더 위주 위계
//   - 버튼은 pill(999), 카드 radius 10, 컨트롤 radius 8
// 기준 문서: docs/design-v2/TOKENS.md (v1 핸드오프는 폐기 — docs/design/.../README 참고)

// 모노스페이스 폰트 토큰 — 시드/ID/메타 영역 공용 (#542)
export const MONO = '"JetBrains Mono","SF Mono","Menlo","Consolas",monospace';

const LIGHT = {
  // 테라코타 포인트
  primary:   { main: '#C96A3B', light: '#F7E8DF', dark: '#A04E26', contrastText: '#FFFFFF' },
  // 진행/파이프라인 계열 보라
  secondary: { main: '#7A5CC4', light: '#EFE9F9', dark: '#5C42A0', contrastText: '#FFFFFF' },
  success:   { main: '#4D8A4D', light: '#E8F1E4', dark: '#3A6E3A', contrastText: '#FFFFFF' },
  warning:   { main: '#B07514', light: '#F9EFD9', dark: '#8A5710', contrastText: '#FFFFFF' },
  error:     { main: '#C73E44', light: '#FAE7E7', dark: '#A02E33', contrastText: '#FFFFFF' },
  info:      { main: '#4A7DBF', light: '#E3EDF8', dark: '#36619A', contrastText: '#FFFFFF' },
  // 라이트 사이드바 — 페이지 배경과 한 몸 (보더 없는 레일), 활성/hover 는 surface 픽
  navbar:    { main: '#F6F2EC', light: '#FFFDFA', dark: '#EFE9DE', contrastText: '#2A241C' },
  background:{ default: '#F6F2EC', paper: '#FFFDFA' },
  text:      { primary: '#2A241C', secondary: '#6E6557', tertiary: '#A39A8A', disabled: '#C9C0B2' },
  divider:   '#E8E0D4',
  // warm-neutral grey 스케일
  grey: {
    50:  '#F6F2EC', 100: '#F0EAE0', 200: '#EAE3D7', 300: '#E8E0D4',
    400: '#D6CBB9', 500: '#A39A8A', 600: '#8A8172', 700: '#6E6557',
    800: '#2A241C', 900: '#1C1812',
  },
};

const DARK = {
  // 민트 포인트 — on-accent 는 딥 그린으로 (발광 대비)
  primary:   { main: '#3DD6B8', light: 'rgba(61,214,184,0.12)', dark: '#2AA890', contrastText: '#06231D' },
  secondary: { main: '#9B7CE0', light: 'rgba(155,124,224,0.16)', dark: '#7A5CC4', contrastText: '#FFFFFF' },
  success:   { main: '#3DD68C', light: 'rgba(61,214,140,0.14)', dark: '#2AA868', contrastText: '#06231D' },
  warning:   { main: '#E0B341', light: 'rgba(224,179,65,0.14)', dark: '#B08A2A', contrastText: '#1C1812' },
  error:     { main: '#E85C64', light: 'rgba(232,92,100,0.14)', dark: '#C73E44', contrastText: '#FFFFFF' },
  info:      { main: '#5C9CE8', light: 'rgba(92,156,232,0.14)', dark: '#3D7CC8', contrastText: '#FFFFFF' },
  // 다크 사이드바 — 컨텐츠보다 더 어두운 콘솔 레일
  navbar:    { main: '#0B0D10', light: '#181B21', dark: '#05070A', contrastText: '#E9EBEF' },
  background:{ default: '#101216', paper: '#181B21' },
  text:      { primary: '#E9EBEF', secondary: '#9AA1AD', tertiary: '#5F6671', disabled: '#3E434C' },
  divider:   '#262B34',
  // 다크 grey 스케일 — bgcolor: 'grey.50/100/...' 가 다크에서 어두운 surface 로 동작 (#442 정책 유지)
  grey: {
    50:  '#13161B', 100: '#181B21', 200: '#1F232B', 300: '#262B34',
    400: '#343B47', 500: '#5F6671', 600: '#9AA1AD', 700: '#E9EBEF',
    800: '#F4F5F7', 900: '#FFFFFF',
  },
};

// warm 소프트 섀도우 (라이트) / 깊은 블랙 (다크)
const SHADOWS_LIGHT = [
  'none',
  '0 1px 2px rgba(90,70,40,0.05), 0 0 0 1px rgba(90,70,40,0.03)',
  '0 2px 10px rgba(90,70,40,0.07), 0 1px 2px rgba(90,70,40,0.05)',
  '0 8px 24px rgba(90,70,40,0.10), 0 2px 6px rgba(90,70,40,0.06)',
  '0 20px 48px rgba(90,70,40,0.16), 0 4px 12px rgba(90,70,40,0.08)',
  ...Array(20).fill('0 20px 48px rgba(90,70,40,0.16), 0 4px 12px rgba(90,70,40,0.08)'),
];

const SHADOWS_DARK = [
  'none',
  '0 1px 2px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.03)',
  '0 2px 10px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.30)',
  '0 8px 24px rgba(0,0,0,0.50), 0 2px 6px rgba(0,0,0,0.40)',
  '0 20px 48px rgba(0,0,0,0.60), 0 4px 12px rgba(0,0,0,0.45)',
  ...Array(20).fill('0 20px 48px rgba(0,0,0,0.60), 0 4px 12px rgba(0,0,0,0.45)'),
];

export function buildVccTheme(mode = 'light') {
  const palette = mode === 'dark' ? DARK : LIGHT;
  return {
    palette: { mode, ...palette },
    typography: {
      fontFamily: '"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Noto Sans KR",Roboto,sans-serif',
      fontFamilyMono: MONO,
      h1: { fontSize: 24, lineHeight: '32px', fontWeight: 800, letterSpacing: '-0.02em' },
      h2: { fontSize: 18, lineHeight: '26px', fontWeight: 700, letterSpacing: '-0.01em' },
      h3: { fontSize: 15, lineHeight: '23px', fontWeight: 700, letterSpacing: '-0.005em' },
      h4: { fontSize: 14, lineHeight: '22px', fontWeight: 600 },
      h5: { fontSize: 13.5, lineHeight: '21px', fontWeight: 700 },
      h6: { fontSize: 13.5, lineHeight: '21px', fontWeight: 700 }, // 카드 타이틀
      body1:    { fontSize: 13.5, lineHeight: '22px', letterSpacing: '-0.005em' },
      body2:    { fontSize: 12.5, lineHeight: '19px', letterSpacing: '-0.005em' },
      caption:  { fontSize: 11.5, lineHeight: '17px', fontWeight: 500 },
      overline: { fontSize: 11, lineHeight: '16px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' },
      button:   { fontWeight: 700, letterSpacing: '-0.005em', textTransform: 'none' },
    },
    shape: { borderRadius: 8 }, // 컨트롤 기본. 카드는 MuiPaper outlined 에서 10
    spacing: 4,
    shadows: mode === 'dark' ? SHADOWS_DARK : SHADOWS_LIGHT,
    components: {
      MuiButton: {
        defaultProps: { size: 'small', disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 700, paddingInline: 14 }, // pill
          sizeSmall: { height: 30, fontSize: 12.5 },
          sizeLarge: { height: 38, fontSize: 13.5, paddingInline: 18 },
          outlined: ({ theme }) => ({ borderColor: theme.palette.grey[400] }),
        },
      },
      MuiChip: {
        defaultProps: { size: 'small', variant: 'outlined' },
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 600, fontSize: 11.5 },
          sizeSmall: { height: 25 },
          label: { paddingInline: 11 }, // 텍스트 주변 여유 (#556)
        },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
            borderRadius: 10,
            ...(theme.palette.mode === 'light' && { boxShadow: theme.shadows[2] }),
          }),
        },
      },
      MuiTextField:    { defaultProps: { size: 'small', variant: 'outlined' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8, fontSize: 13 },
          notchedOutline: ({ theme }) => ({ borderColor: theme.palette.grey[400] }),
        },
      },
      MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 1 } } },
      MuiTab:  { styleOverrides: { root: { fontWeight: 600, fontSize: 13, textTransform: 'none', minHeight: 40 } } },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: theme.palette.navbar.main,
            color: theme.palette.navbar.contrastText,
          }),
        },
      },
      MuiDivider: {
        styleOverrides: { root: ({ theme }) => ({ borderColor: theme.palette.divider }) },
      },
    },
  };
}

// 하위 호환 — Phase 1 에서 `import { vccTheme }` 한 곳이 있어서 유지
export const vccTheme = buildVccTheme('light');

export default vccTheme;
