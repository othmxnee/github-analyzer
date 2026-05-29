/* eslint-disable */
/* ParticleCanvas — the brand motif, now mouse-reactive.
   Nodes drift on a slow random walk; the cursor gently attracts nearby nodes
   and brightens the links around it. Node radii pulse subtly so the field
   breathes even when the mouse is still. */
function ParticleCanvas({ isLight = false }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let raf;
    const dpr = window.devicePixelRatio || 1;
    function size() {
      const r = c.parentElement.getBoundingClientRect();
      c.width = r.width * dpr; c.height = r.height * dpr;
      c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    const onResize = () => size(); window.addEventListener('resize', onResize);

    const W = () => c.width / dpr, H = () => c.height / dpr;
    const N = 60;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * W(), y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      ph: Math.random() * Math.PI * 2,           // phase for the breathing pulse
    }));

    // mouse tracking (in canvas-local coords)
    const mouse = { x: -9999, y: -9999, active: false };
    const onMove = (e) => {
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999; };
    const host = c.parentElement;
    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);

    let t = 0;
    function draw() {
      t += 0.016;
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      const lineCol = isLight ? '37,88,212' : '59,110,234';
      const dotCol  = isLight ? '55,64,96' : '155,168,200';

      // cursor glow halo
      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 180);
        g.addColorStop(0, `rgba(${lineCol},${isLight ? 0.06 : 0.10})`);
        g.addColorStop(1, `rgba(${lineCol},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      for (let i = 0; i < N; i++) {
        const p = pts[i];
        // drift
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        // gentle attraction to cursor
        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 200 && dist > 0.5) {
            const f = (1 - dist / 200) * 0.06;
            p.vx += (dx / dist) * f;
            p.vy += (dy / dist) * f;
          }
        }
        // friction so attraction doesn't runaway
        p.vx *= 0.985; p.vy *= 0.985;
        // keep a minimum drift so the field never freezes
        const sp = Math.hypot(p.vx, p.vy);
        if (sp < 0.12) { p.vx += (Math.random() - 0.5) * 0.06; p.vy += (Math.random() - 0.5) * 0.06; }

        // links
        for (let j = i + 1; j < N; j++) {
          const q = pts[j]; const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 145) {
            const near = mouse.active
              ? Math.max(0, 1 - Math.min(Math.hypot(mouse.x - p.x, mouse.y - p.y), Math.hypot(mouse.x - q.x, mouse.y - q.y)) / 220)
              : 0;
            const base = 0.26 * (1 - d / 145);
            ctx.strokeStyle = `rgba(${lineCol},${base + near * 0.5})`;
            ctx.lineWidth = 1 + near * 0.8;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        // breathing node
        const pr = 1.5 + Math.sin(t + p.ph) * 0.6;
        const glow = mouse.active ? Math.max(0, 1 - Math.hypot(mouse.x - p.x, mouse.y - p.y) / 200) : 0;
        ctx.fillStyle = glow > 0.02
          ? `rgba(${lineCol},${0.55 + glow * 0.45})`
          : `rgba(${dotCol},0.55)`;
        ctx.beginPath(); ctx.arc(p.x, p.y, pr + glow * 2, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      host.removeEventListener('mousemove', onMove);
      host.removeEventListener('mouseleave', onLeave);
    };
  }, [isLight]);
  return <canvas ref={ref} className="hp-hero-canvas" />;
}

/* PCACanvas — 7 role clusters scattered onto a 2D map */
function PCACanvas({ isLight = false }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function size() {
      const r = c.parentElement.getBoundingClientRect();
      c.width = r.width * dpr; c.height = r.height * dpr;
      c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    const onR = () => size(); window.addEventListener('resize', onR);
    const W = () => c.width / dpr, H = () => c.height / dpr;

    const clusters = [
      { c: '#3B6EEA', x: 0.20, y: 0.32, n: 14 }, // Frontend
      { c: '#00C896', x: 0.72, y: 0.48, n: 18 }, // Backend
      { c: '#F59E0B', x: 0.78, y: 0.18, n: 7  }, // DevOps
      { c: '#A78BFA', x: 0.42, y: 0.62, n: 11 }, // FullStack
      { c: '#EF4444', x: 0.18, y: 0.78, n: 5  }, // Tester
      { c: '#06B6D4', x: 0.58, y: 0.82, n: 6  }, // Mobile
      { c: '#7880A0', x: 0.46, y: 0.30, n: 10 }, // Generalist
    ];
    function seed(s) { return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
    const r = seed(7);

    function draw() {
      const w = W(), h = H();
      ctx.clearRect(0, 0, w, h);
      // grid
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((w / 6) * i, 0); ctx.lineTo((w / 6) * i, h); ctx.stroke(); }
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, (h / 6) * i); ctx.lineTo(w, (h / 6) * i); ctx.stroke(); }

      clusters.forEach(cl => {
        for (let i = 0; i < cl.n; i++) {
          const dx = (r() - 0.5) * 60;
          const dy = (r() - 0.5) * 60;
          const x = cl.x * w + dx;
          const y = cl.y * h + dy;
          ctx.fillStyle = cl.c + 'cc';
          ctx.beginPath(); ctx.arc(x, y, 4 + r() * 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = cl.c;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });
    }
    draw();
    return () => window.removeEventListener('resize', onR);
  }, [isLight]);
  return <canvas ref={ref} style={{ width: '100%', height: '100%' }} />;
}

Object.assign(window, { ParticleCanvas, PCACanvas });
