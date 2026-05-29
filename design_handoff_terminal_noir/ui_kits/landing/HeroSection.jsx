/* eslint-disable */
function NavBar({ isLight, onToggleTheme, onScrollTo }) {
  return (
    <nav className="hp-nav">
      <div className="hp-logo">git<span className="dot">·</span>analyzer</div>
      <ul className="hp-navlinks">
        <li><button onClick={() => onScrollTo('hp-features')}>Features</button></li>
        <li><button onClick={() => onScrollTo('hp-roles')}>Developer roles</button></li>
        <li><button onClick={() => onScrollTo('hp-how')}>How it works</button></li>
        <li><button onClick={() => onScrollTo('hp-metrics')}>Metrics</button></li>
      </ul>
      <div className="hp-nav-right">
        <button className="hp-auth-btn"><Ico.GitHub /> Sign in</button>
        <button className="hp-mode-btn" onClick={onToggleTheme}>
          {isLight ? <Ico.Moon /> : <Ico.Sun />} {isLight ? 'Dark mode' : 'Light mode'}
        </button>
        <button className="hp-nav-cta" onClick={() => onScrollTo('hp-input')}>Try it →</button>
      </div>
    </nav>
  );
}

function Hero({ isLight, repoUrl, setRepoUrl, onSubmit }) {
  return (
    <section className="hp-hero">
      <ParticleCanvas isLight={isLight} />
      <div className="hp-hero-inner">
        <div className="hp-badge"><span className="hp-badge-dot" /> Repository intelligence</div>
        <h1 className="hp-h1">
          Paste a repo.
          <span className="hp-h1-accent">See everything.</span>
        </h1>
        <p className="hp-sub">
          Git history doesn't lie. Developer activity, knowledge concentration,
          architectural risks, and team roles — extracted automatically.
        </p>

        <div className="hp-island" id="hp-input">
          <div className="hp-island-label">Analyze a repository</div>
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
            <div className="hp-input-row">
              <div className="hp-prompt">&gt;</div>
              <input className="hp-input" type="text" value={repoUrl}
                     onChange={e => setRepoUrl(e.target.value)}
                     placeholder="https://github.com/pallets/flask"
                     spellCheck={false} autoComplete="off" />
              <button type="submit" className="hp-submit">Analyze →</button>
            </div>
          </form>
          <div className="hp-island-footer">
            <div className="hp-footer-row">
              <div className="hp-pills">
                {['pallets/flask','django/django','torvalds/linux'].map(r => (
                  <div key={r} className="hp-pill"
                       onClick={() => setRepoUrl(`https://github.com/${r}`)}>{r}</div>
                ))}
              </div>
              <div className="hp-note">Sign in for private repos</div>
            </div>
          </div>
        </div>
      </div>

      <div className="hp-scroll-hint">
        <div className="hp-scroll-arr">
          <span>Scroll</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  const [ref, inView] = useInView();
  const stats = [
    { v: 6,   suffix: '',  l: 'Analysis dimensions' },
    { v: 18,  suffix: '+', l: 'Chart types' },
    { v: 15,  suffix: '',  l: 'Metrics per developer' },
    { v: 7,   suffix: '',  l: 'Roles detected' },
    { v: null, text: 'Zero', l: 'Auth required' },
  ];
  return (
    <div className="hp-stats" ref={ref}>
      {stats.map(({ v, suffix, text, l }) => (
        <div className="hp-stat" key={l}>
          <div className="hp-stat-n">
            {text ? text : <CountUp value={v} run={inView} suffix={suffix} />}
          </div>
          <div className="hp-stat-l">{l}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { NavBar, Hero, StatsStrip });
