/* eslint-disable */
/* Reusable icon set — Feather / Lucide family */
const Ico = {
  Overview:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Activity:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Knowledge:   () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>,
  Hotspots:    () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Architecture:() => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Roles:       () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Back:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  Refresh:     () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  Download:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Sun:         () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>,
  Moon:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  GitHub:      () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>,
  Link:        () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  Server:      () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  Calendar:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Info:        () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></svg>,
};
window.Ico = Ico;

/* Reveal + entrance system.
   Design rule: content is VISIBLE BY DEFAULT. We only hide-then-animate after
   probing that requestAnimationFrame actually fires in this context (some
   preview/embed harnesses suspend rAF + CSS animations entirely). If motion
   isn't live, everything just stays visible — never stuck invisible. A safety
   timeout also force-reveals everything after a few seconds no matter what. */
const _easeOut = (p) => 1 - Math.pow(1 - p, 3);

/* probe: does rAF fire? calls cb(true|false) quickly */
function probeMotion(cb) {
  let fired = false;
  requestAnimationFrame(() => { fired = true; });
  setTimeout(() => cb(fired), 240);
}

function tweenIn(el, dur = 640) {
  const start = performance.now();
  const step = (t) => {
    const p = Math.min((t - start) / dur, 1);
    const e = _easeOut(p);
    el.style.opacity = String(e);
    el.style.transform = `translateY(${(1 - e) * 18}px)`;
    if (p < 1) requestAnimationFrame(step);
    else { el.style.opacity = ''; el.style.transform = ''; el.classList.add('in'); }
  };
  requestAnimationFrame(step);
}
window.tweenIn = tweenIn;

function useReveal() {
  React.useEffect(() => {
    const els = Array.from(document.querySelectorAll('.hp-reveal'));
    if (!els.length) return;
    let raf, safety;
    const forceVisible = () => els.forEach(el => { el.style.opacity = ''; el.style.transform = ''; el.classList.add('in'); });

    probeMotion((live) => {
      if (!live) { forceVisible(); return; }          // throttled context: just show everything
      els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(18px)'; });
      const pending = new Set(els);
      const tick = () => {
        const vh = window.innerHeight || document.documentElement.clientHeight;
        for (const el of [...pending]) {
          if (el.getBoundingClientRect().top < vh * 0.9) { pending.delete(el); tweenIn(el); }
        }
        if (pending.size) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      safety = setTimeout(forceVisible, 5000);        // never leave anything hidden
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(safety); };
  }, []);
}
window.useReveal = useReveal;

/* useEntrance — staggered tween-in for hero elements, same probe + fallback. */
function useEntrance(selector, stagger = 130, baseDelay = 80) {
  React.useEffect(() => {
    const els = Array.from(document.querySelectorAll(selector));
    if (!els.length) return;
    probeMotion((live) => {
      if (!live) return;                              // visible by default; nothing to do
      els.forEach((el, i) => {
        el.style.opacity = '0'; el.style.transform = 'translateY(22px)';
        setTimeout(() => tweenIn(el, 720), baseDelay + i * stagger);
      });
      setTimeout(() => els.forEach(el => { el.style.opacity = ''; el.style.transform = ''; }), 5000);
    });
  }, []);
}
window.useEntrance = useEntrance;

/* useInView — true once the element scrolls into view. Falls back to true
   immediately if rAF isn't live (so gated content still appears). */
function useInView() {
  const ref = React.useRef(null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    if (!ref.current) return;
    let raf, fired = false;
    requestAnimationFrame(() => { fired = true; });
    const fallback = setTimeout(() => { if (!fired) setInView(true); }, 260);
    const tick = () => {
      const r = ref.current?.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r && r.top < vh * 0.9) { setInView(true); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(fallback); };
  }, []);
  return [ref, inView];
}
window.useInView = useInView;

/* CountUp — eases 0 → value once `run` is true. If rAF never fires (throttled
   context), it snaps to the final value via a timeout so it's never stuck at 0. */
function CountUp({ value, run = true, dur = 1100, decimals = 0, prefix = '', suffix = '' }) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    if (!run) return;
    const start = performance.now();
    let raf, fired = false;
    const snap = setTimeout(() => { if (!fired) setV(value); }, 280);
    const tick = (t) => {
      fired = true;
      const p = Math.min((t - start) / dur, 1);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(snap); };
  }, [value, run, dur]);
  const txt = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString();
  return <>{prefix}{txt}{suffix}</>;
}
window.CountUp = CountUp;

/* RepoTicker — an infinite horizontal marquee of repo slugs. */
function RepoTicker() {
  const repos = ['pallets/flask', 'django/django', 'torvalds/linux', 'vercel/next.js',
    'facebook/react', 'rust-lang/rust', 'kubernetes/kubernetes', 'pytorch/pytorch',
    'tensorflow/tensorflow', 'golang/go', 'nodejs/node', 'vuejs/core'];
  const row = [...repos, ...repos];
  return (
    <div className="hp-ticker">
      <div className="hp-ticker-track">
        {row.map((r, i) => (
          <span className="hp-ticker-item" key={i}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57"/></svg>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
window.RepoTicker = RepoTicker;
