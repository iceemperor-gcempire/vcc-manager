// image-lightbox.jsx — Fullscreen overlay for viewing a single generated/uploaded image.
// Opens when user clicks any thumbnail in content library / project detail / dashboard.

const { useState: useStateIl, useEffect: useEffectIl } = React;
const Iil = window.Icon;

function ImageLightbox({ open, image, onClose, onPrev, onNext }) {
  useEffectIl(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev && onPrev();
      else if (e.key === "ArrowRight") onNext && onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrev, onNext]);

  if (!open || !image) return null;

  return (
    <div data-no-intercept onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 90,
      background: "rgba(8,10,15,0.86)",
      backdropFilter: "blur(8px)",
      display: "flex", alignItems: "stretch",
      animation: "lb-fade 180ms ease",
      fontFamily: "var(--font-sans)",
    }}>
      {/* Stage */}
      <div style={{
        flex: 1, position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40,
      }} onClick={onClose}>
        {/* Nav arrows */}
        {onPrev && (
          <button onClick={(e) => { e.stopPropagation(); onPrev(); }} style={{
            position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)",
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "white", cursor: "pointer",
            display: "grid", placeItems: "center",
            transition: "background 120ms",
          }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.20)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
          ><Iil.ChevronLeft /></button>
        )}
        {onNext && (
          <button onClick={(e) => { e.stopPropagation(); onNext(); }} style={{
            position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "white", cursor: "pointer",
            display: "grid", placeItems: "center",
            transition: "background 120ms",
          }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.20)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.10)"}
          ><Iil.ChevronRight /></button>
        )}

        {/* Image area */}
        <div onClick={(e) => e.stopPropagation()} style={{
          position: "relative",
          maxWidth: "min(90vh, 1200px)",
          aspectRatio: "1/1",
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 12,
          overflow: "hidden",
          animation: "lb-pop 200ms cubic-bezier(.2,.7,.3,1)",
        }}>
          <div className="thumb-tile" style={{
            width: "100%", height: "100%",
            borderRadius: 0, border: 0,
            "--h": image.hue,
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-mono)", fontSize: 14,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}>{image.label}</div>
        </div>
      </div>

      {/* Sidebar */}
      <aside onClick={(e) => e.stopPropagation()} style={{
        width: 380, flex: "0 0 380px",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-default)",
        display: "flex", flexDirection: "column",
        overflow: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{image.label}</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{image.meta}</div>
          </div>
          <button className="btn btn--ghost btn--icon btn--sm" title="즐겨찾기">
            {image.favorite ? <Iil.StarFill style={{ color: "var(--warning-9)" }}/> : <Iil.Star />}
          </button>
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} title="닫기 (Esc)"><Iil.X /></button>
        </div>

        {/* Actions */}
        <div style={{
          padding: 14,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <button className="btn btn--primary"><Iil.ArrowDown /> 다운로드</button>
          <button className="btn btn--secondary"><Iil.Refresh /> 재생성</button>
          <button className="btn btn--secondary"><Iil.Copy /> 프롬프트 복사</button>
          <button className="btn btn--secondary"><Iil.Play /> 영상 만들기</button>
        </div>

        {/* Metadata */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          <Section title="프롬프트">
            <pre style={{
              margin: 0, padding: 12,
              background: "var(--bg-tint)", border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto",
            }}>{image.prompt || "anime style, full-body, adult male frontier engineer officer, 34 years old, broad-shouldered, sun-tanned skin, short dark brown wavy hair, stubble beard, gray-blue eyes, Rusty Blood era practical clothing, surveyor tools, foggy mountain background, cinematic lighting"}</pre>
          </Section>

          <Section title="부정 프롬프트">
            <pre style={{
              margin: 0, padding: 12,
              background: "var(--bg-tint)", border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
            }}>{image.negative || "lowres, blurry, watermark, extra fingers, deformed hands, text"}</pre>
          </Section>

          <Section title="생성 정보">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <tbody>
                {[
                  ["프로젝트", "Mages"],
                  ["작업판", "SDXL T2I — LoRA"],
                  ["모델", "DreamShaper XL v2 Turbo"],
                  ["LoRA", "anime-line-clean (0.8), rusty-blood-era (0.6)"],
                  ["크기", image.size || "1024 × 1024"],
                  ["단계", "30"],
                  ["CFG", "7.0"],
                  ["시드", "7598157339176202"],
                  ["서버", "comfy-01 · 192.168.1.51"],
                  ["생성 시각", image.meta?.split("·").slice(-1)[0]?.trim() || "방금"],
                  ["소요 시간", "18.4초"],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: "5px 0", color: "var(--text-tertiary)", fontSize: 11.5, verticalAlign: "top", width: 90 }}>{k}</td>
                    <td style={{ padding: "5px 0", fontFamily: ["LoRA", "시드", "서버"].includes(k) ? "var(--font-mono)" : "inherit", fontSize: 11.5, color: "var(--text-primary)", wordBreak: "break-all" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="태그">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <span className="chip chip--tag">캐릭터</span>
              <span className="chip chip--tag">남성</span>
              <span className="chip chip--tag">개척시대</span>
              <button className="btn btn--ghost btn--sm" style={{ height: 22, fontSize: 11 }}>
                <Iil.Plus size={11}/> 추가
              </button>
            </div>
          </Section>
        </div>

        {/* Footer: delete */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
          <button className="btn btn--danger btn--sm" style={{ width: "100%", justifyContent: "center" }}>
            <Iil.Trash size={12}/> 삭제
          </button>
        </div>
      </aside>

      <style>{`
        @keyframes lb-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lb-pop {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-tertiary)", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

Object.assign(window, { ImageLightbox });
