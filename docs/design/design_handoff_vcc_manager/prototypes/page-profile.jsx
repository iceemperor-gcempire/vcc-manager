// page-profile.jsx — User profile + settings (개인 환경설정)

const { useState: useStatePr } = React;
const Ipr = window.Icon;

function ProfilePage({ mobile }) {
  const [section, setSection] = useStatePr("profile");

  const sections = [
    { k: "profile",  l: "프로필",        icon: <Ipr.Users /> },
    { k: "appearance", l: "테마 / 외관",  icon: <Ipr.Eye /> },
    { k: "notif",    l: "알림 설정",     icon: <Ipr.Bell /> },
    { k: "keys",     l: "단축키",        icon: <Ipr.Bolt /> },
    { k: "api",      l: "API 토큰",     icon: <Ipr.Lock /> },
    { k: "danger",   l: "위험 영역",     icon: <Ipr.Trash />, danger: true },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">설정</h1>
          <p className="page-sub">계정, 외관, 알림 환경설정.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "220px 1fr", gap: 16, alignItems: "start" }}>
        {/* Sidebar */}
        {!mobile && (
          <aside className="card" style={{ position: "sticky", top: 12, padding: 8 }}>
            {sections.map((s) => (
              <div key={s.k} onClick={() => setSection(s.k)} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", borderRadius: 6,
                cursor: "pointer",
                background: section === s.k ? "var(--accent-3)" : "transparent",
                color: section === s.k ? "var(--accent-11)" : (s.danger ? "var(--danger-11)" : "var(--text-primary)"),
                fontSize: 13, fontWeight: section === s.k ? 600 : 500,
              }}>
                <span style={{ color: section === s.k ? "var(--accent-9)" : (s.danger ? "var(--danger-9)" : "var(--text-tertiary)") }}>{s.icon}</span>
                {s.l}
              </div>
            ))}
          </aside>
        )}

        {mobile && (
          <div style={{ marginBottom: 12, position: "relative" }}>
            <select value={section} onChange={(e) => setSection(e.target.value)} style={{
              appearance: "none", width: "100%",
              fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
              color: "var(--accent-11)", background: "var(--accent-3)",
              border: "1px solid var(--accent-4)", borderRadius: "var(--r-2)",
              padding: "10px 36px 10px 14px",
            }}>
              {sections.map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
            </select>
            <Ipr.ChevronDown size={14} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--accent-11)", pointerEvents: "none" }}/>
          </div>
        )}

        {/* Body */}
        <section>
          {section === "profile" && <ProfileSection mobile={mobile}/>}
          {section === "appearance" && <AppearanceSection/>}
          {section === "notif" && <NotifSection/>}
          {section === "keys" && <KeysSection/>}
          {section === "api" && <ApiSection/>}
          {section === "danger" && <DangerSection/>}
        </section>
      </div>
    </div>
  );
}

function Card({ title, desc, children, footer }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ padding: 16, borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>{desc}</div>}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
      {footer && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-tint)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {footer}
        </div>
      )}
    </div>
  );
}

function ProfileSection({ mobile }) {
  return (
    <>
      <Card title="기본 정보" desc="다른 사용자에게 표시되는 정보입니다." footer={<button className="btn btn--primary"><Ipr.Check /> 저장</button>}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, #6B6BE0, #9B6BD8)",
            color: "white", fontSize: 22, fontWeight: 700,
            display: "grid", placeItems: "center",
          }}>셀</div>
          <div>
            <button className="btn btn--secondary btn--sm"><Ipr.Image size={12}/> 이미지 변경</button>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>JPG · PNG · 최대 2MB</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div>
            <label className="field-label">표시 이름</label>
            <input className="input" defaultValue="쎌렘황제"/>
          </div>
          <div>
            <label className="field-label">사번</label>
            <input className="input" defaultValue="gc-2031" disabled style={{ fontFamily: "var(--font-mono)", background: "var(--bg-subtle)" }}/>
          </div>
          <div style={{ gridColumn: mobile ? "auto" : "span 2" }}>
            <label className="field-label">이메일</label>
            <input className="input" defaultValue="ceremp@gcempire.net" disabled style={{ background: "var(--bg-subtle)" }}/>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>변경하려면 관리자에게 요청하세요.</div>
          </div>
          <div>
            <label className="field-label">소속 그룹</label>
            <div style={{ display: "flex", gap: 4, padding: "7px 10px", border: "1px solid var(--border-default)", background: "var(--bg-subtle)", borderRadius: 6 }}>
              <span className="chip chip--danger chip--tag">admin</span>
              <span className="chip chip--tag">콘텐츠 제작</span>
            </div>
          </div>
          <div>
            <label className="field-label">언어</label>
            <select className="select" defaultValue="ko"><option value="ko">한국어</option><option value="en">English</option></select>
          </div>
        </div>
      </Card>

      <Card title="비밀번호" desc="마지막 변경 14일 전." footer={<button className="btn btn--primary">변경</button>}>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: mobile ? "auto" : "span 2" }}>
            <label className="field-label">현재 비밀번호</label>
            <input className="input" type="password" placeholder="••••••••"/>
          </div>
          <div>
            <label className="field-label">새 비밀번호</label>
            <input className="input" type="password"/>
          </div>
          <div>
            <label className="field-label">확인</label>
            <input className="input" type="password"/>
          </div>
        </div>
      </Card>
    </>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange && onChange(!on)} style={{
      width: 36, height: 20, padding: 2,
      borderRadius: 999,
      background: on ? "var(--accent-9)" : "var(--border-strong)",
      border: 0, cursor: "pointer",
      display: "flex", alignItems: "center",
      justifyContent: on ? "flex-end" : "flex-start",
      transition: "all 120ms",
    }}>
      <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}/>
    </button>
  );
}

function Row({ title, desc, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{title}</div>
        {desc && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function AppearanceSection() {
  const [theme, setTheme] = useStatePr("auto");
  const [density, setDensity] = useStatePr("comfortable");
  return (
    <>
      <Card title="테마" desc="라이트 / 다크 / 시스템 설정 따름.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { v: "light", l: "라이트", bg: "#F7F7F4", fg: "#16181D" },
            { v: "dark", l: "다크", bg: "#0E1015", fg: "#E8E9EE" },
            { v: "auto", l: "시스템", bg: "linear-gradient(135deg, #F7F7F4 0% 50%, #0E1015 50% 100%)", fg: "#5B5BD6" },
          ].map((t) => (
            <button key={t.v} onClick={() => setTheme(t.v)} style={{
              padding: 12,
              border: "1px solid " + (theme === t.v ? "var(--accent-9)" : "var(--border-default)"),
              borderRadius: 8,
              background: theme === t.v ? "var(--accent-1)" : "transparent",
              cursor: "pointer", fontFamily: "var(--font-sans)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
              <div style={{ width: "100%", height: 60, borderRadius: 4, background: t.bg, border: "1px solid var(--border-subtle)" }}/>
              <span style={{ fontSize: 13, fontWeight: theme === t.v ? 600 : 400, color: theme === t.v ? "var(--accent-11)" : "var(--text-primary)" }}>{t.l}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="레이아웃 밀도" desc="UI 요소 간 간격.">
        <div style={{ display: "flex", gap: 8 }}>
          {[{ v: "comfortable", l: "여유" }, { v: "compact", l: "컴팩트" }].map((d) => (
            <button key={d.v} onClick={() => setDensity(d.v)} className={"btn " + (density === d.v ? "btn--primary" : "btn--secondary")} style={{ flex: 1 }}>
              {d.l}
            </button>
          ))}
        </div>
      </Card>

      <Card title="액센트 컬러">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { v: "iris", c: "#5B5BD6", l: "Iris" },
            { v: "indigo", c: "#3D5AFE", l: "Indigo" },
            { v: "teal", c: "#0F9385", l: "Teal" },
            { v: "mono", c: "#2D3038", l: "Mono" },
          ].map((c, i) => (
            <button key={c.v} style={{
              width: 36, height: 36, borderRadius: "50%",
              background: c.c, cursor: "pointer",
              border: i === 0 ? "3px solid var(--bg-surface)" : "3px solid transparent",
              boxShadow: i === 0 ? `0 0 0 2px ${c.c}` : "none",
            }} title={c.l}/>
          ))}
        </div>
      </Card>
    </>
  );
}

function NotifSection() {
  return (
    <Card title="알림" desc="채널별로 켜고 끌 수 있습니다.">
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 60px 60px 60px",
        gap: 8, alignItems: "center",
        padding: "0 0 10px",
        borderBottom: "1px solid var(--border-default)",
        fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)",
      }}>
        <span>이벤트</span>
        <span style={{ textAlign: "center" }}>앱</span>
        <span style={{ textAlign: "center" }}>이메일</span>
        <span style={{ textAlign: "center" }}>Slack</span>
      </div>
      {[
        { t: "파이프라인 완료", app: true, email: false, slack: true },
        { t: "파이프라인 실패", app: true, email: true, slack: true },
        { t: "LoRA 학습 완료", app: true, email: true, slack: false },
        { t: "서버 응답 지연/실패 (관리자)", app: true, email: true, slack: true },
        { t: "사용자 가입 요청 (관리자)", app: true, email: true, slack: false },
        { t: "백업 실패 (관리자)", app: true, email: true, slack: true },
      ].map((r) => (
        <div key={r.t} style={{
          display: "grid", gridTemplateColumns: "1fr 60px 60px 60px",
          gap: 8, alignItems: "center", padding: "10px 0",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <span style={{ fontSize: 12.5 }}>{r.t}</span>
          {[r.app, r.email, r.slack].map((on, i) => (
            <div key={i} style={{ display: "grid", placeItems: "center" }}>
              <Toggle on={on}/>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}

function KeysSection() {
  const groups = [
    { name: "네비게이션", items: [
      { l: "명령 팔레트 열기", k: ["⌘", "K"] },
      { l: "검색", k: ["/"] },
      { l: "대시보드", k: ["G", "D"] },
      { l: "프로젝트", k: ["G", "P"] },
    ]},
    { name: "액션", items: [
      { l: "새 프로젝트", k: ["⌘", "N"] },
      { l: "이미지 업로드", k: ["⌘", "U"] },
      { l: "저장", k: ["⌘", "S"] },
      { l: "다크 모드 토글", k: ["⌘", "⇧", "D"] },
    ]},
    { name: "라이트박스", items: [
      { l: "이전 / 다음", k: ["←", "→"] },
      { l: "즐겨찾기 토글", k: ["F"] },
      { l: "닫기", k: ["Esc"] },
    ]},
  ];
  return (
    <Card title="단축키" desc="모든 단축키 목록. 명령 팔레트(⌘K)에서도 검색 가능.">
      {groups.map((g) => (
        <div key={g.name} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 8 }}>{g.name}</div>
          {g.items.map((it) => (
            <div key={it.l} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 0",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: 13,
            }}>
              <span style={{ flex: 1 }}>{it.l}</span>
              <div style={{ display: "flex", gap: 3 }}>
                {it.k.map((k) => <span key={k} className="kbd">{k}</span>)}
              </div>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}

function ApiSection() {
  return (
    <Card title="API 토큰" desc="외부 스크립트에서 VCC Manager API를 호출할 때 사용." footer={<button className="btn btn--primary"><Ipr.Plus /> 토큰 생성</button>}>
      {[
        { name: "ComfyUI 외부 호출",   scope: "read:all, write:images", created: "2주 전",  last: "3시간 전" },
        { name: "백업 자동화 스크립트", scope: "read:all",               created: "1개월 전", last: "어제" },
      ].map((t) => (
        <div key={t.name} style={{
          padding: "12px 14px",
          margin: "0 -16px",
          display: "flex", alignItems: "center", gap: 12,
          borderTop: "1px solid var(--border-subtle)",
        }}>
          <Ipr.Lock size={14} style={{ color: "var(--text-tertiary)" }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
              <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{t.scope}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
              vccm_•••••••••••••••f3a2 · 생성 {t.created} · 마지막 사용 {t.last}
            </div>
          </div>
          <button className="btn btn--ghost btn--icon btn--sm"><Ipr.Copy size={12}/></button>
          <button className="btn btn--danger btn--sm"><Ipr.Trash size={12}/> 폐기</button>
        </div>
      ))}
    </Card>
  );
}

function DangerSection() {
  return (
    <div className="card" style={{ borderColor: "var(--danger-3)" }}>
      <div style={{ padding: 16, borderBottom: "1px solid var(--danger-3)", background: "var(--danger-1)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger-11)" }}>위험 영역</div>
        <div style={{ fontSize: 12, color: "var(--danger-11)", marginTop: 3, opacity: 0.85 }}>아래 동작은 되돌릴 수 없습니다.</div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <Row title="모든 작업 히스토리 삭제" desc="실행 기록만 삭제. 생성된 이미지는 보존됩니다.">
          <button className="btn btn--danger">삭제</button>
        </Row>
        <Row title="모든 생성 이미지 삭제" desc="복구 불가. 업로드한 이미지는 별도 처리.">
          <button className="btn btn--danger">삭제</button>
        </Row>
        <Row title="계정 비활성화" desc="다시 로그인 불가. 데이터는 30일간 보관.">
          <button className="btn btn--danger">계정 비활성화</button>
        </Row>
      </div>
    </div>
  );
}

Object.assign(window, { ProfilePage });
