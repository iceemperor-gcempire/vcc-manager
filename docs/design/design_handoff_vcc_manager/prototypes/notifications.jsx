// notifications.jsx — Bell-anchored popover with grouped notifications.

const { useState: useStateN, useRef: useRefN, useEffect: useEffectN } = React;
const In = window.Icon;

const NOTIFICATIONS = [
  {
    g: "new", tone: "success", icon: <In.Check />, time: "방금",
    title: "파이프라인 'NPC 생성' 완료",
    body: "Mages 프로젝트 · 4장 이미지 생성됨 · 2분 35초 소요",
    action: "결과 보기",
  },
  {
    g: "new", tone: "warning", icon: <In.Info />, time: "5분 전",
    title: "local-llama 서버 응답 지연",
    body: "5건 큐 누적. GPU 사용률 100%.",
    action: "서버 확인",
  },
  {
    g: "new", tone: "info", icon: <In.Spinner />, time: "12분 전",
    title: "파이프라인 '배경 시리즈 v3' 시작",
    body: "Cryo 프로젝트 · 4단계 · 백그라운드 실행 중",
  },
  {
    g: "earlier", tone: "success", icon: <In.Check />, time: "어제",
    title: "이미지 88장 LoRA 학습 큐 등록",
    body: "anime-line-clean v2 · 큐 3번째",
  },
  {
    g: "earlier", tone: "danger", icon: <In.X />, time: "어제",
    title: "단계 3 실패 — 'NPC 생성'",
    body: "GPT Image 502 · 재시도 후 성공",
    action: "로그 보기",
  },
  {
    g: "earlier", tone: "info", icon: <In.Info />, time: "2일 전",
    title: "comfy-02 모델 동기화 완료",
    body: "8개 모델 화이트리스트 갱신",
  },
];

function NotifRow({ n }) {
  return (
    <div style={{
      padding: "12px 14px",
      borderBottom: "1px solid var(--border-subtle)",
      display: "flex", gap: 10, alignItems: "flex-start",
      cursor: "pointer",
      transition: "background 120ms",
    }}
      onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-tint)"}
      onMouseOut={(e) => e.currentTarget.style.background = ""}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `var(--${n.tone}-3)`,
        color: `var(--${n.tone}-11)`,
        display: "grid", placeItems: "center",
        flex: "0 0 auto",
      }}>{n.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, textWrap: "pretty" }}>{n.title}</span>
          <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", flex: "0 0 auto" }}>{n.time}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2, lineHeight: 1.55 }}>{n.body}</div>
        {n.action && (
          <a href="#" style={{ display: "inline-block", marginTop: 6, fontSize: 11.5, color: "var(--accent-11)", textDecoration: "none", fontWeight: 500 }}>
            {n.action} →
          </a>
        )}
      </div>
    </div>
  );
}

function NotificationsPopover({ open, anchorRect, onClose }) {
  if (!open) return null;
  const newOnes = NOTIFICATIONS.filter((n) => n.g === "new");
  const earlier = NOTIFICATIONS.filter((n) => n.g === "earlier");

  const right = window.innerWidth - (anchorRect?.right || window.innerWidth - 24);

  return (
    <div data-no-intercept onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 80,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute",
        top: (anchorRect?.bottom || 40) + 8,
        right: Math.max(12, right),
        width: 380, maxHeight: "calc(100vh - 80px)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        boxShadow: "var(--shadow-4)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        animation: "n-pop 180ms cubic-bezier(.2,.7,.3,1)",
      }}>
        <div style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <In.Bell />
          <span style={{ fontSize: 14, fontWeight: 600 }}>알림</span>
          <span className="chip chip--accent chip--tag">{newOnes.length} new</span>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm">모두 읽음</button>
        </div>

        <div style={{ overflow: "auto" }}>
          <div style={{
            padding: "8px 14px 4px",
            fontSize: 10, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--text-tertiary)",
          }}>새 알림</div>
          {newOnes.map((n, i) => <NotifRow key={i} n={n}/>)}

          <div style={{
            padding: "12px 14px 4px",
            fontSize: 10, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.08em",
            color: "var(--text-tertiary)",
          }}>이전</div>
          {earlier.map((n, i) => <NotifRow key={i} n={n}/>)}
        </div>

        <div style={{
          padding: "8px 14px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-tint)",
          fontSize: 12,
          textAlign: "center",
        }}>
          <a href="#" style={{ color: "var(--accent-11)", textDecoration: "none", fontWeight: 500 }}>모든 알림 보기 →</a>
        </div>
      </div>
      <style>{`@keyframes n-pop {
        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }`}</style>
    </div>
  );
}

Object.assign(window, { NotificationsPopover });
