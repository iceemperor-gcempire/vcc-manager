// page-workboard-list.jsx — 작업판 카탈로그 (사이드바 "작업판" 클릭 시)
// Browsable catalog grouped by kind. Cards show last-run, popularity, server.

const { useState: useStateWl } = React;
const Iwl = window.Icon;

const KIND_META = {
  "gpt-chat":  { icon: <Iwl.Robot size={14}/>, label: "텍스트 생성", color: "var(--info-11)",    bg: "var(--info-3)" },
  "gpt-image": { icon: <Iwl.Image size={14}/>, label: "이미지 (API)", color: "#5B2DBF",          bg: "#F1ECFE" },
  "sdxl":      { icon: <Iwl.Cube size={14}/>,  label: "SDXL",         color: "var(--accent-11)", bg: "var(--accent-3)" },
  "i2v":       { icon: <Iwl.Play size={14}/>,  label: "영상 (I2V)",   color: "var(--warning-11)", bg: "var(--warning-3)" },
  "lora":      { icon: <Iwl.Magic size={14}/>, label: "LoRA 학습",     color: "#0F7A40",          bg: "var(--success-3)" },
};

function WorkboardCard({ wb, onClick }) {
  const k = KIND_META[wb.kind];
  return (
    <div className="card" style={{
      padding: 14, cursor: "pointer", transition: "all 150ms",
      display: "flex", flexDirection: "column", gap: 10,
    }}
      onClick={onClick}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.boxShadow = "var(--shadow-2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "var(--r-2)",
          background: k.bg, color: k.color,
          display: "grid", placeItems: "center", flex: "0 0 auto",
        }}>{k.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wb.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
            {k.label} · {wb.io}
          </div>
        </div>
        {wb.favorite && <Iwl.StarFill size={13} style={{ color: "var(--warning-9)", flex: "0 0 auto" }}/>}
      </div>

      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, textWrap: "pretty", minHeight: 32 }}>
        {wb.desc}
      </div>

      {/* Stats row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingTop: 10, borderTop: "1px solid var(--border-subtle)",
        fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: wb.status === "online" ? "var(--success-9)" : "var(--warning-9)" }}/>
          {wb.server}
        </span>
        <span style={{ flex: 1 }}/>
        <span>{wb.runs}회</span>
      </div>
      {wb.lastRun && (
        <div style={{
          marginTop: -6,
          fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4,
        }}>
          <Iwl.Clock size={11}/> 마지막 실행 {wb.lastRun}
        </div>
      )}
    </div>
  );
}

function WorkboardListPage({ mobile, onOpenWorkboard }) {
  const [kindFilter, setKindFilter] = useStateWl("all");
  const [view, setView] = useStateWl("grid");

  const workboards = [
    { name: "SDXL T2I — LoRA",       kind: "sdxl",     io: "text → image", desc: "Anime / 캐릭터 일러스트. anime6b 업스케일 자동 적용.",  server: "comfy-01", status: "online", runs: 412, lastRun: "5분 전", favorite: true },
    { name: "SDXL T2I — Realistic",  kind: "sdxl",     io: "text → image", desc: "RealVisXL 기반 사실적 인물·환경.",                       server: "comfy-01", status: "online", runs: 187, lastRun: "어제" },
    { name: "GPT Image — 1024",      kind: "gpt-image",io: "text → image", desc: "OpenAI gpt-image-1, 1024×1024 빠른 컨셉 드래프트.",     server: "openai",   status: "online", runs: 187, lastRun: "1시간 전" },
    { name: "GPT Image — HD",        kind: "gpt-image",io: "text → image", desc: "고화질 컨셉 드래프트 (1024×1536).",                       server: "openai",   status: "online", runs: 64,  lastRun: "어제" },
    { name: "GPT Chat — 캐릭터 설정", kind: "gpt-chat", io: "text → text",  desc: "월드/캐릭터 시스템 프롬프트 기반 캐릭터 시트 생성.",     server: "openai",   status: "online", runs: 248, lastRun: "10분 전", favorite: true },
    { name: "GPT Chat — SDXL 변환",   kind: "gpt-chat", io: "text → text",  desc: "한국어 캐릭터 묘사를 SDXL 프롬프트로 변환.",            server: "openai",   status: "online", runs: 156, lastRun: "30분 전" },
    { name: "Gemini Chat — 시나리오", kind: "gpt-chat", io: "text → text",  desc: "긴 호흡의 시나리오 단편 생성. 2.5 Pro 모델 사용.",      server: "gemini",   status: "online", runs: 41,  lastRun: "3일 전" },
    { name: "Comfy I2V — 4초",       kind: "i2v",      io: "image → video",desc: "이미지에서 4초 짧은 영상 클립. 1080×1920.",             server: "comfy-02", status: "online", runs: 64,  lastRun: "어제" },
    { name: "Comfy I2V — 10초",      kind: "i2v",      io: "image → video",desc: "10초 길이 영상. GPU 점유 시간 김.",                       server: "comfy-02", status: "online", runs: 12,  lastRun: "1주 전" },
    { name: "LoRA 학습 — 캐릭터",     kind: "lora",     io: "image → lora", desc: "이미지 30+장으로 캐릭터 LoRA 학습.",                     server: "comfy-01", status: "online", runs: 8,   lastRun: "2주 전" },
    { name: "LoRA 학습 — 스타일",     kind: "lora",     io: "image → lora", desc: "스타일 LoRA 학습 — 15+장 권장.",                          server: "comfy-01", status: "online", runs: 3,   lastRun: "3주 전" },
    { name: "ComfyUI — 분기",        kind: "sdxl",     io: "text → image", desc: "조건 분기 워크플로우 — 옷차림/포즈 변형 자동.",           server: "comfy-01", status: "online", runs: 28,  lastRun: "1일 전" },
  ];

  const kinds = [
    { v: "all",       l: "모두",     c: workboards.length },
    { v: "sdxl",      l: "SDXL",     c: workboards.filter(w => w.kind === "sdxl").length },
    { v: "gpt-image", l: "GPT Image", c: workboards.filter(w => w.kind === "gpt-image").length },
    { v: "gpt-chat",  l: "텍스트",   c: workboards.filter(w => w.kind === "gpt-chat").length },
    { v: "i2v",       l: "영상",     c: workboards.filter(w => w.kind === "i2v").length },
    { v: "lora",      l: "LoRA",     c: workboards.filter(w => w.kind === "lora").length },
  ];
  const filtered = kindFilter === "all" ? workboards : workboards.filter((w) => w.kind === kindFilter);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">작업판</h1>
          <p className="page-sub">한 번의 호출로 실행하는 단위. 파이프라인의 단계로도 사용됩니다.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary"><Iwl.Search /> 작업판 검색</button>
            <button className="btn btn--primary"><Iwl.Plus /> 새 작업판</button>
          </div>
        )}
      </div>

      {/* Kind chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
        {kinds.map((k) => (
          <button key={k.v} onClick={() => setKindFilter(k.v)} className="chip" style={{
            cursor: "pointer", whiteSpace: "nowrap",
            background: kindFilter === k.v ? "var(--accent-9)" : "var(--bg-surface)",
            color: kindFilter === k.v ? "white" : "var(--text-primary)",
            border: "1px solid " + (kindFilter === k.v ? "var(--accent-9)" : "var(--border-default)"),
            height: 28, padding: "0 12px", fontSize: 12.5, fontWeight: 500,
          }}>
            {k.l}
            <span style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              opacity: 0.85, marginLeft: 4,
              color: kindFilter === k.v ? "rgba(255,255,255,0.85)" : "var(--text-tertiary)",
            }}>{k.c}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 12,
      }}>
        {filtered.map((wb) => (
          <WorkboardCard key={wb.name} wb={wb} onClick={() => onOpenWorkboard && onOpenWorkboard(wb.name)}/>
        ))}
      </div>

      {/* Empty state if filter narrows everything out */}
      {filtered.length === 0 && (
        <div style={{
          padding: 40,
          border: "1px dashed var(--border-strong)",
          borderRadius: 12,
          textAlign: "center",
          color: "var(--text-tertiary)",
        }}>
          <Iwl.Cube size={32} style={{ margin: "0 auto 12px", opacity: 0.6 }}/>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>이 카테고리에 작업판이 없습니다</div>
          <div style={{ fontSize: 12.5, marginBottom: 16 }}>관리자에게 요청하거나 다른 카테고리를 확인해 보세요.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { WorkboardListPage });
