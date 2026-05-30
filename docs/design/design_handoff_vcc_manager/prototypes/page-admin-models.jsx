// page-admin-models.jsx — 모델 관리 (admin)
// Civitai relay catalog. Single-server selection.
// TWO filter dimensions (Civitai-style): Base Model + Model Type.

const { useState: useStateAm } = React;
const Iam = window.Icon;

// kind = "checkpoint" | "lora" | "vae" | "upscaler" | "embedding"
// baseModel (when applicable): "sdxl" | "illustrious" | "noobai" | "pony" | "sd15" | "flux" | "zimage" | "anima"

const BASE_MODELS = [
  // Diffusion image checkpoints
  { v: "sdxl",         l: "SDXL",          color: "var(--accent-11)", bg: "var(--accent-3)" },
  { v: "illustrious",  l: "Illustrious",   color: "#5B2DBF",          bg: "#F1ECFE" },
  { v: "noobai",       l: "NoobAI",        color: "#9E2FB0",          bg: "#F8E7FC" },
  { v: "pony",         l: "Pony",          color: "#D5383E",          bg: "var(--danger-3)" },
  { v: "sd15",         l: "SD 1.5",        color: "#A85D00",          bg: "#FBEED7" },
  { v: "sd35",         l: "SD 3.5",        color: "#B05A00",          bg: "#FBE4CB" },
  { v: "flux",         l: "Flux",          color: "#0A6E5F",          bg: "#D6F0EA" },
  { v: "flux-schnell", l: "Flux Schnell",  color: "#0A8B79",          bg: "#D6F0EA" },
  { v: "hidream",      l: "HiDream",       color: "#7A4ECB",          bg: "#EBE1F7" },
  // Z-image family
  { v: "zimage-base",  l: "Z Image Base",  color: "#4A6FB0",          bg: "#DDE7F8" },
  { v: "zimage-turbo", l: "Z Image Turbo", color: "#3D5A8C",          bg: "#DDE7F8" },
  // Misc
  { v: "anima",        l: "Anima",         color: "#7C4A2A",          bg: "#EFE0D2" },
  // Video models
  { v: "wan",          l: "WAN",           color: "#1F6BB3",          bg: "#D9E8F6" },
  { v: "wan22",        l: "WAN 2.2",       color: "#1A5A99",          bg: "#D9E8F6" },
  { v: "ltx2",         l: "LTX-2",         color: "#B83A78",          bg: "#F8DCE9" },
  { v: "hunyuan",      l: "Hunyuan Video", color: "#9D3E4A",          bg: "#F4D9DD" },
  { v: "cogvideo",     l: "CogVideoX",     color: "#5C7A4E",          bg: "#E4ECDB" },
];
const BASE_BY_KEY = BASE_MODELS.reduce((a, x) => (a[x.v] = x, a), {});

const MODEL_TYPES = [
  { v: "checkpoint", l: "Checkpoint", color: "var(--text-primary)", bg: "var(--bg-subtle)" },
  { v: "lora",       l: "LoRA",       color: "#0F7A40",             bg: "var(--success-3)" },
  { v: "vae",        l: "VAE",        color: "var(--info-11)",      bg: "var(--info-3)" },
  { v: "upscaler",   l: "Upscaler",   color: "var(--warning-11)",   bg: "var(--warning-3)" },
  { v: "embedding",  l: "Embedding",  color: "var(--text-primary)", bg: "var(--bg-subtle)" },
];
const TYPE_BY_KEY = MODEL_TYPES.reduce((a, x) => (a[x.v] = x, a), {});

function modelTags(m) {
  const out = [];
  out.push(TYPE_BY_KEY[m.kind]);
  if (m.baseModel && BASE_BY_KEY[m.baseModel]) out.push(BASE_BY_KEY[m.baseModel]);
  return out;
}

function NsfwBadge({ small }) {
  return (
    <span style={{
      padding: small ? "1px 4px" : "2px 6px", borderRadius: 4,
      background: "rgba(213,56,62,0.92)", color: "white",
      fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: "0.06em",
      fontFamily: "var(--font-mono)",
    }}>NSFW</span>
  );
}

function ModelThumb({ m, hideNsfw, square }) {
  const isBlurred = m.nsfw && hideNsfw;
  return (
    <div style={{
      position: "relative",
      width: "100%", aspectRatio: square ? "1/1" : "auto", height: square ? undefined : "100%",
      borderRadius: 6,
      overflow: "hidden",
      border: "1px solid var(--border-subtle)",
    }}>
      <div className="thumb-tile" style={{
        position: "absolute", inset: 0,
        "--h": m.hue,
        borderRadius: 0, border: 0,
        filter: isBlurred ? "blur(12px) saturate(0.6)" : "none",
        transition: "filter 200ms",
      }}/>
      {m.nsfw && (
        <span style={{ position: "absolute", top: 6, left: 6 }}>
          <NsfwBadge small={!square}/>
        </span>
      )}
      {isBlurred && (
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", placeItems: "center",
          color: "white", fontSize: 10, fontFamily: "var(--font-mono)",
          fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          background: "rgba(0,0,0,0.25)",
        }}>{square ? "NSFW · hidden" : ""}</div>
      )}
    </div>
  );
}

function ModelCardGrid({ m, hideNsfw, onOpen }) {
  const tags = modelTags(m).filter(Boolean);
  return (
    <div className="card" style={{
      padding: 10, cursor: "pointer", transition: "all 150ms",
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative",
    }}
      onClick={() => onOpen && onOpen(m)}
      onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-9)"; e.currentTarget.style.boxShadow = "var(--shadow-2)"; }}
      onMouseOut={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position: "relative" }}>
        <ModelThumb m={m} hideNsfw={hideNsfw} square/>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen && onOpen(m); }}
          title="상세 정보"
          style={{
            position: "absolute", top: 6, right: 6,
            width: 26, height: 26, borderRadius: 6,
            background: "rgba(22,24,29,0.78)", color: "white",
            border: 0, cursor: "pointer",
            display: "grid", placeItems: "center",
            backdropFilter: "blur(6px)",
          }}>
          <Iam.Info size={13}/>
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 2px", flexWrap: "wrap" }}>
        {tags.map((t) => (
          <span key={t.v} className="chip chip--tag" style={{ background: t.bg, color: t.color, border: "none", fontSize: 10 }}>{t.l}</span>
        ))}
        {m.popular && <span className="chip chip--accent chip--tag" style={{ fontSize: 10 }}>인기</span>}
      </div>
      <div style={{ padding: "0 2px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "1px 6px",
            background: "var(--accent-3)",
            color: "var(--accent-11)",
            borderRadius: 3,
            fontSize: 10.5, fontWeight: 700,
            fontFamily: "var(--font-mono)",
          }}>{m.version}</span>
          {m.author && <span style={{ fontSize: 10.5, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>by {m.author}</span>}
        </div>
      </div>
    </div>
  );
}

function ModelRowList({ m, hideNsfw, mobile, onOpen }) {
  const tags = modelTags(m).filter(Boolean);
  return (
    <div style={{
      padding: 10, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 12,
      borderTop: "1px solid var(--border-subtle)",
    }}
      onClick={() => onOpen && onOpen(m)}
      onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-tint)"}
      onMouseOut={(e) => e.currentTarget.style.background = ""}>
      <div style={{ width: 48, height: 48, flex: "0 0 auto" }}>
        <ModelThumb m={m} hideNsfw={hideNsfw} square/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</span>
          <span style={{
            display: "inline-flex", alignItems: "center",
            padding: "1px 6px",
            background: "var(--accent-3)",
            color: "var(--accent-11)",
            borderRadius: 3,
            fontSize: 10.5, fontWeight: 700,
            fontFamily: "var(--font-mono)",
          }}>{m.version}</span>
          {tags.map((t) => (
            <span key={t.v} className="chip chip--tag" style={{ background: t.bg, color: t.color, border: "none", fontSize: 10 }}>{t.l}</span>
          ))}
          {m.popular && <span className="chip chip--accent chip--tag" style={{ fontSize: 10 }}>인기</span>}
          {m.nsfw && <NsfwBadge small/>}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
          {m.author && <span>by {m.author}</span>}
          {m.author && m.updated && <span style={{ color: "var(--border-strong)" }}> · </span>}
          {m.updated && <span>업데이트 {m.updated}</span>}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onOpen && onOpen(m); }}
        className="btn btn--ghost btn--icon btn--sm" title="상세 정보">
        <Iam.Info size={13}/>
      </button>
    </div>
  );
}

function ModelDetailDrawer({ model, onClose, hideNsfw }) {
  if (!model) return null;
  const tags = modelTags(model).filter(Boolean);
  return (
    <div data-no-intercept onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 90,
      background: "rgba(8,10,15,0.5)",
      backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "flex-end",
      animation: "md-fade 160ms ease",
    }}>
      <aside onClick={(e) => e.stopPropagation()} style={{
        width: "min(480px, 100vw)",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-default)",
        display: "flex", flexDirection: "column",
        overflow: "auto",
        boxShadow: "var(--shadow-4)",
        animation: "md-slide 200ms cubic-bezier(.2,.7,.3,1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{model.name}</span>
              <span style={{ fontSize: 12, color: "var(--accent-11)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{model.version}</span>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              {tags.map((t) => (
                <span key={t.v} className="chip chip--tag" style={{ background: t.bg, color: t.color, border: "none", fontSize: 10 }}>{t.l}</span>
              ))}
              {model.nsfw && <NsfwBadge small/>}
            </div>
          </div>
          <button onClick={onClose} className="btn btn--ghost btn--icon btn--sm" title="닫기 (Esc)"><Iam.X /></button>
        </div>

        {/* Cover */}
        <div style={{ padding: 16 }}>
          <div style={{ aspectRatio: "1/1" }}>
            <ModelThumb m={model} hideNsfw={hideNsfw} square/>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "0 16px 14px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
        }}>
          {model.civitaiUrl && (
            <button className="btn btn--secondary">
              <Iam.Link size={12}/> Civitai에서 보기
            </button>
          )}
          <button className="btn btn--secondary">
            <Iam.Refresh size={12}/> 동기화
          </button>
        </div>

        {/* Description */}
        {model.description && (
          <div style={{ padding: "0 18px 14px" }}>
            <SectionLabel>설명</SectionLabel>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", textWrap: "pretty" }}>
              {model.description}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div style={{ padding: "0 18px 14px" }}>
          <SectionLabel>정보</SectionLabel>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <tbody>
              {[
                ["버전",     model.version],
                ["작성자",   model.author || "—"],
                ["베이스",   BASE_BY_KEY[model.baseModel]?.l || "—"],
                ["타입",     TYPE_BY_KEY[model.kind]?.l],
                ["업데이트", model.updated || "—"],
                ["다운로드", model.civitaiUrl ? "Civitai" : "수동 업로드"],
                ["서버",     model.server],
                ["파일",     model.filename, "mono"],
              ].map(([k, v, kind]) => (
                <tr key={k}>
                  <td style={{ padding: "5px 0", color: "var(--text-tertiary)", fontSize: 11.5, verticalAlign: "top", width: 80 }}>{k}</td>
                  <td style={{
                    padding: "5px 0",
                    fontFamily: kind === "mono" ? "var(--font-mono)" : "inherit",
                    fontSize: kind === "mono" ? 11 : 12.5,
                    color: "var(--text-primary)",
                    wordBreak: "break-all",
                  }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trigger words / suggested */}
        {model.triggerWords && model.triggerWords.length > 0 && (
          <div style={{ padding: "0 18px 14px" }}>
            <SectionLabel>트리거 단어</SectionLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {model.triggerWords.map((w) => (
                <span key={w} className="chip chip--tag" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* Version history */}
        {model.versions && model.versions.length > 1 && (
          <div style={{ padding: "0 18px 14px" }}>
            <SectionLabel>버전 히스토리</SectionLabel>
            {model.versions.map((v, i) => (
              <div key={v.version} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px",
                background: i === 0 ? "var(--accent-1)" : "transparent",
                border: "1px solid " + (i === 0 ? "var(--accent-4)" : "var(--border-subtle)"),
                borderRadius: 6,
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: i === 0 ? "var(--accent-11)" : "var(--text-primary)" }}>{v.version}</span>
                {i === 0 && <span className="chip chip--accent chip--tag" style={{ fontSize: 10 }}>현재</span>}
                <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-tertiary)" }}>{v.note}</span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{v.date}</span>
              </div>
            ))}
          </div>
        )}

        {/* Danger */}
        <div style={{ padding: "10px 18px", marginTop: "auto", borderTop: "1px solid var(--border-subtle)" }}>
          <button className="btn btn--danger btn--sm" style={{ width: "100%", justifyContent: "center" }}>
            <Iam.Trash size={12}/> 서버에서 제거
          </button>
        </div>

        <style>{`
          @keyframes md-fade { from { opacity: 0; } to { opacity: 1; } }
          @keyframes md-slide {
            from { opacity: 0; transform: translateX(20px); }
            to   { opacity: 1; transform: translateX(0); }
          }
        `}</style>
      </aside>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.08em",
      color: "var(--text-tertiary)",
      marginBottom: 8,
    }}>{children}</div>
  );
}

function ServerPicker({ open, onToggle, value, onChange, servers, onSync }) {
  const sel = servers.find((s) => s.name === value);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onToggle} style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 12px",
        background: "var(--bg-surface)",
        border: "1px solid " + (open ? "var(--accent-9)" : "var(--border-default)"),
        borderRadius: "var(--r-2)",
        cursor: "pointer", fontFamily: "var(--font-sans)",
        boxShadow: open ? "var(--shadow-focus)" : "none",
        minWidth: 240,
      }}>
        <Iam.Server size={14} style={{ color: "var(--text-secondary)" }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: sel?.status === "online" ? "var(--success-9)" : "var(--danger-9)",
          }}/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{sel?.name || "서버 선택"}</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>· {sel?.modelCount}개</span>
        </div>
        <Iam.ChevronDown size={12} style={{ color: "var(--text-tertiary)" }}/>
      </button>

      {open && (
        <div data-no-intercept style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          minWidth: 320,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--r-2)",
          boxShadow: "var(--shadow-3)",
          zIndex: 10,
          padding: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-tertiary)", padding: "6px 10px 4px" }}>
            서버 선택
          </div>
          {servers.map((s) => (
            <div key={s.name} onClick={() => { onChange(s.name); onToggle(); }} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px",
              borderRadius: 4,
              background: value === s.name ? "var(--accent-3)" : "transparent",
              cursor: "pointer",
            }}
              onMouseOver={(e) => { if (value !== s.name) e.currentTarget.style.background = "var(--bg-tint)"; }}
              onMouseOut={(e) => { if (value !== s.name) e.currentTarget.style.background = "transparent"; }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: s.status === "online" ? "var(--success-9)" : "var(--danger-9)",
                flex: "0 0 auto",
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: value === s.name ? 600 : 500, color: value === s.name ? "var(--accent-11)" : "var(--text-primary)" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                  {s.host} · {s.modelCount}개 · 마지막 {s.lastSync}
                </div>
              </div>
              {value === s.name && <Iam.Check size={12} style={{ color: "var(--accent-9)" }}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminModelsPage({ mobile }) {
  const [baseFilter, setBaseFilter] = useStateAm([]);  // array of base model keys, empty = all
  const [typeFilter, setTypeFilter] = useStateAm("all");
  const [server, setServer] = useStateAm("comfy-01");
  const [pickerOpen, setPickerOpen] = useStateAm(false);
  const [baseOpen, setBaseOpen] = useStateAm(false);
  const [baseSearch, setBaseSearch] = useStateAm("");
  const [showNsfw, setShowNsfw] = useStateAm(false);
  const [hideNsfwThumbs, setHideNsfwThumbs] = useStateAm(true);
  const [civitaiOpen, setCivitaiOpen] = useStateAm(false);
  const [view, setView] = useStateAm(mobile ? "list" : "grid");
  const [detail, setDetail] = useStateAm(null);  // 선택된 모델 (null이면 닫힘)

  const toggleBase = (v) => {
    setBaseFilter((cur) => cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  const servers = [
    { name: "comfy-01", host: "192.168.1.51", lastSync: "5분 전",  status: "online", modelCount: 13 },
    { name: "comfy-02", host: "192.168.1.52", lastSync: "12분 전", status: "online", modelCount: 6 },
  ];

  // 모델 데이터: 베이스 모델 다양화
  const allModels = [
    // comfy-01
    { name: "DreamShaper XL v2 Turbo",      filename: "dreamshaperXL_v2TurboDpmppSDE.safetensors", kind: "checkpoint", baseModel: "sdxl",        size: "6.4GB",  server: "comfy-01", uses: 412, hue: 270, popular: true },
    { name: "AnimagineXL v3",                filename: "animagineXLV3_v3.safetensors",              kind: "checkpoint", baseModel: "sdxl",        size: "6.6GB",  server: "comfy-01", uses: 248, hue: 320, popular: true },
    { name: "Illustrious-XL v1.0",           filename: "Illustrious-XL-v1.0.safetensors",          kind: "checkpoint", baseModel: "illustrious", size: "6.5GB",  server: "comfy-01", uses: 187, hue: 280, popular: true },
    { name: "NoobAI-XL Vpred 1.0",           filename: "noobaiXLNAIXL_vpred10Version.safetensors", kind: "checkpoint", baseModel: "noobai",      size: "6.5GB",  server: "comfy-01", uses: 88,  hue: 300 },
    { name: "Pony Diffusion v6 XL",          filename: "ponyDiffusionV6XL_v6.safetensors",          kind: "checkpoint", baseModel: "pony",        size: "6.5GB",  server: "comfy-01", uses: 64,  hue: 350, nsfw: true },
    { name: "anime-line-clean",              filename: "anime-line-clean.safetensors",              kind: "lora",       baseModel: "sdxl",        size: "144MB",  server: "comfy-01", uses: 156, hue: 200, popular: true },
    { name: "rusty-blood-era",               filename: "rusty-blood-era.safetensors",               kind: "lora",       baseModel: "illustrious", size: "160MB",  server: "comfy-01", uses: 41,  hue: 20 },
    { name: "frost-mage-v2",                 filename: "frost-mage-v2.safetensors",                 kind: "lora",       baseModel: "sdxl",        size: "152MB",  server: "comfy-01", uses: 28,  hue: 220 },
    { name: "boudoir-style-v3",              filename: "boudoir-style-v3.safetensors",              kind: "lora",       baseModel: "pony",        size: "148MB",  server: "comfy-01", uses: 12,  hue: 0,   nsfw: true },
    { name: "4xUltraSharp",                  filename: "4x-UltraSharp.pth",                         kind: "upscaler",                              size: "67MB",   server: "comfy-01", uses: 412, hue: 50 },
    { name: "Anime6B",                       filename: "RealESRGAN_x4plus_anime_6B.pth",            kind: "upscaler",                              size: "18MB",   server: "comfy-01", uses: 248, hue: 80 },
    { name: "sdxl-vae-fp16-fix",             filename: "sdxl_vae_fp16_fix.safetensors",            kind: "vae",                                   size: "335MB",  server: "comfy-01", uses: 412, hue: 180 },
    { name: "easy_negative",                 filename: "easynegative.safetensors",                  kind: "embedding",                             size: "24KB",   server: "comfy-01", uses: 187, hue: 140 },
    // comfy-02
    { name: "FLUX.1 dev",                    filename: "flux1-dev.safetensors",                     kind: "checkpoint", baseModel: "flux",        size: "23.8GB", server: "comfy-02", uses: 48, hue: 160, popular: true },
    { name: "Z Image Base alpha2",           filename: "zimage-base-alpha2.safetensors",            kind: "checkpoint", baseModel: "zimage-base", size: "8.2GB",  server: "comfy-02", uses: 6,  hue: 240 },
    { name: "Z Image Turbo alpha1",          filename: "zimage-turbo-alpha1.safetensors",           kind: "checkpoint", baseModel: "zimage-turbo",size: "8.2GB",  server: "comfy-02", uses: 14, hue: 250 },
    { name: "Anima Pencil v4",               filename: "animaPencilV4_v4.safetensors",              kind: "checkpoint", baseModel: "anima",       size: "2.1GB",  server: "comfy-02", uses: 18, hue: 40 },
    { name: "WAN 2.2 T2V",                   filename: "wan22-t2v-14B.safetensors",                 kind: "checkpoint", baseModel: "wan22",       size: "14.0GB", server: "comfy-02", uses: 22, hue: 210 },
    { name: "LTX-2 base",                    filename: "ltx2-base.safetensors",                     kind: "checkpoint", baseModel: "ltx2",        size: "9.4GB",  server: "comfy-02", uses: 11, hue: 330 },
  ];

  // First filter by selected server
  const serverModels = allModels.filter((m) => m.server === server);

  const passesNsfw = (m) => showNsfw || !m.nsfw;
  const passesBase = (m, baseSet) => baseSet.length === 0 || baseSet.includes(m.baseModel);
  const passesType = (m, type) => type === "all" || m.kind === type;

  // Counts per base model — respect current type filter
  const baseCounts = BASE_MODELS.map((d) => ({
    ...d,
    c: serverModels.filter((m) => passesNsfw(m) && m.baseModel === d.v && passesType(m, typeFilter)).length,
  }));
  // Show only base models with > 0 in current server scope; otherwise list all (so user knows what exists)
  const visibleBases = baseCounts.filter((b) => b.c > 0);
  const baseListForPicker = visibleBases.length ? visibleBases : baseCounts;
  const baseFiltered = baseSearch.trim()
    ? baseListForPicker.filter((b) => b.l.toLowerCase().includes(baseSearch.toLowerCase()))
    : baseListForPicker;

  // Type chips: context-aware count w/ current base selection
  const typeChips = [{ v: "all", l: "모두", c: serverModels.filter((m) => passesNsfw(m) && passesBase(m, baseFilter)).length }]
    .concat(MODEL_TYPES.map((d) => ({
      ...d,
      c: serverModels.filter((m) => passesNsfw(m) && m.kind === d.v && passesBase(m, baseFilter)).length,
    })))
    .filter((c) => c.v === "all" || c.c > 0);

  const filtered = serverModels.filter((m) => passesNsfw(m) && passesBase(m, baseFilter) && passesType(m, typeFilter));
  const sel = servers.find((s) => s.name === server);
  const hasFilters = baseFilter.length > 0 || typeFilter !== "all";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">모델 관리</h1>
          <p className="page-sub">Civitai에서 다운로드한 모델을 ComfyUI 서버 단위로 관리합니다.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary" onClick={() => setCivitaiOpen(!civitaiOpen)}>
              <Iam.Lock /> Civitai API 키
            </button>
          </div>
        )}
      </div>

      {/* Civitai API key panel (collapsible) */}
      {civitaiOpen && (
        <div className="card" style={{ marginBottom: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--accent-3)", color: "var(--accent-11)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <Iam.Lock />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Civitai API 키</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 3, marginBottom: 12 }}>
                Civitai에서 모델을 다운로드하려면 API 키가 필요합니다.
                <a href="https://civitai.com/user/account" style={{ color: "var(--accent-11)", marginLeft: 6, textDecoration: "none" }}>civitai.com → Account →</a>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <input className="input" type="password" defaultValue="••••••••••••••••••••••3a4f" style={{ fontFamily: "var(--font-mono)", fontSize: 12, flex: 1, minWidth: 200, maxWidth: 420 }}/>
                <button className="btn btn--secondary btn--sm"><Iam.Eye size={12}/></button>
                <button className="btn btn--secondary btn--sm"><Iam.Copy size={12}/></button>
                <button className="btn btn--primary btn--sm"><Iam.Check size={12}/> 저장</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 11.5 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--success-11)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success-9)" }}/>
                  연결됨
                </span>
                <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>마지막 확인 5분 전 · scope: read</span>
              </div>
            </div>
            <button className="btn btn--ghost btn--icon btn--sm" onClick={() => setCivitaiOpen(false)}><Iam.X /></button>
          </div>
        </div>
      )}

      {/* Server picker + Sync button row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <ServerPicker
          open={pickerOpen}
          onToggle={() => setPickerOpen(!pickerOpen)}
          value={server}
          onChange={setServer}
          servers={servers}
        />
        <button className="btn btn--primary btn--sm">
          <Iam.Refresh size={12}/> 동기화
        </button>
        <span style={{ flex: 1 }}/>
        <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          마지막 동기화 {sel?.lastSync}
        </span>
      </div>

      {/* NSFW filter banner */}
      <div className="card" style={{ marginBottom: 14, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "var(--danger-3)", color: "var(--danger-11)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
              <Iam.Shield size={14}/>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>NSFW 컨텐츠</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>성인 컨텐츠 모델 표시 및 썸네일 노출 제어</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12.5 }}>
              <button onClick={() => setShowNsfw(!showNsfw)} style={{
                width: 32, height: 18, padding: 2, borderRadius: 999,
                background: showNsfw ? "var(--accent-9)" : "var(--border-strong)",
                border: 0, cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: showNsfw ? "flex-end" : "flex-start",
                transition: "all 120ms",
              }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white" }}/>
              </button>
              NSFW 모델 표시
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: showNsfw ? "pointer" : "not-allowed", fontSize: 12.5, opacity: showNsfw ? 1 : 0.4 }}>
              <button onClick={() => showNsfw && setHideNsfwThumbs(!hideNsfwThumbs)} disabled={!showNsfw} style={{
                width: 32, height: 18, padding: 2, borderRadius: 999,
                background: hideNsfwThumbs ? "var(--accent-9)" : "var(--border-strong)",
                border: 0, cursor: showNsfw ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center",
                justifyContent: hideNsfwThumbs ? "flex-end" : "flex-start",
                transition: "all 120ms",
              }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "white" }}/>
              </button>
              썸네일 블러 처리
            </label>
          </div>
        </div>
      </div>

      {/* Search row + view toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input className="input" placeholder="모델 이름 · 파일명 검색" style={{ paddingLeft: 32 }}/>
          <span style={{ position: "absolute", left: 10, top: 8, color: "var(--text-tertiary)" }}><Iam.Search size={14}/></span>
        </div>
        <div style={{
          display: "inline-flex", padding: 3, borderRadius: 6,
          background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)",
          flex: "0 0 auto",
        }}>
          {[
            { v: "grid", icon: <Iam.Grid size={12}/>, l: "그리드" },
            { v: "list", icon: <Iam.Menu size={12}/>, l: "목록" },
          ].map((b) => (
            <button key={b.v} onClick={() => setView(b.v)} title={b.l} style={{
              padding: mobile ? "5px 8px" : "5px 10px", borderRadius: 4, border: 0, cursor: "pointer", fontSize: 12,
              background: view === b.v ? "var(--bg-surface)" : "transparent",
              color: view === b.v ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: view === b.v ? "var(--shadow-1)" : "none",
              display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 500,
            }}>
              {b.icon}{!mobile && b.l}
            </button>
          ))}
        </div>
      </div>

      {/* Model Type — primary tabs (complete separation). Mobile: dropdown */}
      {mobile ? (
        <div style={{ position: "relative", marginBottom: 12 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{
            appearance: "none", width: "100%",
            fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600,
            color: "var(--accent-11)", background: "var(--accent-3)",
            border: "1px solid var(--accent-4)", borderRadius: "var(--r-2)",
            padding: "10px 36px 10px 14px", cursor: "pointer",
          }}>
            {typeChips.map((k) => (
              <option key={k.v} value={k.v} style={{ color: "var(--text-primary)", background: "var(--bg-surface)" }}>
                {k.l}  ({k.c})
              </option>
            ))}
          </select>
          <Iam.ChevronDown size={14} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--accent-11)", pointerEvents: "none" }}/>
        </div>
      ) : (
        <div className="tabs" style={{ marginBottom: 12, overflowX: "auto" }}>
          {typeChips.map((t) => (
            <div key={t.v} className={"tab" + (typeFilter === t.v ? " is-active" : "")} onClick={() => setTypeFilter(t.v)}>
              <span>{t.l}</span>
              <span className="tab__count">{t.c}</span>
            </div>
          ))}
        </div>
      )}

      {/* Base Model combo — only shown when type supports base model */}
      {(typeFilter === "all" || typeFilter === "checkpoint" || typeFilter === "lora") && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", flex: "0 0 auto" }}>Base Model</span>
          <div style={{ position: "relative" }}>
            <button onClick={() => { setBaseOpen(!baseOpen); setBaseSearch(""); }} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 10px", height: 30, minWidth: 240,
              background: "var(--bg-surface)",
              border: "1px solid " + (baseOpen ? "var(--accent-9)" : "var(--border-default)"),
              borderRadius: "var(--r-2)",
              cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: 12.5,
              boxShadow: baseOpen ? "var(--shadow-focus)" : "none",
            }}>
              {baseFilter.length === 0 ? (
                <span style={{ flex: 1, textAlign: "left", color: "var(--text-tertiary)" }}>모든 베이스 모델</span>
              ) : (
                <span style={{ flex: 1, textAlign: "left", color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {baseFilter.length === 1
                    ? BASE_BY_KEY[baseFilter[0]]?.l
                    : `${baseFilter.length}개 선택됨`}
                </span>
              )}
              <Iam.ChevronDown size={12} style={{ color: "var(--text-tertiary)" }}/>
            </button>

            {baseOpen && (
              <div data-no-intercept style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0,
                width: 320, maxHeight: 380,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--r-2)",
                boxShadow: "var(--shadow-3)",
                zIndex: 20,
                display: "flex", flexDirection: "column",
                overflow: "hidden",
              }}>
                <div style={{ padding: 8, borderBottom: "1px solid var(--border-subtle)" }}>
                  <div style={{ position: "relative" }}>
                    <input
                      autoFocus
                      value={baseSearch}
                      onChange={(e) => setBaseSearch(e.target.value)}
                      className="input"
                      placeholder="Base Model 검색…"
                      style={{ paddingLeft: 28, fontSize: 12.5 }}
                    />
                    <span style={{ position: "absolute", left: 8, top: 8, color: "var(--text-tertiary)" }}>
                      <Iam.Search size={13}/>
                    </span>
                  </div>
                </div>
                <div style={{ overflow: "auto", padding: 4, flex: 1 }}>
                  {baseFiltered.length === 0 && (
                    <div style={{ padding: 14, fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
                      "{baseSearch}"에 대한 결과 없음
                    </div>
                  )}
                  {baseFiltered.map((b) => {
                    const on = baseFilter.includes(b.v);
                    return (
                      <div key={b.v} onClick={() => toggleBase(b.v)} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px", borderRadius: 4,
                        cursor: "pointer",
                        background: on ? "var(--accent-3)" : "transparent",
                      }}
                        onMouseOver={(e) => { if (!on) e.currentTarget.style.background = "var(--bg-tint)"; }}
                        onMouseOut={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: 3,
                          background: on ? "var(--accent-9)" : "transparent",
                          border: "1.5px solid " + (on ? "var(--accent-9)" : "var(--border-strong)"),
                          display: "grid", placeItems: "center", flex: "0 0 auto",
                        }}>{on && <Iam.Check size={10} style={{ color: "white" }}/>}</div>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: b.color, flex: "0 0 auto" }}/>
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: on ? 600 : 500, color: on ? "var(--accent-11)" : "var(--text-primary)" }}>{b.l}</span>
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>{b.c}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  padding: 8, borderTop: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", gap: 8,
                  background: "var(--bg-tint)",
                }}>
                  <span style={{ flex: 1, fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    {baseFilter.length === 0 ? "전체 표시" : `${baseFilter.length}개 선택`}
                  </span>
                  {baseFilter.length > 0 && (
                    <button onClick={() => setBaseFilter([])} className="btn btn--ghost btn--sm" style={{ height: 22, fontSize: 11 }}>
                      모두 해제
                    </button>
                  )}
                  <button onClick={() => setBaseOpen(false)} className="btn btn--secondary btn--sm" style={{ height: 22, fontSize: 11 }}>완료</button>
                </div>
              </div>
            )}
          </div>
          {baseFilter.length > 0 && (
            <button onClick={() => setBaseFilter([])} className="btn btn--ghost btn--sm" style={{ height: 26, fontSize: 11 }}>
              <Iam.X size={10}/> 초기화
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
        <b>{server}</b> · {filtered.length}개 모델
      </div>

      {/* Grid / List */}
      {view === "grid" ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: mobile ? "repeat(2, 1fr)" : "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}>
          {filtered.map((m) => <ModelCardGrid key={m.filename} m={m} hideNsfw={hideNsfwThumbs} onOpen={setDetail}/>)}
        </div>
      ) : (
        <div className="card">
          {!mobile && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 10px 8px 70px",
              fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--text-tertiary)", background: "var(--bg-tint)",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <span style={{ flex: 1 }}>이름 · 베이스 · 버전</span>
              <span style={{ width: 32 }}/>
            </div>
          )}
          {filtered.map((m) => <ModelRowList key={m.filename} m={m} hideNsfw={hideNsfwThumbs} mobile={mobile} onOpen={setDetail}/>)}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { AdminModelsPage });
