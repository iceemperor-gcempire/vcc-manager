// VCC Manager design tokens — MUI ThemeOptions (#design-handoff).
//
// 디자인 시스템 단일 진입점. createTheme(buildVccTheme(mode)) 로 light/dark 적용.
//
// 변경 요약:
//   - primary: Iris #5B5BD6 (light) / #7676E0 (dark, 가독성 보정)
//   - background warm-neutral (light) / 깊은 회색 (dark)
//   - 신설 palette.navbar (사이드바/헤더 통합)
//   - 한국어 letter-spacing -0.005em, font: Pretendard

const LIGHT = {
  primary:   { main: '#5B5BD6', light: '#A6A8E6', dark: '#4040AD', contrastText: '#FFFFFF' },
  secondary: { main: '#7B4DD8', light: '#B69CEC', dark: '#5B2DBF', contrastText: '#FFFFFF' },
  success:   { main: '#1F9D55', light: '#DCF4E5', dark: '#0F7A40', contrastText: '#FFFFFF' },
  warning:   { main: '#BE7415', light: '#FAEBC8', dark: '#95580B', contrastText: '#FFFFFF' },
  error:     { main: '#D5383E', light: '#FBE0E0', dark: '#A8222A', contrastText: '#FFFFFF' },
  info:      { main: '#2F77E4', light: '#DCEBFC', dark: '#1955B0', contrastText: '#FFFFFF' },
  navbar:    { main: '#161A22', light: '#262C39', dark: '#0F1218', contrastText: '#E4E5E9' },
  background:{ default: '#F7F7F4', paper: '#FFFFFF' },
  text:      { primary: '#16181D', secondary: '#5B616E', disabled: '#B6BAC2' },
  divider:   '#E2E2DC',
  grey: {
    50:  '#F7F7F4', 100: '#F1F1ED', 200: '#EBEAE5', 300: '#E2E2DC',
    400: '#D2D2CA', 500: '#B6BAC2', 600: '#8A8F9A', 700: '#5B616E',
    800: '#16181D', 900: '#0F1218',
  },
};

const DARK = {
  primary:   { main: '#7676E0', light: '#9B9BEC', dark: '#5050A8', contrastText: '#FFFFFF' },
  secondary: { main: '#9870E5', light: '#BFA4F0', dark: '#6E4DB5', contrastText: '#FFFFFF' },
  success:   { main: '#2EBA6B', light: 'rgba(31,157,85,0.22)', dark: '#1F8C50', contrastText: '#0E1015' },
  warning:   { main: '#D69021', light: 'rgba(190,116,21,0.24)', dark: '#A56B15', contrastText: '#0E1015' },
  error:     { main: '#E84B52', light: 'rgba(213,56,62,0.24)', dark: '#A8222A', contrastText: '#FFFFFF' },
  info:      { main: '#4E8EE8', light: 'rgba(47,119,228,0.24)', dark: '#2F77E4', contrastText: '#FFFFFF' },
  // 다크에선 사이드바가 컨텐츠보다 더 어둡게 (디자이너 권장)
  navbar:    { main: '#0A0C10', light: '#1A1E27', dark: '#05070A', contrastText: '#E4E5E9' },
  background:{ default: '#0E1015', paper: '#161A22' },
  text:      { primary: '#E8E9EE', secondary: '#A0A4AF', disabled: '#4A4E58' },
  divider:   '#2A2F3B',
  // 다크 grey 스케일 — bgcolor: 'grey.50/100/...' 가 다크모드에서 어두운 surface 로 동작하도록
  // 50~400 은 paper 주변의 다크 톤, 500~700 은 mid → light text/icon 톤, 800~900 은 near-white.
  // (#442 — 종전 50~400 이 LIGHT 값을 그대로 써서 다크모드에서 흰 패치가 보였던 버그 수정)
  grey: {
    50:  '#11141B', 100: '#161A22', 200: '#1A1E27', 300: '#262C39',
    400: '#3A4051', 500: '#717684', 600: '#A0A4AF', 700: '#E8E9EE',
    800: '#F1F1ED', 900: '#FFFFFF',
  },
};

const SHADOWS_LIGHT = [
  'none',
  '0 1px 2px rgba(15,18,28,0.05), 0 0 0 1px rgba(15,18,28,0.04)',
  '0 2px 6px rgba(15,18,28,0.07), 0 1px 2px rgba(15,18,28,0.04)',
  '0 8px 24px rgba(15,18,28,0.10), 0 2px 6px rgba(15,18,28,0.06)',
  '0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)',
  ...Array(20).fill('0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)'),
];

const SHADOWS_DARK = [
  'none',
  '0 1px 2px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.04)',
  '0 2px 6px rgba(0,0,0,0.50), 0 1px 2px rgba(0,0,0,0.30)',
  '0 8px 24px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.40)',
  '0 20px 48px rgba(0,0,0,0.60), 0 4px 12px rgba(0,0,0,0.45)',
  ...Array(20).fill('0 20px 48px rgba(0,0,0,0.60), 0 4px 12px rgba(0,0,0,0.45)'),
];

export function buildVccTheme(mode = 'light') {
  const palette = mode === 'dark' ? DARK : LIGHT;
  return {
    palette: { mode, ...palette },
    typography: {
      fontFamily: '"Pretendard","Pretendard Variable",-apple-system,BlinkMacSystemFont,"Noto Sans KR",Roboto,sans-serif',
      h1: { fontSize: 28, lineHeight: '36px', fontWeight: 700, letterSpacing: '-0.01em' },
      h2: { fontSize: 22, lineHeight: '30px', fontWeight: 700, letterSpacing: '-0.01em' },
      h3: { fontSize: 18, lineHeight: '26px', fontWeight: 700, letterSpacing: '-0.005em' },
      h4: { fontSize: 18, lineHeight: '26px', fontWeight: 600 },
      h5: { fontSize: 15, lineHeight: '22px', fontWeight: 600 },
      h6: { fontSize: 14, lineHeight: '22px', fontWeight: 600 },
      body1:    { fontSize: 14, lineHeight: '22px', letterSpacing: '-0.005em' },
      body2:    { fontSize: 13, lineHeight: '20px', letterSpacing: '-0.005em' },
      caption:  { fontSize: 12, lineHeight: '18px', fontWeight: 500 },
      overline: { fontSize: 11, lineHeight: '16px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' },
      button:   { fontWeight: 500, letterSpacing: '-0.005em', textTransform: 'none' },
    },
    shape: { borderRadius: 6 },
    spacing: 4,
    shadows: mode === 'dark' ? SHADOWS_DARK : SHADOWS_LIGHT,
    components: {
      MuiButton: {
        defaultProps: { size: 'small', disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500, paddingInline: 12 },
          sizeSmall: { height: 30, fontSize: 13 },
        },
      },
      MuiChip: {
        defaultProps: { size: 'small', variant: 'outlined' },
        styleOverrides: { root: { borderRadius: 999, fontWeight: 500, fontSize: 12 } },
      },
      MuiPaper: {
        styleOverrides: {
          outlined: ({ theme }) => ({
            borderColor: theme.palette.divider,
            borderRadius: 8,
          }),
        },
      },
      MuiTextField:    { defaultProps: { size: 'small', variant: 'outlined' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 6, fontSize: 13 },
          notchedOutline: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 1 } } },
      MuiTab:  { styleOverrides: { root: { fontWeight: 500, fontSize: 13, textTransform: 'none', minHeight: 40 } } },
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
