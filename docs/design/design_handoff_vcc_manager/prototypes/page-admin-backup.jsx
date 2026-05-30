// page-admin-backup.jsx — 백업 / 복구 (admin)

const { useState: useStateAb } = React;
const Iab = window.Icon;

function AdminBackupPage({ mobile }) {
  const [sel, setSel] = useStateAb(null);

  const backups = [
    { id: "bk_a8c2", time: "2026. 5. 25 오전 3:00", size: "412MB", kind: "자동", status: "ok", projects: 4, images: 1247, docs: 16, current: true },
    { id: "bk_9f1d", time: "2026. 5. 24 오전 3:00", size: "408MB", kind: "자동", status: "ok", projects: 4, images: 1218, docs: 16 },
    { id: "bk_man1", time: "2026. 5. 23 오후 8:42", size: "402MB", kind: "수동", status: "ok", projects: 4, images: 1187, docs: 14, note: "v1.4 배포 직전" },
    { id: "bk_7c0a", time: "2026. 5. 23 오전 3:00", size: "401MB", kind: "자동", status: "ok", projects: 4, images: 1184, docs: 14 },
    { id: "bk_6b8e", time: "2026. 5. 22 오전 3:00", size: "398MB", kind: "자동", status: "ok", projects: 4, images: 1160, docs: 13 },
    { id: "bk_5fail", time: "2026. 5. 21 오전 3:00", size: "—",     kind: "자동", status: "fail", note: "디스크 부족" },
    { id: "bk_4d7c", time: "2026. 5. 20 오전 3:00", size: "388MB", kind: "자동", status: "ok", projects: 3, images: 1098, docs: 12 },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ flex: "1 1 360px", minWidth: 0 }}>
          <h1 className="page-title">백업 / 복구</h1>
          <p className="page-sub">매일 03:00 자동 백업. 최근 30일 보관 · 그 이전은 주간만 보관.</p>
        </div>
        {!mobile && (
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary"><Iab.Settings /> 백업 정책</button>
            <button className="btn btn--primary"><Iab.Backup /> 지금 백업</button>
          </div>
        )}
      </div>

      {/* Status banner */}
      <div className="card" style={{ padding: 16, marginBottom: 18, background: "var(--success-1)", borderColor: "var(--success-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--success-9)", color: "white", display: "grid", placeItems: "center" }}>
            <Iab.Check />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success-11)" }}>백업 시스템 정상</div>
            <div style={{ fontSize: 12.5, color: "var(--success-11)", marginTop: 2, opacity: 0.85 }}>
              마지막 성공 · 7시간 전 (오늘 03:00) · 다음 예정 17시간 후
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
            {[
              { l: "보관 중", v: "30개" },
              { l: "총 용량", v: "11.8GB" },
              { l: "최근 백업", v: "412MB" },
            ].map((s) => (
              <div key={s.l}>
                <div style={{ color: "var(--success-11)", opacity: 0.7, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
                <div style={{ color: "var(--success-11)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Backups list */}
      <div className="card">
        <div className="card__header">
          <Iab.Backup />
          <span className="card__title">백업 목록</span>
          <span className="tab__count">{backups.length}</span>
          <span style={{ flex: 1 }}/>
          <button className="btn btn--ghost btn--sm"><Iab.Refresh size={12}/> 새로고침</button>
        </div>
        <div>
          {backups.map((b) => (
            <div key={b.id} onClick={() => setSel(sel === b.id ? null : b.id)} style={{
              padding: "14px 16px",
              borderTop: "1px solid var(--border-subtle)",
              cursor: "pointer",
              background: sel === b.id ? "var(--accent-1)" : (b.current ? "var(--success-1)" : "transparent"),
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: b.status === "ok" ? "var(--success-3)" : "var(--danger-3)",
                  color: b.status === "ok" ? "var(--success-11)" : "var(--danger-11)",
                  display: "grid", placeItems: "center", flex: "0 0 auto",
                }}>
                  {b.status === "ok" ? <Iab.Check /> : <Iab.X />}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{b.time}</span>
                    {b.current && <span className="chip chip--success chip--tag">최신</span>}
                    <span className={"chip chip--tag " + (b.kind === "수동" ? "chip--accent" : "")} style={{ fontSize: 10 }}>{b.kind}</span>
                    {b.status === "fail" && <span className="chip chip--danger chip--tag">실패</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                    {b.id}{b.note && " · " + b.note}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "var(--font-mono)", width: 70, textAlign: "right" }}>
                  {b.size}
                </span>
                {!mobile && b.status === "ok" && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn--secondary btn--sm" onClick={(e) => e.stopPropagation()}>
                      <Iab.ArrowDown size={12}/> 다운로드
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ color: "var(--danger-11)" }} onClick={(e) => e.stopPropagation()}>
                      <Iab.Refresh size={12}/> 복구
                    </button>
                  </div>
                )}
              </div>
              {sel === b.id && b.status === "ok" && (
                <div style={{
                  marginTop: 12, padding: 12,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  fontSize: 12, color: "var(--text-secondary)",
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 12 }}>
                    {[
                      ["프로젝트", b.projects],
                      ["이미지", b.images?.toLocaleString()],
                      ["문서", b.docs],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ color: "var(--text-tertiary)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
                        <div style={{ color: "var(--text-primary)", fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono)", marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 10, background: "var(--warning-1)", border: "1px solid var(--warning-3)", borderRadius: 5, color: "var(--warning-11)", display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
                    <Iab.Info size={14} style={{ marginTop: 1, flex: "0 0 auto" }}/>
                    <div>복구는 현재 데이터를 모두 이 시점으로 되돌립니다. 복구 전 추가 백업이 자동 생성됩니다.</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminBackupPage });
