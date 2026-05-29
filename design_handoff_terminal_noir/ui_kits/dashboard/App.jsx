/* eslint-disable */
function App() {
  const [isLight, setIsLight] = React.useState(false);
  const [active, setActive]   = React.useState('overview');

  const toggleTheme = React.useCallback(() => {
    setIsLight(v => {
      const next = !v;
      document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark');
      document.body.classList.toggle('lm', next);
      return next;
    });
  }, []);

  const switchSection = (id) => {
    setActive(id);
    document.querySelector('.dash-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sectionMap = {
    overview:     <Overview />,
    activity:     <Activity />,
    knowledge:    <KnowledgeRisk />,
    hotspots:     <Hotspots />,
    architecture: <Architecture />,
    roles:        <DeveloperRoles />,
  };

  return (
    <>
      <TopBar isLight={isLight} onToggleTheme={toggleTheme} repoSlug="pallets / flask" />
      <div className="dash-shell">
        <Sidebar activeSection={active} onSwitch={switchSection} healthScore={22} />
        <main className="dash-main" key={active}>
          {sectionMap[active]}
        </main>
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
