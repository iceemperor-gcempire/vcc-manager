// page-auth.jsx — Full-bleed login + signup pages (no shell)
// Left: brand + tagline + decorative grid. Right: form.

const { useState: useStateAu } = React;
const Iau = window.Icon;

function AuthAside() {
  return (
    <aside style={{
      flex: "0 0 480px",
      background: "linear-gradient(135deg, #1F1F60 0%, #4040AD 40%, #5B5BD6 100%)",
      color: "white",
      padding: "48px 44px",
      display: "flex", flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Dot grid background */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.16) 1px, transparent 1px) 0 0/24px 24px",
        opacity: 0.6,
      }}/>

      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: "white", color: "#4040AD",
          display: "grid", placeItems: "center",
          fontWeight: 700, fontFamily: "var(--font-mono)",
          fontSize: 16, letterSpacing: "-0.04em",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>V</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>VCC Manager</div>
          <div style={{ fontSize: 11, opacity: 0.75, fontFamily: "var(--font-mono)" }}>alpha · gcempire</div>
        </div>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, opacity: 0.65, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
          AI workflow manager
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, margin: 0, maxWidth: 380, textWrap: "balance" }}>
          이미지·텍스트·영상 생성 워크플로우를 한 곳에서.
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85, marginTop: 18, maxWidth: 360 }}>
          ComfyUI · OpenAI · Gemini 백엔드를 묶어 프로젝트 단위로 정리하고, 작업판을 파이프라인으로 연결합니다.
        </p>
      </div>

      <div style={{ flex: 1 }}/>

      {/* Mini server status pings */}
      <div style={{ position: "relative", display: "flex", gap: 16, fontSize: 11, fontFamily: "var(--font-mono)", opacity: 0.78 }}>
        {[
          { l: "comfy-01", c: "#2EBA6B" },
          { l: "openai",   c: "#2EBA6B" },
          { l: "gemini",   c: "#2EBA6B" },
          { l: "comfy-02", c: "#2EBA6B" },
        ].map((s) => (
          <span key={s.l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, boxShadow: `0 0 8px ${s.c}` }}/>
            {s.l}
          </span>
        ))}
      </div>
      <div style={{ position: "relative", fontSize: 11, opacity: 0.5, marginTop: 18, fontFamily: "var(--font-mono)" }}>
        © 2026 gcempire · alpha-vccm-svc
      </div>
    </aside>
  );
}

function AuthShell({ children }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "var(--bg-canvas)",
      display: "flex",
      fontFamily: "var(--font-sans)",
      color: "var(--text-primary)",
    }}>
      <AuthAside/>
      <main style={{
        flex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40,
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function AuthLoginPage() {
  return (
    <AuthShell>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        SIGN IN
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em", margin: "6px 0 6px" }}>다시 오신 것을 환영합니다</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 26 }}>
        계정 정보를 입력해 로그인해 주세요.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label className="field-label">이메일</label>
          <input className="input" type="email" defaultValue="ceremp@gcempire.net" autoComplete="email"/>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <label className="field-label" style={{ flex: 1, marginBottom: 5 }}>비밀번호</label>
            <a href="#" style={{ fontSize: 11.5, color: "var(--accent-11)", textDecoration: "none", marginBottom: 5 }}>잊으셨나요?</a>
          </div>
          <input className="input" type="password" defaultValue="••••••••••"/>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 4 }}>
          <input type="checkbox" defaultChecked/>
          로그인 상태 유지
        </label>

        <button className="btn btn--primary btn--lg" style={{ marginTop: 10, justifyContent: "center", width: "100%" }}>
          <Iau.Lock size={14}/> 로그인
        </button>
      </div>

      <div style={{
        margin: "22px 0 18px",
        display: "flex", alignItems: "center", gap: 12,
        fontSize: 11, color: "var(--text-tertiary)",
      }}>
        <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}/>
        OR
        <div style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}/>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn--secondary btn--lg" style={{ width: "100%", justifyContent: "center" }}>
          <span style={{ width: 14, height: 14, background: "#000", color: "white", borderRadius: 2, display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 10 }}>G</span>
          Google로 계속하기
        </button>
        <button className="btn btn--secondary btn--lg" style={{ width: "100%", justifyContent: "center" }}>
          <Iau.Shield size={14}/> SSO · gcempire 사내 계정
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
        아직 계정이 없으신가요? <a href="#" style={{ color: "var(--accent-11)", textDecoration: "none", fontWeight: 500 }}>가입 요청</a>
      </p>
    </AuthShell>
  );
}

function AuthSignupPage() {
  return (
    <AuthShell>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        REQUEST ACCESS
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em", margin: "6px 0 6px" }}>가입 요청</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 22 }}>
        VCC Manager는 사내 도구입니다. 관리자 승인 후 활성화됩니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="field-label">표시 이름</label>
            <input className="input" placeholder="쎌렘황제"/>
          </div>
          <div>
            <label className="field-label">사번 / ID</label>
            <input className="input" placeholder="gc-2031" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}/>
          </div>
        </div>
        <div>
          <label className="field-label">사내 이메일</label>
          <input className="input" type="email" placeholder="you@gcempire.net"/>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>@gcempire.net 도메인만 신청 가능</div>
        </div>
        <div>
          <label className="field-label">소속 그룹</label>
          <select className="select" defaultValue="content">
            <option value="content">콘텐츠 제작</option>
            <option value="eng">엔지니어링</option>
            <option value="design">디자인</option>
            <option value="vip">VIP</option>
          </select>
        </div>
        <div>
          <label className="field-label">사용 목적 (선택)</label>
          <textarea className="textarea" rows={3} placeholder="어떤 워크플로우를 만들 예정인지 간단히 적어 주세요."/>
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", marginTop: 4 }}>
          <input type="checkbox" defaultChecked style={{ marginTop: 3 }}/>
          <span>생성된 콘텐츠가 사내 정책에 따라 검토될 수 있음에 동의합니다.</span>
        </label>

        <button className="btn btn--primary btn--lg" style={{ marginTop: 8, justifyContent: "center", width: "100%" }}>
          <Iau.Send size={13}/> 가입 요청 보내기
        </button>
      </div>

      <p style={{ marginTop: 20, fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
        이미 계정이 있으신가요? <a href="#" style={{ color: "var(--accent-11)", textDecoration: "none", fontWeight: 500 }}>로그인</a>
      </p>
    </AuthShell>
  );
}

Object.assign(window, { AuthLoginPage, AuthSignupPage });
