// page-project-detail.jsx — Project detail page (desktop + mobile)
// Tabs: pipelines / worldview / prompts / images / history / chat history

const { useState: useStateP1 } = React;
const Ip1 = window.Icon;

function Tab({ active, count, children, onClick }) {
  return (
    <div className={"tab" + (active ? " is-active" : "")} onClick={onClick}>
      <span>{children}</span>
      {count != null && <span className="tab__count">{count}</span>}
    </div>
  );
}

function Pill({ tone = "default", icon, children }) {
  return (
    <span className={"chip" + (tone !== "default" ? " chip--" + tone : "")}>
      {icon}
      {children}
    </span>
  );
}

// Generic tinted rectangle placeholder (theme-aware via .thumb-tile)
function Placeholder({ w = "100%", h = 120, label = "", hue = 250 }) {
  return (
    <div className="thumb-tile" style={{
      width: w, height: h,
      borderRadius: 6,
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-mono)",
      fontSize: 11,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      "--h": hue,
    }}>{label}</div>
  );
}

function ProjectHero({ compact, mobile }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
      <div style={{
        width: mobile ? 56 : 72, height: mobile ? 56 : 72,
        borderRadius: "var(--r-3)",
        background: "linear-gradient(135deg, #7B4DD8 0%, #5B5BD6 50%, #2F77E4 100%)",
        display: "grid", placeItems: "center",
        color: "white", fontWeight: 700, fontSize: mobile ? 22 : 26,
        letterSpacing: "-0.02em",
        boxShadow: "var(--shadow-2), inset 0 1px 0 rgba(255,255,255,0.2)",
        flex: "0 0 auto",
      }}>M</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="page-title">
          Mages
          <button className="btn btn--ghost btn--icon btn--sm" aria-label="favorite">
            <Ip1.StarFill style={{ color: "var(--warning-9)" }} />
          </button>
        </h1>
        <p className="page-sub">동방·북방 마법 정치 / 개척 시대 세계관 · 캐릭터 NPC 생성</p>
        <div className="meta-row">
          <span className="tag" style={{ background: "var(--tag-world)" }}>
            <span style={{ width: 6, height: 6, background: "white", borderRadius: 2, display: "inline-block", marginRight: 6, opacity: 0.85 }}/>
            mages
          </span>
          <Pill icon={<Ip1.Image size={12}/>} >이미지 4</Pill>
          <Pill icon={<Ip1.Doc size={12}/>} >프롬프트 1</Pill>
          <Pill icon={<Ip1.Clock size={12}/>} >작업 4</Pill>
          <Pill icon={<Ip1.Pipe size={12}/>} >파이프라인 1</Pill>
        </div>
      </div>
      {!mobile && (
        <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
          <button className="btn btn--secondary"><Ip1.Edit /> 편집</button>
          <button className="btn btn--secondary"><Ip1.Grid /> 작업판 보기</button>
          <button className="btn btn--danger btn--icon" aria-label="삭제"><Ip1.Trash /></button>
        </div>
      )}
    </div>
  );
}

// ---- Pipelines tab content ----
function PipelinesTabContent({ mobile }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: 0, maxWidth: 560 }}>
          작업판 A → B → C 직선 실행. 단계의 출력 타입이 다음 단계의 입력 타입과 일치하면 자동 주입됩니다.
        </p>
        <button className="btn btn--primary"><Ip1.Plus /> 새 파이프라인</button>
      </div>

      {/* Pipeline card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "var(--r-2)",
            background: "var(--accent-3)", color: "var(--accent-11)",
            display: "grid", placeItems: "center",
          }}><Ip1.Pipe /></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>NPC 생성</span>
              <span className="chip chip--accent chip--tag">3단계</span>
              <span className="chip chip--tag" style={{ background: "transparent", border: "none", padding: 0, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                월드 · 캐릭터 → 외형 → 이미지
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>마지막 실행 5분 전 · 평균 2분 35초</div>
          </div>
          {!mobile && (
            <>
              <button className="btn btn--success btn--sm"><Ip1.Play size={12}/> 실행</button>
              <button className="btn btn--secondary btn--sm"><Ip1.Edit /> 편집</button>
              <button className="btn btn--ghost btn--icon btn--sm"><Ip1.Dots /></button>
            </>
          )}
        </div>
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          {[
            { n: 1, kind: "GPT Chat", desc: "캐릭터 생성", input: "text", output: "text" },
            { n: 2, kind: "GPT Chat", desc: "캐릭터 외형 프롬프트", input: "text", output: "text" },
            { n: 3, kind: "GPT Image", desc: "캐릭터 이미지 생성", input: "text", output: "image" },
          ].map((s, i, arr) => (
            <React.Fragment key={i}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--r-2)",
                background: "var(--bg-tint)",
                flex: "0 0 auto",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "var(--accent-9)", color: "white",
                  display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}>{s.n}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{s.kind}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.desc}</div>
                </div>
              </div>
              {i < arr.length - 1 && (
                <span style={{ color: "var(--text-tertiary)", display: "flex", alignItems: "center" }}>
                  <Ip1.ArrowRight size={14}/>
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Empty hint card */}
      <div style={{
        border: "1px dashed var(--border-default)",
        borderRadius: "var(--r-3)",
        padding: 16,
        display: "flex", alignItems: "center", gap: 12,
        color: "var(--text-tertiary)",
        fontSize: 13,
      }}>
        <Ip1.Plus />
        <span>새 파이프라인을 추가해 작업판을 순서대로 실행하세요.</span>
      </div>
    </>
  );
}

// ---- Worldview tab (so canvas shows multiple states) ----
function WorldviewTabContent({ mobile }) {
  const docs = [
    { name: "Mages 세계관 개요", tag: "세계관", color: "var(--tag-world)", lines: 184, time: "3일 전" },
    { name: "캐릭터 톤 — 시스템 프롬프트", tag: "시스템", color: "var(--tag-system)", lines: 32, time: "1일 전" },
    { name: "북방 변경 도시국가", tag: "세계관", color: "var(--tag-world)", lines: 56, time: "5시간 전" },
    { name: "Rusty Blood 시대 연표", tag: "세계관", color: "var(--tag-world)", lines: 41, time: "2일 전" },
  ];
  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <input className="input" placeholder="문서 검색…" style={{ paddingLeft: 32 }} />
          <span style={{ position: "absolute", left: 10, top: 8, color: "var(--text-tertiary)" }}>
            <Ip1.Search size={14}/>
          </span>
        </div>
        <button className="btn btn--secondary"><Ip1.Filter /> 태그</button>
        <div style={{ flex: 1 }}/>
        <button className="btn btn--primary"><Ip1.Plus /> 새 문서</button>
      </div>
      <div className="card">
        {docs.map((d, i) => (
          <div key={i} style={{
            padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12,
            borderBottom: i < docs.length - 1 ? "1px solid var(--border-subtle)" : "none",
            cursor: "pointer",
          }} onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-tint)"} onMouseOut={(e) => e.currentTarget.style.background = ""}>
            <div style={{ flex: "0 0 auto", color: "var(--text-tertiary)" }}><Ip1.Doc /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13.5 }}>{d.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{d.lines}줄 · {d.time}</div>
            </div>
            <span className="tag" style={{ background: d.color }}>
              <span style={{ width: 6, height: 6, background: "white", borderRadius: 2, display: "inline-block", marginRight: 6, opacity: 0.85 }}/>
              {d.tag}
            </span>
            {!mobile && <button className="btn btn--ghost btn--icon btn--sm"><Ip1.Dots /></button>}
          </div>
        ))}
      </div>
    </>
  );
}

// ---- Pipeline history tab ----
function PipelineHistoryTabContent({ mobile }) {
  const runs = [
    { name: "NPC 생성", status: "완료", input: "남성 캐릭터", time: "2026. 5. 24. 오후 4:47:29", steps: [1, 1, 1] },
    { name: "NPC 생성", status: "완료", input: "여성 마법사", time: "2026. 5. 24. 오전 11:32:04", steps: [1, 1, 1] },
    { name: "NPC 생성", status: "실행중", input: "북방 광부 장교", time: "지금", steps: [1, 1, 0], progress: 67 },
    { name: "NPC 생성", status: "실패", input: ".", time: "2026. 5. 24. 오전 5:41:32", steps: [1, 0.5, 0] },
    { name: "NPC 생성", status: "완료", input: "엘프 사절단", time: "2026. 5. 23. 오후 8:12:55", steps: [1, 1, 1] },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {runs.map((r, i) => {
        const tone = r.status === "완료" ? "success" : r.status === "실행중" ? "info" : r.status === "실패" ? "danger" : "default";
        return (
          <div key={i} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</span>
              <span className={"chip chip--" + tone}>
                {r.status === "실행중" && <span className="chip__dot" style={{ background: "currentColor", animation: "pulse 1.4s infinite" }}/>}
                {r.status}
              </span>
              <div style={{ flex: 1 }}/>
              <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{r.time}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{r.input}</span>
              <div style={{ flex: 1 }}/>
              <div style={{ display: "flex", gap: 4 }}>
                {r.steps.map((v, j) => (
                  <div key={j} style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: v === 1 ? "var(--success-9)" : v === 0.5 ? "var(--danger-9)" : "var(--bg-subtle)",
                    color: v >= 0.5 ? "white" : "var(--text-tertiary)",
                    border: "1px solid " + (v === 1 ? "var(--success-9)" : v === 0.5 ? "var(--danger-9)" : "var(--border-default)"),
                    display: "grid", placeItems: "center",
                    fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                  }}>
                    {v === 1 ? <Ip1.Check size={11}/> : (j + 1)}
                  </div>
                ))}
              </div>
              {r.progress != null && (
                <div style={{ width: 80 }}>
                  <div style={{ height: 4, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: r.progress + "%", height: "100%", background: "var(--accent-9)" }}/>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)", textAlign: "right" }}>{r.progress}%</div>
                </div>
              )}
              <a href="#" style={{ fontSize: 12.5, color: "var(--accent-11)", textDecoration: "none", fontWeight: 500 }}>상세 →</a>
            </div>
          </div>
        );
      })}
      <style>{"@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}"}</style>
    </div>
  );
}

function ProjectDetailPage({ mobile, defaultTab = "pipelines", onTabChange }) {
  const [tab, setTab] = useStateP1(defaultTab);

  React.useEffect(() => { setTab(defaultTab); }, [defaultTab]);

  const tabs = [
    { k: "pipelines", l: "파이프라인" },
    { k: "worldview", l: "세계관", c: 4 },
    { k: "prompts", l: "프롬프트 데이터", c: 1 },
    { k: "images", l: "이미지", c: 4 },
    { k: "history", l: "파이프라인 히스토리", c: 5 },
    { k: "chat", l: "대화 히스토리" },
  ];

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Ip1.ChevronLeft size={12}/> 프로젝트 목록
      </a>
      <ProjectHero mobile={mobile} />
      {mobile && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button className="btn btn--primary" style={{ flex: 1 }}><Ip1.Play /> 실행</button>
          <button className="btn btn--secondary"><Ip1.Edit /></button>
          <button className="btn btn--secondary"><Ip1.Grid /></button>
        </div>
      )}
      <div className="tabs" style={{ overflowX: "auto", marginBottom: 20 }}>
        {tabs.map((t) => (
          <Tab key={t.k} active={tab === t.k} count={t.c} onClick={() => { setTab(t.k); onTabChange && onTabChange(t.k); }}>
            {t.l}
          </Tab>
        ))}
      </div>
      {tab === "pipelines" && <PipelinesTabContent mobile={mobile} />}
      {tab === "worldview" && <WorldviewTabContent mobile={mobile} />}
      {tab === "history" && <PipelineHistoryTabContent mobile={mobile} />}
      {tab === "prompts" && <WorldviewTabContent mobile={mobile} />}
      {tab === "images" && <ImagesTabContent mobile={mobile}/>}
      {tab === "chat" && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
          저장된 대화가 없습니다.
        </div>
      )}
    </div>
  );
}

function ImagesTabContent({ mobile }) {
  const imgs = [
    { hue: 30, label: "frontier engineer" },
    { hue: 270, label: "court mage" },
    { hue: 200, label: "elf envoy" },
    { hue: 80, label: "northern miner" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12 }}>
      {imgs.map((im, i) => (
        <div key={i} className="card" style={{ padding: 8 }}>
          <Placeholder h={mobile ? 130 : 180} hue={im.hue} label={im.label} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px 4px" }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>1024×1024</span>
            <button className="btn btn--ghost btn--icon btn--sm"><Ip1.Dots /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ProjectDetailPage });
