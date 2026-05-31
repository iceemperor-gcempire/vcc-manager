// page-admin-workboards.jsx — Admin: 작업판 관리 (governance)
// 사용자 "작업판 목록"과 카드·2축 필터 레이아웃을 공유 (workboard-shared.jsx).
// 차이: 관리 기능(상태 배지·허용 그룹·편집/더보기) + 새 작업판 생성 + 상태 필터.

const { useState: useStateAw } = React;
const Iaw = window.Icon;

function AdminWorkboardsPage({ mobile, onEdit, onNew }) {
  const [status, setStatus] = useStateAw("all");

  const workboards = [
    { name: "SDXL T2I — LoRA",       kind: "sdxl",      io: "text → image",  desc: "Anime / 캐릭터 일러스트. anime6b 업스케일 자동 적용.", server: "comfy-01", groups: ["all-users", "vip"], fields: 7, status: "published", editedAt: "5분 전",  editedBy: "쎌렘황제" },
    { name: "SDXL T2I — Realistic",  kind: "sdxl",      io: "text → image",  desc: "RealVisXL 기반 사실적 인물·환경.",                    server: "comfy-01", groups: ["all-users"],        fields: 6, status: "published", editedAt: "어제",   editedBy: "한지원" },
    { name: "GPT Image — 1024",      kind: "gpt-image", io: "text → image",  desc: "OpenAI gpt-image-1, 1024 빠른 컨셉 드래프트.",        server: "openai",   groups: ["all-users"],        fields: 4, status: "published", editedAt: "1시간 전", editedBy: "쎌렘황제" },
    { name: "GPT Chat — 캐릭터 설정", kind: "gpt-chat",  io: "text → text",   desc: "시스템 프롬프트 기반 캐릭터 시트 생성.",              server: "openai",   groups: ["all-users", "vip"], fields: 5, status: "published", editedAt: "10분 전", editedBy: "한지원" },
    { name: "Gemini Chat — 시나리오", kind: "gpt-chat",  io: "text → text",   desc: "긴 호흡 시나리오 단편. 2.5 Pro 모델.",                server: "gemini",   groups: ["vip"],              fields: 4, status: "draft",     editedAt: "3일 전",  editedBy: "쎌렘황제" },
    { name: "Comfy I2V — 10초",      kind: "i2v",       io: "image → video", desc: "10초 길이 영상. GPU 점유 시간 김.",                    server: "comfy-02", groups: ["vip"],              fields: 5, status: "draft",     editedAt: "1주 전",  editedBy: "한지원" },
    { name: "LoRA 학습 — 캐릭터",     kind: "lora",      io: "image → lora",  desc: "이미지 30+장으로 캐릭터 LoRA 학습.",                  server: "comfy-01", groups: ["관리자"],            fields: 8, status: "published", editedAt: "2주 전",  editedBy: "쎌렘황제" },
    { name: "ComfyUI — 분기 (실험)",  kind: "sdxl",      io: "text → image",  desc: "조건 분기 워크플로우 — 실험 단계.",                   server: "comfy-01", groups: ["관리자"],            fields: 11,status: "archived",  editedAt: "1개월 전", editedBy: "쎌렘황제" },
  ];

  // 상태 필터를 먼저 적용한 뒤, 공유 2축 필터(출력·서버)를 건다.
  const byStatus = status === "all" ? workboards : workboards.filter((w) => w.status === status);
  const { q, setQ, outSel, svcSel, toggleOut, toggleSvc, clear, counts, filtered } = useWorkboardFilter(byStatus);

  const statuses = [
    { k: "all",       l: "전체",   c: workboards.length },
    { k: "published", l: "게시됨", c: workboards.filter(w => w.status === "published").length },
    { k: "draft",     l: "초안",   c: workboards.filter(w => w.status === "draft").length },
    { k: "archived",  l: "보관",   c: workboards.filter(w => w.status === "archived").length },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">작업판 관리</h1>
          <p className="page-sub" style={{ textWrap: "pretty" }}>작업판 정의 · 출력 형식 · 접근 권한 · 서버 매핑을 관리합니다. 사용자가 실행하는 카탈로그와 같은 정보를 관리 관점에서 봅니다.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary" data-no-intercept><Iaw.Copy /> 가져오기</button>
            <button className="btn btn--primary" data-no-intercept onClick={() => onNew && onNew()}><Iaw.Plus /> 새 작업판</button>
          </div>
        )}
      </div>

      {/* Status filter (admin-only dimension) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto", paddingBottom: 2 }}>
        {statuses.map((s) => (
          <button key={s.k} onClick={() => setStatus(s.k)} style={{
            cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5,
            height: 30, padding: "0 13px", borderRadius: "var(--r-2)", fontSize: 12.5, fontWeight: 600,
            background: status === s.k ? "var(--text-primary)" : "var(--bg-surface)",
            color: status === s.k ? "var(--bg-surface)" : "var(--text-secondary)",
            border: "1px solid " + (status === s.k ? "var(--text-primary)" : "var(--border-default)"),
            transition: "all 120ms",
          }}>
            {s.l}
            <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", opacity: 0.7 }}>{s.c}</span>
          </button>
        ))}
      </div>

      {/* Shared 2-axis filter */}
      <WorkboardFilters
        mobile={mobile}
        q={q} setQ={setQ}
        outSel={outSel} toggleOut={toggleOut}
        svcSel={svcSel} toggleSvc={toggleSvc}
        counts={counts} total={byStatus.length} shown={filtered.length}
        onClear={clear}
      />

      {/* Shared card grid (admin variant) */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {filtered.map((wb) => (
          <WorkboardCard key={wb.name} wb={wb} admin onEdit={onEdit}/>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 40, border: "1px dashed var(--border-strong)", borderRadius: 12, textAlign: "center", color: "var(--text-tertiary)" }}>
          <Iaw.Grid size={32} style={{ margin: "0 auto 12px", opacity: 0.6 }}/>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>조건에 맞는 작업판이 없습니다</div>
          <div style={{ fontSize: 12.5, marginBottom: 16 }}>필터를 줄이거나 새 작업판을 만들어 보세요.</div>
          <button className="btn btn--primary btn--sm" data-no-intercept onClick={() => onNew && onNew()}><Iaw.Plus /> 새 작업판</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AdminWorkboardsPage });
