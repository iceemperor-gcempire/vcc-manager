// page-admin-users.jsx — Admin: User & Group management
// Two-pane layout: left rail (groups), right (user table) — both with invite/edit affordances.

const { useState: useStateAu2 } = React;
const Iau2 = window.Icon;

function GroupRow({ g, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 10px",
      borderRadius: 6,
      background: active ? "var(--accent-3)" : "transparent",
      color: active ? "var(--accent-11)" : "var(--text-primary)",
      cursor: "pointer",
      transition: "background 120ms",
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flex: "0 0 auto" }}/>
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
      <span style={{ fontSize: 11, color: active ? "var(--accent-11)" : "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{g.count}</span>
    </div>
  );
}

function UserRow({ u, mobile }) {
  return (
    <div className="u-row" style={{
      padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 10,
      borderTop: "1px solid var(--border-subtle)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: u.avatarBg,
        display: "grid", placeItems: "center",
        color: "white", fontSize: 11, fontWeight: 700,
        flex: "0 0 auto",
      }}>{u.initial}</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span>
          {u.role === "admin" && <span className="chip chip--danger chip--tag">admin</span>}
          {u.role === "vip" && <span className="chip chip--accent chip--tag">VIP</span>}
          {u.status === "pending" && <span className="chip chip--warning chip--tag">승인 대기</span>}
          {u.status === "suspended" && <span className="chip chip--tag" style={{ background: "var(--bg-subtle)", color: "var(--text-tertiary)" }}>중지</span>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
      </div>
      {!mobile && (
        <>
          <div className="u-extra" style={{ width: 100, fontSize: 12, color: "var(--text-secondary)" }}>{u.lastSeen}</div>
          <div className="u-extra" style={{ width: 64, fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{u.usage}회</div>
          <div className="u-extra" style={{ width: 140, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {u.groups.map((g) => (
              <span key={g.name} className="chip chip--tag" style={{ background: g.color + "22", color: g.color, border: "1px solid " + g.color + "44" }}>{g.name}</span>
            ))}
          </div>
          <button className="btn btn--ghost btn--icon btn--sm"><Iau2.Dots /></button>
        </>
      )}
      <style>{`
        @container (max-width: 720px) {
          .u-extra { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function AdminUsersPage({ mobile }) {
  const [activeGroup, setActiveGroup] = useStateAu2("all");
  const [tab, setTab] = useStateAu2("users");

  const groups = [
    { id: "all",       name: "모든 사용자",   count: 47, color: "#5B5BD6" },
    { id: "admin",     name: "관리자",       count: 4,  color: "#D5383E" },
    { id: "vip",       name: "VIP",         count: 8,  color: "#BE7415" },
    { id: "content",   name: "콘텐츠 제작",  count: 22, color: "#7B4DD8" },
    { id: "eng",       name: "엔지니어링",   count: 9,  color: "#2F77E4" },
    { id: "design",    name: "디자인",      count: 6,  color: "#0F9385" },
    { id: "pending",   name: "승인 대기",    count: 3,  color: "#BE7415" },
  ];

  const users = [
    { name: "쎌렘황제",    email: "ceremp@gcempire.net",  initial: "셀", avatarBg: "linear-gradient(135deg,#6B6BE0,#9B6BD8)", role: "admin", lastSeen: "지금",   usage: 1247, groups: [{name:"콘텐츠",color:"#7B4DD8"}], status: "active" },
    { name: "한지원",      email: "hjwon@gcempire.net",   initial: "한", avatarBg: "linear-gradient(135deg,#2F77E4,#4E8EE8)", role: "vip",   lastSeen: "12분 전", usage: 412, groups: [{name:"VIP",color:"#BE7415"},{name:"콘텐츠",color:"#7B4DD8"}], status: "active" },
    { name: "Kim Minjae",  email: "minjae.k@gcempire.net",initial: "K",  avatarBg: "linear-gradient(135deg,#0F9385,#2EBA6B)", role: null,    lastSeen: "1시간 전",usage: 248, groups: [{name:"디자인",color:"#0F9385"}], status: "active" },
    { name: "박서연",      email: "syp@gcempire.net",     initial: "박", avatarBg: "linear-gradient(135deg,#BE7415,#D69021)", role: null,    lastSeen: "어제",   usage: 187, groups: [{name:"엔지",color:"#2F77E4"}], status: "active" },
    { name: "Linda Choi",  email: "linda@gcempire.net",   initial: "L",  avatarBg: "linear-gradient(135deg,#D5383E,#E84B52)", role: "admin", lastSeen: "어제",   usage: 92,  groups: [{name:"관리",color:"#D5383E"}], status: "active" },
    { name: "정현우",      email: "hwjung@gcempire.net",  initial: "정", avatarBg: "linear-gradient(135deg,#5B5BD6,#7676E0)", role: null,    lastSeen: "3일 전", usage: 64,  groups: [{name:"콘텐츠",color:"#7B4DD8"}], status: "active" },
    { name: "no-name",     email: "guest-031@gc.net",     initial: "?",  avatarBg: "linear-gradient(135deg,#8A8F9A,#B6BAC2)", role: null,    lastSeen: "—",      usage: 0,   groups: [{name:"대기",color:"#BE7415"}], status: "pending" },
    { name: "이도윤",      email: "dyleeold@gcempire.net",initial: "이", avatarBg: "linear-gradient(135deg,#717684,#A0A4AF)", role: null,    lastSeen: "3주 전", usage: 18,  groups: [{name:"디자인",color:"#0F9385"}], status: "suspended" },
  ];

  const tabs = [
    { k: "users",     l: "사용자",   c: 47 },
    { k: "groups",    l: "그룹",    c: 7 },
    { k: "invites",   l: "초대",    c: 3 },
    { k: "audit",     l: "감사 로그" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">사용자 / 그룹</h1>
          <p className="page-sub">계정 권한, 그룹 멤버십, 작업판 접근 화이트리스트.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary"><Iau2.ArrowDown /> 내보내기</button>
            <button className="btn btn--secondary"><Iau2.Plus /> 그룹 만들기</button>
            <button className="btn btn--primary"><Iau2.Send /> 사용자 초대</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ overflowX: "auto", marginBottom: 18 }}>
        {tabs.map((t) => (
          <div key={t.k} className={"tab" + (tab === t.k ? " is-active" : "")} onClick={() => setTab(t.k)}>
            <span>{t.l}</span>
            {t.c != null && <span className="tab__count">{t.c}</span>}
          </div>
        ))}
      </div>

      {tab === "users" && (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "220px 1fr", gap: 16, alignItems: "start" }}>
          {/* Groups rail */}
          {!mobile && (
            <aside className="card" style={{ position: "sticky", top: 12 }}>
              <div className="card__header">
                <Iau2.Users />
                <span className="card__title">그룹 필터</span>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                {groups.map((g) => (
                  <GroupRow key={g.id} g={g} active={activeGroup === g.id} onClick={() => setActiveGroup(g.id)}/>
                ))}
              </div>
              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border-subtle)" }}>
                <button className="btn btn--ghost btn--sm" style={{ width: "100%" }}>
                  <Iau2.Plus size={12}/> 새 그룹
                </button>
              </div>
            </aside>
          )}

          {/* User table */}
          <div className="card" style={{ containerType: "inline-size" }}>
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
                <input className="input" placeholder="이름 · 이메일 검색" style={{ paddingLeft: 30 }}/>
                <span style={{ position: "absolute", left: 8, top: 8, color: "var(--text-tertiary)" }}><Iau2.Search size={13}/></span>
              </div>
              <button className="btn btn--ghost btn--sm"><Iau2.Filter size={12}/> 상태</button>
              <span style={{ flex: 1 }}/>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                47명 중 {users.length}명 표시
              </span>
            </div>

            {/* Column headers */}
            {!mobile && (
              <div className="u-table__header" style={{
                padding: "8px 14px 8px 56px",
                fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                color: "var(--text-tertiary)", background: "var(--bg-tint)",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>이름 · 이메일</div>
                <div className="u-extra" style={{ width: 100 }}>마지막 활동</div>
                <div className="u-extra" style={{ width: 64, textAlign: "right" }}>사용</div>
                <div className="u-extra" style={{ width: 140 }}>그룹</div>
                <div style={{ width: 26 }}/>
              </div>
            )}

            {users.map((u, i) => <UserRow key={i} u={u} mobile={mobile}/>)}
          </div>
        </div>
      )}

      {tab === "groups" && (
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
          {groups.filter((g) => g.id !== "all" && g.id !== "pending").map((g) => (
            <div key={g.id} className="card" style={{ padding: 16, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: g.color }}/>
                <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{g.name}</span>
                <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)" }}>{g.count}명</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 12 }}>
                작업판 {g.id === "admin" ? "12개 모두" : g.id === "vip" ? "10개" : g.id === "eng" ? "6개" : "4개"} 접근
              </div>
              <div style={{ display: "flex", gap: -6 }}>
                {[0,1,2,3].map((i) => (
                  <div key={i} style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${g.color}, oklch(60% 0.18 ${(i*60+30) % 360}))`,
                    border: "2px solid var(--bg-surface)",
                    marginLeft: i === 0 ? 0 : -8,
                    color: "white", fontSize: 10, fontWeight: 700,
                    display: "grid", placeItems: "center",
                  }}>{["김","박","이","정"][i]}</div>
                ))}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "var(--bg-subtle)", color: "var(--text-tertiary)",
                  border: "2px solid var(--bg-surface)",
                  marginLeft: -8, fontSize: 10, fontWeight: 600,
                  display: "grid", placeItems: "center",
                  fontFamily: "var(--font-mono)",
                }}>+{Math.max(0, g.count - 4)}</div>
              </div>
            </div>
          ))}
          <div style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: 8, padding: 16,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, color: "var(--text-tertiary)",
            minHeight: 140,
          }}>
            <Iau2.Plus size={20}/>
            <span style={{ fontSize: 13, fontWeight: 500 }}>새 그룹 만들기</span>
          </div>
        </div>
      )}

      {tab === "invites" && (
        <div className="card">
          {[
            { email: "intern1@gcempire.net", invitedBy: "Linda Choi", time: "2일 전", group: "콘텐츠 제작" },
            { email: "newhire@gcempire.net", invitedBy: "쎌렘황제",   time: "1주 전", group: "엔지니어링" },
            { email: "vendor@partner.io",    invitedBy: "쎌렘황제",   time: "2주 전", group: "외부" },
          ].map((inv, i) => (
            <div key={i} style={{
              padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-subtle)", display: "grid", placeItems: "center", color: "var(--text-tertiary)" }}><Iau2.Send size={14}/></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono)" }}>{inv.email}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>
                  {inv.invitedBy} · {inv.time} · {inv.group}
                </div>
              </div>
              <span className="chip chip--warning chip--tag">대기 중</span>
              <button className="btn btn--secondary btn--sm">재발송</button>
              <button className="btn btn--ghost btn--icon btn--sm"><Iau2.X /></button>
            </div>
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
          <Iau2.Doc style={{ marginBottom: 8 }}/>
          <div style={{ fontSize: 13 }}>최근 30일 감사 로그 · 1,247건</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>(별도 페이지로 분리 — 다음 라운드)</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AdminUsersPage });
