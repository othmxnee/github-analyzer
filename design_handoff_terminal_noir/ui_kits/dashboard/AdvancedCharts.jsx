/* eslint-disable */
/* ArchitectureGraph — simple SVG force-directed visualization
   (the real product uses react-force-graph; this is a static layout) */
function ArchitectureGraph({ width = 720, height = 460 }) {
  const ref = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);

  // Hand-positioned graph that suggests app/router/services structure
  const nodes = [
    { id: 'app.py',         x: 0.50, y: 0.12, r: 22, weight: 0.92, kind: 'core' },
    { id: 'routes/auth.py', x: 0.20, y: 0.30, r: 14, weight: 0.55, kind: 'route' },
    { id: 'routes/repo.py', x: 0.36, y: 0.40, r: 18, weight: 0.71, kind: 'route' },
    { id: 'routes/api.py',  x: 0.66, y: 0.36, r: 16, weight: 0.62, kind: 'route' },
    { id: 'routes/job.py',  x: 0.82, y: 0.28, r: 12, weight: 0.42, kind: 'route' },
    { id: 'services/git.py',     x: 0.28, y: 0.62, r: 20, weight: 0.78, kind: 'service' },
    { id: 'services/metrics.py', x: 0.50, y: 0.70, r: 19, weight: 0.74, kind: 'service' },
    { id: 'services/skills.py',  x: 0.72, y: 0.62, r: 17, weight: 0.66, kind: 'service' },
    { id: 'models/dev.py',  x: 0.18, y: 0.84, r: 10, weight: 0.35, kind: 'model' },
    { id: 'models/repo.py', x: 0.40, y: 0.90, r: 11, weight: 0.38, kind: 'model' },
    { id: 'utils/io.py',    x: 0.62, y: 0.88, r: 9,  weight: 0.28, kind: 'util' },
    { id: 'utils/log.py',   x: 0.86, y: 0.80, r: 8,  weight: 0.22, kind: 'util' },
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 5], [2, 5], [3, 7], [4, 7],
    [2, 6], [3, 6],
    [5, 8], [5, 9], [6, 9], [6, 10], [7, 11],
  ];
  const colors = { core: '#3B6EEA', route: '#A78BFA', service: '#00C896', model: '#F59E0B', util: '#7880A0' };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3B6EEA" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3B6EEA" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* edges */}
        {edges.map(([a, b], i) => {
          const A = nodes[a], B = nodes[b];
          const ax = A.x * width, ay = A.y * height;
          const bx = B.x * width, by = B.y * height;
          const isH = hovered != null && (hovered === a || hovered === b);
          return (
            <line key={i} x1={ax} y1={ay} x2={bx} y2={by}
                  stroke={isH ? '#3B6EEA' : 'rgba(155,168,200,0.18)'}
                  strokeWidth={isH ? 1.5 : 1}
                  style={{ strokeDasharray: 6, strokeDashoffset: 6, animation: `dash 1s ${i * 0.04}s ease-out forwards` }} />
          );
        })}
        {/* nodes */}
        {nodes.map((n, i) => {
          const cx = n.x * width, cy = n.y * height;
          const col = colors[n.kind];
          const isH = hovered === i;
          return (
            <g key={n.id} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
               style={{ cursor: 'pointer', transformOrigin: `${cx}px ${cy}px`, transform: isH ? 'scale(1.08)' : 'scale(1)', transition: 'transform .15s' }}>
              {isH && <circle cx={cx} cy={cy} r={n.r * 2.4} fill="url(#node-glow)" />}
              <circle cx={cx} cy={cy} r={n.r}
                      fill={isH ? col : col + '33'} stroke={col} strokeWidth="1.5"
                      style={{ opacity: 0, animation: `fadeIn .5s ${0.2 + i * 0.05}s forwards` }} />
              <text x={cx} y={cy + n.r + 14} fontFamily="JetBrains Mono, monospace" fontSize="10"
                    fill={isH ? '#EEEEF3' : '#9BA8C8'} textAnchor="middle"
                    style={{ opacity: 0, animation: `fadeIn .5s ${0.3 + i * 0.05}s forwards` }}>
                {n.id}
              </text>
            </g>
          );
        })}
        <style>{`
          @keyframes dash { to { stroke-dashoffset: 0; } }
          @keyframes fadeIn { to { opacity: 1; } }
        `}</style>
      </svg>
      <div style={{ position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 10, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--t3)' }}>
        {Object.entries(colors).map(([k, c]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, background: c, borderRadius: '50%' }} /> {k}
          </span>
        ))}
      </div>
    </div>
  );
}
window.ArchitectureGraph = ArchitectureGraph;

/* PCAScatter — role-colored clusters */
function PCAScatter({ height = 320 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const fit = () => {
      const r = c.parentElement.getBoundingClientRect();
      c.width = r.width * dpr; c.height = height * dpr;
      c.style.width = r.width + 'px'; c.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const onR = () => fit(); window.addEventListener('resize', onR);
    const W = () => c.width / dpr, H = () => c.height / dpr;

    const clusters = [
      { c: '#3B6EEA', x: 0.20, y: 0.32, n: 14, name: 'Frontend' },
      { c: '#00C896', x: 0.72, y: 0.48, n: 18, name: 'Backend' },
      { c: '#F59E0B', x: 0.78, y: 0.18, n: 7,  name: 'DevOps' },
      { c: '#A78BFA', x: 0.42, y: 0.62, n: 11, name: 'Full Stack' },
      { c: '#EF4444', x: 0.18, y: 0.78, n: 5,  name: 'Tester' },
      { c: '#06B6D4', x: 0.58, y: 0.82, n: 6,  name: 'Mobile' },
      { c: '#7880A0', x: 0.46, y: 0.30, n: 10, name: 'Generalist' },
    ];
    let s = 7;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;

    function draw() {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((w / 6) * i, 0); ctx.lineTo((w / 6) * i, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, (h / 6) * i); ctx.lineTo(w, (h / 6) * i); ctx.stroke(); }
      clusters.forEach(cl => {
        for (let i = 0; i < cl.n; i++) {
          const x = cl.x * w + (r() - 0.5) * 70;
          const y = cl.y * h + (r() - 0.5) * 50;
          ctx.fillStyle = cl.c + 'aa';
          ctx.beginPath(); ctx.arc(x, y, 4 + r() * 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = cl.c; ctx.lineWidth = 1.2; ctx.stroke();
        }
      });
    }
    draw();
    return () => window.removeEventListener('resize', onR);
  }, []);
  return <canvas ref={ref} />;
}
window.PCAScatter = PCAScatter;

/* RadarChart — dev skill profile, 8 axes */
function RadarChart({ axes, data, color = '#3B6EEA', size = 220 }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 24;
  const N = axes.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (v, i) => [cx + Math.cos(angle(i)) * R * v, cy + Math.sin(angle(i)) * R * v];
  const poly = data.map((v, i) => pt(v, i).join(',')).join(' ');
  return (
    <svg width={size} height={size}>
      {/* rings */}
      {[0.25, 0.5, 0.75, 1].map((p, i) => (
        <polygon key={i} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"
                 points={axes.map((_, j) => pt(p, j).join(',')).join(' ')} />
      ))}
      {/* spokes */}
      {axes.map((_, i) => {
        const [x, y] = pt(1, i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;
      })}
      {/* data */}
      <polygon points={poly} fill={color + '33'} stroke={color} strokeWidth="1.5"
               style={{ transformOrigin: 'center', transform: 'scale(0)', animation: 'radarpop .8s cubic-bezier(.34,1.56,.64,1) .2s forwards' }} />
      {/* labels */}
      {axes.map((a, i) => {
        const [x, y] = pt(1.15, i);
        return <text key={a} x={x} y={y} fontSize="9" fill="#9BA8C8" textAnchor="middle" dominantBaseline="middle" fontFamily="Satoshi, sans-serif">{a}</text>;
      })}
      <style>{`@keyframes radarpop { to { transform: scale(1); } }`}</style>
    </svg>
  );
}
window.RadarChart = RadarChart;

/* RoleDoughnut — distribution of detected roles */
function RoleDoughnut({ data, size = 220 }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const R = size / 2 - 8, r = R - 22, cx = size / 2, cy = size / 2;
  let a = -Math.PI / 2;
  return (
    <svg width={size} height={size}>
      {data.map((d, i) => {
        const slice = (d.v / total) * Math.PI * 2;
        const a2 = a + slice;
        const large = slice > Math.PI ? 1 : 0;
        const path = `
          M ${cx + Math.cos(a) * R} ${cy + Math.sin(a) * R}
          A ${R} ${R} 0 ${large} 1 ${cx + Math.cos(a2) * R} ${cy + Math.sin(a2) * R}
          L ${cx + Math.cos(a2) * r} ${cy + Math.sin(a2) * r}
          A ${r} ${r} 0 ${large} 0 ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}
          Z
        `;
        const el = <path key={d.label} d={path} fill={d.color}
                         style={{ opacity: 0, animation: `fadeIn .5s ${0.1 + i * 0.07}s forwards` }} />;
        a = a2;
        return el;
      })}
      <text x={cx} y={cy - 4} fontSize="28" fontWeight="700" fontFamily="JetBrains Mono, monospace"
            fill="#EEEEF3" textAnchor="middle" letterSpacing="-0.5">{total}</text>
      <text x={cx} y={cy + 14} fontSize="9" fill="#5A6380" textAnchor="middle"
            fontFamily="Satoshi, sans-serif" letterSpacing="1.4" textTransform="uppercase">DEVELOPERS</text>
      <style>{`@keyframes fadeIn { to { opacity: 1; } }`}</style>
    </svg>
  );
}
window.RoleDoughnut = RoleDoughnut;
