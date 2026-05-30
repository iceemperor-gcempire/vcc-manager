// page-project-list.jsx — 프로젝트 카탈로그 (사이드바 "프로젝트" 클릭 시)

const { useState: useStatePl } = React;
const Ipl = window.Icon;

function ProjectGridCard({ p, onClick }) {
  return (
    <div className="card" style={{
      padding: 0, overflow: "hidden", cursor: "pointer", transition: "all 150ms",
    }}
      onClick={onClick}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.boxShadow = "var(--shadow-2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
    >
      {/* Cover — 4 image collage / placeholder */}
      <div style={{
        position: "relative",
        height: 160,
        background: p.gradient,
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2, padding: 2 }}>
          {(p.thumbHues || [30, 270, 200, 80]).slice(0, 4).map((h, i) => (
            <div key={i} className="thumb-tile" style={{ borderRadius: 0, "--h": h, opacity: 0.95 }}/>
          ))}
        </div>
        {/* Favorite */}
        {p.favorite && (
          <div style={{ position: "absolute", top: 10, left: 10, color: "var(--warning-9)" }}>
            <Ipl.StarFill size={16}/>
          </div>
        )}
        {/* Mark badge */}
        <div style={{
          position: "absolute", top: 10, right: 10,
          width: 32, height: 32, borderRadius: 8,
          background: "rgba(255,255,255,0.18)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "white", fontWeight: 700, fontSize: 14,
          display: "grid", placeItems: "center",
        }}>{p.name[0]}</div>
      </div>

      {/* Body */}
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
          <span className="tag" style={{ background: p.tagColor }}>{p.tag}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, textWrap: "pretty", minHeight: 36 }}>
          {p.desc}
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginTop: 12, paddingTop: 12,
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 11, color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Ipl.Image size={11}/> {p.images}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Ipl.Pipe size={11}/> {p.pipelines}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Ipl.Doc size={11}/> {p.docs}
          </span>
          <span style={{ flex: 1 }}/>
          <span>{p.updated}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectListPage({ mobile, onOpenProject }) {
  const [view, setView] = useStatePl("grid");
  const [filter, setFilter] = useStatePl("active");

  const projects = [
    { name: "Mages", tag: "세계관", tagColor: "var(--tag-world)", desc: "동방·북방 마법 정치 / 개척 시대 세계관, 캐릭터 NPC 생성",
      gradient: "linear-gradient(135deg, #7B4DD8 0%, #5B5BD6 50%, #2F77E4 100%)",
      thumbHues: [270, 30, 200, 80], favorite: true,
      images: 124, pipelines: 4, docs: 6, updated: "5분 전" },
    { name: "Cryo", tag: "세계관", tagColor: "var(--tag-world)", desc: "한대 빙하 도시 / 얼음 마법사 가문 시리즈",
      gradient: "linear-gradient(135deg, #2F77E4 0%, #4E8EE8 100%)",
      thumbHues: [200, 220, 180, 240], favorite: false,
      images: 88, pipelines: 2, docs: 3, updated: "어제" },
    { name: "Astral Pact", tag: "캠페인", tagColor: "var(--accent-9)", desc: "TRPG용 NPC 일러스트 — 5인 파티 + 적 캐릭터 80명",
      gradient: "linear-gradient(135deg, #BE7415 0%, #D69021 100%)",
      thumbHues: [30, 50, 0, 60], favorite: true,
      images: 41, pipelines: 1, docs: 2, updated: "2일 전" },
    { name: "초안 모음", tag: "스케치", tagColor: "var(--text-secondary)", desc: "정리 전 자투리 — 분류되지 않은 실험 이미지",
      gradient: "linear-gradient(135deg, #5B616E 0%, #8A8F9A 100%)",
      thumbHues: [180, 220, 130, 50], favorite: false,
      images: 12, pipelines: 0, docs: 1, updated: "1주 전" },
    { name: "Rusty Blood", tag: "세계관", tagColor: "var(--tag-world)", desc: "Mages 세계관 1세대 — 개척기 군대 시리즈",
      gradient: "linear-gradient(135deg, #D5383E 0%, #BE7415 100%)",
      thumbHues: [0, 30, 20, 350], favorite: false,
      images: 67, pipelines: 1, docs: 4, updated: "3주 전" },
    { name: "보관함", tag: "보관", tagColor: "var(--text-tertiary)", desc: "종료된 프로젝트 보관 — 읽기 전용",
      gradient: "linear-gradient(135deg, #717684 0%, #A0A4AF 100%)",
      thumbHues: [240, 200, 280, 220], favorite: false,
      images: 234, pipelines: 0, docs: 12, updated: "3개월 전" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">프로젝트</h1>
          <p className="page-sub">세계관, 캠페인, 실험 모음을 프로젝트 단위로 묶어 관리합니다.</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {!mobile && (
            <div style={{
              display: "inline-flex", padding: 3, borderRadius: 6,
              background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)",
            }}>
              <button onClick={() => setView("grid")} style={{
                padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12,
                background: view === "grid" ? "var(--bg-surface)" : "transparent",
                color: view === "grid" ? "var(--text-primary)" : "var(--text-tertiary)",
                boxShadow: view === "grid" ? "var(--shadow-1)" : "none",
                fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4,
              }}><Ipl.Grid size={12}/> 그리드</button>
              <button onClick={() => setView("list")} style={{
                padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12,
                background: view === "list" ? "var(--bg-surface)" : "transparent",
                color: view === "list" ? "var(--text-primary)" : "var(--text-tertiary)",
                boxShadow: view === "list" ? "var(--shadow-1)" : "none",
                fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4,
              }}><Ipl.Menu size={12}/> 목록</button>
            </div>
          )}
          <button className="btn btn--primary"><Ipl.Plus /> 새 프로젝트</button>
        </div>
      </div>

      {/* Filter / search row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: mobile ? 1 : 0, minWidth: mobile ? 0 : 300 }}>
          <input className="input" placeholder="프로젝트 이름 · 태그 · 설명 검색" style={{ paddingLeft: 32 }}/>
          <span style={{ position: "absolute", left: 10, top: 8, color: "var(--text-tertiary)" }}>
            <Ipl.Search size={14}/>
          </span>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-subtle)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
            {[
              { v: "active", l: "활성" },
              { v: "fav",    l: "즐겨찾기" },
              { v: "archived", l: "보관" },
              { v: "all",    l: "모두" },
            ].map((f) => (
              <button key={f.v} onClick={() => setFilter(f.v)} style={{
                padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12,
                background: filter === f.v ? "var(--bg-surface)" : "transparent",
                color: filter === f.v ? "var(--text-primary)" : "var(--text-tertiary)",
                boxShadow: filter === f.v ? "var(--shadow-1)" : "none",
                fontWeight: 500,
              }}>{f.l}</button>
            ))}
          </div>
        )}
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          {projects.length}개
        </span>
      </div>

      {view === "grid" || mobile ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {projects.map((p) => (
            <ProjectGridCard key={p.name} p={p} onClick={() => onOpenProject && onOpenProject(p.name)}/>
          ))}
          {/* "Create new" affordance card */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, padding: 24, minHeight: 220,
            border: "1px dashed var(--border-strong)",
            borderRadius: 8,
            color: "var(--text-tertiary)",
            cursor: "pointer", transition: "all 120ms",
          }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.background = "var(--accent-1)"; e.currentTarget.style.color = "var(--accent-11)"; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.background = ""; e.currentTarget.style.color = "var(--text-tertiary)"; }}
          >
            <Ipl.Plus size={20}/>
            <span style={{ fontSize: 13, fontWeight: 500 }}>새 프로젝트 만들기</span>
          </div>
        </div>
      ) : (
        <div className="card">
          {projects.map((p, i) => (
            <div key={p.name} onClick={() => onOpenProject && onOpenProject(p.name)} style={{
              padding: "12px 14px", display: "flex", alignItems: "center", gap: 12,
              borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
              cursor: "pointer",
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: p.gradient, color: "white", fontWeight: 700, display: "grid", placeItems: "center", flex: "0 0 auto" }}>{p.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  <span className="tag" style={{ background: p.tagColor }}>{p.tag}</span>
                  {p.favorite && <Ipl.StarFill size={12} style={{ color: "var(--warning-9)" }}/>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.desc}</div>
              </div>
              <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                <span>{p.images} img</span>
                <span>{p.pipelines} pipe</span>
                <span>{p.updated}</span>
              </div>
              <button className="btn btn--ghost btn--icon btn--sm"><Ipl.Dots /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProjectListPage });
