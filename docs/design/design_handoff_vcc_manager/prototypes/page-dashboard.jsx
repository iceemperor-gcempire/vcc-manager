// page-dashboard.jsx — Landing dashboard (first screen after login)
// Widgets: greeting + quick actions / running pipelines / recent projects /
// recent generations grid / activity stats.

const Id = window.Icon;

function StatCard({ label, value, delta, hint }) {
  return (
    <div className="card" style={{ padding: 16, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{value}</div>
        {delta && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: delta.startsWith("+") ? "var(--success-11)" : "var(--danger-11)",
            background: delta.startsWith("+") ? "var(--success-3)" : "var(--danger-3)",
            padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)",
          }}>{delta}</span>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6 }}>{hint}</div>
    </div>
  );
}

function MiniSparkline({ values, color = "var(--accent-9)" }) {
  const max = Math.max(...values), min = Math.min(...values);
  const w = 120, h = 32, range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={pts + ` ${w},${h} 0,${h}`} fill={color} opacity="0.08"/>
    </svg>
  );
}

function RunningPipelineRow({ p }) {
  return (
    <div style={{
      padding: "12px 14px",
      borderBottom: "1px solid var(--border-subtle)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-9)", animation: "pulse 1.4s infinite", flex: "0 0 auto" }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>· {p.project}</span>
        </div>
        <div style={{ marginTop: 5, display: "flex", gap: 4, alignItems: "center" }}>
          <div style={{ height: 4, flex: 1, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: p.progress + "%", height: "100%", background: "var(--accent-9)" }}/>
          </div>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", minWidth: 30, textAlign: "right" }}>{p.progress}%</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{p.eta}</span>
    </div>
  );
}

function ProjectCard({ p }) {
  return (
    <div className="card" style={{ padding: 12, cursor: "pointer", transition: "all 120ms" }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.background = "var(--accent-1)"; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: p.gradient,
        color: "white", fontWeight: 700, fontSize: 16,
        display: "grid", placeItems: "center",
        marginBottom: 10,
        boxShadow: "var(--shadow-1)",
      }}>{p.name[0]}</div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
        {p.images}장 · {p.pipelines}개 파이프라인 · {p.updated}
      </div>
    </div>
  );
}

function DashboardPage({ mobile }) {
  const running = [
    { name: "NPC 생성", project: "Mages", progress: 67, eta: "1분 12초" },
    { name: "배경 시리즈 v3", project: "Cryo", progress: 23, eta: "약 4분" },
    { name: "캐릭터 → 영상 (I2V)", project: "Mages", progress: 89, eta: "30초" },
  ];
  const projects = [
    { name: "Mages",       images: 124, pipelines: 4, updated: "5분 전", gradient: "linear-gradient(135deg, #7B4DD8, #5B5BD6)" },
    { name: "Cryo",        images: 88,  pipelines: 2, updated: "어제",   gradient: "linear-gradient(135deg, #2F77E4, #4E8EE8)" },
    { name: "Astral Pact", images: 41,  pipelines: 1, updated: "2일 전", gradient: "linear-gradient(135deg, #BE7415, #D69021)" },
    { name: "초안 모음",    images: 12,  pipelines: 0, updated: "1주 전", gradient: "linear-gradient(135deg, #5B616E, #8A8F9A)" },
  ];
  const quick = [
    { label: "새 프로젝트", icon: <Id.Plus />, primary: true },
    { label: "작업판 실행", icon: <Id.Play /> },
    { label: "파이프라인 만들기", icon: <Id.Pipe /> },
    { label: "이미지 업로드", icon: <Id.Image /> },
  ];

  return (
    <div>
      {/* Greeting */}
      <div className="dashboard-hero" style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            2026. 5. 24. 일요일 · 오후
          </div>
          <h1 className="page-title">안녕하세요, 쎌렘황제 님</h1>
          <p className="page-sub" style={{ textWrap: "pretty" }}>현재 <b style={{ color: "var(--accent-11)" }}>3개 파이프라인</b>이 실행 중입니다. 어제 대비 이미지 생성량이 <b style={{ color: "var(--success-11)" }}>+18%</b> 늘었어요.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: "0 1 auto" }}>
            {quick.map((q, i) => (
              <button key={i} className={"btn " + (q.primary ? "btn--primary" : "btn--secondary")}>
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main two-column */}
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1.4fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Running pipelines */}
          <div className="card">
            <div className="card__header">
              <Id.Spinner className="spin" style={{ color: "var(--accent-9)" }}/>
              <span className="card__title">실행 중 파이프라인</span>
              <span className="tab__count" style={{ marginLeft: 6 }}>3</span>
              <span style={{ flex: 1 }}/>
              <a href="#" style={{ fontSize: 12, color: "var(--accent-11)", textDecoration: "none" }}>모두 보기 →</a>
            </div>
            {running.map((p, i) => <RunningPipelineRow key={i} p={p}/>)}
          </div>

          {/* Recent projects */}
          <div className="card">
            <div className="card__header">
              <Id.Folder />
              <span className="card__title">최근 프로젝트</span>
              <span style={{ flex: 1 }}/>
              <a href="#" style={{ fontSize: 12, color: "var(--accent-11)", textDecoration: "none" }}>모두 보기 →</a>
            </div>
            <div style={{ padding: 14, display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10 }}>
              {projects.map((p) => <ProjectCard key={p.name} p={p}/>)}
            </div>
          </div>

          {/* Recent generations */}
          <div className="card">
            <div className="card__header">
              <Id.Image />
              <span className="card__title">최근 생성 이미지</span>
              <span style={{ flex: 1 }}/>
              <a href="#" style={{ fontSize: 12, color: "var(--accent-11)", textDecoration: "none" }}>컨텐츠 라이브러리 →</a>
            </div>
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: mobile ? "repeat(3,1fr)" : "repeat(6,1fr)", gap: 6 }}>
              {[30, 270, 200, 80, 0, 320, 180, 50, 220, 130, 100, 240].slice(0, mobile ? 6 : 12).map((h, i) => (
                <div key={i} className="thumb-tile" style={{
                  aspectRatio: "1/1", borderRadius: 4,
                  "--h": h,
                }}/>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Generation activity */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>주간 생성 추이</span>
              <span style={{ flex: 1 }}/>
              <span className="chip chip--success chip--tag">+18%</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <MiniSparkline values={[32, 41, 28, 52, 47, 61, 73]}/>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>오늘</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>73</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>평균</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>48</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>피크</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>73</div>
              </div>
            </div>
          </div>

          {/* Server status */}
          <div className="card">
            <div className="card__header">
              <Id.Server />
              <span className="card__title">서버 상태</span>
              <span style={{ flex: 1 }}/>
              <span className="chip chip--success chip--tag"><span className="chip__dot"/>모두 정상</span>
            </div>
            <div>
              {[
                { name: "comfy-01", host: "192.168.1.51", load: 84, status: "busy" },
                { name: "comfy-02", host: "192.168.1.52", load: 12, status: "idle" },
                { name: "openai",   host: "api.openai.com", load: 31, status: "idle" },
                { name: "gemini",   host: "ai.googleapis.com", load: 0,  status: "idle" },
              ].map((s, i, a) => (
                <div key={s.name} style={{
                  padding: "10px 14px",
                  borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: s.status === "busy" ? "var(--warning-9)" : "var(--success-9)",
                    flex: "0 0 auto",
                  }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{s.host}</div>
                  </div>
                  <div style={{ width: 80 }}>
                    <div style={{ height: 4, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: s.load + "%", height: "100%",
                        background: s.load > 75 ? "var(--warning-9)" : "var(--success-9)" }}/>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)", textAlign: "right", marginTop: 1, fontFamily: "var(--font-mono)" }}>{s.load}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top tags */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>자주 사용하는 작업판</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { name: "SDXL T2I — LoRA", count: 412 },
                { name: "GPT Chat — 캐릭터 설정", count: 248 },
                { name: "GPT Image — 1024", count: 187 },
                { name: "Comfy I2V — 4초", count: 64 },
              ].map((t, i) => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", width: 16 }}>{i+1}</span>
                  <span style={{ fontSize: 12.5, flex: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{t.count}회</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage });
