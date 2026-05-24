// page-pipeline-builder.jsx — Pipeline Builder (NOVEL pattern)
// A horizontal flow lane (left → right) instead of vertical list.
// Each step card:
//  - input/output type pills on top
//  - inline expandable settings (no modal needed)
//  - context-document slots (drag docs in)
//  - between steps: typed rail showing data flow + auto-injection state
// Plus: a "Context palette" left rail with project documents you can drag into steps.

const { useState: useStateP2 } = React;
const Ip2 = window.Icon;

function TypePill({ type, dim }) {
  const colors = {
    text:  { bg: "var(--info-3)",    fg: "var(--info-11)",    icon: <Ip2.Type size={10}/> },
    image: { bg: "#F1ECFE",          fg: "#5B2DBF",           icon: <Ip2.Image size={10}/> },
    video: { bg: "var(--warning-3)", fg: "var(--warning-11)", icon: <Ip2.Play size={10}/> },
    any:   { bg: "var(--bg-subtle)", fg: "var(--text-tertiary)", icon: <Ip2.Refresh size={10}/> },
  };
  const c = colors[type] || colors.any;
  return (
    <span className="chip chip--tag" style={{
      background: dim ? "var(--bg-subtle)" : c.bg,
      color: dim ? "var(--text-tertiary)" : c.fg,
      border: "none",
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.04em",
      fontWeight: 600,
      textTransform: "uppercase",
      fontSize: 10,
    }}>
      {c.icon}
      {type}
    </span>
  );
}

function FlowRail({ from, to, mode = "auto", first }) {
  const ok = from === to;
  const color = ok ? "var(--success-9)" : "var(--warning-9)";
  return (
    <div style={{
      flex: "0 0 110px",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      position: "relative",
      padding: "8px 0",
      gap: 6,
    }}>
      {first ? (
        <>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            display: "grid", placeItems: "center",
            color: "var(--text-secondary)",
          }}>
            <Ip2.Send size={12}/>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            initial
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 2,
            background: ok
              ? `linear-gradient(90deg, var(--accent-9) 0%, ${color} 100%)`
              : `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)`,
            transform: "translateY(-50%)",
          }}/>
          <div style={{
            background: "var(--bg-surface)",
            border: "1px solid " + color,
            color, fontFamily: "var(--font-mono)",
            fontSize: 10,
            padding: "3px 8px",
            borderRadius: "var(--r-pill)",
            position: "relative", zIndex: 1,
            display: "inline-flex", alignItems: "center", gap: 4,
            fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {ok ? <Ip2.Check size={10}/> : <Ip2.Info size={10}/>}
            {ok ? "auto" : "adapt"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", position: "relative", zIndex: 1, background: "var(--bg-canvas)", padding: "0 4px" }}>
            {from} → {to}
          </div>
        </>
      )}
    </div>
  );
}

function StepCard({ step, index, expanded, onToggle, mobile }) {
  const kindIcon = step.kind === "GPT Chat" ? <Ip2.Robot size={14}/> :
                   step.kind === "GPT Image" ? <Ip2.Image size={14}/> :
                   step.kind === "ComfyUI" ? <Ip2.Cube size={14}/> :
                   <Ip2.Bolt size={14}/>;
  return (
    <div style={{
      width: mobile ? "100%" : 320,
      flex: mobile ? "1 1 100%" : "0 0 320px",
      background: "var(--bg-surface)",
      border: "1px solid " + (expanded ? "var(--accent-9)" : "var(--border-default)"),
      borderRadius: "var(--r-3)",
      boxShadow: expanded ? "var(--shadow-3), 0 0 0 3px var(--accent-3)" : "var(--shadow-1)",
      display: "flex", flexDirection: "column",
      transition: "all 200ms cubic-bezier(.2,.7,.3,1)",
      position: "relative",
    }}>
      {/* Drag handle */}
      <button className="btn btn--ghost btn--icon btn--sm" style={{
        position: "absolute", top: 8, right: 8, color: "var(--text-tertiary)",
      }} aria-label="reorder">
        <Ip2.Drag size={14}/>
      </button>

      {/* Type pills row */}
      <div style={{
        padding: "12px 14px 8px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "var(--bg-canvas)",
          border: "1px solid var(--border-default)",
          color: "var(--text-secondary)",
          display: "grid", placeItems: "center",
          fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
        }}>{index + 1}</span>
        <TypePill type={step.input}/>
        <span style={{ color: "var(--text-tertiary)" }}><Ip2.ArrowRight size={11}/></span>
        <TypePill type={step.output}/>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "var(--r-2)",
            background: "var(--accent-3)", color: "var(--accent-11)",
            display: "grid", placeItems: "center",
          }}>{kindIcon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{step.kind}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{step.workboard}</div>
          </div>
          <Ip2.ChevronDown size={14} style={{
            color: "var(--text-tertiary)",
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
            transition: "transform 200ms",
          }}/>
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-primary)" }}>{step.label}</div>
        <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {step.docs.map((d, i) => (
            <span key={i} className="chip chip--tag" style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              fontSize: 11,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: d.color, display: "inline-block" }}/>
              {d.name}
            </span>
          ))}
          {step.docs.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
              컨텍스트 없음
            </span>
          )}
        </div>
      </div>

      {/* Expanded settings */}
      {expanded && (
        <div style={{ padding: "12px 14px 14px", borderTop: "1px dashed var(--border-default)", background: "var(--bg-tint)" }}>
          <label className="field-label">사전 입력 (initial prompt)</label>
          <textarea className="textarea" rows={3} defaultValue={step.preInput} style={{ fontSize: 12.5 }}/>

          <label className="field-label" style={{ marginTop: 10 }}>시스템 프롬프트 / 컨텍스트 문서</label>
          <div style={{
            border: "1px dashed var(--border-default)",
            borderRadius: "var(--r-2)",
            background: "var(--bg-surface)",
            padding: 8,
            minHeight: 40,
            display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center",
          }}>
            {step.docs.length === 0 && (
              <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                ← 좌측 문서를 드래그해서 떨어뜨리세요
              </span>
            )}
            {step.docs.map((d, i) => (
              <span key={i} className="chip chip--tag" style={{
                background: "var(--bg-canvas)",
                border: "1px solid var(--border-default)",
                fontSize: 11.5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: d.color, display: "inline-block" }}/>
                {d.name}
                <Ip2.X size={10} style={{ color: "var(--text-tertiary)", marginLeft: 2 }}/>
              </span>
            ))}
          </div>

          <label className="field-label" style={{ marginTop: 10 }}>메모</label>
          <input className="input" defaultValue={step.note} style={{ fontSize: 12.5 }}/>

          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <button className="btn btn--secondary btn--sm" style={{ flex: 1 }}>
              <Ip2.Eye size={12}/> 단계 단독 실행
            </button>
            <button className="btn btn--danger btn--icon btn--sm"><Ip2.Trash /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function InsertSlot({ mobile, onAdd }) {
  return (
    <div style={{
      flex: mobile ? "1 1 100%" : "0 0 36px",
      display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: mobile ? "6px 0" : "0",
    }}>
      <button
        onClick={onAdd}
        title="단계 삽입"
        style={{
          width: mobile ? "100%" : 28, height: mobile ? 28 : 28,
          border: "1px dashed var(--border-strong)",
          background: "var(--bg-surface)",
          color: "var(--text-tertiary)",
          borderRadius: mobile ? "var(--r-2)" : "50%",
          display: "grid", placeItems: "center",
          cursor: "pointer",
          transition: "all 120ms",
        }}
        onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.color = "var(--accent-11)"; }}
        onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text-tertiary)"; }}
      >
        <Ip2.Plus size={12}/>
      </button>
    </div>
  );
}

function DocPaletteItem({ d }) {
  return (
    <div style={{
      padding: "8px 10px",
      borderRadius: "var(--r-2)",
      border: "1px solid var(--border-subtle)",
      background: "var(--bg-surface)",
      display: "flex", alignItems: "center", gap: 8,
      cursor: "grab",
      fontSize: 12.5,
    }}>
      <Ip2.Drag size={12} style={{ color: "var(--text-tertiary)", flex: "0 0 auto" }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{d.tag} · {d.lines}줄</div>
      </div>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flex: "0 0 auto" }}/>
    </div>
  );
}

function PipelineBuilderPage({ mobile }) {
  const [steps, setSteps] = useStateP2([
    { id: 1, kind: "GPT Chat",  workboard: "world-character-gen",  input: "text", output: "text",
      label: "월드 / 캐릭터 설정 생성",
      preInput: "남성 캐릭터",
      docs: [
        { name: "Mages 세계관 개요", color: "var(--tag-world)" },
        { name: "캐릭터 톤 — 시스템 프롬프트", color: "var(--tag-system)" },
      ],
      note: "초기 프롬프트는 사용자가 실행 시 입력합니다.",
    },
    { id: 2, kind: "GPT Chat",  workboard: "appearance-prompt-builder", input: "text", output: "text",
      label: "외형 묘사 SDXL 프롬프트 변환",
      preInput: "",
      docs: [{ name: "SDXL 프롬프트 가이드", color: "var(--tag-system)" }],
      note: "이전 단계 출력 자동 주입.",
    },
    { id: 3, kind: "GPT Image", workboard: "gpt-image-character",   input: "text", output: "image",
      label: "캐릭터 일러스트 생성 (1024×1024)",
      preInput: "",
      docs: [],
      note: "anime style, full-body",
    },
  ]);
  const [expanded, setExpanded] = useStateP2(2);

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Ip2.ChevronLeft size={12}/> Mages 프로젝트
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 className="page-title">파이프라인 빌더</h1>
        <span className="chip chip--accent">편집 중</span>
      </div>
      <p className="page-sub" style={{ marginBottom: 18 }}>
        작업판을 왼쪽에서 오른쪽으로 연결합니다. 출력 타입이 다음 입력과 일치하면 자동으로 흐릅니다.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "260px 1fr", gap: 16, alignItems: "start" }}>
        {/* Doc palette */}
        {!mobile && (
          <div className="card" style={{ position: "sticky", top: 12 }}>
            <div className="card__header">
              <Ip2.Doc />
              <span className="card__title">컨텍스트 문서</span>
              <span style={{ flex: 1 }}/>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>5</span>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflow: "auto" }}>
              <DocPaletteItem d={{ name: "Mages 세계관 개요", tag: "세계관", lines: 184, color: "var(--tag-world)" }}/>
              <DocPaletteItem d={{ name: "캐릭터 톤 시스템 프롬프트", tag: "시스템", lines: 32, color: "var(--tag-system)" }}/>
              <DocPaletteItem d={{ name: "북방 변경 도시국가", tag: "세계관", lines: 56, color: "var(--tag-world)" }}/>
              <DocPaletteItem d={{ name: "Rusty Blood 연표", tag: "세계관", lines: 41, color: "var(--tag-world)" }}/>
              <DocPaletteItem d={{ name: "SDXL 프롬프트 가이드", tag: "시스템", lines: 78, color: "var(--tag-system)" }}/>
            </div>
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border-subtle)" }}>
              <button className="btn btn--secondary btn--sm" style={{ width: "100%" }}>
                <Ip2.Plus size={12}/> 문서 추가
              </button>
            </div>
          </div>
        )}

        {/* Lane */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input className="input" defaultValue="NPC 생성" style={{ maxWidth: 280, fontWeight: 600, fontSize: 14 }}/>
            <span style={{ flex: 1 }}/>
            <button className="btn btn--secondary btn--sm"><Ip2.Refresh size={12}/> 자동 정렬</button>
            <button className="btn btn--ghost btn--sm"><Ip2.Eye size={12}/> 검증</button>
            <button className="btn btn--secondary btn--sm">취소</button>
            <button className="btn btn--primary btn--sm"><Ip2.Check size={12}/> 저장</button>
          </div>

          <div className="lane" style={{
            display: "flex", flexDirection: mobile ? "column" : "row",
            alignItems: "stretch", padding: mobile ? 12 : 16,
            gap: 0, minHeight: mobile ? 0 : 280,
          }}>
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                {i === 0 && !mobile && <FlowRail first to={s.input}/>}
                {mobile && i > 0 && (
                  <div style={{ padding: "8px 0", display: "flex", justifyContent: "center", color: steps[i-1].output === s.input ? "var(--success-9)" : "var(--warning-9)" }}>
                    <Ip2.ArrowDown size={20}/>
                  </div>
                )}
                {!mobile && i > 0 && (
                  <FlowRail from={steps[i - 1].output} to={s.input}/>
                )}
                <StepCard
                  step={s}
                  index={i}
                  expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  mobile={mobile}
                />
              </React.Fragment>
            ))}
            {!mobile && <InsertSlot/>}
            {!mobile && (
              <div style={{
                flex: "0 0 220px",
                display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                gap: 8,
                border: "1px dashed var(--border-strong)",
                borderRadius: "var(--r-3)",
                color: "var(--text-tertiary)",
                background: "rgba(255,255,255,0.4)",
                padding: 16,
              }}>
                <Ip2.Plus size={20}/>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>새 단계 추가</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", lineHeight: 1.5 }}>
                  작업판을 선택해 마지막 단계의 출력에 연결합니다
                </div>
              </div>
            )}
            {mobile && (
              <button className="btn btn--secondary" style={{ marginTop: 10, justifyContent: "center" }}>
                <Ip2.Plus /> 새 단계 추가
              </button>
            )}
          </div>

          {/* Diagnostic strip */}
          <div style={{
            marginTop: 12,
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px",
            background: "var(--info-1)",
            border: "1px solid var(--info-3)",
            borderRadius: "var(--r-2)",
            fontSize: 12.5,
            color: "var(--info-11)",
          }}>
            <Ip2.Info />
            <div style={{ flex: 1 }}>
              <b>3개 단계, 모두 타입 일치.</b> 실행 시 단계 2의 출력이 단계 3 입력으로 자동 주입됩니다.
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--info-9)" }}>
              평균 소요 ≈ 2분 35초
            </span>
          </div>

          {/* Templates / Recent */}
          {!mobile && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>템플릿에서 추가</span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>· 자주 쓰는 단계 조합</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {[
                  { name: "텍스트 → SDXL 이미지", steps: "GPT Chat → GPT Chat → SDXL T2I", hue: 270 },
                  { name: "이미지 → 영상", steps: "GPT Image → Comfy I2V", hue: 30 },
                  { name: "단편 시나리오 작성", steps: "GPT Chat × 4", hue: 200 },
                ].map((t, i) => (
                  <div key={i} className="card" style={{ padding: 14, cursor: "pointer" }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.background = "var(--accent-1)"; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.background = ""; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "var(--r-2)",
                        background: `oklch(94% 0.04 ${t.hue})`,
                        color: `oklch(40% 0.12 ${t.hue})`,
                        display: "grid", placeItems: "center",
                      }}><Ip2.Layers size={14}/></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{t.steps}</div>
                      </div>
                      <Ip2.Plus size={14} style={{ color: "var(--text-tertiary)" }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Vertical list variant — more traditional, MUI Stepper-like
// Exposed via Tweaks toggle on the prototype.
// ============================================================
function PipelineBuilderListPage({ mobile }) {
  const [steps] = useStateP2([
    { id: 1, kind: "GPT Chat",  workboard: "world-character-gen",  input: "text", output: "text",
      label: "월드 / 캐릭터 설정 생성",
      preInput: "남성 캐릭터",
      docs: [
        { name: "Mages 세계관 개요", color: "var(--tag-world)" },
        { name: "캐릭터 톤 — 시스템 프롬프트", color: "var(--tag-system)" },
      ],
    },
    { id: 2, kind: "GPT Chat",  workboard: "appearance-prompt-builder", input: "text", output: "text",
      label: "외형 묘사 SDXL 프롬프트 변환",
      preInput: "",
      docs: [{ name: "SDXL 프롬프트 가이드", color: "var(--tag-system)" }],
    },
    { id: 3, kind: "GPT Image", workboard: "gpt-image-character",   input: "text", output: "image",
      label: "캐릭터 일러스트 생성 (1024×1024)",
      preInput: "",
      docs: [],
    },
  ]);

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Ip2.ChevronLeft size={12}/> Mages 프로젝트
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 className="page-title">파이프라인 빌더</h1>
        <span className="chip chip--accent">편집 중</span>
        <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", textTransform: "uppercase", fontSize: 10 }}>VARIANT · LIST</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, marginBottom: 16 }}>
        <input className="input" defaultValue="NPC 생성" style={{ maxWidth: 280, fontWeight: 600, fontSize: 14 }}/>
        <span style={{ flex: 1 }}/>
        <button className="btn btn--secondary btn--sm">취소</button>
        <button className="btn btn--primary btn--sm"><Ip2.Check size={12}/> 저장</button>
      </div>

      <div className="card" style={{ padding: "8px 18px" }}>
        <div className="stepper">
          {steps.map((s, i) => (
            <div key={s.id} className="step" style={{ padding: "16px 0" }}>
              <div className="step__rail">
                <div className="step__dot" style={{ background: "var(--accent-3)", color: "var(--accent-11)", border: "1px solid var(--accent-4)" }}>{i + 1}</div>
                <div className="step__line"/>
              </div>
              <div className="step__body" style={{ paddingBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.kind}</span>
                  <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{s.input} → {s.output}</span>
                  <span style={{ flex: 1 }}/>
                  {!mobile && (
                    <>
                      <button className="btn btn--ghost btn--icon btn--sm"><Ip2.Drag /></button>
                      <button className="btn btn--ghost btn--icon btn--sm"><Ip2.Trash /></button>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, marginBottom: 10 }}>{s.label}</div>

                <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <div>
                    <label className="field-label">사전 입력</label>
                    <input className="input" defaultValue={s.preInput} placeholder="(이전 단계 결과를 자동 주입)"/>
                  </div>
                  <div>
                    <label className="field-label">컨텍스트 문서</label>
                    <div style={{
                      border: "1px solid var(--border-default)", borderRadius: 6,
                      padding: "4px 6px", minHeight: 32,
                      display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
                      background: "var(--bg-surface)",
                    }}>
                      {s.docs.map((d, j) => (
                        <span key={j} className="chip chip--tag" style={{ background: "var(--bg-subtle)" }}>
                          <span style={{ width: 6, height: 6, borderRadius: 2, background: d.color, display: "inline-block" }}/>
                          {d.name}
                        </span>
                      ))}
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", padding: "0 4px" }}>+ 추가</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add step row */}
          <div className="step" style={{ padding: "14px 0" }}>
            <div className="step__rail">
              <div className="step__dot" style={{ background: "var(--bg-surface)", borderStyle: "dashed", color: "var(--text-tertiary)" }}>
                <Ip2.Plus size={12}/>
              </div>
            </div>
            <div className="step__body">
              <button className="btn btn--secondary btn--sm" style={{ width: mobile ? "100%" : "auto" }}>
                <Ip2.Plus size={12}/> 단계 추가
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PipelineBuilderPage, PipelineBuilderListPage });
