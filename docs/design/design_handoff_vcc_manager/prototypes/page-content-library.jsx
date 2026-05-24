// page-content-library.jsx — "내 컨텐츠" page (journey C)
// Tabs: 생성된 이미지 / 업로드된 이미지 / 영상 / 직접 작성 텍스트 / 생성된 텍스트
// Left rail: filters (project / tag / favorite / size)
// Right: grid OR list

const { useState: useStateCl } = React;
const Icl = window.Icon;

function Thumb({ idx, hue, size = 1, label, kind = "image", favorite }) {
  // base placeholder; mark style varies by kind
  return (
    <div className="thumb-tile" style={{
      position: "relative",
      aspectRatio: kind === "image" ? "1/1" : kind === "video" ? "16/9" : "auto",
      borderRadius: 6,
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-mono)", fontSize: 10,
      letterSpacing: "0.04em", textTransform: "uppercase",
      overflow: "hidden",
      cursor: "pointer",
      "--h": hue,
    }}>
      {label}
      {kind === "video" && (
        <div style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          background: "rgba(0,0,0,0.18)", color: "white",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.94)",
            color: "var(--accent-11)",
            display: "grid", placeItems: "center",
          }}><Icl.Play size={14}/></div>
        </div>
      )}
      {favorite && (
        <div style={{ position: "absolute", top: 6, left: 6, color: "var(--warning-9)" }}>
          <Icl.StarFill size={14}/>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ title, children }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)", padding: "12px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>
    </div>
  );
}
function FilterRow({ label, count, active, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "5px 8px",
      borderRadius: 4,
      background: active ? "var(--accent-3)" : "transparent",
      color: active ? "var(--accent-11)" : "var(--text-primary)",
      fontSize: 12.5, fontWeight: active ? 600 : 400,
      cursor: "pointer",
    }}>
      {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flex: "0 0 auto" }}/>}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {count != null && <span style={{ fontSize: 11, color: active ? "var(--accent-11)" : "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{count}</span>}
    </div>
  );
}

function ImageGrid({ mobile, items, kind = "image" }) {
  const cols = mobile ? 2 : 5;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Thumb idx={i} {...it} kind={kind}/>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
              <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                {it.meta}
              </div>
            </div>
            <button className="btn btn--ghost btn--icon btn--sm"><Icl.Dots /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContentLibraryPage({ mobile }) {
  const [tab, setTab] = useStateCl("generated_img");
  const [view, setView] = useStateCl("grid");

  const generatedImgs = [
    { hue: 30,  label: "frontier-engineer",  meta: "Mages · 1024×1024 · 4시간 전", favorite: true },
    { hue: 270, label: "court-mage",         meta: "Mages · 1024×1024 · 어제" },
    { hue: 200, label: "elf-envoy",          meta: "Mages · 1024×1024 · 어제" },
    { hue: 80,  label: "northern-miner",     meta: "Mages · 1024×1024 · 2일 전", favorite: true },
    { hue: 0,   label: "rusty-blood-soldier",meta: "Mages · 1024×1024 · 2일 전" },
    { hue: 320, label: "shadow-priest",      meta: "Mages · 1024×1024 · 3일 전" },
    { hue: 180, label: "ice-witch",          meta: "Cryo · 1024×1024 · 3일 전" },
    { hue: 50,  label: "scribe-officer",     meta: "Mages · 1024×1024 · 4일 전" },
    { hue: 220, label: "harbor-captain",     meta: "Mages · 1024×1024 · 5일 전" },
    { hue: 130, label: "swamp-druid",        meta: "Cryo · 1024×1024 · 5일 전", favorite: true },
  ];
  const videos = [
    { hue: 270, label: "court-mage-loop",   meta: "Mages · 1080×1920 · 5초 · 어제", favorite: true },
    { hue: 30,  label: "engineer-walk",     meta: "Mages · 1080×1920 · 6초 · 2일 전" },
    { hue: 200, label: "elf-envoy-turn",    meta: "Mages · 1080×1920 · 4초 · 3일 전" },
  ];
  const texts = [
    { name: "에르난트 그라스벨 — 캐릭터 설정", project: "Mages", lines: 184, time: "5분 전", tag: "세계관" },
    { name: "북방 변경 광산 도시국가",          project: "Mages", lines: 56,  time: "1시간 전", tag: "세계관" },
    { name: "court-mage SDXL prompt",         project: "Mages", lines: 12,  time: "어제",     tag: "프롬프트" },
    { name: "Rusty Blood 시대 연표",           project: "Mages", lines: 41,  time: "어제",     tag: "세계관" },
    { name: "Cryo 캐릭터 톤 가이드",            project: "Cryo",  lines: 28,  time: "3일 전",   tag: "시스템" },
  ];

  const tabs = [
    { k: "generated_img", l: "생성된 이미지", c: 124 },
    { k: "uploaded_img",  l: "업로드된 이미지", c: 18 },
    { k: "video",         l: "영상", c: 7 },
    { k: "text_written",  l: "직접 작성 텍스트", c: 32 },
    { k: "text_generated",l: "생성된 텍스트", c: 218 },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">내 컨텐츠</h1>
          <p className="page-sub">프로젝트에서 생성·업로드된 모든 자산. 즐겨찾기 · 태그 · 프로젝트별 필터링.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <div style={{
              display: "inline-flex", padding: 3, borderRadius: 6,
              background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)",
            }}>
              <button onClick={() => setView("grid")} style={{
                padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12,
                background: view === "grid" ? "var(--bg-surface)" : "transparent",
                color: view === "grid" ? "var(--text-primary)" : "var(--text-tertiary)",
                boxShadow: view === "grid" ? "var(--shadow-1)" : "none",
                display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500,
              }}><Icl.Grid size={12}/> 그리드</button>
              <button onClick={() => setView("list")} style={{
                padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12,
                background: view === "list" ? "var(--bg-surface)" : "transparent",
                color: view === "list" ? "var(--text-primary)" : "var(--text-tertiary)",
                boxShadow: view === "list" ? "var(--shadow-1)" : "none",
                display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500,
              }}><Icl.Menu size={12}/> 목록</button>
            </div>
            <button className="btn btn--secondary"><Icl.ArrowDown /> 내보내기</button>
            <button className="btn btn--primary"><Icl.Plus /> 업로드</button>
          </div>
        )}
      </div>

      {/* Search row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "16px 0 14px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: mobile ? 1 : 0, minWidth: mobile ? 0 : 320 }}>
          <input className="input" placeholder="컨텐츠 검색 · 파일명 / 프롬프트 / 메타데이터" style={{ paddingLeft: 32 }}/>
          <span style={{ position: "absolute", left: 10, top: 8, color: "var(--text-tertiary)" }}>
            <Icl.Search size={14}/>
          </span>
        </div>
        {!mobile && (
          <>
            <button className="btn btn--secondary btn--sm"><Icl.Filter /> 프로젝트</button>
            <button className="btn btn--secondary btn--sm"><Icl.Tag /> 태그</button>
            <button className="btn btn--secondary btn--sm"><Icl.StarFill /> 즐겨찾기만</button>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: "auto" }}>1,247개 중 124개 표시</span>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ overflowX: "auto", marginBottom: 18 }}>
        {tabs.map((t) => (
          <div key={t.k} className={"tab" + (tab === t.k ? " is-active" : "")} onClick={() => setTab(t.k)}>
            <span>{t.l}</span>
            <span className="tab__count">{t.c}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "200px 1fr", gap: 18, alignItems: "start" }}>
        {/* Filter rail */}
        {!mobile && (
          <aside style={{ position: "sticky", top: 12 }}>
            <FilterGroup title="프로젝트">
              <FilterRow label="모두" count={1247} active/>
              <FilterRow label="Mages" count={418} color="var(--tag-world)"/>
              <FilterRow label="Cryo" count={216} color="#2F77E4"/>
              <FilterRow label="Astral Pact" count={124} color="#BE7415"/>
              <FilterRow label="기타" count={489}/>
            </FilterGroup>
            <FilterGroup title="태그">
              <FilterRow label="세계관" count={64} color="var(--tag-world)"/>
              <FilterRow label="시스템 프롬프트" count={28} color="var(--tag-system)"/>
              <FilterRow label="캐릭터" count={148}/>
              <FilterRow label="배경" count={42}/>
              <FilterRow label="러프 스케치" count={18}/>
            </FilterGroup>
            <FilterGroup title="크기">
              <FilterRow label="1024×1024" count={92}/>
              <FilterRow label="1024×1536" count={24}/>
              <FilterRow label="2048×2048" count={8}/>
            </FilterGroup>
            <FilterGroup title="기간">
              <FilterRow label="최근 7일" count={31}/>
              <FilterRow label="최근 30일" count={88}/>
              <FilterRow label="모두" count={124}/>
            </FilterGroup>
          </aside>
        )}

        {/* Main panel */}
        <section>
          {tab === "generated_img" && <ImageGrid mobile={mobile} items={generatedImgs} kind="image"/>}
          {tab === "uploaded_img"  && <ImageGrid mobile={mobile} items={generatedImgs.slice(0, 6).map((x) => ({ ...x, label: "upload-" + x.label, favorite: false }))} kind="image"/>}
          {tab === "video"         && <ImageGrid mobile={mobile} items={videos} kind="video"/>}
          {(tab === "text_written" || tab === "text_generated") && (
            <div className="card">
              {texts.map((t, i) => (
                <div key={i} style={{
                  padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  borderBottom: i < texts.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}>
                  <div style={{ color: "var(--text-tertiary)", flex: "0 0 auto" }}><Icl.Doc /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                      {t.project} · {t.lines}줄 · {t.time}
                    </div>
                  </div>
                  <span className="tag" style={{
                    background: t.tag === "세계관" ? "var(--tag-world)" : t.tag === "시스템" ? "var(--tag-system)" : "var(--tag-project)",
                  }}>{t.tag}</span>
                  {!mobile && <button className="btn btn--ghost btn--icon btn--sm"><Icl.Dots /></button>}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <button className="btn btn--secondary btn--icon btn--sm"><Icl.ChevronLeft /></button>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={"btn btn--sm " + (n === 1 ? "btn--primary" : "btn--ghost")} style={{ minWidth: 30 }}>
                {n}
              </button>
            ))}
            <span style={{ color: "var(--text-tertiary)", fontSize: 12, padding: "0 4px" }}>… 13</span>
            <button className="btn btn--secondary btn--icon btn--sm"><Icl.ChevronRight /></button>
          </div>
        </section>
      </div>
    </div>
  );
}

Object.assign(window, { ContentLibraryPage });
