// page-workboard-list.jsx — 작업판 카탈로그 (사이드바 "작업판" 클릭 시)
// 일반 사용자용: 실행 카탈로그. 생성/관리 불가 → "새 작업판" 없음.
// 카드 + 2축 필터는 workboard-shared.jsx 와 공유 (관리자 화면과 동일 레이아웃).

function WorkboardListPage({ mobile, onOpenWorkboard }) {
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

  const { q, setQ, outSel, svcSel, toggleOut, toggleSvc, clear, counts, filtered } = useWorkboardFilter(workboards);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">작업판</h1>
          <p className="page-sub" style={{ textWrap: "pretty" }}>한 번의 호출로 실행하는 단위. 파이프라인의 단계로도 사용됩니다.</p>
        </div>
      </div>

      <WorkboardFilters
        mobile={mobile}
        q={q} setQ={setQ}
        outSel={outSel} toggleOut={toggleOut}
        svcSel={svcSel} toggleSvc={toggleSvc}
        counts={counts} total={workboards.length} shown={filtered.length}
        onClear={clear}
      />

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {filtered.map((wb) => (
          <WorkboardCard key={wb.name} wb={wb} onClick={() => onOpenWorkboard && onOpenWorkboard(wb.name)}/>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ padding: 40, border: "1px dashed var(--border-strong)", borderRadius: 12, textAlign: "center", color: "var(--text-tertiary)" }}>
          <Icon.Cube size={32} style={{ margin: "0 auto 12px", opacity: 0.6 }}/>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>조건에 맞는 작업판이 없습니다</div>
          <div style={{ fontSize: 12.5 }}>필터를 줄이거나 초기화해 보세요.</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { WorkboardListPage });
