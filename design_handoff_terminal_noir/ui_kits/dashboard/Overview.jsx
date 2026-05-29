/* eslint-disable */
function Overview() {
  return (
    <>
      <SectionHead
        eyebrow="Overview"
        title="Project Health at a Glance"
        sub="Who's active, what's at risk, and where to look next"
      />

      {/* Bento grid */}
      <div className="bento" style={{ marginBottom: 14 }}>
        <div className="card span-2 row-2">
          <div className="card-title">
            <span className="ic"><DIco.Knowledge /></span>
            <span>Repository health</span>
            <span className="meta">computed · 4.2s ago</span>
          </div>
          <div className="health-meter">
            <div className="health-gauge">
              <svg viewBox="0 0 100 100">
                <circle className="ring-bg" cx="50" cy="50" r="42" fill="none" strokeWidth="8" />
                <circle className="ring-fg" cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                        strokeDasharray="58 264" />
              </svg>
              <div className="inner">
                <div className="score"><Counter value={22} /></div>
                <div className="denom">/ 100</div>
              </div>
            </div>
            <div className="health-info">
              <div className="risk-label">CRITICAL · IMMEDIATE ATTENTION</div>
              <h3>Bus factor of 2 leaves the project exposed</h3>
              <p>Top contributor owns 43% of total knowledge. Inequality coefficient 0.74 — well above the 0.6 caution threshold.</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="kpi">
            <div className="kpi-label">COMMITS</div>
            <div className="kpi-value blue"><Counter value={3847} /></div>
            <div className="kpi-trend up">↑ <Counter value={12.4} decimals={1} suffix="%" /> · 30d</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">CONTRIBUTORS</div>
            <div className="kpi-value"><Counter value={142} /></div>
            <div className="kpi-trend up">38 active · 90d</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">BUS FACTOR</div>
            <div className="kpi-value red"><Counter value={2} /></div>
            <div className="kpi-trend down">critical</div>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <div className="kpi-label">GINI</div>
            <div className="kpi-value amber"><Counter value={0.74} decimals={2} /></div>
            <div className="kpi-trend down">unequal</div>
          </div>
        </div>
      </div>

      {/* Activity timeline (full width) */}
      <CardShell
        title="Commit Activity"
        icon={<DIco.Activity />}
        meta="90d · daily"
        style={{ marginBottom: 14 }}
      >
        <TimelineChart data={generateTimeline()} />
      </CardShell>

      {/* Insights & recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <CardShell title="Key insights" icon={<DIco.Info />}>
          <div className="bullet-list" style={{ padding: 0 }}>
            {[
              { ic: '01', t: 'red',   body: <><strong>Bus factor of 2</strong> — losing either of two contributors would cripple delivery. Industry baseline is ≥ 5.</> },
              { ic: '02', t: 'amber', body: <><strong>One module dominates</strong> — <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ac)' }}>flask/app.py</code> sees 4× the churn of any other file.</> },
              { ic: '03', t: 'amber', body: <><strong>Knowledge concentration is high</strong> — top 5 contributors own 78% of all lines in core paths.</> },
              { ic: '04', t: 'green', body: <><strong>Healthy test coverage</strong> — tests grew at 1.3× the rate of source code over the last 12 months.</> },
            ].map(({ ic, t, body }) => (
              <div key={ic} className="row">
                <div className={`ico ${t}`}>{ic}</div>
                <div className="body">{body}</div>
              </div>
            ))}
          </div>
        </CardShell>
        <CardShell title="Recommendations" icon={<DIco.Roles />}>
          <div className="bullet-list" style={{ padding: 0 }}>
            {[
              { ic: '→', body: <><strong>Cross-train</strong> two developers on <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ac)' }}>services/git.py</code> to raise the bus factor to 4.</> },
              { ic: '→', body: <><strong>Refactor</strong> <code style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ac)' }}>flask/app.py</code> — split the 1,840-line file into 3 cohesive modules.</> },
              { ic: '→', body: <><strong>Pair-program</strong> on PRs touching files with KCI &gt; 0.7 for the next 6 sprints.</> },
              { ic: '→', body: <><strong>Document</strong> the auth flow — owned exclusively by one developer for 28 months.</> },
            ].map(({ ic, body }, i) => (
              <div key={i} className="row">
                <div className="ico">{ic}</div>
                <div className="body">{body}</div>
              </div>
            ))}
          </div>
        </CardShell>
      </div>
    </>
  );
}

function generateTimeline() {
  const out = [];
  for (let i = 0; i < 90; i++) {
    const base = 22 + 14 * Math.sin(i * 0.3) + 6 * Math.cos(i * 0.5);
    const noise = (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * 6;
    out.push({ label: `D${i}`, v: Math.max(2, base + noise + Math.random() * 4) });
  }
  return out.map((d, i, arr) => ({
    label: i === 0 ? 'Mar 1' : i === Math.floor(arr.length * 0.5) ? 'Apr 15' : i === arr.length - 1 ? 'May 28' : '',
    v: d.v,
  }));
}

window.Overview = Overview;
