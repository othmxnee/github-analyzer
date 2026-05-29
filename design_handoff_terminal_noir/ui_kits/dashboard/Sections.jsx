/* eslint-disable */
function Architecture() {
  return (
    <>
      <SectionHead
        eyebrow="Architecture"
        title="Dependency Graph"
        sub="File coupling and PageRank centrality"
      />
      <CardShell title="Architecture Graph" icon={<DIco.Architecture />} meta="12 nodes · 15 edges"
                 style={{ marginBottom: 14 }}>
        <ArchitectureGraph />
      </CardShell>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <CardShell title="Top files by in-degree" icon={<DIco.Architecture />}>
          <table className="dt">
            <thead><tr><th>File</th><th className="right">IN-DEG</th><th className="right">PAGE-RANK</th></tr></thead>
            <tbody>
              {[
                ['src/flask/app.py', 11, 0.142],
                ['services/git.py', 8, 0.118],
                ['services/metrics.py', 7, 0.106],
                ['services/skills.py', 6, 0.094],
                ['routes/repo.py', 5, 0.082],
                ['models/repo.py', 4, 0.061],
              ].map(([f, d, p]) => (
                <tr key={f}>
                  <td>{f}</td>
                  <td className="right">{d}</td>
                  <td className="right" style={{ color: 'var(--ac)' }}>{p.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardShell>
        <CardShell title="Modular cohesion" icon={<DIco.Knowledge />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}>
            {[
              { l: 'routes/', v: 0.84, c: 'green' },
              { l: 'services/', v: 0.71, c: 'green' },
              { l: 'models/', v: 0.62, c: 'amber' },
              { l: 'utils/', v: 0.38, c: 'red' },
            ].map(r => (
              <div key={r.l} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 50px', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--t)', fontFamily: 'var(--mono)' }}>{r.l}</div>
                <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4 }}>
                  <div style={{ height: '100%', background: `var(--${r.c})`, width: `${r.v * 100}%`, borderRadius: 4, transition: 'width 1s' }} />
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: `var(--${r.c})`, textAlign: 'right' }}>{r.v.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </>
  );
}

function DeveloperRoles() {
  const dist = [
    { label: 'Backend', v: 38, color: '#00C896' },
    { label: 'Generalist', v: 24, color: '#7880A0' },
    { label: 'Frontend', v: 18, color: '#3B6EEA' },
    { label: 'Full Stack', v: 12, color: '#A78BFA' },
    { label: 'DevOps', v: 9, color: '#F59E0B' },
    { label: 'Tester', v: 8, color: '#EF4444' },
    { label: 'Mobile', v: 6, color: '#06B6D4' },
  ];
  return (
    <>
      <SectionHead
        eyebrow="Developer Roles"
        title="Skills & Role Detection"
        sub="15 metrics per developer · K-Means clustering · PCA projection"
      />

      <div className="bento" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">ANALYZED</div>
            <div className="kpi-value blue"><Counter value={115} /></div>
            <div className="kpi-trend">with 5+ commits</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">BACKEND</div>
            <div className="kpi-value" style={{ color: '#00C896' }}><Counter value={38} /></div>
            <div className="kpi-trend">largest cluster</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">GENERALIST</div>
            <div className="kpi-value" style={{ color: '#7880A0' }}><Counter value={24} /></div>
            <div className="kpi-trend">no dominant signal</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">DEVOPS</div>
            <div className="kpi-value" style={{ color: '#F59E0B' }}><Counter value={9} /></div>
            <div className="kpi-trend">infra · CI · docker</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <CardShell title="Role Distribution" icon={<DIco.Roles />}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '8px 0' }}>
            <RoleDoughnut data={dist} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dist.map(d => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--t)', flex: 1 }}>{d.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{d.v}</span>
                </div>
              ))}
            </div>
          </div>
        </CardShell>
        <CardShell title="Developer Skill Profile" icon={<DIco.Roles />} meta="A. Ronacher · Backend">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
            <RadarChart
              axes={['Python', 'Tests', 'Frontend', 'DevOps', 'Docs', 'Mobile', 'Refactor', 'Features']}
              data={[0.95, 0.62, 0.18, 0.32, 0.74, 0.05, 0.86, 0.91]}
              color="#00C896"
              size={240}
            />
          </div>
        </CardShell>
      </div>

      <CardShell title="Developer Map — Skill Similarity (PCA)" icon={<DIco.Roles />} meta="2 components · 115 devs">
        <div style={{ height: 320 }}><PCAScatter height={320} /></div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, fontSize: 11, fontFamily: 'var(--f)', color: 'var(--t2)' }}>
          {dist.map(d => (
            <span key={d.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: d.color, borderRadius: '50%' }} /> {d.label}
            </span>
          ))}
        </div>
      </CardShell>
    </>
  );
}

Object.assign(window, { Architecture, DeveloperRoles });
