// page-history.jsx — Global "작업 히스토리" (Work History) page
// One unified chronological feed across every generation type, filtered by a
// segmented control: 전체 / 파이프라인 / 이미지 / 영상 / 텍스트.
// Each row adapts its visual + meta to the item's type, but shares one layout.

const { useState: useStateHist } = React;
const Ih = window.Icon;

// ---- status chip --------------------------------------------------------
function HistStatus({ status }) {
  const map = {
    done:    { tone: "success", label: "완료" },
    running: { tone: "info",    label: "실행 중" },
    error:   { tone: "danger",  label: "실패" },
    queued:  { tone: "default", label: "대기" },
  };
  const s = map[status] || map.done;
  return (
    <span className={"chip chip--tag" + (s.tone !== "default" ? " chip--" + s.tone : "")}>
      {status === "running" && <span className="chip__dot" style={{ background: "currentColor", animation: "pulse 1.4s infinite" }}/>}
      {status === "done"  && <Ih.Check size={10}/>}
      {status === "error" && <Ih.X size={10}/>}
      {s.label}
    </span>
  );
}

// ---- left visual per type ----------------------------------------------
function HistVisual({ item, mobile }) {
  const size = mobile ? 48 : 56;
  if (item.type === "image" || item.type === "video") {
    return (
      <div style={{ position: "relative", width: size, height: size, flex: "0 0 auto" }}>
        <div className="thumb-tile" style={{ width: size, height: size, borderRadius: 8, "--h": item.hue }}/>
        {item.type === "video" && (
          <>
            <div style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              color: "white", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}><Ih.Play size={16}/></div>
            <span style={{
              position: "absolute", bottom: 3, right: 3,
              fontSize: 9, fontFamily: "var(--font-mono)", color: "white",
              background: "rgba(0,0,0,0.55)", padding: "1px 4px", borderRadius: 3,
            }}>{item.duration}</span>
          </>
        )}
        {item.type === "image" && item.count > 1 && (
          <span style={{
            position: "absolute", bottom: 3, right: 3,
            fontSize: 9, fontFamily: "var(--font-mono)", color: "white",
            background: "rgba(0,0,0,0.55)", padding: "1px 4px", borderRadius: 3,
          }}>×{item.count}</span>
        )}
      </div>
    );
  }
  // pipeline / text → icon tile
  const icon = item.type === "pipeline" ? <Ih.Pipe size={20}/> : <Ih.Type size={20}/>;
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flex: "0 0 auto",
      background: "var(--accent-3)", color: "var(--accent-11)",
      display: "grid", placeItems: "center",
    }}>{icon}</div>
  );
}

// ---- one row ------------------------------------------------------------
const TYPE_LABEL = { pipeline: "파이프라인", image: "이미지", video: "영상", text: "텍스트" };

function HistoryRow({ item, mobile, onOpenImage }) {
  // sub-meta string per type
  const sub =
    item.type === "image"    ? `${item.project} · ${item.model} · ${item.res} · ${item.count}장` :
    item.type === "video"    ? `${item.project} · ${item.model} · ${item.res} · ${item.duration}` :
    item.type === "text"     ? `${item.project} · ${item.model} · ${item.tokens.toLocaleString()} 토큰` :
                               `${item.project} · ${item.steps.length}단계 · ${item.input}`;

  const clickable = item.type === "image" || item.type === "video";

  return (
    <div className="card hist-row" style={{ padding: mobile ? 10 : "12px 14px", cursor: clickable ? "pointer" : "default" }}
      onClick={clickable ? () => onOpenImage && onOpenImage(item) : undefined}>
      <div style={{ display: "flex", gap: mobile ? 10 : 14, alignItems: "flex-start" }}>
        <HistVisual item={item} mobile={mobile}/>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: mobile ? 13 : 13.5 }}>{item.title}</span>
            <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--text-tertiary)" }}>
              {TYPE_LABEL[item.type]}
            </span>
            <HistStatus status={item.status}/>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3 }}>{sub}</div>

          {/* type-specific extra row */}
          {item.type === "text" && (
            <div style={{
              marginTop: 8, fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              background: "var(--bg-tint)", borderRadius: 6, padding: "8px 10px",
            }}>{item.preview}</div>
          )}

          {item.type === "pipeline" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {item.steps.map((v, j) => (
                  <div key={j} style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: v === 1 ? "var(--success-9)" : v === 0.5 ? "var(--danger-9)" : "var(--bg-subtle)",
                    color: v >= 0.5 ? "white" : "var(--text-tertiary)",
                    border: "1px solid " + (v === 1 ? "var(--success-9)" : v === 0.5 ? "var(--danger-9)" : "var(--border-default)"),
                    display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
                  }}>{v === 1 ? <Ih.Check size={10}/> : (j + 1)}</div>
                ))}
              </div>
              {item.progress != null && (
                <div style={{ width: 90 }}>
                  <div style={{ height: 4, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: item.progress + "%", height: "100%", background: "var(--accent-9)" }}/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* image / video → 작업 재개 액션 (두 가지) */}
          {(item.type === "image" || item.type === "video") && item.status !== "error" && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn btn--secondary btn--sm" onClick={(e) => e.stopPropagation()} title="같은 작업을 같은 설정으로 이어서 진행">
                <Ih.Refresh size={12}/> 계속하기
              </button>
              <button className="btn btn--secondary btn--sm" onClick={(e) => e.stopPropagation()} title="이 결과를 입력으로 다른 작업판으로 전환">
                <Ih.ArrowRight size={12}/> 다른 작업
              </button>
            </div>
          )}
        </div>

        {/* right meta */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flex: "0 0 auto" }}>
          <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{item.time}</span>
          {!mobile && (
            <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12, color: "var(--accent-11)", textDecoration: "none", fontWeight: 500 }}>
              {item.type === "pipeline" ? "상세 →" : item.type === "text" ? "전문 보기 →" : "열기 →"}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- data ---------------------------------------------------------------
const HIST_ITEMS = [
  { type: "image", title: "GPT Image — 1024", project: "Mages", model: "gpt-image-1", res: "1024×1024", count: 4, status: "done", time: "방금", hue: 270 },
  { type: "pipeline", title: "NPC 생성", project: "Mages", input: "북방 광부 장교", steps: [1, 1, 0], progress: 67, status: "running", time: "지금" },
  { type: "text", title: "GPT Chat — 캐릭터 설정", project: "Mages", model: "gpt-4o", tokens: 1284, status: "done", time: "5분 전",
    preview: "에르난트 그라스벨 / 남성 · 북방 출신 · 전직 공병 장교. 마법과 정치의 긴장 사이에서 단단한 손과 차가운 시선을 가진 1세대 개척 기술자." },
  { type: "video", title: "Comfy I2V — 4초", project: "Mages", model: "SVD-XT", res: "1024×576", duration: "4초", status: "done", time: "12분 전", hue: 210 },
  { type: "image", title: "SDXL T2I — LoRA", project: "Cryo", model: "DreamShaper XL", res: "1024×1024", count: 8, status: "done", time: "32분 전", hue: 30 },
  { type: "text", title: "GPT Chat — 세계관 확장", project: "Cryo", model: "gpt-4o", tokens: 642, status: "done", time: "1시간 전",
    preview: "북방 변경 도시국가의 광맥 분쟁과 마도 길드 사이의 위태로운 균형. Rusty Blood 시대 이후 재편된 세 개의 세력권에 대한 개요." },
  { type: "video", title: "Comfy I2V — 6초", project: "Cryo", model: "SVD-XT", res: "768×768", duration: "6초", status: "error", time: "2시간 전", hue: 80 },
  { type: "pipeline", title: "배경 시리즈 v3", project: "Cryo", input: "북방 항구 야경", steps: [1, 1, 1], status: "done", time: "3시간 전" },
  { type: "image", title: "GPT Image — 1024", project: "Mages", model: "gpt-image-1", res: "1024×1024", count: 2, status: "done", time: "어제 20:12", hue: 200 },
  { type: "text", title: "GPT Chat — 대사 생성", project: "Astral Pact", model: "gpt-4o-mini", tokens: 318, status: "done", time: "어제 16:40",
    preview: "엘프 사절단 단장의 첫 대면 대사 세트. 격식과 경계심이 공존하는 톤으로, 인간 측 개척자에 대한 미묘한 우월감을 담아 작성." },
  { type: "pipeline", title: "NPC 생성", project: "Mages", input: ".", steps: [1, 0.5, 0], status: "error", time: "어제 05:41" },
];

// ---- page ---------------------------------------------------------------
function WorkHistoryPage({ mobile, onOpenImage }) {
  const [seg, setSeg] = useStateHist("all");

  const counts = {
    all: HIST_ITEMS.length,
    pipeline: HIST_ITEMS.filter(i => i.type === "pipeline").length,
    image: HIST_ITEMS.filter(i => i.type === "image").length,
    video: HIST_ITEMS.filter(i => i.type === "video").length,
    text: HIST_ITEMS.filter(i => i.type === "text").length,
  };
  const segs = [
    { k: "all", l: "전체" },
    { k: "pipeline", l: "파이프라인" },
    { k: "image", l: "이미지" },
    { k: "video", l: "영상" },
    { k: "text", l: "텍스트" },
  ];
  const visible = seg === "all" ? HIST_ITEMS : HIST_ITEMS.filter(i => i.type === seg);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <h1 className="page-title">작업 히스토리</h1>
          <p className="page-sub" style={{ textWrap: "pretty" }}>파이프라인 · 이미지 · 영상 · 텍스트 생성 기록을 한 곳에서. 최신순.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
            <button className="btn btn--secondary"><Ih.Filter /> 프로젝트</button>
            <button className="btn btn--secondary"><Ih.Clock /> 기간</button>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14, position: "relative", maxWidth: mobile ? "none" : 360 }}>
        <input className="input" placeholder="히스토리 검색…" style={{ paddingLeft: 32, width: "100%" }} />
        <span style={{ position: "absolute", left: 10, top: 8, color: "var(--text-tertiary)" }}><Ih.Search size={14}/></span>
      </div>

      {/* Segmented control */}
      <div className="tabs" style={{ overflowX: "auto", marginBottom: 18 }}>
        {segs.map((s) => (
          <div key={s.k} className={"tab" + (seg === s.k ? " is-active" : "")} onClick={() => setSeg(s.k)}>
            <span>{s.l}</span>
            <span className="tab__count">{counts[s.k]}</span>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((item, i) => (
          <HistoryRow key={i} item={item} mobile={mobile} onOpenImage={onOpenImage}/>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        .hist-row { transition: border-color 120ms, background 120ms; }
        .hist-row:hover { border-color: var(--accent-7); }
      `}</style>
    </div>
  );
}

Object.assign(window, { WorkHistoryPage });
