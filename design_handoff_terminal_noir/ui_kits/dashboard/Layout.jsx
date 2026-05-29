/* eslint-disable */
function TopBar({ isLight, onToggleTheme, repoSlug }) {
  return (
    <header className="dash-topbar">
      <div className="dash-topbar-logo">git<span className="dot">·</span>analyzer</div>
      <div className="dash-topbar-center">
        <button className="dash-back-btn"><DIco.Back /> New analysis</button>
        <div className="dash-divider" />
        <div className="dash-repo-name">{repoSlug}</div>
        <div className="dash-repo-badge">ANALYZED</div>
      </div>
      <div className="dash-topbar-right">
        <a className="dash-gh-btn" href="#"><DIco.GitHub /> View on GitHub</a>
        <button className="dash-reanalyze-btn"><DIco.Refresh /> Re-analyze</button>
        <button className="dash-pdf-btn"><DIco.Download /> PDF Report</button>
        <button className="dash-mode-btn" onClick={onToggleTheme}>
          {isLight ? <DIco.Moon /> : <DIco.Sun />} {isLight ? 'Dark' : 'Light'}
        </button>
      </div>
    </header>
  );
}

const NAV_SECTIONS = [
  { id: 'overview',     label: 'Overview',         Icon: DIco.Overview,      badge: null },
  { id: 'activity',     label: 'Activity',         Icon: DIco.Activity,      badge: null },
  { id: 'knowledge',    label: 'Knowledge & Risk', Icon: DIco.Knowledge,     badge: 'red' },
  { id: 'hotspots',     label: 'Hotspots',         Icon: DIco.Hotspots,      badge: 'amber' },
  { id: 'architecture', label: 'Architecture',     Icon: DIco.Architecture,  badge: null },
  { id: 'roles',        label: 'Developer Roles',  Icon: DIco.Roles,         badge: null },
];

function Sidebar({ activeSection, onSwitch, healthScore }) {
  const c = healthScore >= 70 ? 'green' : healthScore >= 40 ? 'amber' : 'red';
  return (
    <aside className="dash-sidebar">
      <div className="dash-health-widget">
        <div className="dash-hw-label">Health Score</div>
        <div className="dash-hw-score">
          <div className={`dash-hw-num ${c}`}><Counter value={healthScore} /></div>
          <div className="dash-hw-denom">/ 100</div>
        </div>
        <div className="dash-hw-bar">
          <div className={`dash-hw-fill ${c}`} style={{ width: `${healthScore}%` }} />
        </div>
      </div>

      <div className="dash-nav-label" style={{ marginTop: 20 }}>Navigation</div>
      {NAV_SECTIONS.map(({ id, label, Icon, badge }) => (
        <div key={id} className={`dash-nav-item${activeSection === id ? ' active' : ''}`} onClick={() => onSwitch(id)}>
          <Icon /> {label}
          {badge && (
            <span className={`dash-nav-badge ${badge}`}>{badge === 'red' ? 'Risk' : 'High'}</span>
          )}
        </div>
      ))}

      <div className="dash-nav-label">Repository</div>
      <div className="dash-nav-meta"><DIco.Info /> 3,847 commits · 142 devs</div>
      <div className="dash-nav-meta"><DIco.Calendar /> 2010-04 → 2026-05</div>
    </aside>
  );
}

function SectionHead({ eyebrow, title, sub, right }) {
  return (
    <div className="dash-section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
      <div>
        <div className="dash-s-eyebrow">{eyebrow}</div>
        <div className="dash-s-title">{title}</div>
        {sub && <div className="dash-s-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function CardShell({ title, icon, meta, children, style }) {
  return (
    <div className="card" style={style}>
      <div className="card-title">
        {icon && <span className="ic">{icon}</span>}
        <span>{title}</span>
        {meta && <span className="meta">{meta}</span>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

Object.assign(window, { TopBar, Sidebar, SectionHead, CardShell, NAV_SECTIONS });
