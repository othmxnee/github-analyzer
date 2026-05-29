/* eslint-disable */
/* TypewriterTerminal — types each line out char-by-char, then loops.
   Only runs once it scrolls into view. */
function TypewriterTerminal() {
  const LINES = [
    { c: 'dim',   text: '$ git-analyzer run pallets/flask' },
    { c: 'gray',  text: '→ Cloning repository...' },
    { c: 'green', text: '✓ 3,847 commits loaded' },
    { c: 'green', text: '✓ 142 contributors found' },
    { c: 'gray',  text: '→ Computing 15 metrics / dev...' },
    { c: 'blue',  text: '  gini_coefficient = 0.74' },
    { c: 'amber', text: '  ⚠ bus_factor = 2 (critical)' },
    { c: 'gray',  text: '→ Detecting developer roles...' },
    { c: 'green', text: '✓ Backend: 38 · Generalist: 24' },
    { c: 'green', text: '✓ Tester: 8 · DevOps: 9' },
    { c: 'gray',  text: '→ Running K-Means + PCA...' },
    { c: 'green', text: '✓ Dashboard ready in 4.2s' },
  ];
  const [ref, inView] = useInView();
  const [done, setDone] = React.useState([]);   // completed lines
  const [cur, setCur] = React.useState('');      // current line being typed
  const [li, setLi] = React.useState(0);         // line index
  const [ci, setCi] = React.useState(0);         // char index

  React.useEffect(() => {
    if (!inView) return;
    if (li >= LINES.length) {
      // hold the finished screen, then restart
      const hold = setTimeout(() => { setDone([]); setCur(''); setLi(0); setCi(0); }, 2600);
      return () => clearTimeout(hold);
    }
    const line = LINES[li];
    if (ci <= line.text.length) {
      const speed = 16 + Math.random() * 26;
      const tm = setTimeout(() => { setCur(line.text.slice(0, ci)); setCi(ci + 1); }, speed);
      return () => clearTimeout(tm);
    } else {
      // line complete — commit it, brief pause before next
      const pause = setTimeout(() => {
        setDone(d => [...d, line]); setCur(''); setLi(li + 1); setCi(0);
      }, 90 + (line.text.startsWith('→') ? 220 : 40));
      return () => clearTimeout(pause);
    }
  }, [inView, li, ci]);

  const curColor = LINES[li]?.c || 'bright';
  return (
    <div className="hp-term-body" ref={ref}>
      {done.map((l, i) => <span key={i} className={`hp-tl ${l.c}`}>{l.text || '\u00A0'}</span>)}
      {li < LINES.length && (
        <span className={`hp-tl ${curColor}`}>{cur}<span className="hp-cursor" /></span>
      )}
      {li >= LINES.length && (
        <span className="hp-tl bright">{'\u00A0'}<span className="hp-cursor" /></span>
      )}
    </div>
  );
}
window.TypewriterTerminal = TypewriterTerminal;

function HowItWorks() {
  const steps = [
    { n: '01', t: 'Paste a repository URL', icon: <Ico.Link />,
      d: 'Any public GitHub repository. No authentication, API keys, or configuration needed.' },
    { n: '02', t: 'Analysis runs automatically', icon: <Ico.Server />,
      d: 'PyDriller extracts commit history, file changes, and authorship data; we compute all 15 metrics per developer.' },
    { n: '03', t: 'Explore the dashboard', icon: <Ico.Overview />,
      d: 'Interactive charts, heatmaps, dependency graphs, PCA skill maps, and risk tables — all in one place.' },
  ];
  return (
    <section className="hp-section" id="hp-how">
      <div className="hp-inner">
        <div className="hp-reveal">
          <div className="hp-s-label">How it works</div>
          <div className="hp-s-title">Three steps to insight</div>
          <div className="hp-s-sub">No setup. No configuration. No API keys. Just a GitHub URL.</div>
        </div>
        <div className="hp-steps hp-reveal">
          {steps.map(({ n, t, d, icon }, i) => (
            <div className="hp-step" key={n} style={i > 0 ? { borderLeft: '1px solid var(--b)' } : {}}>
              <div className="hp-step-num">{n}</div>
              <div className="hp-step-ico">{icon}</div>
              <div className="hp-step-t">{t}</div>
              <div className="hp-step-d">{d}</div>
            </div>
          ))}
        </div>
        <div className="hp-terminal-row hp-reveal">
          <div className="hp-term-text">
            <div className="hp-s-label">See it in action</div>
            <div className="hp-s-title" style={{ marginBottom: 12 }}>Live analysis output</div>
            <div className="hp-s-sub" style={{ marginBottom: 24 }}>
              Watch the platform extract and compute in real time — from raw Git history to
              role-annotated developer profiles.
            </div>
            {[
              { c: 'var(--green)', title: 'PyDriller extraction',
                detail: '— full commit history, file diffs, and author metadata' },
              { c: 'var(--ac)',    title: '15 metrics per developer',
                detail: '— file extensions, folder paths, commit keywords' },
              { c: 'var(--amber)', title: 'K-Means + PCA',
                detail: '— clustering resolves ambiguous profiles, PCA maps skill space' },
            ].map(({ c, title, detail }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 7 }} />
                <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
                  <strong style={{ color: 'var(--t)', fontWeight: 600 }}>{title}</strong> {detail}
                </div>
              </div>
            ))}
          </div>
          <div className="hp-term-win">
            <div className="hp-term-bar">
              <div className="hp-t-dot" style={{ background: '#FF5F56' }} />
              <div className="hp-t-dot" style={{ background: '#FFBD2E' }} />
              <div className="hp-t-dot" style={{ background: '#27C93F' }} />
              <span className="hp-term-file">analysis.log — pallets/flask</span>
            </div>
            <TypewriterTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}

const METRICS = [
  { label: 'Total commits',         val: '3,847',  sub: 'over 14 years',          bar: 100, cls: 'blue'  },
  { label: 'Contributors',          val: '142',    sub: '38 active in 90d',       bar: 38,  cls: ''      },
  { label: 'Gini coefficient',      val: '0.74',   sub: 'unequal contribution',   bar: 74,  cls: 'amber' },
  { label: 'Bus factor',            val: '2',      sub: 'critical · raise to 5',   bar: 20,  cls: 'red'   },
  { label: 'Top contributor share', val: '43%',    sub: 'of total knowledge',     bar: 43,  cls: 'amber' },
  { label: 'Project health',        val: '22/100', sub: 'critical · needs attention', bar: 22, cls: 'red' },
];

function Metrics() {
  return (
    <section className="hp-section alt" id="hp-metrics">
      <div className="hp-inner">
        <div className="hp-reveal">
          <div className="hp-s-label">Sample output</div>
          <div className="hp-s-title">What you will see</div>
          <div className="hp-s-sub">Real metrics from <code style={{ fontFamily: 'var(--mono)', color: 'var(--ac)', fontSize: 13, background: 'var(--ac-d)', padding: '2px 6px', borderRadius: 4 }}>pallets/flask</code>.</div>
        </div>
        <div className="hp-mets hp-reveal">
          {METRICS.map(({ label, val, sub, bar, cls }) => (
            <div className="hp-mc" key={label}>
              <div className="hp-mc-label">{label}</div>
              <div className={`hp-mc-val${cls ? ' ' + cls : ''}`}>{val}</div>
              <div className="hp-mc-sub">{sub}</div>
              <div className="hp-mc-bar">
                <div className={`hp-mc-fill${cls ? ' ' + cls : ''}`} style={{ width: `${bar}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ repoUrl, setRepoUrl, onSubmit }) {
  return (
    <div className="hp-cta hp-reveal">
      <h2 className="hp-cta-h">Ready to analyze your repository?</h2>
      <p className="hp-cta-sub">Paste a URL and get a full breakdown in under a minute.</p>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <div className="hp-cta-bar">
          <input className="hp-cta-input" type="text" value={repoUrl}
                 onChange={e => setRepoUrl(e.target.value)}
                 placeholder="https://github.com/your/repo" />
          <button type="submit" className="hp-cta-btn">Get started →</button>
        </div>
      </form>
    </div>
  );
}

function Footer() {
  return (
    <footer className="hp-footer">
      <div className="hp-footer-logo">git<span>·</span>analyzer</div>
      <div>Built with PyDriller · Flask · React</div>
      <div>PFE 2025</div>
    </footer>
  );
}

Object.assign(window, { HowItWorks, Metrics, CTASection, Footer });
