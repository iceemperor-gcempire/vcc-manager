// page-admin-stats.jsx — 시스템 통계 (admin)
// GPU usage, throughput, per-user, per-project — dashboard for admin.

const Iast = window.Icon;

function StatBig({ label, val, sub, color = "var(--text-primary)" }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 6, color }}>{val}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, max, color = "var(--accent-9)", height = 100 }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, padding: "0 4px" }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: (v / max) * 100 + "%",
          background: color,
          borderRadius: "3px 3px 0 0",
          opacity: 0.45 + (i / data.length) * 0.55,
          minHeight: 2,
        }}/>
      ))}
    </div>
  );
}

function AdminStatsPage({ mobile }) {
  const dailyImages = [42, 67, 53, 89, 71, 94, 112, 98, 135, 142, 168, 187, 156, 201, 234, 188, 247];
  const dailyMax = Math.max(...dailyImages);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">시스템 통계</h1>
          <p className="page-sub">생성량 · GPU 사용 · 사용자별 활동 · 비용. 최근 30일 기준.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <select className="select" defaultValue="30d" style={{ width: 120, fontSize: 12 }}>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="90d">최근 90일</option>
              <option value="all">전체</option>
            </select>
            <button className="btn btn--secondary"><Iast.ArrowDown /> CSV 내보내기</button>
          </div>
        )}
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        <StatBig label="총 생성 (30일)" val="2,847" sub="↑ 28% vs 이전 30일" color="var(--success-11)"/>
        <StatBig label="활성 사용자" val="34 / 47" sub="72% 활성률"/>
        <StatBig label="GPU 시간" val="412h" sub="평균 점유 62%"/>
        <StatBig label="추정 비용" val="$1,247" sub="$612 OpenAI · $635 GPU"/>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.5fr 1fr", gap: 14, marginBottom: 18 }}>
        {/* Generation trend */}
        <div className="card">
          <div className="card__header">
            <Iast.Stats />
            <span className="card__title">일일 생성 추이</span>
            <span style={{ flex: 1 }}/>
            <span className="chip chip--success chip--tag">↑ 28%</span>
          </div>
          <div style={{ padding: 16 }}>
            <BarChart data={dailyImages} max={dailyMax} height={140}/>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              <span>5/8</span><span>5/15</span><span>5/22</span><span>오늘</span>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 14, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
              {[
                { l: "오늘", v: 247 }, { l: "평균", v: 168 }, { l: "피크", v: 247 }, { l: "총계", v: 2847 },
              ].map((s) => (
                <div key={s.l} style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.l}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.v.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Server utilization */}
        <div className="card">
          <div className="card__header">
            <Iast.Server />
            <span className="card__title">서버 사용률</span>
          </div>
          <div style={{ padding: 14 }}>
            {[
              { name: "comfy-01", load: 84, hours: 142, color: "var(--warning-9)" },
              { name: "comfy-02", load: 62, hours: 88,  color: "var(--accent-9)" },
              { name: "openai",   load: 31, hours: 0,   color: "var(--success-9)", note: "API" },
              { name: "gemini",   load: 12, hours: 0,   color: "var(--success-9)", note: "API" },
              { name: "local-llama", load: 100, hours: 12, color: "var(--danger-9)", note: "과부하" },
            ].map((s) => (
              <div key={s.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, fontFamily: "var(--font-mono)" }}>{s.name}</span>
                  {s.note && <span style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.note}</span>}
                  <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{s.load}%</span>
                </div>
                <div style={{ height: 5, background: "var(--bg-subtle)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: s.load + "%", height: "100%", background: s.color }}/>
                </div>
                {s.hours > 0 && <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{s.hours}h GPU</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tables row */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        {/* Top users */}
        <div className="card">
          <div className="card__header">
            <Iast.Users />
            <span className="card__title">사용자별 활동 (Top)</span>
          </div>
          <div>
            {[
              { name: "쎌렘황제",   role: "admin", uses: 412, color: "linear-gradient(135deg,#6B6BE0,#9B6BD8)" },
              { name: "한지원",     role: "vip",   uses: 248, color: "linear-gradient(135deg,#2F77E4,#4E8EE8)" },
              { name: "Kim Minjae", role: "user",  uses: 187, color: "linear-gradient(135deg,#0F9385,#2EBA6B)" },
              { name: "박서연",     role: "user",  uses: 124, color: "linear-gradient(135deg,#BE7415,#D69021)" },
              { name: "정현우",     role: "user",  uses: 64,  color: "linear-gradient(135deg,#5B5BD6,#7676E0)" },
            ].map((u, i, arr) => (
              <div key={u.name} style={{
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
              }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", width: 16 }}>{i+1}</span>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: u.color, color: "white", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center" }}>{u.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{u.role}</div>
                </div>
                {/* Mini bar */}
                <div style={{ width: 100, height: 4, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: (u.uses / 412 * 100) + "%", height: "100%", background: "var(--accent-9)" }}/>
                </div>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", width: 40, textAlign: "right" }}>{u.uses}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top workboards */}
        <div className="card">
          <div className="card__header">
            <Iast.Cube />
            <span className="card__title">작업판별 사용 (Top)</span>
          </div>
          <div>
            {[
              { name: "SDXL T2I — LoRA",    runs: 412, server: "comfy-01" },
              { name: "GPT Chat — 캐릭터 설정", runs: 248, server: "openai" },
              { name: "GPT Image — 1024",   runs: 187, server: "openai" },
              { name: "GPT Chat — SDXL 변환", runs: 156, server: "openai" },
              { name: "Comfy I2V — 4초",    runs: 64,  server: "comfy-02" },
            ].map((w, i, arr) => (
              <div key={w.name} style={{
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
                borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
              }}>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", width: 16 }}>{i+1}</span>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--accent-3)", color: "var(--accent-11)", display: "grid", placeItems: "center" }}><Iast.Cube size={13}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{w.server}</div>
                </div>
                <div style={{ width: 80, height: 4, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: (w.runs / 412 * 100) + "%", height: "100%", background: "var(--accent-9)" }}/>
                </div>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", width: 40, textAlign: "right" }}>{w.runs}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminStatsPage });
