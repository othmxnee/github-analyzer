/* eslint-disable */
function App() {
  const [isLight, setIsLight] = React.useState(false);
  const [repoUrl, setRepoUrl] = React.useState('');
  useReveal();
  useEntrance('.hp-badge, .hp-h1, .hp-sub, .hp-island');

  const toggleTheme = React.useCallback(() => {
    setIsLight(v => {
      const next = !v;
      document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark');
      document.body.classList.toggle('lm', next);
      return next;
    });
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const onSubmit = () => {
    // demo only — show a transient toast
    const t = document.createElement('div');
    t.textContent = `→ Would analyze ${repoUrl || 'https://github.com/pallets/flask'}`;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(59,110,234,0.13)', border: '1px solid rgba(59,110,234,0.28)',
      color: '#3B6EEA', padding: '10px 18px', borderRadius: '10px', fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px', zIndex: 100, backdropFilter: 'blur(12px)',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  };

  return (
    <>
      <NavBar isLight={isLight} onToggleTheme={toggleTheme} onScrollTo={scrollTo} />
      <Hero isLight={isLight} repoUrl={repoUrl} setRepoUrl={setRepoUrl} onSubmit={onSubmit} />
      <StatsStrip />
      <RepoTicker />
      <div className="hp-divider" />
      <Features />
      <div className="hp-divider" />
      <Roles isLight={isLight} />
      <div className="hp-divider" />
      <HowItWorks />
      <div className="hp-divider" />
      <Metrics />
      <CTASection repoUrl={repoUrl} setRepoUrl={setRepoUrl} onSubmit={onSubmit} />
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
