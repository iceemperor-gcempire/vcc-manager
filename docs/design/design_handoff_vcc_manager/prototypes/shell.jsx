// shell.jsx — Shared chrome (sidebar + top bar) for VCC prototype pages.
// All pages mount inside <Shell>.

const { useState } = React;
const I = window.Icon;

function NavItem({ icon, label, badge, active, danger, onClick }) {
  return (
    <div
      className={
        "vcc-nav-item" +
        (active ? " is-active" : "") +
        (danger ? " vcc-nav-item--admin" : "")
      }
      onClick={onClick}
    >
      <span className="vcc-nav-item__icon">{icon}</span>
      <span>{label}</span>
      {badge != null && <span className="vcc-nav-item__badge">{badge}</span>}
    </div>
  );
}

function Sidebar({ active = "projects", onNav, mobile }) {
  if (mobile) return null;
  const nav = (k, label, icon, badge) => (
    <NavItem
      key={k}
      icon={icon}
      label={label}
      badge={badge}
      active={active === k}
      onClick={() => onNav && onNav(k)}
    />
  );
  return (
    <aside className="vcc-side">
      <div className="vcc-side__brand">
        <div className="vcc-side__mark">V</div>
        <div className="vcc-side__brand-text">
          <span className="vcc-side__brand-name">VCC Manager</span>
          <span className="vcc-side__brand-sub">alpha · v1.4</span>
        </div>
      </div>

      <div className="vcc-side__section">
        <div className="vcc-side__label">메뉴</div>
        {nav("dashboard", "대시보드", <I.Dashboard />)}
        {nav("workboards", "작업판", <I.Grid />, "12")}
        {nav("projects", "프로젝트", <I.Folder />, "4")}
        {nav("content", "내 컨텐츠", <I.Image />)}
        {nav("history", "작업 히스토리", <I.Clock />)}
        {nav("prompts", "프롬프트 데이터", <I.Doc />)}
        {nav("tags", "태그", <I.Tag />)}
        {nav("lora", "LoRA 목록", <I.Magic />)}
        {nav("settings", "설정", <I.Settings />)}
      </div>

      <div className="vcc-side__section">
        <div className="vcc-side__label">관리자</div>
        <NavItem icon={<I.Shield />} label="관리자 대시보드" danger active={active === "admindash"} onClick={() => onNav && onNav("admindash")}/>
        <NavItem icon={<I.Users />} label="사용자 관리" danger active={active === "users"} onClick={() => onNav && onNav("users")}/>
        <NavItem icon={<I.Grid />} label="작업판 관리" danger active={active === "wbadmin"} onClick={() => onNav && onNav("wbadmin")}/>
        <NavItem icon={<I.Server />} label="서버 관리" danger active={active === "servers"} onClick={() => onNav && onNav("servers")}/>
        <NavItem icon={<I.Cube />} label="모델 관리" danger active={active === "models"} onClick={() => onNav && onNav("models")}/>
        <NavItem icon={<I.Stats />} label="시스템 통계" danger active={active === "stats"} onClick={() => onNav && onNav("stats")}/>
        <NavItem icon={<I.Backup />} label="백업 / 복구" danger active={active === "backup"} onClick={() => onNav && onNav("backup")}/>
      </div>

      <div className="vcc-side__spacer" />

      <div className="vcc-side__user" onClick={() => onNav && onNav("profile")} style={{ cursor: "pointer" }}>
        <div className="vcc-side__avatar">셀</div>
        <div className="vcc-side__user-meta">
          <span className="vcc-side__user-name">쎌렘황제</span>
          <span className="vcc-side__user-role">Admin</span>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ crumbs = [], children, mobile, onMenu }) {
  return (
    <header className="vcc-top">
      {mobile && (
        <button className="btn btn--ghost btn--icon btn--sm" onClick={onMenu} aria-label="메뉴">
          <I.Menu />
        </button>
      )}
      <nav className="vcc-top__crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep"><I.ChevronRight size={12}/></span>}
            {i === crumbs.length - 1 ? (
              <span className="here">{c}</span>
            ) : (
              <a href="#">{c}</a>
            )}
          </React.Fragment>
        ))}
      </nav>
      <div className="vcc-top__right">{children}</div>
    </header>
  );
}

function Shell({ active, crumbs, mobile, topRight, children, onNav }) {
  return (
    <div className={"vcc-app" + (mobile ? " mobile" : "")}>
      <Sidebar active={active} onNav={onNav} mobile={mobile} />
      <main className="vcc-main">
        <TopBar crumbs={crumbs} mobile={mobile}>{topRight}</TopBar>
        <div className="vcc-body">{children}</div>
      </main>
    </div>
  );
}

// Simple bottom tabbar for mobile prototype
function MobileTabbar({ active = "projects", onNav }) {
  const tabs = [
    { k: "dashboard", l: "대시", icon: <I.Dashboard /> },
    { k: "workboards", l: "작업판", icon: <I.Grid /> },
    { k: "projects", l: "프로젝트", icon: <I.Folder /> },
    { k: "content", l: "컨텐츠", icon: <I.Image /> },
    { k: "history", l: "히스토리", icon: <I.Clock /> },
  ];
  return (
    <nav className="m-tabbar">
      {tabs.map((t) => (
        <div
          key={t.k}
          className={"m-tabbar__item" + (active === t.k ? " is-active" : "")}
          onClick={() => onNav && onNav(t.k)}
        >
          {t.icon}
          <span>{t.l}</span>
        </div>
      ))}
    </nav>
  );
}

Object.assign(window, { Shell, Sidebar, TopBar, MobileTabbar, NavItem });
