// workboard-picker.jsx — "다른 작업으로 전환" 모달
// 히스토리(또는 라이트박스)에서 이미지/영상 결과를 입력으로 받아,
// 그 결과를 먹일 수 있는 호환 작업판을 골라 전환하는 picker.
// 핵심: 단순 나열이 아니라 "이 결과 → 어떤 작업"의 흐름을 명확히 보여준다.

const { useState: useStateWp, useEffect: useEffectWp, useMemo: useMemoWp } = React;
const Iwp = window.Icon;

// 출력 종류별 메타 (그룹 헤더 + 카드 아이콘 컬러)
const OUT_META = {
  video: { label: "영상 생성",   icon: (s) => <Iwp.Play size={s}/>,    color: "var(--warning-11)", bg: "var(--warning-3)" },
  image: { label: "이미지 변환", icon: (s) => <Iwp.Image size={s}/>,   color: "var(--accent-11)",  bg: "var(--accent-3)" },
  lora:  { label: "LoRA 학습",   icon: (s) => <Iwp.Magic size={s}/>,   color: "#0F7A40",           bg: "var(--success-3)" },
  text:  { label: "텍스트 생성", icon: (s) => <Iwp.Robot size={s}/>,   color: "var(--info-11)",    bg: "var(--info-3)" },
};

const TYPE_KO = { image: "이미지", video: "영상", text: "텍스트", lora: "LoRA" };

// 호환 작업판 카탈로그 — inKind 가 소스 타입과 일치하는 것만 노출
const PICKER_CATALOG = [
  // image 입력
  { name: "Comfy I2V — 4초",     inKind: "image", outKind: "video", desc: "정지 이미지에서 4초 짧은 영상 클립. 1080×1920.",        server: "comfy-02", status: "online", runs: 64,  hot: true },
  { name: "Comfy I2V — 10초",    inKind: "image", outKind: "video", desc: "10초 길이 영상. GPU 점유 시간 김.",                     server: "comfy-02", status: "online", runs: 12 },
  { name: "이미지 업스케일 4×",   inKind: "image", outKind: "image", desc: "디테일 보존 4배 업스케일. 인쇄·고해상 납품용.",          server: "comfy-01", status: "online", runs: 203, hot: true },
  { name: "배경 제거 / 누끼",     inKind: "image", outKind: "image", desc: "피사체만 분리해 투명 PNG로. 합성 소스 제작.",            server: "comfy-01", status: "online", runs: 142 },
  { name: "img2img 변형",         inKind: "image", outKind: "image", desc: "구도 유지한 채 스타일·디테일 재생성. denoise 0.4~0.7.",  server: "comfy-01", status: "busy",   runs: 88 },
  { name: "LoRA 학습 — 캐릭터",   inKind: "image", outKind: "lora",  desc: "이 결과를 학습셋에 추가해 캐릭터 LoRA 학습.",           server: "comfy-01", status: "online", runs: 8 },
  // video 입력
  { name: "영상 업스케일",        inKind: "video", outKind: "video", desc: "프레임별 업스케일로 해상도 2배. 디테일 복원.",          server: "comfy-02", status: "online", runs: 31,  hot: true },
  { name: "프레임 보간 60fps",    inKind: "video", outKind: "video", desc: "중간 프레임 생성으로 부드러운 60fps 변환.",             server: "comfy-02", status: "online", runs: 19 },
  { name: "영상 확장 +4초",       inKind: "video", outKind: "video", desc: "마지막 프레임에서 이어지는 4초를 추가 생성.",            server: "comfy-02", status: "busy",   runs: 7 },
];

function StatusDot({ status }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: "50%", flex: "0 0 auto",
      background: status === "online" ? "var(--success-9)" : "var(--warning-9)",
    }}/>
  );
}

// 흐름 칩: "이미지 → 영상"
function FlowTag({ from, to, big }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontFamily: "var(--font-mono)", fontSize: big ? 11.5 : 10.5, fontWeight: 500,
      color: "var(--text-secondary)",
    }}>
      <span>{TYPE_KO[from]}</span>
      <Iwp.ArrowRight size={big ? 12 : 11} style={{ color: "var(--text-tertiary)" }}/>
      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{TYPE_KO[to]}</span>
    </span>
  );
}

// 일반 카드
function PickCard({ wb, sourceType, onPick }) {
  const m = OUT_META[wb.outKind];
  return (
    <button className="wp-card" onClick={() => onPick(wb)} style={{
      textAlign: "left", cursor: "pointer", font: "inherit",
      background: "var(--bg-surface)", border: "1px solid var(--border-default)",
      borderRadius: "var(--r-3)", padding: 13,
      display: "flex", flexDirection: "column", gap: 9,
      transition: "border-color 130ms, box-shadow 130ms, transform 130ms",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "var(--r-2)", flex: "0 0 auto",
          background: m.bg, color: m.color, display: "grid", placeItems: "center",
        }}>{m.icon(15)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wb.name}</div>
          <div style={{ marginTop: 2 }}><FlowTag from={sourceType} to={wb.outKind}/></div>
        </div>
        <span className="wp-go" style={{ color: "var(--accent-11)", flex: "0 0 auto", opacity: 0, transform: "translateX(-4px)", transition: "opacity 130ms, transform 130ms" }}>
          <Iwp.ArrowRight size={15}/>
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5, textWrap: "pretty", minHeight: 34 }}>{wb.desc}</div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, paddingTop: 9,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)",
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><StatusDot status={wb.status}/>{wb.server}</span>
        <span style={{ flex: 1 }}/>
        <span>{wb.runs}회</span>
      </div>
    </button>
  );
}

// 추천(피처드) 카드 — 가로로 넓게, 강조 배경
function FeaturedCard({ wb, sourceType, onPick }) {
  const m = OUT_META[wb.outKind];
  return (
    <button className="wp-feat" onClick={() => onPick(wb)} style={{
      textAlign: "left", cursor: "pointer", font: "inherit", width: "100%",
      background: "linear-gradient(180deg, var(--accent-2), var(--bg-surface))",
      border: "1px solid var(--accent-7)", borderRadius: "var(--r-3)",
      padding: 14, display: "flex", alignItems: "center", gap: 14,
      transition: "border-color 130ms, box-shadow 130ms",
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: "var(--r-2)", flex: "0 0 auto",
        background: m.bg, color: m.color, display: "grid", placeItems: "center",
      }}>{m.icon(20)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 650, color: "var(--text-primary)" }}>{wb.name}</span>
          <span className="chip chip--tag" style={{ background: "var(--accent-9)", color: "white", border: 0, fontSize: 10, height: 17 }}>추천</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.45 }}>{wb.desc}</div>
        <div style={{ marginTop: 6 }}><FlowTag from={sourceType} to={wb.outKind} big/></div>
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, flex: "0 0 auto",
        background: "var(--accent-9)", color: "white", borderRadius: "var(--r-2)",
        padding: "8px 14px", fontSize: 12.5, fontWeight: 600,
      }}>
        전환 <Iwp.ArrowRight size={14}/>
      </span>
    </button>
  );
}

function WorkboardPicker({ open, source, onClose, onPick }) {
  const [q, setQ] = useStateWp("");

  useEffectWp(() => {
    if (!open) return;
    setQ("");
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sourceType = source?.type || "image";

  const { featured, groups, total } = useMemoWp(() => {
    let list = PICKER_CATALOG.filter((w) => w.inKind === sourceType);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((w) => (w.name + " " + w.desc + " " + OUT_META[w.outKind].label).toLowerCase().includes(needle));
    const feat = !needle ? list.find((w) => w.hot) : null;
    const rest = list.filter((w) => w !== feat);
    const byKind = {};
    rest.forEach((w) => { (byKind[w.outKind] ||= []).push(w); });
    const order = ["video", "image", "lora", "text"];
    const grouped = order.filter((k) => byKind[k]).map((k) => ({ kind: k, items: byKind[k] }));
    return { featured: feat, groups: grouped, total: list.length };
  }, [sourceType, q]);

  if (!open || !source) return null;

  return (
    <div data-no-intercept onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 95,
      background: "rgba(8,10,15,0.62)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "var(--font-sans)", animation: "wp-fade 160ms ease",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(760px, 100%)", maxHeight: "min(86vh, 760px)",
        background: "var(--bg-surface)", border: "1px solid var(--border-default)",
        borderRadius: "var(--r-4)", boxShadow: "var(--shadow-4)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        animation: "wp-pop 200ms cubic-bezier(.2,.7,.3,1)",
      }}>
        {/* Header: source preview */}
        <div style={{
          padding: "16px 18px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 13,
        }}>
          <div style={{ position: "relative", width: 46, height: 46, flex: "0 0 auto" }}>
            <div className="thumb-tile" style={{ width: 46, height: 46, borderRadius: "var(--r-2)", "--h": source.hue ?? 270 }}/>
            {sourceType === "video" && (
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "white", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.5))" }}><Iwp.Play size={14}/></span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 650, color: "var(--text-primary)" }}>다른 작업으로 전환</div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{source.title}</span>
              <span style={{ margin: "0 6px", color: "var(--border-strong)" }}>·</span>
              {TYPE_KO[sourceType]} 결과를 입력으로 사용
            </div>
          </div>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} title="닫기 (Esc)"><Iwp.X /></button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 18px 0" }}>
          <div style={{ position: "relative" }}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="작업판 검색…" style={{ paddingLeft: 32, width: "100%" }} autoFocus/>
            <span style={{ position: "absolute", left: 10, top: 8, color: "var(--text-tertiary)" }}><Iwp.Search size={14}/></span>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {total === 0 && (
            <div style={{ padding: 36, textAlign: "center", color: "var(--text-tertiary)" }}>
              <Iwp.Search size={28} style={{ margin: "0 auto 10px", opacity: 0.5 }}/>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>일치하는 작업판이 없습니다</div>
              <div style={{ fontSize: 12 }}>{TYPE_KO[sourceType]} 입력을 받는 다른 작업판을 검색해 보세요.</div>
            </div>
          )}

          {featured && (
            <div>
              <div className="wp-grouphead">추천 — 가장 많이 쓰는 다음 단계</div>
              <FeaturedCard wb={featured} sourceType={sourceType} onPick={onPick}/>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.kind}>
              <div className="wp-grouphead">
                {OUT_META[g.kind].label}
                <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{g.items.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {g.items.map((wb) => <PickCard key={wb.name} wb={wb} sourceType={sourceType} onPick={onPick}/>)}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "11px 18px", borderTop: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 11.5, color: "var(--text-tertiary)",
        }}>
          <Iwp.Info size={13}/>
          <span>선택한 작업판이 새 입력으로 이 결과를 받아 실행 화면으로 이동합니다.</span>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--secondary btn--sm" onClick={onClose}>취소</button>
        </div>
      </div>

      <style>{`
        @keyframes wp-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wp-pop { from { opacity: 0; transform: scale(0.97) translateY(6px); } to { opacity: 1; transform: none; } }
        .wp-grouphead {
          display: flex; align-items: center; gap: 7;
          font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
          text-transform: uppercase; color: var(--text-secondary);
          margin-bottom: 9px;
        }
        .wp-card:hover { border-color: var(--accent-8); box-shadow: var(--shadow-2); transform: translateY(-1px); }
        .wp-card:hover .wp-go { opacity: 1; transform: none; }
        .wp-feat:hover { border-color: var(--accent-9); box-shadow: var(--shadow-3); }
      `}</style>
    </div>
  );
}

Object.assign(window, { WorkboardPicker });
