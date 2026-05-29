/* eslint-disable */
/* TimelineChart — drawing-in commit timeline (sparkline + area) */
function TimelineChart({ data, height = 180 }) {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(600);
  React.useEffect(() => {
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.v));
  const pad = 24;
  const W = w, H = height;
  const x = (i) => pad + ((W - pad * 2) * i) / (data.length - 1);
  const y = (v) => H - pad - ((H - pad * 2) * v) / max;
  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.v)}`).join(' ');
  const areaPath = `${linePath} L ${x(data.length - 1)} ${H - pad} L ${x(0)} ${H - pad} Z`;
  const len = data.length * 8;
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ga-line-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3B6EEA" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3B6EEA" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line key={i} x1={pad} x2={W - pad} y1={pad + (H - pad * 2) * p} y2={pad + (H - pad * 2) * p}
                stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        <path d={areaPath} fill="url(#ga-line-grad)" style={{ opacity: 0, animation: 'fadeIn .8s .3s forwards' }} />
        <path d={linePath} fill="none" stroke="#3B6EEA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: len, strokeDashoffset: len, animation: 'draw 1.2s cubic-bezier(.16,1,.3,1) forwards' }} />
        {/* dots */}
        {data.map((d, i) => i % 6 === 0 && (
          <circle key={i} cx={x(i)} cy={y(d.v)} r="2" fill="#3B6EEA" style={{ opacity: 0, animation: `fadeIn .4s ${0.6 + i * 0.01}s forwards` }} />
        ))}
        {/* x-axis labels */}
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 5)) === 0).map((d, i, arr) => {
          const idx = data.indexOf(d);
          return (
            <text key={i} x={x(idx)} y={H - 6} fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#5A6380" textAnchor="middle">
              {d.label}
            </text>
          );
        })}
      </svg>
      <style>{`
        @keyframes draw { to { stroke-dashoffset: 0; } }
        @keyframes fadeIn { to { opacity: 1; } }
      `}</style>
    </div>
  );
}

/* BarChart — horizontal bars, e.g. top devs / hotspots */
function BarChart({ data, color = '#3B6EEA', valueFmt = (v) => v.toLocaleString() }) {
  const max = Math.max(...data.map(d => d.v));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--f)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: d.color || color, borderRadius: 4,
              width: '0%', animation: `bargrow .9s ${i * 0.05 + 0.1}s cubic-bezier(.16,1,.3,1) forwards`,
              '--final': `${(d.v / max) * 100}%`,
            }} />
          </div>
          <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--t)', textAlign: 'right' }}>{valueFmt(d.v)}</div>
        </div>
      ))}
      <style>{`
        @keyframes bargrow { from { width: 0; } to { width: var(--final); } }
      `}</style>
    </div>
  );
}

/* SimpleHeatmap — dev × file mod intensity */
function Heatmap({ rows, cols, values }) {
  const max = Math.max(...values.flat());
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: `120px repeat(${cols.length}, 1fr)`, gap: 2, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
      <div />
      {cols.map(c => <div key={c} style={{ color: 'var(--t3)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '0 2px' }}>{c}</div>)}
      {rows.map((r, i) => (
        <React.Fragment key={r}>
          <div style={{ color: 'var(--t2)', padding: '4px 8px 4px 0', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r}</div>
          {cols.map((c, j) => {
            const v = values[i]?.[j] || 0;
            const a = v / max;
            return <div key={c + j} title={`${r} × ${c}: ${v}`} style={{ height: 22, background: `rgba(59,110,234,${a})`, borderRadius: 2 }} />;
          })}
        </React.Fragment>
      ))}
    </div>
  );
}

window.TimelineChart = TimelineChart;
window.BarChart = BarChart;
window.Heatmap = Heatmap;
