// page-workboard-editor.jsx — Admin: customField designer (novel UI)
// Three-pane layout:
//   1) Field-type palette (left)
//   2) Field list + per-field inspector (middle)
//   3) Live form preview rendered the way users will see it (right)
// Plus header: name / output type / server / permissions

const { useState: useStateWe } = React;
const Iwe = window.Icon;

const FIELD_TYPES = [
  { t: "text",   icon: <Iwe.Type />,    label: "텍스트",      hint: "한 줄 입력" },
  { t: "prompt", icon: <Iwe.Sparkle />, label: "프롬프트",    hint: "다중 라인 + AI 생성" },
  { t: "number", icon: <Iwe.Stats />,   label: "숫자",        hint: "정수/실수" },
  { t: "select", icon: <Iwe.ChevronDown />, label: "드롭다운", hint: "선택지 중 하나" },
  { t: "slider", icon: <Iwe.Refresh />, label: "슬라이더",    hint: "범위 값" },
  { t: "image",  icon: <Iwe.Image />,   label: "이미지 업로드", hint: "드래그 드롭" },
  { t: "model",  icon: <Iwe.Cube />,    label: "모델 선택",   hint: "화이트리스트" },
  { t: "lora",   icon: <Iwe.Magic />,   label: "LoRA 슬롯",   hint: "이름 + 가중치" },
  { t: "seed",   icon: <Iwe.Refresh />, label: "시드",        hint: "무작위/고정 토글" },
];

function PaletteItem({ ft }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 10px",
      borderRadius: "var(--r-2)",
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      cursor: "grab",
      transition: "all 120ms",
    }}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.background = "var(--accent-1)"; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.background = "var(--bg-surface)"; }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 4,
        background: "var(--accent-3)", color: "var(--accent-11)",
        display: "grid", placeItems: "center",
      }}>{ft.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{ft.label}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-tertiary)" }}>{ft.hint}</div>
      </div>
      <Iwe.Plus size={12} style={{ color: "var(--text-tertiary)" }}/>
    </div>
  );
}

function FieldRow({ f, active, onClick }) {
  const ft = FIELD_TYPES.find((x) => x.t === f.type);
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px",
      borderRadius: "var(--r-2)",
      background: active ? "var(--accent-3)" : "transparent",
      border: "1px solid " + (active ? "var(--accent-9)" : "transparent"),
      cursor: "pointer",
      transition: "all 120ms",
    }}>
      <Iwe.Drag size={14} style={{ color: "var(--text-tertiary)", flex: "0 0 auto", cursor: "grab" }}/>
      <div style={{
        width: 22, height: 22, borderRadius: 4,
        background: active ? "var(--accent-9)" : "var(--bg-subtle)",
        color: active ? "white" : "var(--text-secondary)",
        display: "grid", placeItems: "center",
        flex: "0 0 auto",
      }}>{ft?.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{f.label}</div>
        <div style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{f.key} · {ft?.label}</div>
      </div>
      {f.required && <span className="chip chip--tag" style={{ height: 18, fontSize: 10, color: "var(--danger-11)", background: "var(--danger-3)", border: "none" }}>required</span>}
    </div>
  );
}

// Renders each field type as it will appear to the end user.
function PreviewField({ f }) {
  const labelEl = (
    <label className="field-label">
      {f.label}{f.required && <span style={{ color: "var(--danger-9)", marginLeft: 4 }}>*</span>}
    </label>
  );
  if (f.type === "text")   return (<div>{labelEl}<input className="input" placeholder={f.placeholder || ""}/></div>);
  if (f.type === "prompt") return (<div>{labelEl}<textarea className="textarea" rows={3} placeholder={f.placeholder || ""} defaultValue={f.defaultValue || ""}/></div>);
  if (f.type === "number") return (<div>{labelEl}<input className="input" type="number" defaultValue={f.defaultValue}/></div>);
  if (f.type === "select") return (<div>{labelEl}<select className="select">{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select></div>);
  if (f.type === "slider") return (
    <div>
      {labelEl}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="range" min={f.min || 0} max={f.max || 100} defaultValue={f.defaultValue} style={{ flex: 1 }}/>
        <span className="code" style={{ width: 36, textAlign: "right" }}>{f.defaultValue}</span>
      </div>
    </div>
  );
  if (f.type === "model") return (
    <div>{labelEl}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--r-2)", background: "var(--bg-surface)" }}>
        <div style={{ width: 24, height: 24, borderRadius: 4, background: "linear-gradient(135deg,#7B4DD8,#5B5BD6)", color: "white", display: "grid", placeItems: "center" }}><Iwe.Cube size={12}/></div>
        <div style={{ flex: 1, fontSize: 12.5 }}>모델 선택…</div>
        <Iwe.Search size={12} style={{ color: "var(--text-tertiary)" }}/>
      </div>
    </div>
  );
  if (f.type === "seed") return (
    <div>
      <div style={{ border: "1px solid var(--border-default)", borderRadius: "var(--r-2)", padding: 10, background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{f.label}</span>
          <span style={{ fontSize: 11, color: "var(--accent-11)" }}>무작위</span>
          <div style={{ width: 28, height: 16, borderRadius: 999, background: "var(--accent-9)", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: 2 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "white" }}/>
          </div>
        </div>
        <input className="input" style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 12 }} placeholder="자동 생성"/>
      </div>
    </div>
  );
  if (f.type === "image") return (
    <div>{labelEl}
      <div style={{ border: "1px dashed var(--border-strong)", borderRadius: "var(--r-2)", padding: 20, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5 }}>
        <Iwe.Image style={{ margin: "0 auto 6px" }}/>
        <div>이미지를 끌어다 놓거나 클릭해서 선택</div>
      </div>
    </div>
  );
  if (f.type === "lora") return (
    <div>{labelEl}
      <div style={{ border: "1px dashed var(--border-default)", borderRadius: "var(--r-2)", padding: 10, background: "var(--bg-tint)", minHeight: 40, display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>LoRA 슬롯 — 사용자가 추가</span>
      </div>
    </div>
  );
  return null;
}

function Inspector({ f, onChange }) {
  if (!f) {
    return (
      <div style={{
        padding: 14, color: "var(--text-tertiary)", fontSize: 12.5, textAlign: "center",
        background: "var(--bg-tint)",
        borderRadius: "var(--r-2)",
        border: "1px dashed var(--border-default)",
      }}>
        가운데에서 필드를 선택하면 속성이 여기에 표시됩니다.
      </div>
    );
  }
  return (
    <div style={{
      padding: 14, background: "var(--bg-tint)",
      borderRadius: "var(--r-2)",
      border: "1px solid var(--border-default)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>필드 속성</span>
        <span style={{ flex: 1 }}/>
        <span className="chip chip--accent chip--tag">{f.type}</span>
      </div>
      <div>
        <label className="field-label">라벨</label>
        <input className="input" defaultValue={f.label}/>
      </div>
      <div>
        <label className="field-label">키 (변수명)</label>
        <input className="input" defaultValue={f.key} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}/>
      </div>
      {f.type === "select" && (
        <div>
          <label className="field-label">선택지 (한 줄에 하나)</label>
          <textarea className="textarea" rows={3} defaultValue={(f.options || []).join("\n")} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}/>
        </div>
      )}
      {f.type === "slider" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div><label className="field-label">최소</label><input className="input" defaultValue={f.min}/></div>
          <div><label className="field-label">최대</label><input className="input" defaultValue={f.max}/></div>
          <div><label className="field-label">기본값</label><input className="input" defaultValue={f.defaultValue}/></div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" defaultChecked={f.required}/>
          필수 입력
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
          <input type="checkbox"/>
          고급 설정 그룹
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button className="btn btn--secondary btn--sm" style={{ flex: 1 }}><Iwe.Copy size={12}/> 복제</button>
        <button className="btn btn--danger btn--sm"><Iwe.Trash size={12}/> 삭제</button>
      </div>
    </div>
  );
}

function WorkboardEditorPage({ mobile }) {
  const [fields, setFields] = useStateWe([
    { id: 1, key: "prompt",      label: "프롬프트",     type: "prompt",  required: true,  placeholder: "anime style, ..." },
    { id: 2, key: "negative",    label: "부정 프롬프트", type: "prompt", placeholder: "lowres, blurry" },
    { id: 3, key: "seed",        label: "시드 (Seed)",  type: "seed" },
    { id: 4, key: "baseModel",   label: "베이스 모델",  type: "model",   required: true },
    { id: 5, key: "size",        label: "이미지 크기",  type: "select",  options: ["768x1024", "1024x1024", "1024x1536"], defaultValue: "1024x1024" },
    { id: 6, key: "steps",       label: "샘플링 단계",  type: "slider",  min: 10, max: 60, defaultValue: 30 },
    { id: 7, key: "upscale",     label: "업스케일 방법", type: "select", options: ["사용 안 함", "Anime6B", "UltraSharp"] },
  ]);
  const [sel, setSel] = useStateWe(5);
  const selected = fields.find((f) => f.id === sel);

  // Mobile: render simplified layout (palette → field list → preview as separate sections)
  if (mobile) {
    return (
      <div>
        <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
          <Iwe.ChevronLeft size={12}/> 작업판 관리
        </a>
        <h1 className="page-title">작업판 편집</h1>
        <p className="page-sub">customField 정의는 데스크탑 권장</p>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card__header"><span className="card__title">필드 ({fields.length})</span></div>
            <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {fields.map((f) => (
                <FieldRow key={f.id} f={f} active={sel === f.id} onClick={() => setSel(f.id)}/>
              ))}
            </div>
          </div>
          <Inspector f={selected}/>
          <button className="btn btn--primary"><Iwe.Plus /> 필드 추가</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Iwe.ChevronLeft size={12}/> 작업판 관리
      </a>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <input className="input" defaultValue="SDXL T2I — LoRA" style={{ maxWidth: 320, fontWeight: 700, fontSize: 18, padding: "8px 12px" }}/>
        <span className="chip chip--accent">편집 중</span>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--secondary btn--sm"><Iwe.Eye size={12}/> 미리보기</button>
        <button className="btn btn--secondary btn--sm">취소</button>
        <button className="btn btn--primary btn--sm"><Iwe.Check size={12}/> 저장</button>
      </div>

      {/* Header config */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
          <FormFieldX label="출력 형식">
            <select className="select" defaultValue="image">
              <option value="image">image</option><option value="text">text</option><option value="video">video</option>
            </select>
          </FormFieldX>
          <FormFieldX label="서버">
            <select className="select"><option>comfy-01 · 192.168.1.51</option><option>openai</option></select>
          </FormFieldX>
          <FormFieldX label="허용 그룹">
            <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 8px", border: "1px solid var(--border-default)", borderRadius: "var(--r-2)", background: "var(--bg-surface)" }}>
              <span className="chip chip--tag">all-users</span>
              <span className="chip chip--tag">vip</span>
              <button className="btn btn--ghost btn--icon btn--sm" style={{ marginLeft: "auto" }}><Iwe.Plus size={12}/></button>
            </div>
          </FormFieldX>
          <FormFieldX label="모델 화이트리스트">
            <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "7px 10px", border: "1px solid var(--border-default)", borderRadius: "var(--r-2)", background: "var(--bg-surface)", display: "flex", alignItems: "center", gap: 6 }}>
              <Iwe.Cube size={12}/> 4개 모델 허용
              <span style={{ flex: 1 }}/>
              <Iwe.Edit size={12} style={{ color: "var(--text-tertiary)" }}/>
            </div>
          </FormFieldX>
        </div>
      </div>

      {/* Three panes */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "200px 1fr 1fr",
        gap: 12,
        alignItems: "stretch",
        minHeight: 520,
      }}>
        {/* Palette */}
        <div className="card" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 8px" }}>필드 타입</div>
          {FIELD_TYPES.map((ft) => <PaletteItem key={ft.t} ft={ft}/>)}
        </div>

        {/* Field list + Inspector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="card__header">
              <span className="card__title">필드 순서</span>
              <span className="tab__count" style={{ marginLeft: 6 }}>{fields.length}</span>
              <span style={{ flex: 1 }}/>
              <button className="btn btn--ghost btn--sm"><Iwe.Plus size={12}/> 필드 추가</button>
            </div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {fields.map((f) => (
                <FieldRow key={f.id} f={f} active={sel === f.id} onClick={() => setSel(f.id)}/>
              ))}
            </div>
          </div>
          <Inspector f={selected}/>
        </div>

        {/* Live preview */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card__header">
            <Iwe.Eye />
            <span className="card__title">라이브 프리뷰</span>
            <span style={{ flex: 1 }}/>
            <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>사용자 시점</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, overflow: "auto" }}>
            {fields.map((f) => (
              <div key={f.id} style={{
                padding: 10,
                borderRadius: "var(--r-2)",
                border: "1px solid " + (sel === f.id ? "var(--accent-9)" : "transparent"),
                background: sel === f.id ? "var(--accent-1)" : "transparent",
                margin: "0 -10px",
                transition: "all 150ms",
              }}>
                <PreviewField f={f}/>
              </div>
            ))}
            <button className="btn btn--primary btn--lg" style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>
              <Iwe.Send /> 이미지 생성 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormFieldX({ label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

Object.assign(window, { WorkboardEditorPage });
