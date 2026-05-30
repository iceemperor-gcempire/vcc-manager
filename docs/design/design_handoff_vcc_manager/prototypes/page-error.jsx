// page-error.jsx — 404 / 500 / 403 error pages (full-bleed, no shell)

const Ier = window.Icon;

function ErrorPageBase({ code, title, body, primary, secondary, hue = 250 }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: "var(--bg-canvas)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 40, fontFamily: "var(--font-sans)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative dot grid */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 1px 1px, var(--border-default) 1px, transparent 1px) 0 0 / 24px 24px",
        opacity: 0.5,
      }}/>

      <div style={{ position: "relative", textAlign: "center", maxWidth: 480 }}>
        <div style={{
          fontSize: 96, lineHeight: 1, fontWeight: 800,
          letterSpacing: "-0.04em",
          background: `linear-gradient(135deg, oklch(45% 0.18 ${hue}) 0%, oklch(60% 0.10 ${hue + 30}) 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          fontFamily: "var(--font-mono)",
        }}>{code}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 14 }}>{title}</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 10, textWrap: "pretty" }}>
          {body}
        </div>
        <div style={{ marginTop: 22, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {primary && <button className="btn btn--primary">{primary}</button>}
          {secondary && <button className="btn btn--secondary">{secondary}</button>}
        </div>

        {/* Trace info */}
        <div style={{
          marginTop: 32,
          padding: "10px 14px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11, color: "var(--text-tertiary)",
          display: "flex", alignItems: "center", gap: 8,
          maxWidth: 360, margin: "32px auto 0",
        }}>
          <Ier.Info size={12}/>
          <span style={{ flex: 1 }}>trace: err_{code.toLowerCase()}_a47f2c · 2026-05-25 16:47</span>
          <button style={{ background: "transparent", border: 0, color: "var(--accent-11)", cursor: "pointer", fontSize: 11 }}>복사</button>
        </div>
      </div>
    </div>
  );
}

function Error404() {
  return (
    <ErrorPageBase
      code="404"
      title="페이지를 찾을 수 없습니다"
      body="요청하신 페이지가 삭제되었거나, URL이 잘못되었을 수 있습니다."
      primary={<><Ier.Dashboard size={13}/> 대시보드로</>}
      secondary={<><Ier.ChevronLeft size={13}/> 뒤로 가기</>}
      hue={250}
    />
  );
}

function Error500() {
  return (
    <ErrorPageBase
      code="500"
      title="서버에 문제가 발생했습니다"
      body="잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요."
      primary={<><Ier.Refresh size={13}/> 다시 시도</>}
      secondary={<>오류 신고</>}
      hue={20}
    />
  );
}

function Error403() {
  return (
    <ErrorPageBase
      code="403"
      title="접근 권한이 없습니다"
      body="이 페이지를 보려면 별도 권한이 필요합니다. 관리자에게 요청하세요."
      primary={<><Ier.Dashboard size={13}/> 대시보드로</>}
      secondary={<>관리자 문의</>}
      hue={0}
    />
  );
}

Object.assign(window, { Error404, Error500, Error403 });
