// page-admin-servers.jsx — Admin: Server management + model sync (compact)

const { useState: useStateAs } = React;
const Ias = window.Icon;

const SERVER_TYPES = {
  comfy:    { label: "ComfyUI",  color: "var(--accent-9)",  bg: "var(--accent-3)",  fg: "var(--accent-11)" },
  openai:   { label: "OpenAI",   color: "#10A37F",          bg: "rgba(16,163,127,0.12)", fg: "#0A7C5F" },
  gemini:   { label: "Gemini",   color: "#2F77E4",          bg: "var(--info-3)",    fg: "var(--info-11)" },
  compat:   { label: "Compatible", color: "var(--text-secondary)", bg: "var(--bg-subtle)", fg: "var(--text-primary)" },
};

function ServerCard({ s, expanded, onToggle }) {
  const t = SERVER_TYPES[s.type];
  return (
    <div className="card" style={{ overflow: "hidden", transition: "all 200ms" }}>
      <div onClick={onToggle} style={{
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
        cursor: "pointer",
        background: expanded ? "var(--bg-tint)" : "transparent",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: t.bg, color: t.fg,
          display: "grid", placeItems: "center",
          fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
        }}>{t.label.slice(0, 3)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
            <span className="chip chip--tag" style={{ background: t.bg, color: t.fg, border: "none" }}>{t.label}</span>
            {s.status === "online" && <span className="chip chip--success chip--tag"><span className="chip__dot"/>online</span>}
            {s.status === "degraded" && <span className="chip chip--warning chip--tag"><span className="chip__dot"/>degraded</span>}
            {s.status === "offline" && <span className="chip chip--danger chip--tag"><span className="chip__dot"/>offline</span>}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
            {s.host}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          {s.gpu != null && (
            <div style={{ width: 72 }}>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>GPU</div>
              <div style={{ height: 4, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
                <div style={{ width: s.gpu + "%", height: "100%", background: s.gpu > 75 ? "var(--warning-9)" : "var(--success-9)" }}/>
              </div>
              <div style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", marginTop: 1, fontFamily: "var(--font-mono)" }}>{s.gpu}%</div>
            </div>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>큐</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.queue}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>모델</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.models}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>마지막 동기화</div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", marginTop: 1 }}>{s.lastSync}</div>
          </div>
        </div>

        <button className="btn btn--ghost btn--icon btn--sm" onClick={(e) => { e.stopPropagation(); }}><Ias.Dots /></button>
        <Ias.ChevronDown size={14} style={{ color: "var(--text-tertiary)", transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }}/>
      </div>

      {expanded && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>설치된 모델</span>
            <span className="tab__count">{s.models}</span>
            <span style={{ flex: 1 }}/>
            <button className="btn btn--secondary btn--sm"><Ias.Refresh size={12}/> 동기화</button>
            <button className="btn btn--ghost btn--sm"><Ias.Edit size={12}/> 화이트리스트 편집</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {(s.modelList || []).map((m) => (
              <div key={m.name} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--r-2)",
                background: "var(--bg-tint)",
              }}>
                <Ias.Cube size={14} style={{ color: "var(--text-tertiary)", flex: "0 0 auto" }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{m.kind} · {m.size}</div>
                </div>
                {m.whitelisted ? (
                  <Ias.Check size={14} style={{ color: "var(--success-9)" }}/>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>비활성</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminServersPage({ mobile }) {
  const [expanded, setExpanded] = useStateAs(0);
  const servers = [
    {
      name: "comfy-01", host: "http://192.168.1.51:8188", type: "comfy",
      status: "online", gpu: 84, queue: 2, models: 12, lastSync: "5분 전",
      modelList: [
        { name: "DreamShaper XL v2 Turbo", kind: "SDXL Checkpoint", size: "6.4GB", whitelisted: true },
        { name: "AnimagineXL v3", kind: "SDXL Checkpoint", size: "6.6GB", whitelisted: true },
        { name: "RealVisXL v4", kind: "SDXL Checkpoint", size: "6.4GB", whitelisted: false },
        { name: "anime-line-clean", kind: "LoRA", size: "144MB", whitelisted: true },
        { name: "rusty-blood-era", kind: "LoRA", size: "160MB", whitelisted: true },
        { name: "4xUltraSharp", kind: "Upscaler", size: "67MB", whitelisted: true },
      ],
    },
    {
      name: "comfy-02", host: "http://192.168.1.52:8188", type: "comfy",
      status: "online", gpu: 12, queue: 0, models: 8, lastSync: "12분 전",
    },
    {
      name: "openai", host: "https://api.openai.com/v1", type: "openai",
      status: "online", queue: 1, models: 6, lastSync: "1시간 전",
    },
    {
      name: "gemini", host: "https://generativelanguage.googleapis.com", type: "gemini",
      status: "online", queue: 0, models: 4, lastSync: "1시간 전",
    },
    {
      name: "local-llama", host: "http://192.168.1.60:8080", type: "compat",
      status: "degraded", gpu: 100, queue: 5, models: 2, lastSync: "이상 발생 · 3분 전",
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">서버 관리</h1>
          <p className="page-sub">ComfyUI / OpenAI / Gemini / Compatible 백엔드 등록 및 모델 동기화.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary"><Ias.Refresh /> 모두 동기화</button>
            <button className="btn btn--primary"><Ias.Plus /> 서버 추가</button>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>서버</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>5 <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>등록</span></div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>온라인</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "var(--success-11)" }}>4 / 5</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>총 모델</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>32</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>실행 중 큐</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>8</div>
        </div>
      </div>

      {/* Server cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {servers.map((s, i) => (
          <ServerCard
            key={s.name}
            s={s}
            expanded={expanded === i}
            onToggle={() => setExpanded(expanded === i ? -1 : i)}
          />
        ))}
      </div>

      {/* Add server hint */}
      <div style={{
        marginTop: 14,
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--r-3)",
        padding: 18,
        display: "flex", alignItems: "center", gap: 12,
        color: "var(--text-tertiary)",
        fontSize: 13,
        background: "var(--bg-tint)",
      }}>
        <Ias.Plus />
        <span>새 서버를 추가하려면 호스트 URL과 API 키 (필요한 경우)를 입력하세요.</span>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--secondary btn--sm"><Ias.Plus size={12}/> 서버 추가</button>
      </div>
    </div>
  );
}

Object.assign(window, { AdminServersPage });
