// page-pipeline-run.jsx — Pipeline Run + History page (desktop + mobile)
// Two states shown side-by-side via small toggle:
//  1) Live running — vertical Stepper with one step active, one done, one queued
//  2) Completed — all done, results preview, restart action

const { useState: useStateP3, useEffect: useEffectP3 } = React;
const Ip3 = window.Icon;

function StepResult({ step, mobile }) {
  const stateColor =
    step.state === "done"   ? "var(--success-9)" :
    step.state === "active" ? "var(--accent-9)" :
    step.state === "error"  ? "var(--danger-9)"  :
                              "var(--border-default)";
  return (
    <div className="step">
      <div className="step__rail">
        <div className={"step__dot" +
          (step.state === "done"   ? " step__dot--done"   : "") +
          (step.state === "active" ? " step__dot--active" : "") +
          (step.state === "error"  ? " step__dot--error"  : "")
        }>
          {step.state === "done"   ? <Ip3.Check size={11}/> :
           step.state === "error"  ? <Ip3.X size={11}/> :
           step.state === "active" ? <Ip3.Spinner className="spin"/> :
                                     step.n}
        </div>
        <div className={"step__line" + (step.state === "done" ? " step__line--done" : "")}/>
      </div>
      <div className="step__body" style={{ paddingBottom: 6 }}>
        <div className="step__title">
          <span>{step.kind}</span>
          <span className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", fontSize: 10, background: "transparent", border: "1px solid var(--border-subtle)" }}>
            {step.input} → {step.output}
          </span>
          {step.state === "active" && (
            <span className="chip chip--info chip--tag">
              <Ip3.Spinner className="spin" size={10}/> 실행 중
            </span>
          )}
          {step.state === "done" && (
            <span className="chip chip--success chip--tag">
              <Ip3.Check size={10}/> 완료 · {step.took}
            </span>
          )}
          {step.state === "queued" && (
            <span className="chip chip--tag">대기</span>
          )}
          {step.state === "error" && (
            <span className="chip chip--danger chip--tag"><Ip3.X size={10}/> 실패</span>
          )}
          {step.state === "done" && !mobile && (
            <button className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }}>
              <Ip3.Refresh size={12}/> 이 단계만 재실행
            </button>
          )}
        </div>
        <div className="step__sub">{step.label}</div>

        {/* Per-step result */}
        {step.state !== "queued" && (
          <div className="card" style={{ marginTop: 10, background: step.state === "done" ? "var(--success-1)" : step.state === "error" ? "var(--danger-1)" : "var(--bg-tint)", borderColor: step.state === "done" ? "var(--success-3)" : step.state === "error" ? "var(--danger-3)" : "var(--border-subtle)" }}>
            <div style={{
              padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 11.5, color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              borderBottom: "1px dashed var(--border-subtle)",
            }}>
              결과 ({step.output})
              <span style={{ flex: 1 }}/>
              {step.state === "done" && (
                <>
                  <span>{step.tokensOrSize}</span>
                  {!mobile && (
                    <>
                      <button className="btn btn--ghost btn--icon btn--sm"><Ip3.Copy /></button>
                      <button className="btn btn--ghost btn--icon btn--sm"><Ip3.Eye /></button>
                    </>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: 12 }}>
              {step.output === "text" ? (
                <pre style={{
                  margin: 0,
                  fontFamily: "var(--font-sans)",
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  color: "var(--text-primary)",
                  maxHeight: mobile ? 140 : 200,
                  overflow: "hidden",
                  position: "relative",
                }}>
                  {step.preview}
                  {step.state === "active" && (
                    <span style={{
                      display: "inline-block", width: 7, height: 14,
                      background: "var(--accent-9)", verticalAlign: "middle",
                      animation: "blink 1s steps(2) infinite", marginLeft: 2,
                    }}/>
                  )}
                </pre>
              ) : step.output === "image" ? (
                <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8 }}>
                  {[0,1,2,3].map((i) => (
                    <div key={i} className="thumb-tile" style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 6,
                      display: "grid", placeItems: "center",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      letterSpacing: "0.04em", textTransform: "uppercase",
                      "--h": 30,
                    }}>character · {i+1}</div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>(결과 없음)</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineRunPage({ mobile }) {
  const [mode, setMode] = useStateP3("running"); // "running" | "done"

  // Auto-progress demo: cycle states gently
  useEffectP3(() => {
    if (mode !== "running") return;
    // pure visual — nothing to do, just blinking caret in preview
  }, [mode]);

  const runningSteps = [
    {
      n: 1, state: "done", kind: "GPT Chat", input: "text", output: "text",
      label: "캐릭터 생성", took: "42초", tokensOrSize: "1,284 토큰",
      preview: `# 캐릭터 설정: 에르난트 그라스벨
**분류:** 남성 / 북방 출신 / 전직 공병 장교 / 현장 개척 기술자
**나이:** 34세
**출신:** 북방 변경의 광산 도시국가

마법과 정치의 긴장 사이에서 단단한 손과 차가운 시선을 가진 인물.
Rusty Blood 시대를 직접 통과한 1세대 개척 기술자.`,
    },
    {
      n: 2, state: "active", kind: "GPT Chat", input: "text", output: "text",
      label: "캐릭터 외형 SDXL 프롬프트", took: "—", tokensOrSize: "—",
      preview: `anime style, full-body character illustration of an adult male frontier engineer officer, 34 years old, 186cm tall, broad-shouldered and sturdy build, rugged northern miner-city origin, sun-tanned light brown skin, short dark brown slightly wavy hair, stubble beard, faint scar on the bridge of the nose, tired cool gray-blue eyes`,
    },
    {
      n: 3, state: "queued", kind: "GPT Image", input: "text", output: "image",
      label: "캐릭터 이미지 생성", took: "—", tokensOrSize: "—", preview: "",
    },
  ];
  const doneSteps = runningSteps.map((s, i) => ({
    ...s,
    state: "done",
    took: ["42초", "1분 18초", "35초"][i],
    tokensOrSize: ["1,284 토큰", "412 토큰", "4 × 1024×1024"][i],
    preview: s.preview || "(이미지 결과 4장)"
  }));
  const steps = mode === "running" ? runningSteps : doneSteps;

  const doneCount = steps.filter(s => s.state === "done").length;
  const progress = mode === "running" ? Math.round(((doneCount + 0.4) / steps.length) * 100) : 100;

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Ip3.ChevronLeft size={12}/> 파이프라인 히스토리
      </a>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">
            NPC 생성
            <span className={mode === "running" ? "chip chip--info" : "chip chip--success"} style={{ fontSize: 12 }}>
              {mode === "running" ? <><Ip3.Spinner className="spin" size={11}/> 실행 중</> : <><Ip3.Check size={11}/> 완료</>}
            </span>
          </h1>
          <p className="page-sub" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>실행 ID</span>
            <span className="code" style={{
              padding: "2px 6px", background: "var(--bg-subtle)", borderRadius: 4,
              color: "var(--text-secondary)",
            }}>run_a47f2c1e</span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span>시작 {mode === "running" ? "1분 22초 전" : "2026. 5. 24. 16:47:29"}</span>
            {mode === "done" && <><span style={{ color: "var(--border-strong)" }}>·</span><span>총 2분 35초</span></>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* Mode toggle (prototype demo control) */}
          <div style={{
            display: "inline-flex", padding: 3, borderRadius: "var(--r-2)",
            background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)",
          }}>
            <button onClick={() => setMode("running")} style={{
              padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12, fontWeight: 500,
              background: mode === "running" ? "var(--bg-surface)" : "transparent",
              color: mode === "running" ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: mode === "running" ? "var(--shadow-1)" : "none",
            }}>실행 중</button>
            <button onClick={() => setMode("done")} style={{
              padding: "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12, fontWeight: 500,
              background: mode === "done" ? "var(--bg-surface)" : "transparent",
              color: mode === "done" ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: mode === "done" ? "var(--shadow-1)" : "none",
            }}>완료</button>
          </div>
          {mode === "running" ? (
            <button className="btn btn--danger"><Ip3.X /> 중단</button>
          ) : (
            <>
              <button className="btn btn--secondary"><Ip3.Refresh /> 재실행</button>
              <button className="btn btn--primary"><Ip3.Bolt /> 결과 활용</button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-2)",
        marginBottom: 16,
        fontSize: 12.5,
      }}>
        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
          {doneCount} / {steps.length} 단계
        </span>
        <div style={{ flex: 1, height: 6, background: "var(--bg-subtle)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            width: progress + "%", height: "100%",
            background: mode === "running"
              ? "linear-gradient(90deg, var(--accent-9), var(--accent-7))"
              : "var(--success-9)",
            transition: "width 0.6s",
          }}/>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)", minWidth: 36, textAlign: "right" }}>
          {progress}%
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 280px", gap: 16, alignItems: "start" }}>
        {/* Main: stepper */}
        <div className="card" style={{ padding: "8px 18px 8px" }}>
          <div className="stepper">
            {steps.map((s, i) => <StepResult key={i} step={s} mobile={mobile}/>)}
          </div>
        </div>

        {/* Right rail: meta + history */}
        {!mobile && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 12 }}>
            <div className="card">
              <div className="card__header">
                <Ip3.Info />
                <span className="card__title">실행 정보</span>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
                {[
                  ["프로젝트", "Mages"],
                  ["파이프라인", "NPC 생성"],
                  ["트리거", "사용자 실행"],
                  ["서버", "comfy-01 (192.168.1.51)"],
                  ["시드", "759815733917"],
                  ["모델", "DreamShaper XL · GPT-Image"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ width: 64, color: "var(--text-tertiary)", flex: "0 0 auto", fontSize: 11.5 }}>{k}</span>
                    <span style={{ fontFamily: ["서버", "시드"].includes(k) ? "var(--font-mono)" : "inherit", fontSize: 12, color: "var(--text-primary)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card__header">
                <Ip3.Clock />
                <span className="card__title">최근 실행</span>
              </div>
              <div>
                {[
                  { t: "방금", input: "남성 캐릭터", state: "running" },
                  { t: "오전 11:32", input: "여성 마법사", state: "done" },
                  { t: "오전 5:41", input: "북방 광부 장교", state: "done" },
                  { t: "어제 20:12", input: "엘프 사절단", state: "error" },
                ].map((r, i, arr) => (
                  <div key={i} style={{
                    padding: "10px 14px",
                    borderTop: i > 0 ? "1px solid var(--border-subtle)" : "none",
                    cursor: "pointer",
                    background: i === 0 ? "var(--accent-1)" : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: r.state === "running" ? "var(--accent-9)" : r.state === "done" ? "var(--success-9)" : "var(--danger-9)",
                        animation: r.state === "running" ? "pulse 1.4s infinite" : "none",
                      }}/>
                      <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.input}</span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{r.t}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card__header">
                <Ip3.Bolt />
                <span className="card__title">다음 작업으로</span>
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {["이 결과를 다른 작업판 입력으로", "이미지로 영상 만들기 (I2V)", "캐릭터를 LoRA 학습 큐에 추가"].map((a, i) => (
                  <button key={i} className="btn btn--secondary btn--sm" style={{ justifyContent: "flex-start", width: "100%" }}>
                    <Ip3.ArrowRight size={12}/> {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes blink { 50% { opacity: 0 } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

Object.assign(window, { PipelineRunPage });
