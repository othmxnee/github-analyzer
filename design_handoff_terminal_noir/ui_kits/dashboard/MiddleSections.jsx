/* eslint-disable */
function Activity() {
  const topDevs = [
    { label: 'Armin Ronacher', v: 1240, color: '#3B6EEA' },
    { label: 'David Lord',     v: 698,  color: '#3B6EEA' },
    { label: 'Adrian Mönnich', v: 412,  color: '#3B6EEA' },
    { label: 'Markus Unterwaditzer', v: 287, color: '#3B6EEA' },
    { label: 'Daniel Neuhäuser', v: 196, color: '#3B6EEA' },
    { label: 'Keyan Pishdadian', v: 142, color: '#3B6EEA' },
    { label: 'Christopher Grebs', v: 88, color: '#3B6EEA' },
  ];
  return (
    <>
      <SectionHead
        eyebrow="Activity"
        title="Developer Activity"
        sub="Who contributes, how often, and how consistently"
      />
      <CardShell title="Activity Timeline" icon={<DIco.Activity />} meta="monthly · 12mo"
                 style={{ marginBottom: 14 }}>
        <TimelineChart data={genMonthly()} height={210} />
      </CardShell>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <CardShell title="Top Developers by Commits" icon={<DIco.Roles />}>
          <BarChart data={topDevs} />
        </CardShell>
        <CardShell title="Contribution Inequality (Lorenz)" icon={<DIco.Knowledge />}
                   meta="Gini = 0.74">
          <LorenzCurve />
        </CardShell>
      </div>
      <CardShell title="Developer × File Activity" icon={<DIco.Hotspots />} meta="top 6 devs × top 8 files">
        <Heatmap
          rows={['A. Ronacher', 'D. Lord', 'A. Mönnich', 'M. Unter…', 'D. Neuhäu…', 'K. Pishd…']}
          cols={['app.py', 'helpers.py', 'cli.py', 'sessions.py', 'json/__init__.py', 'globals.py', 'blueprints.py', 'wrappers.py']}
          values={[
            [42, 18, 12, 14, 8, 22, 31, 16],
            [22, 28, 8, 12, 14, 18, 9, 4],
            [12, 8, 22, 6, 18, 14, 7, 11],
            [8, 14, 6, 10, 4, 9, 8, 12],
            [6, 4, 11, 8, 14, 7, 3, 5],
            [4, 6, 8, 14, 5, 4, 6, 3],
          ]}
        />
      </CardShell>
    </>
  );
}
function genMonthly() {
  const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  return months.map((m, i) => ({ label: m, v: 80 + Math.random() * 90 + 30 * Math.sin(i * 0.7) }));
}

/* Lorenz curve drawing */
function LorenzCurve() {
  const W = 360, H = 200, pad = 28;
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const x = i / 100;
    // skewed curve mimicking gini 0.74
    const y = Math.pow(x, 4.0);
    pts.push([pad + (W - pad * 2) * x, H - pad - (H - pad * 2) * y]);
  }
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const equal = `M ${pad} ${H - pad} L ${W - pad} ${pad}`;
  const len = 1200;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <path d={`${equal} L ${W - pad} ${H - pad} Z`} fill="rgba(245,158,11,0.08)" />
      <path d={`${path} L ${W - pad} ${H - pad} Z`} fill="rgba(59,110,234,0.18)" />
      <path d={equal} stroke="#5A6380" strokeWidth="1" strokeDasharray="4 3" fill="none" />
      <path d={path} stroke="#3B6EEA" strokeWidth="2" fill="none" strokeLinecap="round"
            style={{ strokeDasharray: len, strokeDashoffset: len, animation: 'draw 1.2s cubic-bezier(.16,1,.3,1) forwards' }} />
      <text x={pad} y={H - 10} fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#5A6380">0%</text>
      <text x={W - pad} y={H - 10} fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#5A6380" textAnchor="end">100% of devs</text>
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

function KnowledgeRisk() {
  return (
    <>
      <SectionHead
        eyebrow="Knowledge & Risk"
        title="Ownership & Bus Factor"
        sub="Who knows what — and what happens if they leave"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <CardShell title="Knowledge Concentration (KCI)" icon={<DIco.Knowledge />}>
          <table className="dt">
            <thead><tr><th>File</th><th className="right">KCI</th><th>OWNER</th></tr></thead>
            <tbody>
              {[
                { f: 'src/flask/app.py',      kci: 0.84, o: 'A. Ronacher', c: 'red' },
                { f: 'src/flask/sessions.py', kci: 0.78, o: 'A. Ronacher', c: 'red' },
                { f: 'src/flask/cli.py',      kci: 0.62, o: 'D. Lord',     c: 'amber' },
                { f: 'src/flask/helpers.py',  kci: 0.55, o: 'D. Lord',     c: 'amber' },
                { f: 'src/flask/blueprints.py', kci: 0.47, o: 'A. Mönnich', c: 'amber' },
                { f: 'tests/test_basic.py',   kci: 0.31, o: 'D. Lord',     c: '' },
              ].map(r => (
                <tr key={r.f}>
                  <td>{r.f}</td>
                  <td className="right" style={{ color: r.c === 'red' ? 'var(--red)' : r.c === 'amber' ? 'var(--amber)' : 'var(--t)' }}>{r.kci.toFixed(2)}</td>
                  <td className="muted">{r.o}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardShell>
        <CardShell title="Risk = KCI × In-Degree" icon={<DIco.Hotspots />}>
          <table className="dt">
            <thead><tr><th>File</th><th className="right">RISK</th><th>STATUS</th></tr></thead>
            <tbody>
              {[
                { f: 'src/flask/app.py', r: 0.92, s: 'CRITICAL', c: 'red' },
                { f: 'src/flask/sessions.py', r: 0.74, s: 'CRITICAL', c: 'red' },
                { f: 'services/git.py', r: 0.58, s: 'WARNING', c: 'amber' },
                { f: 'services/skills.py', r: 0.46, s: 'WARNING', c: 'amber' },
                { f: 'src/flask/cli.py', r: 0.34, s: 'OK', c: 'green' },
                { f: 'src/flask/helpers.py', r: 0.28, s: 'OK', c: 'green' },
              ].map(r => (
                <tr key={r.f}>
                  <td>{r.f}</td>
                  <td className="right">{r.r.toFixed(2)}</td>
                  <td><span className="role-chip" style={{ background: `var(--${r.c}-d)`, color: `var(--${r.c})` }}>{r.s}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardShell>
      </div>
    </>
  );
}

function Hotspots() {
  const files = [
    { label: 'src/flask/app.py',         v: 318, color: '#EF4444' },
    { label: 'src/flask/helpers.py',     v: 142, color: '#F59E0B' },
    { label: 'src/flask/cli.py',         v: 124, color: '#F59E0B' },
    { label: 'src/flask/sessions.py',    v: 108, color: '#F59E0B' },
    { label: 'tests/test_basic.py',      v:  98, color: '#3B6EEA' },
    { label: 'docs/changes.rst',         v:  88, color: '#3B6EEA' },
    { label: 'src/flask/blueprints.py',  v:  72, color: '#3B6EEA' },
    { label: 'src/flask/json/__init__.py',v: 64, color: '#3B6EEA' },
  ];
  return (
    <>
      <SectionHead eyebrow="Hotspots" title="Code Churn & Hotspots"
        sub="Highest-churn files by modification frequency" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <CardShell title="Top Modified Files" icon={<DIco.Hotspots />} meta="all-time">
          <BarChart data={files} valueFmt={(v) => `${v} mods`} />
        </CardShell>
        <CardShell title="Repository File Hotspots (Treemap)" icon={<DIco.Hotspots />}>
          <TreemapStub />
        </CardShell>
      </div>
    </>
  );
}

function TreemapStub() {
  // simulated treemap with proportional rectangles
  const items = [
    { l: 'flask/app.py',     v: 318, c: '#EF4444' },
    { l: 'flask/helpers.py', v: 142, c: '#F59E0B' },
    { l: 'flask/cli.py',     v: 124, c: '#F59E0B' },
    { l: 'flask/sessions.py',v: 108, c: '#F59E0B' },
    { l: 'tests/',           v: 200, c: '#3B6EEA' },
    { l: 'docs/',            v: 140, c: '#3B6EEA' },
    { l: 'flask/blueprints',  v: 72, c: '#3B6EEA' },
    { l: 'flask/wrappers',    v: 58, c: '#3B6EEA' },
    { l: 'flask/json/',       v: 64, c: '#3B6EEA' },
  ];
  // quick squarified layout — simplified to row-fill
  const total = items.reduce((s, i) => s + i.v, 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, height: 280 }}>
      {items.slice(0, 6).map((it, i) => (
        <div key={it.l} style={{
          background: it.c + '33', border: `1px solid ${it.c}66`,
          borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          gridColumn: i === 0 ? '1 / span 1' : 'auto',
          gridRow: i === 0 ? '1 / span 2' : 'auto',
        }}>
          <div style={{ fontSize: 11, color: 'var(--t)', fontFamily: 'var(--mono)' }}>{it.l}</div>
          <div style={{ fontSize: 18, color: it.c, fontFamily: 'var(--mono)', fontWeight: 700 }}>{it.v}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Activity, KnowledgeRisk, Hotspots });
