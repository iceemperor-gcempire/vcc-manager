// system-docs.jsx — Round B: design system documentation cards.
// Grid system, Data table, Form patterns, Dropdown/Popover.

const Isd = window.Icon;

// ============================================================
// 1) GRID SYSTEM
// ============================================================
function GridSystemCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
      display: "flex", flexDirection: "column", gap: 24,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Breakpoints — 2축</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>MUI 5종(xs/sm/md/lg/xl) 대신 mobile/desktop 2종으로 정식화.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {[
          { name: "mobile", range: "< 720px", icon: "📱", desc: "사이드바 → 하단 탭바, 1열 레이아웃, 탭 → select", color: "var(--info-9)" },
          { name: "desktop", range: "≥ 720px", icon: "🖥", desc: "사이드바 + 다단 레이아웃, 탭 가로형 유지", color: "var(--accent-9)" },
        ].map((b) => (
          <div key={b.name} style={{
            padding: 18, border: "1px solid var(--border-subtle)", borderRadius: 8,
            background: "var(--bg-tint)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: b.color, color: "white",
                display: "grid", placeItems: "center",
                fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)",
              }}>{b.name[0].toUpperCase()}</div>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{b.name}</span>
              <span className="code" style={{ background: "var(--bg-surface)", padding: "2px 6px", borderRadius: 3 }}>{b.range}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{b.desc}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Container · Page max-width</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>본문 영역 최대 폭. 사이드바 제외한 main column 기준.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { name: "narrow",   w: 720,  desc: "긴 본문 (마이그레이션 가이드 등)" },
          { name: "default",  w: 1200, desc: "대시보드, 프로젝트 상세, 컨텐츠 라이브러리" },
          { name: "wide",     w: 1440, desc: "관리자 페이지, 데이터 테이블" },
          { name: "full",     w: null, desc: "파이프라인 빌더 (graph), 이미지 라이트박스" },
        ].map((c) => (
          <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 80, fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-tertiary)" }}>{c.name}</span>
            <span style={{ width: 70, fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600 }}>{c.w ? c.w + "px" : "100%"}</span>
            <div style={{
              height: 8,
              width: c.w ? Math.min(c.w / 1.6, 600) : 600,
              background: "linear-gradient(90deg, var(--accent-9), var(--accent-7))",
              borderRadius: 2,
            }}/>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.desc}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>12-Column Grid (Desktop)</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Gutter 16px · MUI Grid v2 또는 CSS grid 양쪽 모두 사용 가능.</div>
      </div>
      <div style={{ background: "var(--bg-tint)", padding: 14, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 8, marginBottom: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{
              height: 36, background: "var(--accent-3)",
              border: "1px solid var(--accent-4)",
              borderRadius: 4,
              display: "grid", placeItems: "center",
              fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent-11)",
              fontWeight: 600,
            }}>{i+1}</div>
          ))}
        </div>
        {/* Common layouts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { name: "Full",       cols: [12], use: "Hero, lists" },
            { name: "Half",       cols: [6, 6], use: "Two-column form" },
            { name: "Sidebar 4/8", cols: [4, 8], use: "Filter rail + content" },
            { name: "Sidebar 3/9", cols: [3, 9], use: "Project filter + main" },
            { name: "Detail",     cols: [8, 4], use: "Content + sticky meta panel" },
            { name: "Thirds",     cols: [4, 4, 4], use: "Card grid (3 cols)" },
            { name: "Quarters",   cols: [3, 3, 3, 3], use: "Stat cards (4 cols)" },
          ].map((row) => (
            <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 100, fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{row.name}</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 4, flex: 1, maxWidth: 540 }}>
                {row.cols.flatMap((c, ci) => Array.from({ length: c }).map((_, idx) => (
                  <div key={`${ci}-${idx}`} style={{
                    height: 18, gridColumn: idx === 0 ? `span ${c}` : "auto",
                    background: ["var(--accent-9)", "var(--info-9)", "var(--success-9)", "var(--warning-9)"][ci % 4],
                    borderRadius: 2,
                    display: idx === 0 ? "block" : "none",
                  }}/>
                )))}
              </div>
              <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{row.use}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Gutter & Page Padding</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>row gap / column gap 표준 + 페이지 측면 패딩.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { name: "tight",   v: 8,  use: "card 내부, chip 사이" },
          { name: "default", v: 16, use: "section · grid gutter" },
          { name: "loose",   v: 24, use: "큰 카드 사이, 페이지 측면" },
        ].map((g) => (
          <div key={g.name} style={{ padding: 14, border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginBottom: 6 }}>gap-{g.name} · {g.v}px</div>
            <div style={{ display: "flex", gap: g.v, marginBottom: 6 }}>
              {[0,1,2,3].map((i) => <div key={i} style={{ flex: 1, height: 24, background: "var(--accent-3)", borderRadius: 3, border: "1px solid var(--accent-4)" }}/>)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{g.use}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 2) DATA TABLE
// ============================================================
function DataTableCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
      display: "flex", flexDirection: "column", gap: 18,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Data Table — 표준 패턴</div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>관리자 페이지, 히스토리, 로그 등 데이터 리스트의 일관 패턴.</div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-surface)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>실행 히스토리</span>
          <span className="tab__count">247</span>
          <div style={{ position: "relative", flex: 1, maxWidth: 280, marginLeft: 12 }}>
            <input className="input" placeholder="검색…" style={{ paddingLeft: 28, fontSize: 12 }}/>
            <span style={{ position: "absolute", left: 8, top: 8, color: "var(--text-tertiary)" }}><Isd.Search size={12}/></span>
          </div>
          <button className="btn btn--secondary btn--sm"><Isd.Filter size={12}/> 필터</button>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--icon btn--sm"><Isd.Refresh size={12}/></button>
          <button className="btn btn--ghost btn--icon btn--sm"><Isd.ArrowDown size={12}/></button>
        </div>

        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr 120px 100px 140px 80px 32px",
          padding: "8px 14px",
          gap: 10,
          fontSize: 10, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.06em",
          color: "var(--text-tertiary)",
          background: "var(--bg-tint)",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <span><input type="checkbox"/></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            파이프라인 <Isd.ArrowDown size={10}/>
          </span>
          <span>프로젝트</span>
          <span>상태</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            시각 <Isd.ArrowDown size={10}/>
          </span>
          <span style={{ textAlign: "right" }}>소요</span>
          <span/>
        </div>

        {/* Rows */}
        {[
          { name: "NPC 생성",     project: "Mages", status: "완료",    tone: "success", time: "방금",      took: "2:35",  sel: false },
          { name: "배경 시리즈 v3", project: "Cryo",  status: "실행 중", tone: "info",    time: "5분 전",    took: "—",     sel: true },
          { name: "NPC 생성",     project: "Mages", status: "완료",    tone: "success", time: "1시간 전",  took: "2:22",  sel: false },
          { name: "캐릭터 → 영상", project: "Mages", status: "실패",    tone: "danger",  time: "3시간 전",  took: "0:54",  sel: false },
          { name: "NPC 생성",     project: "Mages", status: "완료",    tone: "success", time: "어제",      took: "2:30",  sel: false },
        ].map((r, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 120px 100px 140px 80px 32px",
            padding: "12px 14px",
            gap: 10,
            alignItems: "center",
            fontSize: 13,
            background: r.sel ? "var(--accent-1)" : (i % 2 === 1 ? "var(--bg-tint)" : "white"),
            borderBottom: "1px solid var(--border-subtle)",
            cursor: "pointer",
          }}>
            <span><input type="checkbox" defaultChecked={r.sel}/></span>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.project}</span>
            <span className={"chip chip--" + r.tone + " chip--tag"}>
              {r.tone === "info" && <Isd.Spinner className="spin" size={10}/>}
              {r.tone === "success" && <Isd.Check size={10}/>}
              {r.tone === "danger" && <Isd.X size={10}/>}
              {r.status}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{r.time}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{r.took}</span>
            <button className="btn btn--ghost btn--icon btn--sm"><Isd.Dots /></button>
          </div>
        ))}

        {/* Footer */}
        <div style={{
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 12, color: "var(--text-tertiary)",
          background: "var(--bg-tint)",
        }}>
          <span><span style={{ fontWeight: 600, color: "var(--accent-11)" }}>1</span>개 선택됨</span>
          <span style={{ flex: 1 }}/>
          <span>1–5 / 247</span>
          <button className="btn btn--ghost btn--icon btn--sm"><Isd.ChevronLeft size={12}/></button>
          <button className="btn btn--ghost btn--icon btn--sm"><Isd.ChevronRight size={12}/></button>
        </div>
      </div>

      {/* Patterns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { name: "Sortable header", desc: "헤더 클릭 → ↑/↓ 표시. 한 컬럼만 활성." },
          { name: "Selectable row", desc: "체크박스 컬럼 + bulk action 푸터." },
          { name: "Sticky header", desc: "긴 테이블에서 헤더가 sticky." },
          { name: "Striped rows", desc: "odd row tint (bg-tint) — 가독성." },
          { name: "Empty / Loading", desc: "각각 EmptyShell / shimmer skeleton." },
          { name: "Pagination", desc: "Cursor / 페이지 번호 둘 다 지원." },
        ].map((p) => (
          <div key={p.name} style={{ padding: 12, border: "1px solid var(--border-subtle)", borderRadius: 6, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: "var(--accent-11)", fontSize: 12.5 }}>{p.name}</div>
            <div style={{ color: "var(--text-secondary)", lineHeight: 1.5, marginTop: 3 }}>{p.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 3) FORM PATTERNS
// ============================================================
function FormPatternsCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Form Patterns — 표준 입력 구조</div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32 }}>
        {/* Anatomy */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 10 }}>
            Anatomy
          </div>

          <div style={{ position: "relative", padding: "16px 20px", border: "1px dashed var(--accent-9)", borderRadius: 8, background: "var(--accent-1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-secondary)" }}>프로젝트 이름</span>
              <span style={{ color: "var(--danger-9)" }}>*</span>
              <span style={{ flex: 1 }}/>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>0/64</span>
            </div>
            <input className="input" defaultValue="Mages" />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>한국어/영문 64자 이내</div>

            {/* Callouts */}
            <Callout style={{ top: -8, left: 24 }} text="라벨 + required(*)"/>
            <Callout style={{ top: -8, right: 60 }} text="문자수 카운터"/>
            <Callout style={{ bottom: -22, left: 24 }} text="help text"/>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><strong>라벨</strong>은 항상 상단. placeholder는 라벨 대체 X.</li>
              <li><strong>required</strong>는 <code className="code">*</code> 표시. optional 표시는 별도 안 함.</li>
              <li><strong>help</strong>는 하단 회색 11px. 항상 visible (toggle X).</li>
              <li><strong>error</strong>는 빨강 11px + 입력란 border red. help text 자리 차지.</li>
            </ul>
          </div>
        </div>

        {/* States stacked */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 10 }}>
            States
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              {
                label: "기본 입력", state: "default", val: "",
                placeholder: "프로젝트 이름", help: null,
              },
              {
                label: "포커스", state: "focus", val: "Mages",
                help: "한국어/영문 64자 이내",
              },
              {
                label: "에러", state: "error", val: "Mages!",
                err: "특수문자는 허용되지 않습니다",
              },
              {
                label: "성공", state: "success", val: "Mages",
                ok: "사용 가능한 이름입니다",
              },
              {
                label: "비활성", state: "disabled", val: "readonly-7e2a",
              },
              {
                label: "로딩 (서버 확인 중)", state: "loading", val: "Mages",
              },
            ].map((f, i) => (
              <div key={i}>
                <label className="field-label" style={{ color: f.state === "error" ? "var(--danger-11)" : "var(--text-secondary)" }}>
                  {f.label}{f.state === "error" && <span style={{ color: "var(--danger-9)", marginLeft: 3 }}>*</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    defaultValue={f.val}
                    placeholder={f.placeholder}
                    disabled={f.state === "disabled"}
                    style={
                      f.state === "focus" ? { borderColor: "var(--accent-9)", boxShadow: "var(--shadow-focus)" }
                      : f.state === "error" ? { borderColor: "var(--danger-9)", boxShadow: "0 0 0 3px rgba(213,56,62,0.18)" }
                      : f.state === "success" ? { borderColor: "var(--success-9)" }
                      : f.state === "disabled" ? { background: "var(--bg-subtle)", color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }
                      : {}
                    }
                  />
                  {f.state === "loading" && (
                    <div style={{ position: "absolute", right: 10, top: 9, color: "var(--text-tertiary)" }}>
                      <Isd.Spinner className="spin" size={14}/>
                    </div>
                  )}
                  {f.state === "success" && (
                    <div style={{ position: "absolute", right: 10, top: 9, color: "var(--success-9)" }}>
                      <Isd.Check size={14}/>
                    </div>
                  )}
                </div>
                {f.err && <div style={{ fontSize: 11, color: "var(--danger-11)", marginTop: 4 }}>{f.err}</div>}
                {f.ok && <div style={{ fontSize: 11, color: "var(--success-11)", marginTop: 4 }}>{f.ok}</div>}
                {f.help && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{f.help}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Layouts */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 10 }}>
          Layouts
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { name: "Stacked (default)", desc: "1열 — 모든 폼의 기본. 라벨 위, 입력 아래." },
            { name: "2-column",          desc: "관련 항목 묶음 (이름/사번, 시작/종료 날짜)." },
            { name: "Inline",            desc: "검색 + 필터 같은 1줄 컨트롤. 라벨 생략 가능." },
          ].map((p) => (
            <div key={p.name} style={{ padding: 12, border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: "var(--accent-11)", fontSize: 12.5, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Validation timing */}
      <div style={{ marginTop: 20, padding: 14, background: "var(--info-1)", border: "1px solid var(--info-3)", borderRadius: 6, fontSize: 12.5, color: "var(--info-11)", lineHeight: 1.6 }}>
        <strong>Validation 정책</strong>: 사용자 입력 중에는 검사 안 함. blur 시점 / 제출 시점에만. 단, 비밀번호 강도/문자수 같은 실시간 인디케이터는 입력 중 업데이트.
      </div>
    </div>
  );
}

function Callout({ style, text }) {
  return (
    <div style={{
      position: "absolute",
      padding: "3px 8px",
      background: "var(--accent-9)", color: "white",
      borderRadius: 4,
      fontSize: 10, fontWeight: 600,
      fontFamily: "var(--font-mono)",
      whiteSpace: "nowrap",
      ...style,
    }}>{text}</div>
  );
}

// ============================================================
// 4) DROPDOWN / POPOVER
// ============================================================
function PopoverPatternsCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Dropdowns & Popovers — anchor-positioned overlay</div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 18 }}>
        4가지 변형. 모두 같은 base (drop-shadow, anchor, focus 관리, ESC 닫기) 공유.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {/* Select dropdown */}
        <PopoverSample title="Select / Combobox" desc="↕ 아이콘 + 선택지. 단일 선택. 검색 가능 (combobox).">
          <div style={{ position: "relative", width: 220 }}>
            <button style={{
              width: "100%", padding: "8px 12px",
              background: "white", border: "1px solid var(--border-default)",
              borderRadius: 6, textAlign: "left",
              fontSize: 13, fontFamily: "var(--font-sans)",
              display: "flex", alignItems: "center", gap: 6,
              cursor: "pointer",
            }}>
              <span style={{ flex: 1 }}>DreamShaper XL v2 Turbo</span>
              <Isd.ChevronDown size={12} style={{ color: "var(--text-tertiary)" }}/>
            </button>
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%",
              background: "var(--bg-surface)", border: "1px solid var(--border-default)",
              borderRadius: 6, padding: 4,
              boxShadow: "var(--shadow-3)", zIndex: 1,
            }}>
              {[
                { name: "DreamShaper XL v2 Turbo", active: true },
                { name: "AnimagineXL v3" },
                { name: "RealVisXL v4" },
                { name: "Pony Diffusion v6" },
              ].map((o) => (
                <div key={o.name} style={{
                  padding: "6px 10px",
                  borderRadius: 4,
                  background: o.active ? "var(--accent-3)" : "transparent",
                  color: o.active ? "var(--accent-11)" : "var(--text-primary)",
                  fontWeight: o.active ? 600 : 400,
                  fontSize: 12.5,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Isd.Cube size={11}/>
                  {o.name}
                  {o.active && <Isd.Check size={11} style={{ marginLeft: "auto" }}/>}
                </div>
              ))}
            </div>
          </div>
        </PopoverSample>

        {/* Menu */}
        <PopoverSample title="Action Menu" desc="••• 또는 우클릭. 액션 목록 + 구분선 + 위험 액션 빨강.">
          <div style={{ position: "relative", width: 200 }}>
            <button className="btn btn--ghost btn--icon btn--sm" style={{ marginBottom: 4 }}><Isd.Dots /></button>
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0, width: 200,
              background: "var(--bg-surface)", border: "1px solid var(--border-default)",
              borderRadius: 6, padding: 4,
              boxShadow: "var(--shadow-3)", zIndex: 1,
              fontSize: 12.5,
            }}>
              {[
                { label: "편집",       icon: <Isd.Edit size={12}/>, kbd: ["⌘", "E"] },
                { label: "복제",       icon: <Isd.Copy size={12}/>, kbd: ["⌘", "D"] },
                { label: "이동…",      icon: <Isd.ArrowRight size={12}/> },
                { divider: true },
                { label: "내보내기",   icon: <Isd.ArrowDown size={12}/> },
                { label: "공유 링크",  icon: <Isd.Link size={12}/> },
                { divider: true },
                { label: "삭제",       icon: <Isd.Trash size={12}/>, danger: true, kbd: ["⌫"] },
              ].map((m, i) => m.divider ? (
                <div key={i} style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }}/>
              ) : (
                <div key={i} style={{
                  padding: "6px 10px", borderRadius: 4,
                  color: m.danger ? "var(--danger-11)" : "var(--text-primary)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: m.danger ? "var(--danger-9)" : "var(--text-tertiary)" }}>{m.icon}</span>
                  <span style={{ flex: 1 }}>{m.label}</span>
                  {m.kbd && <span style={{ display: "flex", gap: 2 }}>
                    {m.kbd.map((k) => <span key={k} className="kbd">{k}</span>)}
                  </span>}
                </div>
              ))}
            </div>
          </div>
        </PopoverSample>

        {/* Tooltip */}
        <PopoverSample title="Tooltip" desc="hover 시 작은 라벨. 정보 보조 — 200ms 지연 후 표시.">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn btn--ghost btn--icon btn--sm" style={{ position: "relative" }}>
              <Isd.Info />
            </button>
            <div style={{
              padding: "5px 9px",
              background: "#16181D",
              color: "white",
              borderRadius: 5,
              fontSize: 11.5,
              fontWeight: 500,
              boxShadow: "var(--shadow-2)",
              position: "relative",
            }}>
              명령 팔레트 열기
              <span style={{
                position: "absolute", left: -4, top: "50%", marginTop: -4,
                width: 0, height: 0,
                borderTop: "4px solid transparent",
                borderBottom: "4px solid transparent",
                borderRight: "4px solid #16181D",
              }}/>
              <span className="kbd" style={{ marginLeft: 8, background: "#2A2F3B", color: "#E4E5E9", border: "1px solid #383E4D" }}>⌘K</span>
            </div>
          </div>
        </PopoverSample>

        {/* Date picker preview */}
        <PopoverSample title="Date Picker" desc="달력 popover. 미니 인터페이스 — 단일 / 범위 / 빠른 선택.">
          <div style={{ width: 240 }}>
            <button style={{
              width: "100%", padding: "8px 12px",
              background: "white", border: "1px solid var(--border-default)",
              borderRadius: 6, textAlign: "left",
              fontSize: 13, fontFamily: "var(--font-sans)",
              display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
            }}>
              <Isd.Clock size={12} style={{ color: "var(--text-tertiary)" }}/>
              <span style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12 }}>2026. 5. 24 — 5. 31</span>
              <Isd.ChevronDown size={12} style={{ color: "var(--text-tertiary)" }}/>
            </button>
            <div style={{
              background: "var(--bg-surface)", border: "1px solid var(--border-default)",
              borderRadius: 6, padding: 10, boxShadow: "var(--shadow-3)",
            }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                {["오늘", "7일", "30일", "이번 달", "전체"].map((s, i) => (
                  <button key={s} className="chip" style={{
                    cursor: "pointer", height: 22, padding: "0 8px", fontSize: 11,
                    background: i === 1 ? "var(--accent-9)" : "var(--bg-surface)",
                    color: i === 1 ? "white" : "var(--text-primary)",
                    border: "1px solid " + (i === 1 ? "var(--accent-9)" : "var(--border-default)"),
                  }}>{s}</button>
                ))}
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2,
                fontSize: 11, fontFamily: "var(--font-mono)",
              }}>
                {["일","월","화","수","목","금","토"].map((d) => (
                  <div key={d} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "2px 0" }}>{d}</div>
                ))}
                {Array.from({ length: 31 }).map((_, i) => {
                  const day = i + 1;
                  const inRange = day >= 24 && day <= 30;
                  const isEnd = day === 24 || day === 30;
                  return (
                    <div key={day} style={{
                      textAlign: "center", padding: "3px 0",
                      borderRadius: 3,
                      background: isEnd ? "var(--accent-9)" : inRange ? "var(--accent-3)" : "transparent",
                      color: isEnd ? "white" : inRange ? "var(--accent-11)" : "var(--text-primary)",
                      fontWeight: isEnd ? 700 : 400,
                    }}>{day}</div>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverSample>
      </div>

      {/* Behavior */}
      <div style={{ marginTop: 20, padding: 14, background: "var(--bg-tint)", border: "1px solid var(--border-subtle)", borderRadius: 6, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text-primary)" }}>공통 동작</strong>:
        anchor 기준 자동 flip (뷰포트에 안 맞으면 위/왼쪽) ·
        ESC로 닫힘 ·
        focus는 첫 항목으로 ·
        외부 클릭 시 닫힘 ·
        ↑/↓ 키보드 nav (메뉴/셀렉트)
      </div>
    </div>
  );
}

function PopoverSample({ title, desc, children }) {
  return (
    <div style={{
      border: "1px solid var(--border-subtle)",
      borderRadius: 8,
      padding: 16,
      background: "var(--bg-tint)",
      minHeight: 280,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent-11)" }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, marginBottom: 16, lineHeight: 1.55 }}>{desc}</div>
      <div style={{ paddingLeft: 4 }}>
        {children}
      </div>
    </div>
  );
}

function ViewToggleCard() {
  return (
    <div style={{
      width: 1100, background: "white", border: "1px solid #E2E2DC", borderRadius: 8,
      padding: 24, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>View Toggle — 모든 카탈로그 화면 공통 패턴</div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 18 }}>
        그리드 + 리스트 두 가지 뷰를 무조건 같이 제공. 윈도 탐색기 · macOS Finder · Notion 데이터베이스 등 모든 컬렉션 UI의 기본 패턴.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: 16, border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-tint)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{
              display: "inline-flex", padding: 3, borderRadius: 5,
              background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            }}>
              <span style={{ padding: "4px 10px", background: "var(--bg-surface)", borderRadius: 3, fontSize: 11.5, color: "var(--text-primary)", fontWeight: 500, boxShadow: "var(--shadow-1)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Isd.Grid size={11}/> 그리드
              </span>
              <span style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Isd.Menu size={11}/> 목록
              </span>
            </span>
            <span style={{ fontSize: 11.5, color: "var(--accent-11)", fontWeight: 600 }}>Grid 모드</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} style={{
                aspectRatio: "1/1",
                background: `oklch(94% 0.03 ${i*60})`,
                border: `1px solid oklch(80% 0.05 ${i*60})`,
                borderRadius: 4,
                display: "grid", placeItems: "center",
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: `oklch(40% 0.1 ${i*60})`,
              }}>{i+1}</div>
            ))}
          </div>
        </div>
        <div style={{ padding: 16, border: "1px solid var(--border-subtle)", borderRadius: 8, background: "var(--bg-tint)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{
              display: "inline-flex", padding: 3, borderRadius: 5,
              background: "var(--bg-surface)", border: "1px solid var(--border-subtle)",
            }}>
              <span style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Isd.Grid size={11}/> 그리드
              </span>
              <span style={{ padding: "4px 10px", background: "var(--bg-surface)", borderRadius: 3, fontSize: 11.5, color: "var(--text-primary)", fontWeight: 500, boxShadow: "var(--shadow-1)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Isd.Menu size={11}/> 목록
              </span>
            </span>
            <span style={{ fontSize: 11.5, color: "var(--accent-11)", fontWeight: 600 }}>List 모드</span>
          </div>
          <div style={{ background: "white", border: "1px solid var(--border-subtle)", borderRadius: 4 }}>
            {[0,1,2,3].map((i) => (
              <div key={i} style={{
                padding: "6px 8px", display: "flex", alignItems: "center", gap: 8,
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                fontSize: 11.5,
              }}>
                <div style={{
                  width: 24, height: 24,
                  background: `oklch(94% 0.03 ${i*60})`,
                  border: `1px solid oklch(80% 0.05 ${i*60})`,
                  borderRadius: 3, flex: "0 0 auto",
                }}/>
                <span style={{ flex: 1 }}>항목 {i+1}</span>
                <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{["6.4GB","144MB","18MB","335MB"][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 14, background: "var(--accent-1)", border: "1px solid var(--accent-4)", borderRadius: 6, fontSize: 12.5, color: "var(--accent-12)", lineHeight: 1.7 }}>
        <strong>적용 원칙</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          <li>리스트 뷰는 <strong>썸네일 작게(40~48px) + 메타데이터 추가 컬럼</strong> 형태. 그리드 뷰는 <strong>썸네일 크게(정사각) + 라벨 아래</strong>.</li>
          <li>두 뷰는 같은 데이터 · 같은 정렬 · 같은 필터를 공유. 토글로만 표시 방식이 바뀜.</li>
          <li>모바일 기본은 <strong>list</strong> (썸네일이 작아 가독성 우선). 데스크탑 기본은 <strong>grid</strong>.</li>
          <li>토글 위치는 검색창 우측. 단일 아이콘 버튼 두 개 (그리드/목록).</li>
        </ul>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-tertiary)" }}>
        <strong style={{ color: "var(--text-primary)" }}>적용 화면</strong>:
        모델 관리 · 프로젝트 카탈로그 · 작업판 카탈로그 · 내 컨텐츠 · LoRA 목록 · 검색 결과
      </div>
    </div>
  );
}

Object.assign(window, {
  GridSystemCard, DataTableCard, FormPatternsCard, PopoverPatternsCard, ViewToggleCard,
});
