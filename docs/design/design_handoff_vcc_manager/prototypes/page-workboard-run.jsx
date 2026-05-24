// page-workboard-run.jsx — Single workboard execution page (journey B)
// Left: input form generated from the workboard's customField spec.
// Right: live preview / queue / past runs.

const { useState: useStateWr } = React;
const Iwr = window.Icon;

function FieldHelp({ children }) {
  return <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{children}</div>;
}

function FormField({ label, hint, children, required, span }) {
  return (
    <div style={{ gridColumn: span === 2 ? "span 2" : "auto" }}>
      <label className="field-label">
        {label}
        {required && <span style={{ color: "var(--danger-9)", marginLeft: 4 }}>*</span>}
      </label>
      {children}
      {hint && <FieldHelp>{hint}</FieldHelp>}
    </div>
  );
}

function SeedField() {
  const [random, setRandom] = useStateWr(true);
  return (
    <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--r-2)", padding: "10px 12px", background: "var(--bg-surface)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>시드 (Seed)</span>
        <span style={{ fontSize: 11.5, color: random ? "var(--accent-11)" : "var(--text-tertiary)" }}>무작위</span>
        <button onClick={() => setRandom(!random)} style={{
          width: 32, height: 18, padding: 2,
          borderRadius: 999,
          background: random ? "var(--accent-9)" : "var(--border-strong)",
          border: 0, cursor: "pointer",
          display: "flex", alignItems: "center",
          justifyContent: random ? "flex-end" : "flex-start",
          transition: "all 120ms",
        }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }}/>
        </button>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <input className="input" defaultValue="7598157339176202" style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: random ? 0.55 : 1 }} disabled={random}/>
        <button className="btn btn--secondary btn--icon" title="새 시드"><Iwr.Refresh size={12}/></button>
      </div>
      <FieldHelp>
        {random ? "무작위 모드에서는 자동으로 시드가 생성됩니다" : "고정 시드로 동일한 결과 재현"}
      </FieldHelp>
    </div>
  );
}

function ModelPicker() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--r-2)",
      background: "var(--bg-surface)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 4,
        background: "linear-gradient(135deg, #7B4DD8, #5B5BD6)",
        flex: "0 0 auto", color: "white", display: "grid", placeItems: "center",
      }}><Iwr.Cube size={14}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>DreamShaper XL v2 Turbo</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>SDXL · 6.4GB · comfy-01</div>
      </div>
      <button className="btn btn--ghost btn--sm"><Iwr.Search size={12}/> 변경</button>
    </div>
  );
}

function LoraChips() {
  const loras = [
    { name: "anime-line-clean", weight: 0.8 },
    { name: "rusty-blood-era",  weight: 0.6 },
  ];
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6,
      padding: "8px 10px",
      border: "1px dashed var(--border-default)",
      borderRadius: "var(--r-2)",
      background: "var(--bg-tint)",
      minHeight: 44,
      alignItems: "center",
    }}>
      {loras.map((l) => (
        <span key={l.name} className="chip" style={{
          background: "var(--bg-surface)", border: "1px solid var(--border-default)",
          padding: "2px 4px 2px 8px", height: 26,
        }}>
          <Iwr.Magic size={11}/>
          <span>{l.name}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>· {l.weight.toFixed(1)}</span>
          <button className="btn btn--ghost btn--icon" style={{ width: 18, height: 18, padding: 0 }}><Iwr.X size={10}/></button>
        </span>
      ))}
      <button className="btn btn--ghost btn--sm" style={{ height: 24 }}><Iwr.Plus size={12}/> LoRA 추가</button>
    </div>
  );
}

function WorkboardRunPage({ mobile }) {
  const [queueOpen, setQueueOpen] = useStateWr(true);

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Iwr.ChevronLeft size={12}/> 작업판 목록
      </a>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "var(--r-3)",
          background: "linear-gradient(135deg, #7B4DD8, #5B5BD6)",
          display: "grid", placeItems: "center",
          color: "white", flex: "0 0 auto",
          boxShadow: "var(--shadow-2)",
        }}><Iwr.Cube size={24}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">
            SDXL T2I — LoRA
            <span className="chip chip--success chip--tag"><Iwr.Check size={10}/> 정상 동작</span>
          </h1>
          <div className="meta-row">
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              ID: 6a0861e2ea0ea151cd860df0
            </span>
            <button className="btn btn--ghost btn--icon btn--sm"><Iwr.Copy size={12}/></button>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>comfy-01 · v3 · 사용횟수 412회</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 360px", gap: 16, alignItems: "start" }}>
        {/* LEFT: form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Basic */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">기본 설정</span>
              <span style={{ flex: 1 }}/>
              <button className="btn btn--ghost btn--sm"><Iwr.Doc size={12}/> 프롬프트 불러오기</button>
              <button className="btn btn--ghost btn--sm" style={{ color: "var(--accent-11)" }}><Iwr.Sparkle size={12}/> AI 프롬프트 생성</button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <FormField label="프롬프트" required hint="명사 위주, 콤마로 구분. 가중치는 (word:1.2) 문법.">
                <textarea className="textarea" rows={4} defaultValue="anime style, full-body, adult male frontier engineer officer, 34 years old, broad-shouldered, sun-tanned skin, short dark brown wavy hair, stubble beard, gray-blue eyes, Rusty Blood era practical clothing, surveyor tools, foggy mountain background, cinematic lighting"/>
              </FormField>

              <FormField label="LoRA">
                <LoraChips/>
              </FormField>

              <FormField label="부정 프롬프트" hint="제외할 요소. (선택)">
                <textarea className="textarea" rows={2} defaultValue="lowres, blurry, watermark, extra fingers, deformed hands, text"/>
              </FormField>

              <SeedField/>
            </div>
          </div>

          {/* Advanced */}
          <div className="card">
            <div className="card__header">
              <span className="card__title">고급 설정</span>
            </div>
            <div style={{
              padding: 16,
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
              gap: 14,
            }}>
              <FormField label="베이스 모델" required>
                <ModelPicker/>
              </FormField>

              <FormField label="이미지 크기">
                <select className="select" defaultValue="1024x1024">
                  <option>768x1024 (인물)</option>
                  <option>1024x1024 (정사각)</option>
                  <option>1024x1536 (세로)</option>
                  <option>1536x1024 (가로)</option>
                </select>
              </FormField>

              <FormField label="샘플링 단계" hint="기본 30 · 빠른 미리보기 20">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min="10" max="60" defaultValue="30" style={{ flex: 1 }}/>
                  <span className="code" style={{ width: 36, textAlign: "right" }}>30</span>
                </div>
              </FormField>

              <FormField label="CFG Scale" hint="프롬프트 충실도">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min="1" max="15" step="0.5" defaultValue="7" style={{ flex: 1 }}/>
                  <span className="code" style={{ width: 36, textAlign: "right" }}>7.0</span>
                </div>
              </FormField>

              <FormField label="업스케일 방법">
                <select className="select" defaultValue="anime6b">
                  <option value="none">사용 안 함</option>
                  <option value="anime6b">Anime6B (×1.5)</option>
                  <option value="ultrasharp">UltraSharp (×2)</option>
                </select>
              </FormField>

              <FormField label="업스케일 노이즈">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="range" min="0" max="1" step="0.05" defaultValue="0.5" style={{ flex: 1 }}/>
                  <span className="code" style={{ width: 36, textAlign: "right" }}>0.50</span>
                </div>
              </FormField>

              <FormField label="배치 수량" span={2}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 4, 8].map((n) => (
                    <button key={n} className={"btn " + (n === 4 ? "btn--primary" : "btn--secondary")} style={{ flex: 1 }}>
                      {n}장
                    </button>
                  ))}
                </div>
              </FormField>
            </div>
          </div>
        </div>

        {/* RIGHT: action panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, position: mobile ? "static" : "sticky", top: 12 }}>
          {/* Run button */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>작업판 정보</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
              {[
                ["서버", "comfy-01 · 192.168.1.51"],
                ["버전", "v3 · 5일 전 수정"],
                ["예상 소요", "약 18초"],
                ["GPU 큐", "1번째"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                  <span style={{ fontFamily: k === "서버" ? "var(--font-mono)" : "inherit", fontSize: 12 }}>{v}</span>
                </div>
              ))}
            </div>
            <button className="btn btn--primary btn--lg" style={{ width: "100%", marginTop: 14, justifyContent: "center" }}>
              <Iwr.Send /> 이미지 생성 시작
            </button>
            <div style={{
              marginTop: 10, padding: 10,
              background: "var(--info-1)", border: "1px solid var(--info-3)",
              borderRadius: "var(--r-2)",
              display: "flex", gap: 8, alignItems: "flex-start",
              color: "var(--info-11)",
            }}>
              <Iwr.Info size={14} style={{ marginTop: 2, flex: "0 0 auto" }}/>
              <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                이미지 생성은 백그라운드에서 처리됩니다. 작업 히스토리에서 진행 상황을 확인할 수 있습니다.
              </div>
            </div>
          </div>

          {/* Preview placeholder */}
          <div className="card">
            <div className="card__header">
              <Iwr.Eye />
              <span className="card__title">미리보기</span>
              <span style={{ flex: 1 }}/>
              <span className="chip chip--tag">대기</span>
            </div>
            <div style={{ padding: 12 }}>
              <div className="thumb-tile" style={{
                aspectRatio: "1/1", borderRadius: 6,
                "--h": 270,
                display: "grid", placeItems: "center",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)", fontSize: 11,
              }}>실행 시 결과 표시</div>
            </div>
          </div>

          {/* Recent results */}
          <div className="card">
            <div className="card__header" style={{ cursor: "pointer" }} onClick={() => setQueueOpen(!queueOpen)}>
              <Iwr.Clock />
              <span className="card__title">최근 실행 결과</span>
              <span className="tab__count" style={{ marginLeft: 4 }}>8</span>
              <span style={{ flex: 1 }}/>
              <Iwr.ChevronDown size={14} style={{ transform: queueOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms", color: "var(--text-tertiary)" }}/>
            </div>
            {queueOpen && (
              <div style={{ padding: 10, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {[30, 270, 200, 80, 0, 320, 180, 50].map((h, i) => (
                  <div key={i} className="thumb-tile" style={{ aspectRatio: "1/1", borderRadius: 4, "--h": h }}/>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { WorkboardRunPage });
