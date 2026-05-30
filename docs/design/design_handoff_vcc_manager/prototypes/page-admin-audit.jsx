// page-admin-audit.jsx — 감사 로그 (admin)
// Filterable timeline of all admin/user actions.

const { useState: useStateAa } = React;
const Iaa = window.Icon;

const EVENT_META = {
  login:    { color: "var(--info-9)",    bg: "var(--info-3)",    label: "로그인",     icon: <Iaa.Lock /> },
  logout:   { color: "var(--text-tertiary)", bg: "var(--bg-subtle)", label: "로그아웃", icon: <Iaa.Lock /> },
  create:   { color: "var(--success-9)", bg: "var(--success-3)", label: "생성",     icon: <Iaa.Plus /> },
  edit:     { color: "var(--accent-9)",  bg: "var(--accent-3)",  label: "수정",     icon: <Iaa.Edit /> },
  delete:   { color: "var(--danger-9)",  bg: "var(--danger-3)",  label: "삭제",     icon: <Iaa.Trash /> },
  run:      { color: "var(--accent-9)",  bg: "var(--accent-3)",  label: "실행",     icon: <Iaa.Play /> },
  permission: { color: "var(--warning-9)", bg: "var(--warning-3)", label: "권한 변경", icon: <Iaa.Shield /> },
};

function AdminAuditPage({ mobile }) {
  const [kind, setKind] = useStateAa("all");

  const events = [
    { t: "오늘 16:47:29", actor: "쎌렘황제",   kind: "run",        target: "파이프라인 'NPC 생성'",   detail: "Mages · run_a47f2c1e" },
    { t: "오늘 14:22:11", actor: "Linda Choi", kind: "permission", target: "한지원",                 detail: "역할 user → vip" },
    { t: "오늘 11:32:04", actor: "쎌렘황제",   kind: "run",        target: "파이프라인 'NPC 생성'",   detail: "Mages · run_8c1bcd1e" },
    { t: "오늘 10:15:33", actor: "Linda Choi", kind: "create",     target: "사용자 'newhire@gcempire.net'", detail: "초대 발송" },
    { t: "어제 22:18:42", actor: "쎌렘황제",   kind: "delete",     target: "이미지 8장",              detail: "Mages 컨텐츠 라이브러리" },
    { t: "어제 20:12:55", actor: "Kim Minjae", kind: "run",        target: "파이프라인 'NPC 생성'",   detail: "Mages · run_4d7c..." },
    { t: "어제 18:42:11", actor: "쎌렘황제",   kind: "edit",       target: "작업판 'SDXL T2I — LoRA'", detail: "고급 설정 변경" },
    { t: "어제 15:30:22", actor: "한지원",     kind: "login",      target: "—",                      detail: "192.168.1.84 · macOS Safari" },
    { t: "어제 14:18:09", actor: "Linda Choi", kind: "create",     target: "서버 'local-llama'",     detail: "192.168.1.60" },
    { t: "어제 12:00:01", actor: "system",    kind: "create",     target: "백업 'bk_9f1d'",         detail: "자동 (03:00) · 408MB" },
    { t: "2일 전 18:42",  actor: "쎌렘황제",   kind: "edit",       target: "Mages 세계관 개요",       detail: "184줄 → 211줄" },
    { t: "2일 전 14:32",  actor: "박서연",     kind: "create",     target: "프로젝트 'Cryo'",         detail: "—" },
  ];

  const kinds = [
    { v: "all",        l: "모두" },
    { v: "run",        l: "실행" },
    { v: "create",     l: "생성" },
    { v: "edit",       l: "수정" },
    { v: "delete",     l: "삭제" },
    { v: "permission", l: "권한" },
    { v: "login",      l: "로그인" },
  ];

  const filtered = kind === "all" ? events : events.filter((e) => e.kind === kind);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">감사 로그</h1>
          <p className="page-sub">모든 사용자/관리자 액션 타임라인. 최근 90일 보관.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <select className="select" defaultValue="all" style={{ width: 140, fontSize: 12 }}>
              <option value="all">모든 사용자</option>
              <option>쎌렘황제</option>
              <option>Linda Choi</option>
              <option>한지원</option>
              <option>system</option>
            </select>
            <select className="select" defaultValue="7d" style={{ width: 120, fontSize: 12 }}>
              <option value="24h">최근 24시간</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="all">전체</option>
            </select>
            <button className="btn btn--secondary"><Iaa.ArrowDown /> CSV</button>
          </div>
        )}
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
        {[
          { l: "총 이벤트", v: "1,247" },
          { l: "오늘", v: "47" },
          { l: "삭제 이벤트", v: "12", color: "var(--danger-11)" },
          { l: "권한 변경", v: "3", color: "var(--warning-11)" },
          { l: "활성 사용자", v: "34" },
        ].map((s) => (
          <div key={s.l} className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: s.color || "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Kind filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {kinds.map((k) => (
          <button key={k.v} onClick={() => setKind(k.v)} className="chip" style={{
            cursor: "pointer", whiteSpace: "nowrap",
            background: kind === k.v ? "var(--accent-9)" : "var(--bg-surface)",
            color: kind === k.v ? "white" : "var(--text-primary)",
            border: "1px solid " + (kind === k.v ? "var(--accent-9)" : "var(--border-default)"),
            height: 28, padding: "0 12px", fontSize: 12.5, fontWeight: 500,
          }}>{k.l}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ position: "relative", width: 240 }}>
          <input className="input" placeholder="검색…" style={{ paddingLeft: 28, fontSize: 12 }}/>
          <span style={{ position: "absolute", left: 8, top: 8, color: "var(--text-tertiary)" }}><Iaa.Search size={12}/></span>
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        {filtered.map((e, i) => {
          const meta = EVENT_META[e.kind];
          return (
            <div key={i} style={{
              padding: "12px 16px",
              display: "grid",
              gridTemplateColumns: mobile ? "32px 1fr" : "150px 32px 1fr 80px",
              gap: 12,
              alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
            }}>
              {!mobile && (
                <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{e.t}</span>
              )}
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: meta.bg, color: meta.color,
                display: "grid", placeItems: "center", flex: "0 0 auto",
              }}>{meta.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600 }}>{e.actor}</span>
                  <span className="chip chip--tag" style={{ background: meta.bg, color: meta.color, border: "none", fontSize: 10 }}>{meta.label}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{e.target}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                  {mobile && e.t + " · "}{e.detail}
                </div>
              </div>
              {!mobile && (
                <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, justifySelf: "end" }}>
                  자세히
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { AdminAuditPage });
