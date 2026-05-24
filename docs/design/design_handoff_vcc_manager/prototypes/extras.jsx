// extras.jsx — State matrices, Korean stress test, Empty/Loading/Error patterns,
// and MUI theme code display. Each export is a fixed-size card for the design canvas.

const Ix = window.Icon;

// ============================================================
// 1) STATE MATRIX
// ============================================================
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px dashed var(--border-subtle)" }}>
      <div style={{ width: 90, flex: "0 0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      </div>
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

function StyledBtn({ extraClass = "", style, children }) {
  // Hover/active simulated by inline styles since canvas is static.
  return <button className={"btn " + extraClass} style={style}>{children}</button>;
}

function StateMatrixCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
      display: "flex", flexDirection: "column", gap: 22,
    }} className="vcc-app-shim">
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Button — variant × state</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>5 상태가 모든 variant에 일관되게 적용되어야 합니다.</div>
      </div>

      {/* PRIMARY */}
      <Row label="Primary">
        <StyledBtn extraClass="btn--primary">Default</StyledBtn>
        <StyledBtn extraClass="btn--primary" style={{ background: "var(--accent-10)" }}>Hover</StyledBtn>
        <StyledBtn extraClass="btn--primary" style={{ background: "var(--accent-11)", boxShadow: "var(--shadow-focus)" }}>Active · Focus</StyledBtn>
        <StyledBtn extraClass="btn--primary" style={{ background: "var(--accent-7)", opacity: 0.6, cursor: "not-allowed" }}>Disabled</StyledBtn>
        <StyledBtn extraClass="btn--primary"><Ix.Spinner className="spin" size={12}/> 처리 중…</StyledBtn>
      </Row>

      <Row label="Secondary">
        <StyledBtn extraClass="btn--secondary">Default</StyledBtn>
        <StyledBtn extraClass="btn--secondary" style={{ background: "var(--bg-tint)", borderColor: "var(--border-strong)" }}>Hover</StyledBtn>
        <StyledBtn extraClass="btn--secondary" style={{ background: "var(--accent-3)", borderColor: "var(--accent-9)", color: "var(--accent-11)", boxShadow: "var(--shadow-focus)" }}>Active · Focus</StyledBtn>
        <StyledBtn extraClass="btn--secondary" style={{ background: "var(--bg-subtle)", color: "var(--text-disabled)", borderColor: "var(--border-subtle)", cursor: "not-allowed" }}>Disabled</StyledBtn>
        <StyledBtn extraClass="btn--secondary"><Ix.Spinner className="spin" size={12}/> 저장 중…</StyledBtn>
      </Row>

      <Row label="Ghost">
        <StyledBtn extraClass="btn--ghost">Default</StyledBtn>
        <StyledBtn extraClass="btn--ghost" style={{ background: "var(--bg-subtle)", color: "var(--text-primary)" }}>Hover</StyledBtn>
        <StyledBtn extraClass="btn--ghost" style={{ background: "var(--accent-3)", color: "var(--accent-11)" }}>Active</StyledBtn>
        <StyledBtn extraClass="btn--ghost" style={{ color: "var(--text-disabled)", cursor: "not-allowed" }}>Disabled</StyledBtn>
        <StyledBtn extraClass="btn--ghost"><Ix.Spinner className="spin" size={12}/></StyledBtn>
      </Row>

      <Row label="Danger">
        <StyledBtn extraClass="btn--danger">삭제</StyledBtn>
        <StyledBtn extraClass="btn--danger" style={{ background: "var(--danger-1)", borderColor: "var(--danger-3)" }}>Hover</StyledBtn>
        <StyledBtn extraClass="btn--danger" style={{ background: "var(--danger-3)", borderColor: "var(--danger-9)", boxShadow: "0 0 0 3px rgba(213,56,62,0.18)" }}>Active</StyledBtn>
        <StyledBtn extraClass="btn--danger" style={{ color: "var(--text-disabled)", cursor: "not-allowed" }}>Disabled</StyledBtn>
        <StyledBtn extraClass="btn--danger"><Ix.Spinner className="spin" size={12}/> 삭제 중…</StyledBtn>
      </Row>

      <Row label="Success">
        <StyledBtn extraClass="btn--success">실행</StyledBtn>
        <StyledBtn extraClass="btn--success" style={{ background: "var(--success-11)" }}>Hover</StyledBtn>
        <StyledBtn extraClass="btn--success" style={{ background: "var(--success-11)", boxShadow: "0 0 0 3px rgba(31,157,85,0.22)" }}>Active</StyledBtn>
        <StyledBtn extraClass="btn--success" style={{ opacity: 0.5, cursor: "not-allowed" }}>Disabled</StyledBtn>
        <StyledBtn extraClass="btn--success"><Ix.Spinner className="spin" size={12}/> 실행 중…</StyledBtn>
      </Row>

      {/* Chips */}
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>Chip — semantic states</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -10 }}>
        <span className="chip chip--success"><Ix.Check size={10}/> 완료</span>
        <span className="chip chip--info"><Ix.Spinner className="spin" size={10}/> 실행 중</span>
        <span className="chip chip--warning">대기</span>
        <span className="chip chip--danger"><Ix.X size={10}/> 실패</span>
        <span className="chip">취소됨</span>
        <span className="chip chip--accent"><Ix.Bolt size={10}/> 신규</span>
        <span className="chip chip--violet">세계관</span>
      </div>

      {/* Input states */}
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700 }}>Input — state</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <div>
          <label className="field-label">Default</label>
          <input className="input" placeholder="프로젝트 이름"/>
        </div>
        <div>
          <label className="field-label">Focus</label>
          <input className="input" defaultValue="Mages" style={{ borderColor: "var(--accent-9)", boxShadow: "var(--shadow-focus)" }}/>
        </div>
        <div>
          <label className="field-label" style={{ color: "var(--danger-11)" }}>Error</label>
          <input className="input" defaultValue="Mages!" style={{ borderColor: "var(--danger-9)", boxShadow: "0 0 0 3px rgba(213,56,62,0.18)" }}/>
          <div style={{ fontSize: 11, color: "var(--danger-11)", marginTop: 4 }}>특수문자는 허용되지 않습니다.</div>
        </div>
        <div>
          <label className="field-label">Disabled</label>
          <input className="input" defaultValue="readonly-id-9e2f" disabled style={{ background: "var(--bg-subtle)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}/>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2) KOREAN STRESS TEST
// ============================================================
function KoreanStressCard() {
  const longLabels = [
    "대화 이어가기",
    "파이프라인 단계 추가",
    "이 결과를 다른 작업판 입력으로 보내기",
    "현재 단계만 다시 실행 (이전 단계 결과 유지)",
    "선택한 이미지 4장을 LoRA 학습 큐에 모두 추가",
    "북방 변경 광산 도시국가 — 시스템 프롬프트",
  ];
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>긴 한국어 라벨 — 깨짐 없이</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>
          버튼/탭/칩이 다양한 한국어 길이에서 어떻게 보이는지.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {longLabels.map((l, i) => (
            <button key={i} className={"btn " + (i % 3 === 0 ? "btn--primary" : i % 3 === 1 ? "btn--secondary" : "btn--ghost")}>{l}</button>
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Truncation 정책</div>
        <div style={{ marginTop: 8, padding: 12, background: "var(--bg-tint)", borderRadius: 6, fontSize: 12.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
          한 줄 라벨에서 잘릴 경우 <span className="code" style={{ background: "white", padding: "1px 6px", borderRadius: 3 }}>text-overflow: ellipsis</span>,
          툴팁(title) 보강. 본문은 <span className="code" style={{ background: "white", padding: "1px 6px", borderRadius: 3 }}>text-wrap: pretty</span>로 줄바꿈 균형.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>탭 — 좁은 모바일 폭</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 14 }}>
          탭 6개가 360px 안에 들어갈 때 → 가로 스크롤, fade mask.
        </div>
        <div style={{
          width: 360, border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden",
          background: "var(--bg-surface)", position: "relative",
        }}>
          <div style={{ overflowX: "auto", scrollbarWidth: "none" }} className="hide-sb">
            <div className="tabs" style={{ border: "none", padding: "0 8px", width: "max-content" }}>
              <div className="tab">파이프라인</div>
              <div className="tab is-active">세계관 <span className="tab__count">4</span></div>
              <div className="tab">프롬프트 데이터</div>
              <div className="tab">이미지 <span className="tab__count">12</span></div>
              <div className="tab">파이프라인 히스토리</div>
              <div className="tab">대화 히스토리</div>
            </div>
          </div>
          {/* Fade mask */}
          <div style={{ position: "absolute", top: 0, right: 0, width: 32, height: "100%", background: "linear-gradient(90deg, transparent, white)" }}/>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Long chip — wrap behavior</div>
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 360 }}>
          <span className="chip chip--accent">월드 · 캐릭터 → 외형 → 이미지</span>
          <span className="chip chip--violet">Rusty Blood 시대 연표</span>
          <span className="chip chip--success"><Ix.Check size={10}/> 완료 · 2분 35초</span>
          <span className="chip">SDXL 프롬프트 가이드</span>
        </div>

        <div style={{ marginTop: 18, fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>One-line ellipsis (sidebar / list)</div>
        <div style={{ marginTop: 8, width: 240, padding: "8px 12px", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            북방 변경 광산 도시국가 — 시스템 프롬프트
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
            세계관 · 56줄 · 5시간 전
          </div>
        </div>
      </div>

      <style>{".hide-sb::-webkit-scrollbar{display:none}"}</style>
    </div>
  );
}

// ============================================================
// 3) EMPTY / LOADING / ERROR PATTERNS
// ============================================================
function EmptyStateCard({ title, body, action, icon }) {
  return (
    <div style={{
      flex: 1, minHeight: 220,
      border: "1px dashed var(--border-strong)",
      borderRadius: 8, background: "var(--bg-tint)",
      padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", gap: 8,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "white", border: "1px solid var(--border-subtle)",
        display: "grid", placeItems: "center",
        color: "var(--text-tertiary)",
      }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", maxWidth: 280, lineHeight: 1.5 }}>{body}</div>
      {action && <button className="btn btn--primary btn--sm" style={{ marginTop: 8 }}>{action}</button>}
    </div>
  );
}

function LoadingSkeleton() {
  const bar = (w, mt = 8) => (
    <div style={{
      width: w, height: 10, background: "linear-gradient(90deg, var(--bg-subtle), var(--bg-sunken), var(--bg-subtle))",
      backgroundSize: "200% 100%", animation: "shim 1.6s linear infinite",
      borderRadius: 4, marginTop: mt,
    }}/>
  );
  return (
    <div style={{ flex: 1, padding: 16, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, minHeight: 220 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-subtle)", animation: "shim 1.6s linear infinite", backgroundImage: "linear-gradient(90deg, var(--bg-subtle), var(--bg-sunken), var(--bg-subtle))", backgroundSize: "200% 100%" }}/>
        <div style={{ flex: 1 }}>
          {bar("60%", 0)}
          {bar("35%", 6)}
        </div>
      </div>
      {bar("90%", 16)}
      {bar("80%")}
      {bar("70%")}
      {bar("88%")}
      {bar("50%")}
      <style>{"@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
    </div>
  );
}

function ErrorStateCard({ title, body, kind = "danger" }) {
  const c = kind === "danger" ? { bg: "var(--danger-1)", b: "var(--danger-3)", t: "var(--danger-11)" }
         : kind === "warning" ? { bg: "var(--warning-1)", b: "var(--warning-3)", t: "var(--warning-11)" }
                              : { bg: "var(--info-1)", b: "var(--info-3)", t: "var(--info-11)" };
  return (
    <div style={{
      flex: 1, padding: 16, minHeight: 220,
      background: c.bg, border: "1px solid " + c.b, borderRadius: 8,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "white", color: c.t, display: "grid", placeItems: "center", border: "1px solid " + c.b }}>
          {kind === "danger" ? <Ix.X /> : kind === "warning" ? <Ix.Info /> : <Ix.Info />}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: c.t }}>{title}</div>
      </div>
      <div style={{ fontSize: 12.5, color: c.t, opacity: 0.85, lineHeight: 1.6 }}>{body}</div>
      <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
        <button className="btn btn--secondary btn--sm" style={{ background: "white" }}><Ix.Refresh size={12}/> 재시도</button>
        <button className="btn btn--ghost btn--sm" style={{ color: c.t }}>로그 보기</button>
      </div>
      <div style={{ fontSize: 11, color: c.t, opacity: 0.7, fontFamily: "var(--font-mono)" }}>
        err_a47f · ComfyError: 'GPT Image' returned 502
      </div>
    </div>
  );
}

function PatternsCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Empty · Loading · Error · Toast — 정보 상태 패턴</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <EmptyStateCard
          icon={<Ix.Pipe />}
          title="아직 파이프라인이 없습니다"
          body="작업판을 순서대로 연결해 첫 파이프라인을 만들어 보세요."
          action={<><Ix.Plus size={12}/> 새 파이프라인</>}
        />
        <LoadingSkeleton/>
        <ErrorStateCard
          title="단계 3 실패"
          body="GPT Image 서버가 응답하지 않았습니다. 이전 단계 결과는 보존되어 있으니, 단계 3만 다시 실행할 수 있습니다."
        />
      </div>

      {/* Toast row */}
      <div style={{ marginTop: 24, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Toast — 일시 알림</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { tone: "success", icon: <Ix.Check />, title: "프로젝트가 저장되었습니다", body: "Mages · 5초 전" },
          { tone: "info",    icon: <Ix.Spinner className="spin"/>, title: "파이프라인 실행 시작", body: "3단계 · 백그라운드 진행" },
          { tone: "warning", icon: <Ix.Info />, title: "타입 불일치 감지", body: "단계 2 → 3 사이 자동 변환 필요" },
          { tone: "danger",  icon: <Ix.X />, title: "단계 3 실패", body: "재시도하시겠어요?" },
        ].map((t, i) => {
          const c = t.tone === "success" ? "success" : t.tone === "danger" ? "danger" : t.tone === "warning" ? "warning" : "info";
          return (
            <div key={i} style={{
              flex: "1 1 240px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderLeft: `3px solid var(--${c}-9)`,
              borderRadius: 6,
              padding: "10px 12px",
              display: "flex", gap: 10, alignItems: "flex-start",
              boxShadow: "var(--shadow-2)",
            }}>
              <div style={{ color: `var(--${c}-9)`, marginTop: 2 }}>{t.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 1 }}>{t.body}</div>
              </div>
              <button className="btn btn--ghost btn--icon btn--sm" style={{ color: "var(--text-tertiary)" }}><Ix.X /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 4) MUI THEME — CODE PREVIEW
// ============================================================
const THEME_CODE = `// theme.ts — VCC Manager design tokens as MUI ThemeOptions v1
// Copy-paste into your createTheme() call. No external dependencies.

import { ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette { navbar: Palette['primary']; }
  interface PaletteOptions { navbar?: PaletteOptions['primary']; }
}

export const vccTheme: ThemeOptions = {
  palette: {
    mode: 'light',
    primary:   { main: '#5B5BD6', light: '#A6A8E6', dark: '#4040AD', contrastText: '#FFFFFF' },
    secondary: { main: '#7B4DD8', light: '#B69CEC', dark: '#5B2DBF', contrastText: '#FFFFFF' },
    success:   { main: '#1F9D55', light: '#DCF4E5', dark: '#0F7A40', contrastText: '#FFFFFF' },
    warning:   { main: '#BE7415', light: '#FAEBC8', dark: '#95580B', contrastText: '#FFFFFF' },
    error:     { main: '#D5383E', light: '#FBE0E0', dark: '#A8222A', contrastText: '#FFFFFF' },
    info:      { main: '#2F77E4', light: '#DCEBFC', dark: '#1955B0', contrastText: '#FFFFFF' },
    // NEW — unifies the scattered #2c3e50 / #34495e / #ecf0f1 / #bdc3c7 hexes.
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
  shape:   { borderRadius: 6 },   // r-2
  spacing: 4,                      // sp unit (so theme.spacing(2) = 8px)
  shadows: [
    'none',
    '0 1px 2px rgba(15,18,28,0.05), 0 0 0 1px rgba(15,18,28,0.04)',
    '0 2px 6px rgba(15,18,28,0.07), 0 1px 2px rgba(15,18,28,0.04)',
    '0 8px 24px rgba(15,18,28,0.10), 0 2px 6px rgba(15,18,28,0.06)',
    '0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)',
    // 5..24 fall back to shadow-3 / shadow-4
    ...Array(20).fill('0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)'),
  ] as any,
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
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: '#E2E2DC', borderRadius: 8 } },
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
`;

function MuiThemeCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 0, fontFamily: "var(--font-sans)", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg-tint)",
      }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--accent-3)", color: "var(--accent-11)", display: "grid", placeItems: "center" }}>
          <Ix.Cube size={14}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>theme.ts — MUI ThemeOptions</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            <span className="code">frontend/src/theme.ts</span> · <span className="code">createTheme(vccTheme)</span> 호출에 그대로 전달
          </div>
        </div>
        <a href="theme.ts" download className="btn btn--secondary btn--sm">
          <Ix.ArrowDown size={12}/> theme.ts 다운로드
        </a>
      </div>
      <pre style={{
        margin: 0, padding: 18,
        fontFamily: "var(--font-mono)",
        fontSize: 11.5, lineHeight: 1.7,
        color: "#16181D",
        background: "#FBFBF8",
        maxHeight: 520,
        overflow: "auto",
        whiteSpace: "pre",
      }}>{THEME_CODE}</pre>
    </div>
  );
}

// ============================================================
// 5) BEFORE / AFTER
// ============================================================
function BeforeAfterCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {[
          { tag: "Before", side: "#2c3e50", accent: "#1976d2", textSame: true,
            issues: [
              "MUI primary blue(#1976d2)가 system-prompt 태그 색(#2196f3)과 거의 같음 — 시각 구분 안 됨",
              "사이드바 hex 6종이 코드 여러 곳에 흩어짐 (`#2c3e50`, `#34495e`, `#ecf0f1` ...)",
              "borderRadius 1/2/4 임의 — 컴포넌트 간 모서리 통일 없음",
              "한국어 fallback 폰트 미지정 — OS별 가독성 편차",
              "정보 위계 약함 — 카드 안 정보가 모두 비슷한 무게",
            ],
          },
          { tag: "After", side: "#161A22", accent: "#5B5BD6", textSame: false,
            issues: [
              "Iris(#5B5BD6) 단일 액센트 — 태그/링크/상태와 명확히 구별",
              "`palette.navbar` 토큰 1개로 사이드바 통합 — 코드 grep 결과 한 줄로 수렴",
              "radius r-1(4) · r-2(6) · r-3(8) · r-4(12) 4단계 정식화",
              "Pretendard Variable 우선 + Noto Sans KR fallback",
              "display→h1→h2→body→tiny 5단 위계 + 색·굵기 조합으로 그룹화",
            ],
          },
        ].map((c, i) => (
          <div key={i} style={{
            border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden",
          }}>
            {/* Mini header showing side+accent colors */}
            <div style={{ display: "flex", alignItems: "stretch", height: 56 }}>
              <div style={{ width: 64, background: c.side, color: "white", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                sidebar
              </div>
              <div style={{ flex: 1, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{c.tag}</span>
                <span style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  primary
                  <span style={{ width: 14, height: 14, background: c.accent, borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)" }}/>
                  {c.accent}
                </span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: "12px 16px 16px 32px", display: "flex", flexDirection: "column", gap: 6 }}>
              {c.issues.map((iss, j) => (
                <li key={j} style={{
                  fontSize: 12.5, color: c.tag === "Before" ? "var(--text-secondary)" : "var(--text-primary)",
                  lineHeight: 1.55,
                }}>{iss}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  StateMatrixCard, KoreanStressCard, PatternsCard, MuiThemeCard, BeforeAfterCard,
});
