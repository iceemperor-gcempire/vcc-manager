// command-palette.jsx — Cmd+K global search & action palette
// Opens on Cmd/Ctrl+K, ESC to close. Groups results, arrow nav.

const { useState: useStateCp, useEffect: useEffectCp, useRef: useRefCp } = React;
const Icp = window.Icon;

// All commands the palette can find. In real app pulled from backend / router.
function getCommands() {
  return [
    // Projects
    { g: "프로젝트", icon: <Icp.Folder size={14}/>, name: "Mages",       hint: "124 이미지 · 4 파이프라인", kbd: ["G", "P"] },
    { g: "프로젝트", icon: <Icp.Folder size={14}/>, name: "Cryo",        hint: "88 이미지 · 2 파이프라인" },
    { g: "프로젝트", icon: <Icp.Folder size={14}/>, name: "Astral Pact", hint: "41 이미지 · 1 파이프라인" },

    // Workboards
    { g: "작업판", icon: <Icp.Cube size={14}/>, name: "SDXL T2I — LoRA",       hint: "comfy-01 · 412회 사용" },
    { g: "작업판", icon: <Icp.Robot size={14}/>, name: "GPT Chat — 캐릭터 설정", hint: "openai · 248회" },
    { g: "작업판", icon: <Icp.Image size={14}/>, name: "GPT Image — 1024",     hint: "openai · 187회" },
    { g: "작업판", icon: <Icp.Play size={14}/>, name: "Comfy I2V — 4초",       hint: "comfy-02 · 64회" },

    // Pipelines
    { g: "파이프라인", icon: <Icp.Pipe size={14}/>, name: "NPC 생성",  hint: "Mages · 3단계 · 실행 중" },
    { g: "파이프라인", icon: <Icp.Pipe size={14}/>, name: "배경 시리즈 v3", hint: "Cryo · 4단계" },

    // Documents
    { g: "문서", icon: <Icp.Doc size={14}/>, name: "Mages 세계관 개요",      hint: "184줄 · 5분 전" },
    { g: "문서", icon: <Icp.Doc size={14}/>, name: "Rusty Blood 시대 연표", hint: "41줄 · 어제" },

    // Actions
    { g: "명령", icon: <Icp.Plus size={14}/>,    name: "새 프로젝트 만들기",   kbd: ["⌘", "N"] },
    { g: "명령", icon: <Icp.Pipe size={14}/>,    name: "새 파이프라인 만들기" },
    { g: "명령", icon: <Icp.Image size={14}/>,   name: "이미지 업로드",       kbd: ["⌘", "U"] },
    { g: "명령", icon: <Icp.Settings size={14}/>,name: "설정 열기" },
    { g: "명령", icon: <Icp.Eye size={14}/>,     name: "다크 모드 토글",     kbd: ["⌘", "⇧", "D"] },
    { g: "명령", icon: <Icp.Server size={14}/>,  name: "서버 상태 보기" },
  ];
}

function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useStateCp("");
  const [sel, setSel] = useStateCp(0);
  const inputRef = useRefCp(null);
  const listRef = useRefCp(null);

  const all = getCommands();
  const filtered = !query.trim() ? all : all.filter((c) =>
    (c.name + " " + (c.hint || "") + " " + c.g).toLowerCase().includes(query.toLowerCase())
  );

  // Group by g but preserve sort order
  const grouped = filtered.reduce((acc, c) => {
    (acc[c.g] = acc[c.g] || []).push(c);
    return acc;
  }, {});
  const groupOrder = ["프로젝트", "작업판", "파이프라인", "문서", "명령"].filter(g => grouped[g]);

  // Flat list for keyboard nav
  const flat = groupOrder.flatMap((g) => grouped[g]);

  useEffectCp(() => {
    setSel(0);
  }, [query]);

  useEffectCp(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setSel(0);
    }
  }, [open]);

  useEffectCp(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
      else if (e.key === "ArrowUp")   { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
      else if (e.key === "Enter") {
        // Visual demo only — close on enter
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat.length, onClose]);

  if (!open) return null;

  let runningIdx = 0;
  return (
    <div data-no-intercept style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)",
      backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "12vh",
      animation: "cp-fade 140ms ease",
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(640px, 92vw)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 12,
        boxShadow: "var(--shadow-4)",
        overflow: "hidden",
        animation: "cp-pop 180ms cubic-bezier(.2,.7,.3,1)",
      }}>
        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <Icp.Search style={{ color: "var(--text-tertiary)" }}/>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로젝트 · 작업판 · 명령 검색…"
            style={{
              flex: 1, border: 0, outline: "none",
              fontFamily: "var(--font-sans)", fontSize: 16,
              background: "transparent",
              color: "var(--text-primary)",
              padding: "4px 0",
            }}
          />
          <span className="kbd">ESC</span>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 420, overflow: "auto", padding: 6 }}>
          {flat.length === 0 && (
            <div style={{ padding: 28, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              "{query}"에 대한 결과가 없습니다.
            </div>
          )}
          {groupOrder.map((g) => (
            <div key={g}>
              <div style={{
                padding: "8px 12px 4px",
                fontSize: 10, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: "var(--text-tertiary)",
              }}>{g}</div>
              {grouped[g].map((c) => {
                const myIdx = runningIdx++;
                const active = sel === myIdx;
                return (
                  <div
                    key={c.name}
                    onMouseEnter={() => setSel(myIdx)}
                    onClick={onClose}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: active ? "var(--accent-3)" : "transparent",
                      color: active ? "var(--accent-11)" : "var(--text-primary)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 4,
                      background: active ? "var(--accent-9)" : "var(--bg-subtle)",
                      color: active ? "white" : "var(--text-secondary)",
                      display: "grid", placeItems: "center",
                      flex: "0 0 auto",
                    }}>{c.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                      {c.hint && <div style={{ fontSize: 11, color: active ? "var(--accent-11)" : "var(--text-tertiary)", opacity: 0.85, marginTop: 1 }}>{c.hint}</div>}
                    </div>
                    {c.kbd && (
                      <div style={{ display: "flex", gap: 3 }}>
                        {c.kbd.map((k) => <span key={k} className="kbd">{k}</span>)}
                      </div>
                    )}
                    {active && <Icp.ArrowRight size={14}/>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "8px 14px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-tint)",
          fontSize: 11, color: "var(--text-tertiary)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="kbd">↑</span><span className="kbd">↓</span> 이동
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="kbd">↵</span> 선택
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="kbd">⌘</span><span className="kbd">K</span> 닫기
          </span>
          <span style={{ flex: 1 }}/>
          <span style={{ fontFamily: "var(--font-mono)" }}>{flat.length}개 결과</span>
        </div>
      </div>
      <style>{`
        @keyframes cp-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cp-pop {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

Object.assign(window, { CommandPalette });
