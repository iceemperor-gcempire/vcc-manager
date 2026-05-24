// VCC Manager design tokens — MUI ThemeOptions v1 (#design-handoff Phase 1).
// 디자인 시스템 단일 진입점. createTheme(vccTheme) 로 적용.
//
// 변경 요약 (대비 v0 = MUI 기본 primary/secondary):
//   - primary: #1976d2 → #5B5BD6 (Iris)
//   - secondary: #dc004e → #7B4DD8 (Violet)
//   - background.default: #FFFFFF → #F7F7F4 (warm-neutral)
//   - 신설 palette.navbar (sidebar/header 의 hardcoded hex 통합)
//   - radius 기본 4 → 6 (r-2), Paper 는 8 (r-3)
//   - shadow scale 4단계 + focus ring
//   - defaultProps 일괄 (Button/Chip/Paper/TextField size: small / variant: outlined)
//   - 한국어 letter-spacing -0.005em 본문, font: Pretendard

export const vccTheme = {
  palette: {
    mode: 'light',
    primary:   { main: '#5B5BD6', light: '#A6A8E6', dark: '#4040AD', contrastText: '#FFFFFF' },
    secondary: { main: '#7B4DD8', light: '#B69CEC', dark: '#5B2DBF', contrastText: '#FFFFFF' },
    success:   { main: '#1F9D55', light: '#DCF4E5', dark: '#0F7A40', contrastText: '#FFFFFF' },
    warning:   { main: '#BE7415', light: '#FAEBC8', dark: '#95580B', contrastText: '#FFFFFF' },
    error:     { main: '#D5383E', light: '#FBE0E0', dark: '#A8222A', contrastText: '#FFFFFF' },
    info:      { main: '#2F77E4', light: '#DCEBFC', dark: '#1955B0', contrastText: '#FFFFFF' },
    // 신설 — 흩어진 #2c3e50 / #34495e / #ecf0f1 / #bdc3c7 통합 (Phase 2 에서 사이드바 적용)
    navbar:    { main: '#161A22', light: '#262C39', dark: '#0F1218', contrastText: '#E4E5E9' },
    background:{ default: '#F7F7F4', paper: '#FFFFFF' },
    text: { primary: '#16181D', secondary: '#5B616E', disabled: '#B6BAC2' },
    divider: '#E2E2DC',
    grey: {
      50:  '#F7F7F4', 100: '#F1F1ED', 200: '#EBEAE5', 300: '#E2E2DC',
      400: '#D2D2CA', 500: '#B6BAC2', 600: '#8A8F9A', 700: '#5B616E',
      800: '#16181D', 900: '#0F1218',
    },
  },
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
  shape:   { borderRadius: 6 },
  spacing: 4,
  shadows: [
    'none',
    '0 1px 2px rgba(15,18,28,0.05), 0 0 0 1px rgba(15,18,28,0.04)',
    '0 2px 6px rgba(15,18,28,0.07), 0 1px 2px rgba(15,18,28,0.04)',
    '0 8px 24px rgba(15,18,28,0.10), 0 2px 6px rgba(15,18,28,0.06)',
    '0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)',
    // 5..24 → shadow-4 폴백 (MUI 가 25개 요구)
    ...Array(20).fill('0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)'),
  ],
  components: {
    MuiButton: {
      defaultProps:  { size: 'small', disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 6, fontWeight: 500, paddingInline: 12 },
        sizeSmall: { height: 30, fontSize: 13 },
      },
    },
    MuiChip: {
      defaultProps:  { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 500, fontSize: 12 },
      },
    },
    MuiPaper: {
      // defaultProps variant 강제 미적용 — Drawer / Menu / Dialog 등이 모두 Paper 기반이라
      // 강제로 outlined 입히면 사방에 어색한 테두리가 생김. outlined 변형은 explicit 적용한 곳만 영향.
      styleOverrides: {
        outlined: { borderColor: '#E2E2DC', borderRadius: 8 },
      },
    },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 6, fontSize: 13 },
        notchedOutline: { borderColor: '#E2E2DC' },
      },
    },
    MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 1 } } },
    MuiTab:  { styleOverrides: { root: { fontWeight: 500, fontSize: 13, textTransform: 'none', minHeight: 40 } } },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundColor: '#161A22', color: '#E4E5E9' } },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: '#ECECE7' } } },
  },
};

export default vccTheme;
