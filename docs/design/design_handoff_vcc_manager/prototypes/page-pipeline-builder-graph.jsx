// page-pipeline-builder-graph.jsx — Graph node editor variant for pipeline builder.
// Free-form 2D canvas with nodes, typed sockets, bezier connections.

const { useState: useStateGr, useRef: useRefGr } = React;
const Igr = window.Icon;

// Layout: pin nodes at fixed coordinates (no real drag — visual demo).
// Coordinate system is the SVG/canvas internal one (e.g. 1200×620).
const NODE_W = 220;
const SOCKET_R = 6;

const SOCKET_COLORS = {
  text:  "#5B5BD6",
  image: "#7B4DD8",
  video: "#BE7415",
  any:   "#8A8F9A",
};

function Socket({ side, type, label, hovered, onMouseEnter, onMouseLeave }) {
  const color = SOCKET_COLORS[type] || SOCKET_COLORS.any;
  return (
    <div style={{
      position: "absolute",
      top: 0, [side]: -SOCKET_R - 1,
      width: SOCKET_R * 2 + 2, height: SOCKET_R * 2 + 2,
      display: "grid", placeItems: "center",
    }}>
      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          width: SOCKET_R * 2, height: SOCKET_R * 2,
          borderRadius: "50%",
          background: hovered ? color : "var(--bg-surface)",
          border: `2px solid ${color}`,
          boxShadow: hovered ? `0 0 0 4px ${color}33` : "var(--shadow-1)",
          cursor: "crosshair",
          transition: "all 120ms",
        }}
      />
      <div style={{
        position: "absolute",
        [side === "left" ? "right" : "left"]: SOCKET_R * 2 + 6,
        top: "50%", transform: "translateY(-50%)",
        fontSize: 10, fontFamily: "var(--font-mono)",
        color: "var(--text-tertiary)",
        textTransform: "uppercase", letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}>{label}</div>
    </div>
  );
}

function NodeCard({ n, active, onClick, hoveredSocket, setHoveredSocket }) {
  const kindIcon =
    n.kind === "GPT Chat"  ? <Igr.Robot size={14}/> :
    n.kind === "GPT Image" ? <Igr.Image size={14}/> :
    n.kind === "Initial"   ? <Igr.Send size={14}/> :
    n.kind === "Output"    ? <Igr.Check size={14}/> :
                             <Igr.Bolt size={14}/>;
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: n.x, top: n.y,
        width: NODE_W,
        background: "var(--bg-surface)",
        border: "1px solid " + (active ? "var(--accent-9)" : "var(--border-default)"),
        borderRadius: "var(--r-3)",
        boxShadow: active ? "var(--shadow-3), 0 0 0 3px var(--accent-3)" : "var(--shadow-2)",
        cursor: "pointer",
        transition: "all 200ms cubic-bezier(.2,.7,.3,1)",
        userSelect: "none",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "8px 10px",
        background: "var(--bg-tint)",
        borderBottom: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-3) var(--r-3) 0 0",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 4,
          background: "var(--accent-3)", color: "var(--accent-11)",
          display: "grid", placeItems: "center",
        }}>{kindIcon}</span>
        <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {n.title}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>#{n.id}</span>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {n.preview}
      </div>

      {/* Status row */}
      {n.status && (
        <div style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--border-subtle)",
          background: n.status === "ok" ? "var(--success-1)" : "var(--warning-1)",
          color: n.status === "ok" ? "var(--success-11)" : "var(--warning-11)",
          fontSize: 10.5, fontWeight: 600,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "0.04em",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {n.status === "ok" ? <Igr.Check size={10}/> : <Igr.Info size={10}/>}
          {n.statusLabel || n.status}
        </div>
      )}

      {/* Input sockets — left side */}
      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        {n.inputs.map((s, i) => (
          <div key={s.label} style={{ position: "relative", height: 14, marginLeft: 0 }}>
            <Socket
              side="left"
              type={s.type}
              label={s.label}
              hovered={hoveredSocket === `${n.id}-in-${i}`}
              onMouseEnter={() => setHoveredSocket(`${n.id}-in-${i}`)}
              onMouseLeave={() => setHoveredSocket(null)}
            />
          </div>
        ))}
      </div>

      {/* Output sockets — right side */}
      <div style={{ position: "absolute", right: 0, top: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
        {n.outputs.map((s, i) => (
          <div key={s.label} style={{ position: "relative", height: 14 }}>
            <Socket
              side="right"
              type={s.type}
              label={s.label}
              hovered={hoveredSocket === `${n.id}-out-${i}`}
              onMouseEnter={() => setHoveredSocket(`${n.id}-out-${i}`)}
              onMouseLeave={() => setHoveredSocket(null)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Compute socket center coords for connection drawing.
function socketPos(nodes, ref) {
  const [nid, side, idx] = ref;
  const n = nodes.find((x) => x.id === nid);
  if (!n) return { x: 0, y: 0 };
  const list = side === "in" ? n.inputs : n.outputs;
  const count = list.length;
  const centerY = NODE_H_estimate(n) / 2 + n.y;
  const totalGap = (count - 1) * 18;
  const startY = centerY - totalGap / 2 + 7;          // approx center of node area for the socket
  const y = startY + idx * 18;
  const x = side === "in" ? n.x - SOCKET_R - 1 + SOCKET_R : n.x + NODE_W + SOCKET_R + 1 - SOCKET_R;
  return { x, y };
}
function NODE_H_estimate(n) {
  // header 36 + body lines (~32 per 2 lines) + status 26 if present
  return 36 + 64 + (n.status ? 26 : 0);
}

function Connection({ from, to, type, active }) {
  const color = SOCKET_COLORS[type] || SOCKET_COLORS.any;
  const dx = Math.max(40, (to.x - from.x) * 0.5);
  const path = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
  return (
    <g>
      <path d={path} stroke={color} strokeWidth={active ? 2.5 : 1.8} fill="none"
        strokeLinecap="round"
        style={{
          filter: active ? `drop-shadow(0 0 4px ${color})` : "none",
          opacity: active ? 1 : 0.8,
          transition: "all 150ms",
        }}
      />
      {/* small arrowhead near target */}
      <circle cx={to.x} cy={to.y} r={3} fill={color} opacity={0.9}/>
    </g>
  );
}

function PipelineBuilderGraphPage({ mobile }) {
  // Static node graph — visual demo, no real drag.
  const [nodes] = useStateGr([
    {
      id: "start", kind: "Initial", title: "초기 프롬프트",
      x: 60, y: 90,
      inputs: [], outputs: [{ label: "text", type: "text" }],
      preview: "남성 캐릭터\n(사용자가 실행 시 입력)",
      status: "ok", statusLabel: "trigger",
    },
    {
      id: "n1", kind: "GPT Chat", title: "캐릭터 설정 생성",
      x: 360, y: 60,
      inputs: [{ label: "text", type: "text" }],
      outputs: [{ label: "text", type: "text" }],
      preview: "Mages 세계관 + 캐릭터 톤 시스템 프롬프트 → 인물 시트 생성",
      status: "ok", statusLabel: "ready",
    },
    {
      id: "n2", kind: "GPT Chat", title: "외형 프롬프트",
      x: 660, y: 220,
      inputs: [{ label: "text", type: "text" }],
      outputs: [{ label: "text", type: "text" }],
      preview: "SDXL 프롬프트 가이드 적용 · 한 줄 SDXL 변환",
      status: "ok", statusLabel: "ready",
    },
    {
      id: "n3", kind: "GPT Image", title: "이미지 생성",
      x: 960, y: 100,
      inputs: [{ label: "text", type: "text" }],
      outputs: [{ label: "image", type: "image" }],
      preview: "1024×1024, batch 4 · DreamShaper XL Turbo",
      status: "ok", statusLabel: "ready",
    },
    {
      id: "end", kind: "Output", title: "최종 출력",
      x: 1240, y: 130,
      inputs: [{ label: "image", type: "image" }],
      outputs: [],
      preview: "4장 이미지 → 컨텐츠 라이브러리 저장",
    },
  ]);

  const [connections] = useStateGr([
    { from: ["start", "out", 0], to: ["n1", "in", 0], type: "text" },
    { from: ["n1", "out", 0],    to: ["n2", "in", 0], type: "text" },
    { from: ["n2", "out", 0],    to: ["n3", "in", 0], type: "text" },
    { from: ["n3", "out", 0],    to: ["end", "in", 0], type: "image" },
  ]);

  const [activeNode, setActiveNode] = useStateGr("n2");
  const [hoveredSocket, setHoveredSocket] = useStateGr(null);

  if (mobile) {
    return (
      <div>
        <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
          <Igr.ChevronLeft size={12}/> Mages 프로젝트
        </a>
        <h1 className="page-title">파이프라인 빌더</h1>
        <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", fontSize: 10 }}>VARIANT · GRAPH</span>
        <div style={{
          marginTop: 14, padding: 16,
          background: "var(--bg-tint)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 13, lineHeight: 1.6,
        }}>
          <Igr.Pipe style={{ color: "var(--accent-9)", marginBottom: 8 }}/>
          <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>그래프 편집은 데스크탑 권장</div>
          모바일에서는 list 모드로 확인 / 편집해 주세요.
          <div style={{ marginTop: 12 }}>
            <button className="btn btn--primary" style={{ width: "100%" }}>list 모드로 전환</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Igr.ChevronLeft size={12}/> Mages 프로젝트
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 className="page-title">파이프라인 빌더</h1>
        <span className="chip chip--accent">편집 중</span>
        <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", fontSize: 10 }}>VARIANT · GRAPH</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 12 }}>
        <input className="input" defaultValue="NPC 생성" style={{ maxWidth: 280, fontWeight: 600, fontSize: 14 }}/>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--secondary btn--sm"><Igr.Eye size={12}/> 검증</button>
        <button className="btn btn--secondary btn--sm">취소</button>
        <button className="btn btn--primary btn--sm"><Igr.Check size={12}/> 저장</button>
      </div>

      {/* Canvas */}
      <div style={{
        position: "relative",
        height: 580,
        borderRadius: 12,
        border: "1px solid var(--border-subtle)",
        background:
          "radial-gradient(circle at 1px 1px, var(--border-default) 1px, transparent 1px) 0 0 / 18px 18px," +
          "var(--bg-tint)",
        overflow: "hidden",
      }}>
        {/* Floating toolbar */}
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 5,
          display: "flex", gap: 4, padding: 4,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          boxShadow: "var(--shadow-2)",
        }}>
          <button className="btn btn--ghost btn--icon btn--sm" title="화면에 맞춤"><Igr.Eye size={12}/></button>
          <button className="btn btn--ghost btn--sm" style={{ fontFamily: "var(--font-mono)" }}>100%</button>
          <button className="btn btn--ghost btn--icon btn--sm" title="자동 정렬"><Igr.Refresh size={12}/></button>
        </div>

        {/* Add-node palette */}
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 5,
          padding: 6,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          boxShadow: "var(--shadow-2)",
          display: "flex", flexDirection: "column", gap: 3,
          fontSize: 11,
          minWidth: 140,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", padding: "4px 6px" }}>
            노드 추가
          </div>
          {[
            { label: "GPT Chat",  icon: <Igr.Robot size={12}/> },
            { label: "GPT Image", icon: <Igr.Image size={12}/> },
            { label: "SDXL T2I",  icon: <Igr.Cube size={12}/> },
            { label: "Comfy I2V", icon: <Igr.Play size={12}/> },
            { label: "분기",      icon: <Igr.Pipe size={12}/> },
          ].map((it) => (
            <div key={it.label} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 8px",
              borderRadius: 4,
              cursor: "grab",
              color: "var(--text-primary)",
              fontWeight: 500,
            }} onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-subtle)"} onMouseOut={(e) => e.currentTarget.style.background = ""}>
              {it.icon}
              <span>{it.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable inner viewport — pan the graph; chrome stays pinned outside */}
        <div className="graph-scroll" style={{
          position: "absolute", inset: 0,
          overflow: "auto",
          zIndex: 1,
        }}>
          <div style={{
            position: "relative",
            width: 1500, height: "100%",
            minHeight: 580,
          }}>
            {/* Connection lines */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
              {connections.map((c, i) => {
                const from = socketPos(nodes, c.from);
                const to   = socketPos(nodes, c.to);
                const isActive = c.from[0] === activeNode || c.to[0] === activeNode;
                return <Connection key={i} from={from} to={to} type={c.type} active={isActive}/>;
              })}
            </svg>

            {/* Nodes */}
            {nodes.map((n) => (
              <NodeCard
                key={n.id}
                n={n}
                active={activeNode === n.id}
                onClick={() => setActiveNode(n.id)}
                hoveredSocket={hoveredSocket}
                setHoveredSocket={setHoveredSocket}
              />
            ))}
          </div>
        </div>

        {/* Status overlay bottom-left */}
        <div style={{
          position: "absolute", bottom: 12, left: 12, zIndex: 5,
          padding: "6px 12px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 999,
          boxShadow: "var(--shadow-1)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 11.5,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success-9)" }}/>
            <b>5 노드 · 4 연결</b>
          </span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ color: "var(--text-secondary)" }}>모든 타입 일치</span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>예상 2분 35초</span>
        </div>

        {/* Mini legend bottom-right */}
        <div style={{
          position: "absolute", bottom: 12, right: 12, zIndex: 5,
          padding: "6px 10px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          boxShadow: "var(--shadow-1)",
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 10.5, fontFamily: "var(--font-mono)",
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {Object.entries(SOCKET_COLORS).filter(([k]) => k !== "any").map(([k, v]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: v }}/>
              {k}
            </span>
          ))}
        </div>

        <style>{`
          .graph-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
          .graph-scroll::-webkit-scrollbar-thumb {
            background: var(--border-strong);
            border-radius: 999px;
            border: 2px solid var(--bg-tint);
          }
          .graph-scroll::-webkit-scrollbar-track { background: transparent; }
        `}</style>
      </div>

      {/* Selected node inspector */}
      {activeNode && (() => {
        const n = nodes.find((x) => x.id === activeNode);
        return (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="card">
              <div className="card__header">
                <span className="card__title">선택 노드 · {n.title}</span>
                <span style={{ flex: 1 }}/>
                <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)" }}>#{n.id}</span>
              </div>
              <div style={{ padding: 14 }}>
                <label className="field-label">노드 이름</label>
                <input className="input" defaultValue={n.title} style={{ marginBottom: 10 }}/>
                <label className="field-label">사전 입력 / 메모</label>
                <textarea className="textarea" rows={3} defaultValue={n.preview}/>
              </div>
            </div>
            <div className="card">
              <div className="card__header">
                <span className="card__title">컨텍스트 문서</span>
                <span className="tab__count" style={{ marginLeft: 6 }}>2</span>
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                {["SDXL 프롬프트 가이드", "Mages 세계관 개요"].map((d, i) => (
                  <div key={d} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    background: "var(--bg-tint)",
                  }}>
                    <Igr.Doc size={12} style={{ color: "var(--text-tertiary)" }}/>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{d}</span>
                    <button className="btn btn--ghost btn--icon btn--sm"><Igr.X size={11}/></button>
                  </div>
                ))}
                <button className="btn btn--ghost btn--sm" style={{ marginTop: 4 }}>
                  <Igr.Plus size={12}/> 문서 추가
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

Object.assign(window, { PipelineBuilderGraphPage });
