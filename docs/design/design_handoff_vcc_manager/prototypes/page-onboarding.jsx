// page-onboarding.jsx — Onboarding wizard (첫 가입 직후, 4 단계)

const { useState: useStateOb } = React;
const Iob = window.Icon;

function OnboardingPage({ mobile }) {
  const [step, setStep] = useStateOb(2); // 0..3

  const steps = [
    { l: "환영", icon: <Iob.Sparkle /> },
    { l: "프로젝트", icon: <Iob.Folder /> },
    { l: "세계관", icon: <Iob.Doc /> },
    { l: "준비 완료", icon: <Iob.Check /> },
  ];

  return (
    <div style={{
      width: "100%", minHeight: "100%",
      background: "var(--bg-canvas)",
      padding: mobile ? 16 : 32,
      display: "flex", justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, var(--accent-9), var(--accent-11))",
            color: "white", display: "grid", placeItems: "center",
            fontFamily: "var(--font-mono)", fontWeight: 700,
          }}>V</div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>VCC Manager 시작하기</span>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm">건너뛰기 →</button>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
          {steps.map((s, i) => (
            <React.Fragment key={s.l}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  display: "grid", placeItems: "center",
                  background: i < step ? "var(--success-9)" : i === step ? "var(--accent-9)" : "var(--bg-subtle)",
                  color: i <= step ? "white" : "var(--text-tertiary)",
                  border: "1px solid " + (i < step ? "var(--success-9)" : i === step ? "var(--accent-9)" : "var(--border-default)"),
                  boxShadow: i === step ? "0 0 0 4px var(--accent-3)" : "none",
                  flex: "0 0 auto",
                }}>
                  {i < step ? <Iob.Check size={12}/> : <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 700 }}>{i+1}</span>}
                </div>
                {!mobile && (
                  <span style={{
                    fontSize: 11, fontWeight: i === step ? 600 : 400,
                    color: i === step ? "var(--accent-11)" : i < step ? "var(--success-11)" : "var(--text-tertiary)",
                    whiteSpace: "nowrap",
                  }}>{s.l}</span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? "var(--success-9)" : "var(--border-default)", borderRadius: 1, marginTop: -16 }}/>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step body */}
        <div className="card" style={{ padding: mobile ? 20 : 32 }}>
          {step === 0 && <Step0/>}
          {step === 1 && <Step1/>}
          {step === 2 && <Step2 mobile={mobile}/>}
          {step === 3 && <Step3/>}
        </div>

        {/* Footer nav */}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          {step > 0 && (
            <button className="btn btn--secondary" onClick={() => setStep(step - 1)}>
              <Iob.ChevronLeft size={12}/> 이전
            </button>
          )}
          <span style={{ flex: 1 }}/>
          {step < 3 && (
            <button className="btn btn--primary" onClick={() => setStep(step + 1)}>
              다음 <Iob.ArrowRight size={12}/>
            </button>
          )}
          {step === 3 && (
            <button className="btn btn--primary"><Iob.Play size={12}/> VCC Manager 시작</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step0() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, margin: "0 auto 20px",
        borderRadius: 16,
        background: "linear-gradient(135deg, var(--accent-9), #7B4DD8)",
        color: "white", display: "grid", placeItems: "center",
      }}><Iob.Sparkle size={28}/></div>
      <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 0 }}>환영합니다, 쎌렘황제 님</h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 460, margin: "8px auto 0" }}>
        VCC Manager는 ComfyUI · OpenAI · Gemini를 묶어 이미지 · 텍스트 · 영상 생성 워크플로우를 한 곳에서 관리하는 도구입니다.
        몇 가지 설정만 마치면 바로 시작할 수 있어요.
      </p>
      <div style={{
        marginTop: 24,
        padding: 16,
        background: "var(--bg-tint)",
        borderRadius: 8,
        textAlign: "left",
        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7,
      }}>
        <strong style={{ color: "var(--text-primary)" }}>설정 흐름:</strong>
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          <span>1. 첫 프로젝트 만들기 — 작업을 묶는 단위</span>
          <span>2. 세계관 / 시스템 프롬프트 등록 — AI에 항상 제공</span>
          <span>3. 첫 작업판 실행 → 결과 확인</span>
        </div>
      </div>
    </div>
  );
}

function Step1() {
  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 0 }}>첫 프로젝트 만들기</h2>
      <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 22 }}>
        세계관·캠페인·실험 단위로 자산을 묶어둡니다. 나중에 더 추가할 수 있어요.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="field-label">프로젝트 이름</label>
          <input className="input" placeholder="예: Mages" autoFocus/>
        </div>
        <div>
          <label className="field-label">설명 (선택)</label>
          <textarea className="textarea" rows={2} placeholder="동방·북방 마법 정치 / 개척 시대 세계관"/>
        </div>
        <div>
          <label className="field-label">기본 태그</label>
          <div style={{ display: "flex", gap: 6 }}>
            {["세계관", "캠페인", "실험", "스케치"].map((t, i) => (
              <button key={t} className="chip" style={{
                cursor: "pointer", height: 28, padding: "0 12px",
                background: i === 0 ? "var(--accent-9)" : "var(--bg-surface)",
                color: i === 0 ? "white" : "var(--text-primary)",
                border: "1px solid " + (i === 0 ? "var(--accent-9)" : "var(--border-default)"),
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Step2({ mobile }) {
  return (
    <>
      <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 0 }}>세계관 / 시스템 프롬프트</h2>
      <p style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 22 }}>
        AI가 항상 참고하는 컨텍스트입니다. 한 줄도 좋고, 나중에 자세히 적어도 됩니다.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { l: "비워두기", icon: <Iob.Doc />, desc: "나중에 추가" },
          { l: "직접 입력", icon: <Iob.Edit />, desc: "한 번에 작성", active: true },
          { l: "예시 템플릿", icon: <Iob.Magic />, desc: "샘플에서 시작" },
          { l: "파일 업로드", icon: <Iob.Image />, desc: ".md · .txt 가져오기" },
        ].map((t) => (
          <div key={t.l} style={{
            padding: 14, borderRadius: 8,
            border: "1px solid " + (t.active ? "var(--accent-9)" : "var(--border-default)"),
            background: t.active ? "var(--accent-1)" : "var(--bg-surface)",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: t.active ? "var(--accent-9)" : "var(--bg-subtle)",
              color: t.active ? "white" : "var(--text-secondary)",
              display: "grid", placeItems: "center",
            }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.l}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.desc}</div>
            </div>
            {t.active && <Iob.Check size={14} style={{ color: "var(--accent-9)" }}/>}
          </div>
        ))}
      </div>
      <textarea className="textarea" rows={6} defaultValue={"# Mages 세계관 개요\n\n동방·북방 마법 정치 / 개척 시대 세계관.\nRusty Blood 시대 — 마법과 정치의 긴장 사이에서 1세대 개척 기술자들이 등장한 시기."}/>
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8 }}>
        마크다운 형식 · 언제든 수정 가능 · 모든 파이프라인에 컨텍스트로 자동 주입
      </div>
    </>
  );
}

function Step3() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, margin: "0 auto 20px",
        borderRadius: "50%",
        background: "var(--success-3)", color: "var(--success-11)",
        display: "grid", placeItems: "center",
      }}><Iob.Check size={28}/></div>
      <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 0 }}>준비 완료!</h2>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 440, margin: "8px auto 22px" }}>
        Mages 프로젝트가 생성되었습니다. 이제 작업판을 실행하거나 파이프라인을 만들어 보세요.
      </p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
        textAlign: "left", maxWidth: 480, margin: "0 auto",
      }}>
        {[
          { l: "작업판 둘러보기", icon: <Iob.Cube />, hint: "12개 사용 가능" },
          { l: "파이프라인 만들기", icon: <Iob.Pipe />, hint: "단계 연결" },
          { l: "문서 더 쓰기", icon: <Iob.Doc />, hint: "캐릭터·연표 등" },
        ].map((c) => (
          <div key={c.l} style={{
            padding: 14, border: "1px solid var(--border-subtle)", borderRadius: 8,
            background: "var(--bg-tint)", cursor: "pointer",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: "var(--accent-3)", color: "var(--accent-11)",
              display: "grid", placeItems: "center", marginBottom: 8,
            }}>{c.icon}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{c.l}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{c.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingPage });
