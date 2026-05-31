// page-admin-dashboard.jsx — 관리자 대시보드 (운영 허브)
// 시스템 통계(분석/리포트)와 구분되는 "오늘 무엇을 봐야 하나" 중심의 운영 화면.
//   1) 시스템 상태 한눈에  2) 조치 필요 항목  3) 관리 영역 바로가기  4) 최근 관리 활동
// onNav(key) 로 각 관리 페이지로 이동.

const Iad = window.Icon;

// 상태 색 토큰
const SEV = {
  danger:  { fg: "var(--danger-11)",  bg: "var(--danger-3)",  dot: "var(--danger-9)" },
  warning: { fg: "var(--warning-11)", bg: "var(--warning-3)", dot: "var(--warning-9)" },
  info:    { fg: "var(--info-11)",    bg: "var(--info-3)",    dot: "var(--info-9)" },
  success: { fg: "var(--success-11)", bg: "var(--success-3)", dot: "var(--success-9)" },
};

// ── 상단 헬스 카드 ─────────────────────────────────────────────
function HealthCard({ icon, label, value, foot, tone }) {
  const s = tone ? SEV[tone] : null;
  return (
    <div className="card" style={{ padding: 15, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", flex: "0 0 auto",
          background: s ? s.bg : "var(--bg-subtle)", color: s ? s.fg : "var(--text-tertiary)",
        }}>{icon}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: s ? s.fg : "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 5 }}>
        {tone && <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flex: "0 0 auto" }}/>}
        {foot}
      </div>
    </div>
  );
}

// ── 조치 필요 항목 ────────────────────────────────────────────
function ActionRow({ item, onNav, last }) {
  const s = SEV[item.sev];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
      borderTop: last ? "none" : "1px solid var(--border-subtle)",
    }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, flex: "0 0 auto", display: "grid", placeItems: "center", background: s.bg, color: s.fg }}>
        {item.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{item.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1, textWrap: "pretty" }}>{item.detail}</div>
      </div>
      {item.count != null && (
        <span className="chip chip--tag" style={{ background: s.bg, color: s.fg, border: "none", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>{item.count}</span>
      )}
      <button className="btn btn--secondary btn--sm" style={{ flex: "0 0 auto" }} onClick={() => onNav && onNav(item.nav)}>
        {item.cta} <Iad.ArrowRight size={12}/>
      </button>
    </div>
  );
}

// ── 관리 영역 바로가기 카드 ────────────────────────────────────
function AreaCard({ icon, label, metric, sub, navKey, onNav }) {
  return (
    <button className="ad-area" onClick={() => onNav && onNav(navKey)} style={{
      textAlign: "left", font: "inherit", cursor: "pointer",
      background: "var(--bg-surface)", border: "1px solid var(--border-default)",
      borderRadius: "var(--r-3)", padding: 14,
      display: "flex", flexDirection: "column", gap: 10,
      transition: "border-color 130ms, box-shadow 130ms, transform 130ms",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent-3)", color: "var(--accent-11)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>{label}</span>
        <span className="ad-area__go" style={{ color: "var(--text-tertiary)", transition: "transform 130ms, color 130ms" }}><Iad.ArrowRight size={14}/></span>
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", fontFamily: "var(--font-mono)" }}>{metric}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

// ── 최근 관리 활동 ────────────────────────────────────────────
function ActivityRow({ a, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: last ? "none" : "1px solid var(--border-subtle)" }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: a.color, color: "white", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", flex: "0 0 auto" }}>{a.who[0]}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{a.who}</span>
        {" "}{a.action}{" "}
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{a.target}</span>
      </div>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>{a.time}</span>
    </div>
  );
}

function AdminDashboardPage({ mobile, onNav }) {
  const actions = [
    { sev: "danger",  icon: <Iad.Bolt size={15}/>,  title: "local-llama 서버 과부하", detail: "GPU 100% · 5분간 응답 지연. 큐 적체 우려.", cta: "서버 점검", nav: "servers" },
    { sev: "warning", icon: <Iad.Users size={15}/>, title: "신규 가입 승인 대기", detail: "초대 수락 후 승인을 기다리는 사용자.", count: 3, cta: "검토", nav: "users" },
    { sev: "warning", icon: <Iad.Cube size={15}/>,  title: "모델 화이트리스트 요청", detail: "RealVisXL v4 외 1건이 활성화 승인 대기 중.", count: 2, cta: "검토", nav: "models" },
    { sev: "info",    icon: <Iad.Backup size={15}/>,title: "마지막 백업 26시간 전", detail: "24시간 주기를 초과했습니다. 수동 백업 권장.", cta: "백업", nav: "backup" },
  ];

  const areas = [
    { icon: <Iad.Users size={15}/>,  label: "사용자 관리", metric: "47", sub: "활성 34 · 대기 3", navKey: "users" },
    { icon: <Iad.Server size={15}/>, label: "서버 관리",   metric: "4 / 5", sub: "1대 과부하", navKey: "servers" },
    { icon: <Iad.Cube size={15}/>,   label: "모델 관리",   metric: "32", sub: "화이트리스트 28", navKey: "models" },
    { icon: <Iad.Grid size={15}/>,   label: "작업판 관리", metric: "12", sub: "이번 주 2개 신규", navKey: "wbadmin" },
    { icon: <Iad.Stats size={15}/>,  label: "시스템 통계", metric: "2,847", sub: "30일 생성량", navKey: "stats" },
    { icon: <Iad.Backup size={15}/>, label: "백업 / 복구", metric: "26h", sub: "마지막 백업 경과", navKey: "backup" },
  ];

  const activity = [
    { who: "쎌렘황제", action: "사용자 권한을 변경했습니다", target: "한지원 → vip", time: "12분 전", color: "linear-gradient(135deg,#6B6BE0,#9B6BD8)" },
    { who: "쎌렘황제", action: "모델을 화이트리스트에 추가했습니다", target: "AnimagineXL v3", time: "1시간 전", color: "linear-gradient(135deg,#6B6BE0,#9B6BD8)" },
    { who: "한지원",   action: "작업판을 수정했습니다", target: "SDXL T2I — LoRA", time: "3시간 전", color: "linear-gradient(135deg,#2F77E4,#4E8EE8)" },
    { who: "system",   action: "자동 백업을 완료했습니다", target: "snapshot-0530", time: "어제 02:00", color: "linear-gradient(135deg,#5B5BD6,#7676E0)" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <h1 className="page-title" style={{ marginBottom: 0 }}>관리자 대시보드</h1>
            <span className="chip chip--warning chip--tag" style={{ height: 22 }}><span className="chip__dot"/>주의 필요</span>
          </div>
          <p className="page-sub" style={{ textWrap: "pretty", marginTop: 6 }}>시스템 운영 상태와 조치가 필요한 항목을 한 곳에서. 상세 분석은 시스템 통계에서.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
            <button className="btn btn--secondary"><Iad.Refresh /> 새로고침</button>
            <button className="btn btn--secondary" onClick={() => onNav && onNav("stats")}><Iad.Stats /> 시스템 통계</button>
          </div>
        )}
      </div>

      {/* Health strip */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <HealthCard icon={<Iad.Server size={14}/>} label="서버" value="4 / 5" foot="1대 과부하 · 점검 필요" tone="warning"/>
        <HealthCard icon={<Iad.Stats size={14}/>}  label="GPU 평균 부하" value="58%" foot="comfy-01 84% 최고"/>
        <HealthCard icon={<Iad.Clock size={14}/>}  label="대기 큐" value="8" foot="실행 중 작업 4건"/>
        <HealthCard icon={<Iad.Users size={14}/>}  label="활성 사용자" value="34 / 47" foot="오늘 활동 기준" tone="success"/>
      </div>

      {/* Two-column: actions + activity */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.55fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* 조치 필요 */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card__header">
            <Iad.Bell />
            <span className="card__title">조치 필요</span>
            <span style={{ flex: 1 }}/>
            <span className="chip chip--danger chip--tag" style={{ fontFamily: "var(--font-mono)" }}>{actions.length}</span>
          </div>
          <div>
            {actions.map((it, i) => (
              <ActionRow key={i} item={it} onNav={onNav} last={i === actions.length - 1}/>
            ))}
          </div>
        </div>

        {/* 최근 관리 활동 */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card__header">
            <Iad.Shield />
            <span className="card__title">최근 관리 활동</span>
            <span style={{ flex: 1 }}/>
            <button className="btn btn--ghost btn--sm" onClick={() => onNav && onNav("audit")} style={{ height: 24, fontSize: 11.5 }}>감사 로그 →</button>
          </div>
          <div>
            {activity.map((a, i) => (
              <ActivityRow key={i} a={a} last={i === activity.length - 1}/>
            ))}
          </div>
        </div>
      </div>

      {/* 관리 영역 바로가기 */}
      <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>관리 영역</div>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 12 }}>
        {areas.map((a) => (
          <AreaCard key={a.label} {...a} onNav={onNav}/>
        ))}
      </div>

      <style>{`
        .ad-area:hover { border-color: var(--accent-8); box-shadow: var(--shadow-2); transform: translateY(-1px); }
        .ad-area:hover .ad-area__go { color: var(--accent-11); transform: translateX(2px); }
      `}</style>
    </div>
  );
}

Object.assign(window, { AdminDashboardPage });
