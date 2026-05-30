// empty-states.jsx — First-use / empty-data patterns for every main page.
// Static cards for the design canvas — also exported so they can be imported in actual pages.

const Ies = window.Icon;

function EmptyShell({ icon, title, body, primary, secondary, illustration }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 32,
      background: "var(--bg-canvas)",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        maxWidth: 420, textAlign: "center",
        padding: 32,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        boxShadow: "var(--shadow-1)",
      }}>
        {illustration ? illustration : (
          <div style={{
            width: 56, height: 56, margin: "0 auto 16px",
            background: "var(--accent-3)",
            color: "var(--accent-11)",
            borderRadius: 14,
            display: "grid", placeItems: "center",
          }}>{icon}</div>
        )}
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, textWrap: "pretty", marginBottom: 18 }}>
          {body}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {primary && <button className="btn btn--primary">{primary.icon}{primary.label}</button>}
          {secondary && <button className="btn btn--secondary">{secondary.icon}{secondary.label}</button>}
        </div>
      </div>
    </div>
  );
}

// ---- Dot-grid illustration (no SVG, just CSS) ----
function DotGridIllu({ accent = "var(--accent-9)", sub = "var(--accent-7)" }) {
  return (
    <div style={{
      width: 80, height: 80, margin: "0 auto 18px",
      position: "relative",
      background: "radial-gradient(circle at 1px 1px, var(--border-default) 1px, transparent 1px) 0 0 / 8px 8px",
      borderRadius: 12,
    }}>
      {/* Accent shape — diamond + dot */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 28, height: 28, marginLeft: -14, marginTop: -14,
        background: accent,
        borderRadius: 6,
        transform: "rotate(45deg)",
      }}/>
      <div style={{
        position: "absolute", top: 14, right: 14,
        width: 10, height: 10, borderRadius: "50%",
        background: sub,
      }}/>
      <div style={{
        position: "absolute", bottom: 14, left: 14,
        width: 6, height: 6, borderRadius: "50%",
        background: "var(--text-tertiary)",
      }}/>
    </div>
  );
}

function EmptyProjects() {
  return (
    <EmptyShell
      illustration={<DotGridIllu/>}
      title="아직 프로젝트가 없어요"
      body="세계관, 캠페인, 실험 작업을 프로젝트 단위로 묶어 시작해 보세요. 첫 프로젝트는 2분이면 만듭니다."
      primary={{ icon: <Ies.Plus size={13}/>, label: "첫 프로젝트 만들기" }}
      secondary={{ label: "둘러보기" }}
    />
  );
}

function EmptyImages() {
  return (
    <EmptyShell
      illustration={(
        <div style={{
          width: 80, height: 80, margin: "0 auto 18px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
        }}>
          {[270, 30, 200, 80].map((h, i) => (
            <div key={i} className="thumb-tile" style={{ borderRadius: 6, "--h": h, opacity: i === 0 ? 1 : 0.55 }}/>
          ))}
        </div>
      )}
      title="생성된 이미지가 없습니다"
      body="작업판을 한 번 실행하거나 파이프라인으로 자동 생성된 이미지가 여기에 모입니다."
      primary={{ icon: <Ies.Play size={13}/>, label: "작업판 둘러보기" }}
      secondary={{ icon: <Ies.Image size={13}/>, label: "이미지 업로드" }}
    />
  );
}

function EmptyPipelines() {
  return (
    <EmptyShell
      illustration={(
        <div style={{
          width: 96, height: 56, margin: "0 auto 18px",
          display: "flex", alignItems: "center", gap: 4,
        }}>
          {[0, 1, 2].map((i) => (
            <React.Fragment key={i}>
              <div style={{
                flex: 1, height: 36,
                borderRadius: 6,
                background: i === 1 ? "var(--accent-3)" : "var(--bg-subtle)",
                border: "1px solid " + (i === 1 ? "var(--accent-9)" : "var(--border-default)"),
                display: "grid", placeItems: "center",
                color: i === 1 ? "var(--accent-11)" : "var(--text-tertiary)",
                fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
              }}>{i + 1}</div>
              {i < 2 && (
                <div style={{ width: 6, height: 2, background: i === 0 ? "var(--accent-9)" : "var(--border-default)", borderRadius: 1 }}/>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      title="이 프로젝트엔 파이프라인이 아직 없어요"
      body="작업판을 순서대로 연결하면 한 번에 여러 단계를 자동 실행할 수 있습니다."
      primary={{ icon: <Ies.Plus size={13}/>, label: "새 파이프라인" }}
      secondary={{ icon: <Ies.Doc size={13}/>, label: "템플릿에서 시작" }}
    />
  );
}

function EmptyDocs() {
  return (
    <EmptyShell
      illustration={(
        <div style={{
          width: 64, height: 80, margin: "0 auto 18px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          position: "relative",
          boxShadow: "var(--shadow-1)",
        }}>
          <div style={{ position: "absolute", top: 12, left: 10, right: 10, height: 4, background: "var(--bg-subtle)", borderRadius: 2 }}/>
          <div style={{ position: "absolute", top: 22, left: 10, right: 20, height: 4, background: "var(--bg-subtle)", borderRadius: 2 }}/>
          <div style={{ position: "absolute", top: 32, left: 10, right: 16, height: 4, background: "var(--bg-subtle)", borderRadius: 2 }}/>
          <div style={{ position: "absolute", bottom: -8, right: -8,
            width: 24, height: 24, borderRadius: 6,
            background: "var(--accent-9)", color: "white",
            display: "grid", placeItems: "center",
          }}><Ies.Plus size={14}/></div>
        </div>
      )}
      title="첫 세계관 문서를 만들어 보세요"
      body="세계관·시스템 프롬프트는 AI에 항상 제공되어 모든 생성의 톤을 결정합니다."
      primary={{ icon: <Ies.Plus size={13}/>, label: "문서 만들기" }}
    />
  );
}

function EmptyHistory() {
  return (
    <EmptyShell
      icon={<Ies.Clock size={22}/>}
      title="실행 히스토리가 비어 있습니다"
      body="파이프라인을 실행하면 이곳에 결과가 시간순으로 쌓입니다."
      primary={{ icon: <Ies.Play size={13}/>, label: "지금 실행하기" }}
    />
  );
}

function EmptyServers() {
  return (
    <EmptyShell
      icon={<Ies.Server size={22}/>}
      title="등록된 서버가 없습니다"
      body="ComfyUI · OpenAI · Gemini · 호환 API 백엔드를 등록해야 작업판을 실행할 수 있습니다."
      primary={{ icon: <Ies.Plus size={13}/>, label: "첫 서버 추가" }}
      secondary={{ icon: <Ies.Doc size={13}/>, label: "설치 가이드" }}
    />
  );
}

function EmptySearch({ query = "" }) {
  return (
    <EmptyShell
      icon={<Ies.Search size={22}/>}
      title={`"${query || "abc"}"에 대한 결과 없음`}
      body="철자를 확인하거나 더 간단한 키워드로 검색해 보세요. 태그·프로젝트로 필터를 좁힐 수도 있습니다."
      primary={{ icon: <Ies.Filter size={13}/>, label: "필터 초기화" }}
    />
  );
}

function EmptyNotifications() {
  return (
    <EmptyShell
      icon={<Ies.Bell size={22}/>}
      title="모든 알림을 확인했어요"
      body="새 알림이 도착하면 여기에 표시됩니다."
    />
  );
}

function EmptyError() {
  return (
    <EmptyShell
      illustration={(
        <div style={{
          width: 56, height: 56, margin: "0 auto 16px",
          background: "var(--danger-3)",
          color: "var(--danger-11)",
          borderRadius: 14,
          display: "grid", placeItems: "center",
        }}><Ies.X /></div>
      )}
      title="불러오기에 실패했어요"
      body="서버 응답이 없거나 권한이 부족합니다. 잠시 후 다시 시도해 주세요."
      primary={{ icon: <Ies.Refresh size={13}/>, label: "다시 시도" }}
      secondary={{ label: "오류 신고" }}
    />
  );
}

Object.assign(window, {
  EmptyProjects, EmptyImages, EmptyPipelines, EmptyDocs,
  EmptyHistory, EmptyServers, EmptySearch, EmptyNotifications, EmptyError,
});
