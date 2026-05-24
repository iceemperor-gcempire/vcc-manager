// canvas-sections.jsx — Token / Component display sections for the design canvas.

const Ic = window.Icon;

function Swatch({ name, value, hex }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto", width: 110 }}>
      <div style={{ height: 56, background: value, borderRadius: 6, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)" }}/>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#16181D" }}>{name}</div>
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#8A8F9A" }}>{hex}</div>
    </div>
  );
}

function ColorRow({ label, items }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {items.map((it) => <Swatch key={it.name} {...it}/>)}
      </div>
    </div>
  );
}

function TokensSwatchesCard() {
  return (
    <div style={{
      width: 1100, background: "white", borderRadius: 8,
      padding: 24, display: "flex", flexDirection: "column", gap: 22,
      border: "1px solid #E2E2DC",
      fontFamily: "var(--font-sans)",
    }}>
      <ColorRow label="Surface · 콘텐츠 표면" items={[
        { name: "bg/canvas",  value: "#F7F7F4", hex: "#F7F7F4" },
        { name: "bg/surface", value: "#FFFFFF", hex: "#FFFFFF" },
        { name: "bg/subtle",  value: "#F1F1ED", hex: "#F1F1ED" },
        { name: "bg/sunken",  value: "#EBEAE5", hex: "#EBEAE5" },
        { name: "bg/tint",    value: "#FAFAF7", hex: "#FAFAF7" },
        { name: "border",     value: "#E2E2DC", hex: "#E2E2DC" },
        { name: "border/strong", value: "#D2D2CA", hex: "#D2D2CA" },
      ]}/>
      <ColorRow label="Navbar · 어두운 사이드바" items={[
        { name: "nav/bg",     value: "#161A22", hex: "#161A22" },
        { name: "nav/hover",  value: "#20252F", hex: "#20252F" },
        { name: "nav/active", value: "#262C39", hex: "#262C39" },
        { name: "nav/border", value: "#232833", hex: "#232833" },
        { name: "nav/text",   value: "#E4E5E9", hex: "#E4E5E9" },
        { name: "nav/dim",    value: "#8A8F9C", hex: "#8A8F9C" },
        { name: "nav/faint",  value: "#5B616E", hex: "#5B616E" },
      ]}/>
      <ColorRow label="Accent · Iris (단일 브랜드 컬러)" items={[
        { name: "accent/2",   value: "#F4F4FE", hex: "#F4F4FE" },
        { name: "accent/3",   value: "#ECECFE", hex: "#ECECFE" },
        { name: "accent/4",   value: "#E0E0FC", hex: "#E0E0FC" },
        { name: "accent/7",   value: "#A6A8E6", hex: "#A6A8E6" },
        { name: "accent/9",   value: "#5B5BD6", hex: "#5B5BD6" },
        { name: "accent/10",  value: "#4F4FC9", hex: "#4F4FC9" },
        { name: "accent/11",  value: "#4040AD", hex: "#4040AD" },
        { name: "accent/12",  value: "#1F1F60", hex: "#1F1F60" },
      ]}/>
      <ColorRow label="Status" items={[
        { name: "success/3",  value: "#DCF4E5", hex: "#DCF4E5" },
        { name: "success/9",  value: "#1F9D55", hex: "#1F9D55" },
        { name: "warning/3",  value: "#FAEBC8", hex: "#FAEBC8" },
        { name: "warning/9",  value: "#BE7415", hex: "#BE7415" },
        { name: "danger/3",   value: "#FBE0E0", hex: "#FBE0E0" },
        { name: "danger/9",   value: "#D5383E", hex: "#D5383E" },
        { name: "info/3",     value: "#DCEBFC", hex: "#DCEBFC" },
        { name: "info/9",     value: "#2F77E4", hex: "#2F77E4" },
      ]}/>
      <ColorRow label="Tag · 내장 태그" items={[
        { name: "tag/world",   value: "#7B4DD8", hex: "#7B4DD8" },
        { name: "tag/system",  value: "#2F77E4", hex: "#2F77E4" },
        { name: "tag/project", value: "#5B5BD6", hex: "#5B5BD6" },
      ]}/>
    </div>
  );
}

function TypeCard() {
  return (
    <div style={{
      width: 1100, background: "white", borderRadius: 8, border: "1px solid #E2E2DC",
      padding: 28, fontFamily: "var(--font-sans)",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Type Scale · Pretendard</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { name: "display", size: 28, lh: 36, weight: 700, label: "VCC Manager — 의미 위계 최상단" },
            { name: "h1",      size: 22, lh: 30, weight: 700, label: "Mages — 페이지 제목" },
            { name: "h2",      size: 18, lh: 26, weight: 700, label: "파이프라인 빌더 — 섹션" },
            { name: "h3",      size: 15, lh: 22, weight: 600, label: "GPT Chat · 캐릭터 생성" },
            { name: "body",    size: 14, lh: 22, weight: 400, label: "본문 — 작업판 A → B → C 직선 시퀀스를 정의합니다." },
            { name: "small",   size: 13, lh: 20, weight: 400, label: "보조 텍스트 — 평균 2분 35초" },
            { name: "tiny",    size: 12, lh: 18, weight: 500, label: "라벨 — 시드 / 메타데이터" },
            { name: "micro",   size: 11, lh: 16, weight: 500, label: "MICRO · UPPERCASE BADGE" },
          ].map((t) => (
            <div key={t.name} style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#8A8F9A", width: 84, flex: "0 0 auto" }}>
                {t.name} · {t.size}/{t.lh} · {t.weight}
              </span>
              <span style={{ fontSize: t.size, lineHeight: t.lh + "px", fontWeight: t.weight, letterSpacing: t.size > 20 ? "-0.01em" : "-0.005em" }}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Mono · JetBrains Mono</div>
        <div style={{ background: "#F7F7F4", border: "1px solid #E2E2DC", borderRadius: 8, padding: 16, fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.7 }}>
          <div style={{ color: "#8A8F9A" }}>// 사용처: ID, 파일명, 메타데이터, 토큰 카운트, 시간</div>
          <div>run_a47f2c1e</div>
          <div>workboard_6a0861e2ea0ea151cd860df0</div>
          <div>1024 × 1024 · 1,284 토큰 · 2분 35초</div>
          <div>seed 7598157339176202</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", margin: "20px 0 12px" }}>Korean tracking</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, background: "#F7F7F4", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "#8A8F9A", fontFamily: "var(--font-mono)", marginBottom: 4 }}>tracking-tight · -0.01em</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>파이프라인 빌더</div>
          </div>
          <div style={{ padding: 12, background: "#F7F7F4", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "#8A8F9A", fontFamily: "var(--font-mono)", marginBottom: 4 }}>tracking-base · -0.005em</div>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>작업판 A → B → C 직선 실행. 단계의 출력 타입이 다음 단계의 입력 타입과 일치하면 자동 주입됩니다.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpaceRadiusShadowCard() {
  const spacing = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];
  const radius = [4, 6, 8, 12, 16, 999];
  const radiusName = ["r-1", "r-2", "r-3", "r-4", "r-5", "r-pill"];
  return (
    <div style={{
      width: 1100, background: "white", borderRadius: 8, border: "1px solid #E2E2DC",
      padding: 24, fontFamily: "var(--font-sans)",
      display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 24,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Spacing · 4-based</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {spacing.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#8A8F9A", width: 56 }}>sp-{i} · {s}px</span>
              <div style={{ height: 14, width: s, background: "#5B5BD6", borderRadius: 2 }}/>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Radius</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {radius.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, background: "#ECECFE", border: "1px solid #5B5BD6", borderRadius: r }}/>
              <div style={{ fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{radiusName[i]}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#8A8F9A" }}>{r}px</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Elevation</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { name: "shadow-1", val: "0 1px 2px rgba(15,18,28,0.05), 0 0 0 1px rgba(15,18,28,0.04)", desc: "flat outline" },
            { name: "shadow-2", val: "0 2px 6px rgba(15,18,28,0.07), 0 1px 2px rgba(15,18,28,0.04)", desc: "card hover" },
            { name: "shadow-3", val: "0 8px 24px rgba(15,18,28,0.10), 0 2px 6px rgba(15,18,28,0.06)", desc: "popover / floating" },
            { name: "shadow-4", val: "0 20px 48px rgba(15,18,28,0.16), 0 4px 12px rgba(15,18,28,0.08)", desc: "modal / sheet" },
          ].map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: "white", borderRadius: 8, boxShadow: s.val, flex: "0 0 auto" }}/>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#8A8F9A" }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComponentsCard() {
  return (
    <div style={{
      width: 1100, background: "white", borderRadius: 8, border: "1px solid #E2E2DC",
      padding: 24, fontFamily: "var(--font-sans)",
      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28,
    }} className="vcc-app" >
      {/* HACK: not inside vcc-app shell but we want styled components */}
      {/* Buttons */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Buttons</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          <button className="btn btn--primary"><Ic.Play size={12}/> 실행</button>
          <button className="btn btn--secondary"><Ic.Edit /> 편집</button>
          <button className="btn btn--ghost"><Ic.Plus /> 추가</button>
          <button className="btn btn--success"><Ic.Check /> 저장</button>
          <button className="btn btn--danger"><Ic.Trash /> 삭제</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
          <button className="btn btn--primary btn--sm">Small</button>
          <button className="btn btn--primary">Medium</button>
          <button className="btn btn--primary btn--lg">Large</button>
          <button className="btn btn--secondary btn--icon"><Ic.Dots /></button>
          <button className="btn btn--secondary btn--icon btn--sm"><Ic.X /></button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", margin: "20px 0 12px" }}>Chips · Status</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          <span className="chip">기본</span>
          <span className="chip chip--accent">강조</span>
          <span className="chip chip--success"><Ic.Check size={10}/> 완료</span>
          <span className="chip chip--info">실행 중</span>
          <span className="chip chip--warning">대기</span>
          <span className="chip chip--danger"><Ic.X size={10}/> 실패</span>
          <span className="chip chip--violet">세계관</span>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", margin: "20px 0 12px" }}>Tabs</div>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <div className="tab">파이프라인</div>
          <div className="tab is-active">세계관 <span className="tab__count">4</span></div>
          <div className="tab">프롬프트</div>
          <div className="tab">이미지 <span className="tab__count">12</span></div>
        </div>
      </div>

      {/* Inputs / Stepper */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", marginBottom: 12 }}>Inputs</div>
        <label className="field-label">프로젝트 이름</label>
        <input className="input" defaultValue="Mages" style={{ marginBottom: 12 }}/>
        <label className="field-label">설명</label>
        <textarea className="textarea" rows={2} defaultValue="동방·북방 마법 정치 / 개척 시대 세계관" style={{ marginBottom: 12 }}/>

        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#5B616E", margin: "20px 0 10px" }}>Stepper</div>
        <div className="stepper">
          <div className="step">
            <div className="step__rail">
              <div className="step__dot step__dot--done"><Ic.Check size={11}/></div>
              <div className="step__line step__line--done"/>
            </div>
            <div className="step__body" style={{ paddingBottom: 8 }}>
              <div className="step__title">캐릭터 생성 <span className="chip chip--success chip--tag">완료 · 42초</span></div>
              <div className="step__sub">GPT Chat · text → text</div>
            </div>
          </div>
          <div className="step">
            <div className="step__rail">
              <div className="step__dot step__dot--active"><Ic.Spinner className="spin"/></div>
              <div className="step__line"/>
            </div>
            <div className="step__body" style={{ paddingBottom: 8 }}>
              <div className="step__title">외형 프롬프트 <span className="chip chip--info chip--tag">실행 중</span></div>
              <div className="step__sub">GPT Chat · text → text</div>
            </div>
          </div>
          <div className="step">
            <div className="step__rail">
              <div className="step__dot">3</div>
            </div>
            <div className="step__body">
              <div className="step__title">이미지 생성 <span className="chip chip--tag">대기</span></div>
              <div className="step__sub">GPT Image · text → image</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrincipleCard({ title, body }) {
  return (
    <div style={{
      width: 340, height: 200,
      background: "white", border: "1px solid #E2E2DC",
      borderRadius: 8, padding: 22,
      display: "flex", flexDirection: "column", gap: 8,
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: "#ECECFE", color: "#4040AD",
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13,
      }}>·</div>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.005em" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#5B616E", lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

Object.assign(window, {
  TokensSwatchesCard, TypeCard, SpaceRadiusShadowCard, ComponentsCard, PrincipleCard,
});
