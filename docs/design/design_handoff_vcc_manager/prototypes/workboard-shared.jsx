// workboard-shared.jsx — 사용자 "작업판 목록"과 관리자 "작업판 관리"가 공유하는
// 카드 + 2축 필터(출력 형식 × 서버 타입) 컴포넌트. 주요 정보 표시는 동일하게,
// 차이는 admin prop(상태 배지 · 허용 그룹 · 편집/더보기 액션)으로만 분기.

const { useState: useStateWs, useMemo: useMemoWs } = React;
const Iws = window.Icon;

// 종류(생성 엔진) 메타 — 카드 좌측 아이콘
const WB_KIND_META = {
  "gpt-chat":  { icon: (s) => <Iws.Robot size={s}/>, label: "텍스트 생성", color: "var(--info-11)",    bg: "var(--info-3)" },
  "gpt-image": { icon: (s) => <Iws.Image size={s}/>, label: "이미지 (API)", color: "#5B2DBF",          bg: "#F1ECFE" },
  "sdxl":      { icon: (s) => <Iws.Cube size={s}/>,  label: "SDXL",         color: "var(--accent-11)", bg: "var(--accent-3)" },
  "i2v":       { icon: (s) => <Iws.Play size={s}/>,  label: "영상 (I2V)",   color: "var(--warning-11)", bg: "var(--warning-3)" },
  "lora":      { icon: (s) => <Iws.Magic size={s}/>, label: "LoRA 학습",     color: "#0F7A40",          bg: "var(--success-3)" },
};

// 필터 축 1 — 출력 형식
const WB_OUTPUTS = [
  { k: "image", label: "이미지" },
  { k: "video", label: "영상" },
  { k: "text",  label: "텍스트" },
  { k: "lora",  label: "LoRA" },
];
// 필터 축 2 — 서버 타입
const WB_SERVERS = [
  { k: "comfy",  label: "ComfyUI" },
  { k: "openai", label: "OpenAI" },
  { k: "gemini", label: "Gemini" },
];

const OUT_CHIP = { image: "chip--accent", video: "chip--warning", text: "chip--info", lora: "chip--success" };
const OUT_LABEL = { image: "image", video: "video", text: "text", lora: "lora" };

// 데이터 유도 헬퍼 — kind/server 로부터 출력형식·서버타입 산출
const deriveOut = (kind) => (kind === "i2v" ? "video" : kind === "gpt-chat" ? "text" : kind === "lora" ? "lora" : "image");
const deriveSvc = (server) => (server.startsWith("comfy") ? "comfy" : server.startsWith("openai") ? "openai" : "gemini");

// ── 2축 필터 바 ────────────────────────────────────────────────
function FilterToggle({ active, onClick, children, count }) {
  return (
    <button onClick={onClick} className="wb-ftoggle" style={{
      cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5,
      height: 28, padding: "0 11px", borderRadius: 999, fontSize: 12.5, fontWeight: 500,
      background: active ? "var(--accent-9)" : "var(--bg-surface)",
      color: active ? "white" : "var(--text-secondary)",
      border: "1px solid " + (active ? "var(--accent-9)" : "var(--border-default)"),
      transition: "background 120ms, border-color 120ms, color 120ms",
    }}>
      {children}
      {count != null && (
        <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: active ? "rgba(255,255,255,0.8)" : "var(--text-tertiary)" }}>{count}</span>
      )}
    </button>
  );
}

function WorkboardFilters({ mobile, q, setQ, outSel, toggleOut, svcSel, toggleSvc, counts, total, shown, onClear }) {
  const anyActive = outSel.length > 0 || svcSel.length > 0 || q.trim().length > 0;
  return (
    <div style={{
      border: "1px solid var(--border-subtle)", borderRadius: "var(--r-3)",
      background: "var(--bg-tint)", padding: mobile ? 12 : "12px 14px", marginBottom: 18,
      display: "flex", flexDirection: "column", gap: 11,
    }}>
      {/* search row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="작업판 이름 · 설명 검색" style={{ paddingLeft: 30, width: "100%", background: "var(--bg-surface)" }}/>
          <span style={{ position: "absolute", left: 9, top: 8, color: "var(--text-tertiary)" }}><Iws.Search size={14}/></span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>
          {shown === total ? `${total}개` : `${shown} / ${total}`}
        </span>
      </div>

      {/* two filter axes */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: mobile ? 10 : 18, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>출력</span>
          {WB_OUTPUTS.map((o) => (
            <FilterToggle key={o.k} active={outSel.includes(o.k)} onClick={() => toggleOut(o.k)} count={counts.out[o.k] || 0}>{o.label}</FilterToggle>
          ))}
        </div>
        <div style={{ width: 1, height: 22, background: "var(--border-default)", flex: "0 0 auto", display: mobile ? "none" : "block" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)" }}>서버</span>
          {WB_SERVERS.map((s) => (
            <FilterToggle key={s.k} active={svcSel.includes(s.k)} onClick={() => toggleSvc(s.k)} count={counts.svc[s.k] || 0}>{s.label}</FilterToggle>
          ))}
        </div>
        {anyActive && (
          <>
            <span style={{ flex: 1 }}/>
            <button onClick={onClear} className="btn btn--ghost btn--sm" style={{ flex: "0 0 auto", color: "var(--text-tertiary)" }}>
              <Iws.X size={12}/> 초기화
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 공유 카드 ──────────────────────────────────────────────────
function WbStatusChip({ status }) {
  if (status === "published") return <span className="chip chip--success chip--tag"><span className="chip__dot"/>게시됨</span>;
  if (status === "draft")     return <span className="chip chip--warning chip--tag">초안</span>;
  if (status === "archived")  return <span className="chip chip--tag" style={{ background: "var(--bg-subtle)", color: "var(--text-tertiary)" }}>보관</span>;
  return null;
}

function WorkboardCard({ wb, admin, onClick, onEdit }) {
  const k = WB_KIND_META[wb.kind];
  const out = deriveOut(wb.kind);
  return (
    <div className="wb-card card" style={{
      padding: 14, cursor: admin ? "default" : "pointer",
      display: "flex", flexDirection: "column", gap: 10,
      transition: "border-color 150ms, box-shadow 150ms, transform 150ms",
      opacity: wb.status === "archived" ? 0.72 : 1,
    }}
      onClick={admin ? undefined : onClick}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "var(--r-2)", background: k.bg, color: k.color, display: "grid", placeItems: "center", flex: "0 0 auto" }}>{k.icon(15)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wb.name}</span>
            {admin && <WbStatusChip status={wb.status}/>}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1 }}>{k.label} · {wb.io}</div>
        </div>
        {!admin && wb.favorite && <Iws.StarFill size={13} style={{ color: "var(--warning-9)", flex: "0 0 auto" }}/>}
        <span className={"chip chip--tag " + OUT_CHIP[out]} style={{ flex: "0 0 auto", marginLeft: admin ? 0 : 2 }}>{OUT_LABEL[out]}</span>
      </div>

      {/* description */}
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, textWrap: "pretty", minHeight: 32 }}>{wb.desc}</div>

      {/* admin: allowed groups */}
      {admin && wb.groups && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>허용</span>
          {wb.groups.map((g) => <span key={g} className="chip chip--tag" style={{ fontSize: 10.5 }}>{g}</span>)}
        </div>
      )}

      {/* stats row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingTop: 10, borderTop: "1px solid var(--border-subtle)",
        fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: wb.status === "archived" ? "var(--text-tertiary)" : "var(--success-9)" }}/>
          {wb.server}
        </span>
        <span style={{ flex: 1 }}/>
        {admin ? (
          <span>필드 {wb.fields}</span>
        ) : (
          <span>{wb.runs}회</span>
        )}
      </div>

      {/* footer line */}
      {admin ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{wb.editedAt} · {wb.editedBy}</span>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--secondary btn--sm" data-no-intercept onClick={(e) => { e.stopPropagation(); onEdit && onEdit(wb); }}><Iws.Edit size={12}/> 편집</button>
          <button className="btn btn--ghost btn--icon btn--sm" data-no-intercept onClick={(e) => e.stopPropagation()} title="더보기"><Iws.Dots /></button>
        </div>
      ) : (
        wb.lastRun && (
          <div style={{ marginTop: -4, fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
            <Iws.Clock size={11}/> 마지막 실행 {wb.lastRun}
          </div>
        )
      )}
    </div>
  );
}

// ── 공유 필터 로직 훅 ──────────────────────────────────────────
function useWorkboardFilter(workboards) {
  const [q, setQ] = useStateWs("");
  const [outSel, setOutSel] = useStateWs([]);
  const [svcSel, setSvcSel] = useStateWs([]);

  const toggleOut = (k) => setOutSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  const toggleSvc = (k) => setSvcSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);
  const clear = () => { setQ(""); setOutSel([]); setSvcSel([]); };

  const counts = useMemoWs(() => {
    const out = {}, svc = {};
    workboards.forEach((w) => {
      const o = deriveOut(w.kind), s = deriveSvc(w.server);
      out[o] = (out[o] || 0) + 1;
      svc[s] = (svc[s] || 0) + 1;
    });
    return { out, svc };
  }, [workboards]);

  const filtered = useMemoWs(() => {
    const needle = q.trim().toLowerCase();
    return workboards.filter((w) => {
      if (outSel.length && !outSel.includes(deriveOut(w.kind))) return false;
      if (svcSel.length && !svcSel.includes(deriveSvc(w.server))) return false;
      if (needle && !(w.name + " " + (w.desc || "")).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [workboards, q, outSel, svcSel]);

  return { q, setQ, outSel, svcSel, toggleOut, toggleSvc, clear, counts, filtered };
}

Object.assign(window, { WorkboardFilters, WorkboardCard, useWorkboardFilter, WB_KIND_META });
