// page-document-editor.jsx — Worldview / prompt document editor (markdown-ish).
// Opens when user clicks a document in project detail's 세계관 / 프롬프트 tab.

const { useState: useStateDe } = React;
const Ide = window.Icon;

function ToolbarBtn({ icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 30, height: 30,
        border: 0,
        borderRadius: "var(--r-2)",
        background: active ? "var(--accent-3)" : "transparent",
        color: active ? "var(--accent-11)" : "var(--text-secondary)",
        cursor: "pointer",
        display: "grid", placeItems: "center",
        transition: "all 120ms",
      }}
      onMouseOver={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-subtle)"; }}
      onMouseOut={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >{icon}</button>
  );
}

function DocumentEditorPage({ mobile }) {
  const [tab, setTab] = useStateDe("edit"); // edit | preview | split

  // Sample content
  const text = `# Mages 세계관 개요

## 시대

**Rusty Blood 시대** — 마법과 정치의 긴장 사이에서 1세대 개척 기술자들이 등장한 시기.
북방 변경 광산 도시국가와 동방 마법 학파의 갈등이 본격화됨.

## 주요 세력

### 1. 북방 변경 광산 도시국가
- 광산업 기반의 실용주의 사회
- 마법보다 기술/공학을 우선
- 마법사들에 대한 경계심 보유

### 2. 동방 마법 학파
- 학문적 마법 추구
- 정치적 야망과 균형 시도
- 7개 학파의 연합 구조

### 3. 자유 도시 동맹
- 양 세력 사이 중립 지역
- 무역과 외교의 중심
- 마법사·기술자 공존

## 캐릭터 톤

- **이름**: 게르만/슬라브 어원의 이름 (에르난트, 그라스벨 등)
- **나이대**: 30–40대 베테랑 중심
- **외형**: 단단한 손, 차가운 시선, 실용적 의복
- **성격**: 냉정하지만 동료에게 충성

## 핵심 사건

> Rusty Blood 사건 (1세대 개척기 종료를 알리는 대규모 충돌)

자세한 내용은 별도 문서 [Rusty Blood 시대 연표] 참조.
`;

  return (
    <div>
      <a href="#" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent-11)", fontSize: 13, textDecoration: "none", marginBottom: 12 }}>
        <Ide.ChevronLeft size={12}/> Mages · 세계관
      </a>

      {/* Title row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <input
          className="input"
          defaultValue="Mages 세계관 개요"
          style={{ maxWidth: 480, fontWeight: 700, fontSize: 22, padding: "8px 12px", letterSpacing: "-0.01em" }}
        />
        <span className="tag" style={{ background: "var(--tag-world)" }}>세계관</span>
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          184줄 · 마지막 저장 2분 전
        </span>
      </div>
      <p className="page-sub" style={{ marginBottom: 16 }}>
        파이프라인의 컨텍스트 문서로 사용됩니다.
        AI에 항상 제공되어 톤·세계관 일관성을 유지합니다.
      </p>

      {/* Toolbar */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-tint)",
          flexWrap: "wrap",
        }}>
          <ToolbarBtn icon={<Ide.Type />} label="제목" />
          <ToolbarBtn icon={<span style={{ fontWeight: 700, fontSize: 13 }}>B</span>} label="굵게" />
          <ToolbarBtn icon={<span style={{ fontStyle: "italic", fontSize: 13 }}>I</span>} label="기울임" />
          <ToolbarBtn icon={<span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{"</>"}</span>} label="코드" />
          <span style={{ width: 1, height: 18, background: "var(--border-default)", margin: "0 4px" }}/>
          <ToolbarBtn icon={<Ide.Menu />} label="목록" />
          <ToolbarBtn icon={<Ide.Doc />} label="인용" />
          <ToolbarBtn icon={<Ide.Link />} label="링크" />
          <ToolbarBtn icon={<Ide.Image />} label="이미지 삽입" />
          <span style={{ flex: 1 }}/>

          {/* AI ASSIST */}
          <button className="btn btn--ghost btn--sm" style={{ color: "var(--accent-11)" }}>
            <Ide.Sparkle size={12}/> AI 정리
          </button>
          <span style={{ width: 1, height: 18, background: "var(--border-default)", margin: "0 4px" }}/>

          {/* View toggle */}
          <div style={{
            display: "inline-flex", padding: 3, borderRadius: 5,
            background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)",
          }}>
            {[
              { v: "edit",    l: "편집",    icon: <Ide.Edit size={11}/> },
              { v: "split",   l: "분할",    icon: <Ide.Grid size={11}/> },
              { v: "preview", l: "미리보기", icon: <Ide.Eye size={11}/> },
            ].filter((b) => !mobile || b.v !== "split").map((b) => (
              <button key={b.v} onClick={() => setTab(b.v)} style={{
                padding: "4px 10px", borderRadius: 3, border: 0, cursor: "pointer", fontSize: 11.5,
                background: tab === b.v ? "var(--bg-surface)" : "transparent",
                color: tab === b.v ? "var(--text-primary)" : "var(--text-tertiary)",
                boxShadow: tab === b.v ? "var(--shadow-1)" : "none",
                fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4,
              }}>{b.icon}{b.l}</button>
            ))}
          </div>
        </div>

        {/* Editor body — split / edit / preview */}
        <div style={{
          display: "grid",
          gridTemplateColumns: tab === "split" && !mobile ? "1fr 1fr" : "1fr",
          minHeight: 540,
        }}>
          {(tab === "edit" || tab === "split") && (
            <div style={{ padding: 24, borderRight: (tab === "split" && !mobile) ? "1px solid var(--border-subtle)" : "none" }}>
              <textarea
                defaultValue={text}
                style={{
                  width: "100%", minHeight: 480,
                  border: 0, outline: "none",
                  resize: "vertical",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13, lineHeight: 1.7,
                  color: "var(--text-primary)",
                  background: "transparent",
                }}
              />
            </div>
          )}
          {(tab === "preview" || tab === "split") && (
            <div style={{ padding: "24px 32px", overflow: "auto", maxHeight: 700, background: tab === "split" ? "var(--bg-tint)" : "transparent" }}>
              <MarkdownPreview text={text}/>
            </div>
          )}
        </div>
      </div>

      {/* Metadata strip */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 8 }}>이 문서를 사용하는 파이프라인</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { name: "NPC 생성", uses: "단계 1, 2" },
              { name: "배경 시리즈 v3", uses: "단계 1" },
            ].map((p) => (
              <div key={p.name} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px",
                background: "var(--bg-tint)", borderRadius: 6,
              }}>
                <Ide.Pipe size={12} style={{ color: "var(--accent-9)" }}/>
                <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{p.uses}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", marginBottom: 8 }}>버전 히스토리</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { time: "2분 전",  msg: "Rusty Blood 사건 설명 보강", current: true },
              { time: "1시간 전", msg: "북방 변경 광산 도시국가 추가" },
              { time: "어제",    msg: "초기 작성" },
            ].map((v, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "5px 4px",
                fontSize: 12.5,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: v.current ? "var(--accent-9)" : "var(--border-default)",
                }}/>
                <span style={{ flex: 1, fontWeight: v.current ? 600 : 400 }}>{v.msg}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{v.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Tiny markdown preview — renders headings, bold/italic/code, lists, quotes.
function MarkdownPreview({ text }) {
  const lines = text.split("\n");
  const out = [];
  let listOpen = false;
  lines.forEach((raw, i) => {
    let line = raw;
    // close list if needed
    if (!line.match(/^\s*[-*] /) && listOpen) {
      out.push(<div key={"close-" + i}/>);
      listOpen = false;
    }
    if (line.startsWith("# ")) {
      out.push(<h1 key={i} style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", marginTop: 8, marginBottom: 12 }}>{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      out.push(<h2 key={i} style={{ fontSize: 18, fontWeight: 700, marginTop: 20, marginBottom: 8, color: "var(--accent-11)" }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      out.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>{line.slice(4)}</h3>);
    } else if (line.startsWith("> ")) {
      out.push(
        <blockquote key={i} style={{
          margin: "12px 0",
          padding: "10px 14px",
          borderLeft: "3px solid var(--accent-9)",
          background: "var(--accent-1)",
          color: "var(--text-primary)",
          fontSize: 14, lineHeight: 1.6,
          fontStyle: "italic",
        }}>{line.slice(2)}</blockquote>
      );
    } else if (line.match(/^\s*[-*] /)) {
      if (!listOpen) { out.push(<ul key={"ul" + i} style={{ margin: "6px 0", paddingLeft: 20 }}/>); listOpen = true; }
      const last = out[out.length - 1];
      // append item
      const itemText = line.replace(/^\s*[-*] /, "");
      out[out.length - 1] = React.cloneElement(last, {
        children: [...(last.props.children || []), <li key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)" }}>{renderInline(itemText)}</li>],
      });
    } else if (line.trim() === "") {
      out.push(<div key={i} style={{ height: 6 }}/>);
    } else {
      out.push(<p key={i} style={{ margin: "6px 0", fontSize: 14, lineHeight: 1.7, color: "var(--text-primary)", textWrap: "pretty" }}>{renderInline(line)}</p>);
    }
  });
  return <div style={{ fontFamily: "var(--font-sans)" }}>{out}</div>;
}

function renderInline(s) {
  // **bold**, *italic*, `code`, [link](url)
  const parts = [];
  let i = 0; let key = 0;
  while (i < s.length) {
    if (s[i] === "*" && s[i+1] === "*") {
      const end = s.indexOf("**", i+2);
      if (end !== -1) {
        parts.push(<b key={key++} style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.slice(i+2, end)}</b>);
        i = end + 2; continue;
      }
    }
    if (s[i] === "`") {
      const end = s.indexOf("`", i+1);
      if (end !== -1) {
        parts.push(<code key={key++} style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, background: "var(--bg-subtle)", padding: "1px 5px", borderRadius: 3, color: "var(--accent-11)" }}>{s.slice(i+1, end)}</code>);
        i = end + 1; continue;
      }
    }
    if (s[i] === "[") {
      const close = s.indexOf("]", i);
      if (close !== -1) {
        parts.push(<span key={key++} style={{ color: "var(--accent-11)", textDecoration: "underline", textUnderlineOffset: 2 }}>{s.slice(i+1, close)}</span>);
        i = close + 1; continue;
      }
    }
    // accumulate plain text until next special
    const next = s.slice(i).search(/[\*`\[]/);
    const end = next === -1 ? s.length : i + next;
    parts.push(s.slice(i, end));
    i = end;
  }
  return parts;
}

Object.assign(window, { DocumentEditorPage });
