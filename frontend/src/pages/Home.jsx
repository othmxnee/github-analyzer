import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRepoAnalysisResult, startRepoAnalysis } from '../services/api'
import Loader from '../components/Loader'
import ThemeToggle from '../components/ThemeToggle'

/* ── dependency graph illustration ── */
function GraphIllustration() {
  return (
    <svg viewBox="0 0 380 220" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 380 }}>
      <line x1="100" y1="80"  x2="190" y2="110" stroke="#BFDBFE" strokeWidth="1.5" />
      <line x1="190" y1="110" x2="280" y2="75"  stroke="#BFDBFE" strokeWidth="1.5" />
      <line x1="190" y1="110" x2="230" y2="165" stroke="#BFDBFE" strokeWidth="1.5" />
      <line x1="100" y1="80"  x2="75"  y2="155" stroke="#E2E8F0" strokeWidth="1.2" />
      <line x1="75"  y1="155" x2="230" y2="165" stroke="#E2E8F0" strokeWidth="1.2" />
      <line x1="280" y1="75"  x2="320" y2="145" stroke="#E2E8F0" strokeWidth="1.2" />
      <line x1="320" y1="145" x2="230" y2="165" stroke="#E2E8F0" strokeWidth="1.2" />
      <circle cx="190" cy="110" r="18" fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" />
      <circle cx="190" cy="110" r="7"  fill="#2563EB">
        <animate attributeName="r" values="7;9;7" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="100" cy="80"  r="12" fill="#F8FAFC" stroke="#93C5FD" strokeWidth="1.2" />
      <circle cx="100" cy="80"  r="5"  fill="#60A5FA" />
      <circle cx="280" cy="75"  r="12" fill="#F8FAFC" stroke="#93C5FD" strokeWidth="1.2" />
      <circle cx="280" cy="75"  r="5"  fill="#60A5FA" />
      <circle cx="230" cy="165" r="11" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
      <circle cx="230" cy="165" r="4.5" fill="#94A3B8" />
      <circle cx="75"  cy="155" r="9"  fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
      <circle cx="75"  cy="155" r="3.5" fill="#94A3B8" />
      <circle cx="320" cy="145" r="9"  fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.2" />
      <circle cx="320" cy="145" r="3.5" fill="#94A3B8" />
      <text x="190" y="94"  textAnchor="middle" fontSize="8"   fill="#1D4ED8" fontFamily="monospace">app.py</text>
      <text x="100" y="64"  textAnchor="middle" fontSize="7.5" fill="#3B82F6" fontFamily="monospace">auth.py</text>
      <text x="280" y="59"  textAnchor="middle" fontSize="7.5" fill="#3B82F6" fontFamily="monospace">models.py</text>
      <text x="230" y="183" textAnchor="middle" fontSize="7"   fill="#64748B" fontFamily="monospace">utils.py</text>
      <text x="60"  y="148" textAnchor="middle" fontSize="7"   fill="#64748B" fontFamily="monospace">db.py</text>
    </svg>
  )
}

/* ── intersection observer for fade-in ── */
function FadeObserver() {
  useEffect(() => {
    const els = document.querySelectorAll('.fi')
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('fv') }),
      { threshold: 0.1 }
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return null
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const navigate = useNavigate()

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')
    if (!repoUrl.trim())                { setError('Please enter a GitHub repository URL'); return }
    if (!repoUrl.includes('github.com')){ setError('Please enter a valid GitHub URL');      return }
    setLoading(true)
    try {
      const start = await startRepoAnalysis(repoUrl)
      if (start.error) throw new Error(start.error)

      let results = null

      while (true) {
        const data = await getRepoAnalysisResult(repoUrl)

        if (data.status === 'done') {
          results = data
          break
        }

        if (data.status === 'error') {
          throw new Error(data.error || 'Analysis failed')
        }

        await wait(5000)
      }

      sessionStorage.setItem('analysisResults', JSON.stringify(results))
      sessionStorage.setItem('repoUrl', repoUrl)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'An unknown error occurred'
      setError(msg === 'developer_id' || !msg
        ? 'Analysis failed. Please check the repository URL and try again.'
        : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

        .hp{
          font-family:'Inter',sans-serif;
          color:var(--color-text-primary);
          background:var(--color-background-primary);
          min-height:100vh;
          -webkit-font-smoothing:antialiased;
        }

        /* NAV */
        .hp-nav{
          position:sticky;top:0;z-index:100;
          height:60px;display:flex;align-items:center;justify-content:space-between;
          padding:0 48px;
          background:var(--color-background-primary);
          border-bottom:1px solid var(--color-border-tertiary);
        }
        .hp-logo{
          font-family:'JetBrains Mono',monospace;
          font-size:14px;font-weight:500;
          color:var(--color-text-primary);
          text-decoration:none;
        }
        .hp-logo span{color:#2563EB;}
        .hp-navlinks{
          display:flex;align-items:center;gap:32px;list-style:none;
        }
        .hp-navlinks button{
          background:none;border:none;cursor:pointer;
          font-size:14px;font-weight:400;
          color:var(--color-text-secondary);
          font-family:'Inter',sans-serif;
          transition:color .15s;padding:0;
        }
        .hp-navlinks button:hover{color:var(--color-text-primary);}
        .hp-nav-r{display:flex;align-items:center;gap:12px;}
        .hp-nav-try{
          padding:7px 18px;background:#2563EB;color:#fff;
          border:none;border-radius:8px;
          font-size:13px;font-weight:500;
          font-family:'Inter',sans-serif;
          cursor:pointer;transition:background .15s;
        }
        .hp-nav-try:hover{background:#1D4ED8;}

        /* HERO */
        .hp-hero{
          display:grid;grid-template-columns:1fr 1fr;
          align-items:center;gap:80px;
          max-width:1120px;margin:0 auto;
          padding:100px 48px 80px;
        }
        .hp-kicker{
          display:inline-flex;align-items:center;gap:8px;
          font-size:12px;font-weight:500;
          color:#2563EB;letter-spacing:.06em;
          text-transform:uppercase;margin-bottom:20px;
          font-family:'JetBrains Mono',monospace;
        }
        .hp-kicker-dot{
          width:6px;height:6px;border-radius:50%;
          background:#2563EB;
          animation:blink 2.4s ease-in-out infinite;
        }
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:.3;}}
        .hp-h1{
          font-size:clamp(34px,4.5vw,54px);
          font-weight:600;line-height:1.1;
          letter-spacing:-.04em;margin-bottom:20px;
        }
        .hp-h1 em{font-style:normal;color:#2563EB;}
        .hp-sub{
          font-size:16px;line-height:1.7;
          color:var(--color-text-secondary);
          font-weight:400;margin-bottom:36px;
          max-width:420px;
        }

        /* INPUT BAR */
        .hp-bar{
          display:flex;align-items:center;
          background:var(--color-background-primary);
          border:1.5px solid var(--color-border-secondary);
          border-radius:12px;
          padding:6px 6px 6px 20px;gap:8px;
          transition:border-color .2s,box-shadow .2s;
          margin-bottom:10px;
        }
        .hp-bar:focus-within{
          border-color:#2563EB;
          box-shadow:0 0 0 3px rgba(37,99,235,.10);
        }
        .hp-bar input{
          flex:1;border:none;outline:none;background:transparent;
          font-size:14px;
          font-family:'JetBrains Mono',monospace;
          color:var(--color-text-primary);min-width:0;
        }
        .hp-bar input::placeholder{color:var(--color-text-secondary);}
        .hp-bar-btn{
          flex-shrink:0;padding:9px 22px;
          background:#2563EB;color:#fff;
          border:none;border-radius:8px;
          font-size:13px;font-weight:500;
          font-family:'Inter',sans-serif;
          cursor:pointer;transition:background .15s;white-space:nowrap;
        }
        .hp-bar-btn:hover:not(:disabled){background:#1D4ED8;}
        .hp-bar-btn:disabled{opacity:.5;cursor:not-allowed;}
        .hp-hint{font-size:12px;color:var(--color-text-secondary);font-family:'JetBrains Mono',monospace;}
        .hp-err{font-size:13px;color:#DC2626;margin-top:8px;font-family:'JetBrains Mono',monospace;}

        /* GRAPH CARD */
        .hp-gcard{
          background:var(--color-background-secondary);
          border:1px solid var(--color-border-tertiary);
          border-radius:16px;padding:28px 24px;
        }
        .hp-gcard-hd{
          display:flex;align-items:center;gap:6px;
          font-size:11px;font-family:'JetBrains Mono',monospace;
          color:var(--color-text-secondary);margin-bottom:20px;
        }
        .hp-gdot{width:6px;height:6px;border-radius:50%;background:#22C55E;}

        /* STATS */
        .hp-stats{
          border-top:1px solid var(--color-border-tertiary);
          border-bottom:1px solid var(--color-border-tertiary);
          background:var(--color-background-secondary);
        }
        .hp-stats-inner{
          max-width:1120px;margin:0 auto;
          padding:40px 48px;
          display:grid;grid-template-columns:repeat(4,1fr);
          text-align:center;
        }
        .hp-stat+.hp-stat{border-left:1px solid var(--color-border-tertiary);}
        .hp-stat-val{
          font-size:28px;font-weight:600;
          letter-spacing:-.03em;
          font-family:'JetBrains Mono',monospace;
          margin-bottom:4px;
        }
        .hp-stat-lbl{font-size:13px;color:var(--color-text-secondary);}

        /* SECTION */
        .hp-section{max-width:1120px;margin:0 auto;padding:96px 48px;}
        .hp-alt{background:var(--color-background-secondary);}
        .hp-sh{text-align:center;margin-bottom:56px;}
        .hp-ey{
          font-size:11px;font-weight:500;
          text-transform:uppercase;letter-spacing:.1em;
          color:#2563EB;margin-bottom:10px;
          font-family:'JetBrains Mono',monospace;
        }
        .hp-st{
          font-size:clamp(24px,3vw,32px);
          font-weight:600;letter-spacing:-.03em;
        }

        /* FEATURES */
        .hp-feats{
          display:grid;grid-template-columns:repeat(3,1fr);
          border:1px solid var(--color-border-tertiary);
          border-radius:16px;overflow:hidden;
        }
        .hp-feat{
          background:var(--color-background-primary);
          padding:32px 28px;
          border-right:1px solid var(--color-border-tertiary);
          border-bottom:1px solid var(--color-border-tertiary);
          transition:background .2s;
        }
        .hp-feat:hover{background:var(--color-background-secondary);}
        .hp-feat:nth-child(3n){border-right:none;}
        .hp-feat:nth-child(n+4){border-bottom:none;}
        .hp-feat-ico{
          width:32px;height:32px;margin-bottom:14px;
          color:#2563EB;
        }
        .hp-feat-t{font-size:15px;font-weight:600;margin-bottom:8px;}
        .hp-feat-d{font-size:13px;line-height:1.65;color:var(--color-text-secondary);}

        /* STEPS */
        .hp-steps{
          display:grid;grid-template-columns:repeat(3,1fr);
          gap:48px;position:relative;
        }
        .hp-steps::before{
          content:'';position:absolute;
          top:22px;left:calc(16.66% + 14px);right:calc(16.66% + 14px);
          height:1px;background:var(--color-border-tertiary);
        }
        .hp-step-num{
          width:44px;height:44px;border-radius:50%;
          background:var(--color-background-primary);
          border:1px solid var(--color-border-tertiary);
          display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:600;color:#2563EB;
          font-family:'JetBrains Mono',monospace;
          margin-bottom:20px;position:relative;z-index:1;
        }
        .hp-step-t{font-size:15px;font-weight:600;margin-bottom:8px;}
        .hp-step-d{font-size:13px;line-height:1.65;color:var(--color-text-secondary);}

        /* METRICS */
        .hp-mets{
          display:grid;grid-template-columns:repeat(4,1fr);
          border:1px solid var(--color-border-tertiary);
          border-radius:16px;overflow:hidden;
        }
        .hp-met{
          padding:32px 24px;
          background:var(--color-background-primary);
          border-right:1px solid var(--color-border-tertiary);
        }
        .hp-met:last-child{border-right:none;}
        .hp-met-lbl{
          font-size:11px;font-family:'JetBrains Mono',monospace;
          color:var(--color-text-secondary);margin-bottom:12px;
          text-transform:uppercase;letter-spacing:.06em;
        }
        .hp-met-val{
          font-size:30px;font-weight:600;
          font-family:'JetBrains Mono',monospace;
          color:#2563EB;letter-spacing:-.03em;
          margin-bottom:6px;
        }
        .hp-met-sub{font-size:12px;color:var(--color-text-secondary);margin-bottom:16px;}
        .hp-met-bar{height:3px;background:var(--color-border-tertiary);border-radius:2px;overflow:hidden;}
        .hp-met-fill{height:100%;background:#2563EB;border-radius:2px;}

        /* CTA */
        .hp-cta{
          text-align:center;padding:100px 48px;
          border-top:1px solid var(--color-border-tertiary);
          background:var(--color-background-secondary);
        }
        .hp-cta-t{
          font-size:clamp(26px,3.5vw,38px);
          font-weight:600;letter-spacing:-.035em;
          margin-bottom:12px;
        }
        .hp-cta-s{font-size:16px;color:var(--color-text-secondary);margin-bottom:40px;}
        .hp-cta-bar{
          display:flex;align-items:center;
          max-width:560px;margin:0 auto;
          background:var(--color-background-primary);
          border:1.5px solid var(--color-border-secondary);
          border-radius:12px;padding:6px 6px 6px 20px;gap:8px;
          transition:border-color .2s,box-shadow .2s;
        }
        .hp-cta-bar:focus-within{
          border-color:#2563EB;
          box-shadow:0 0 0 3px rgba(37,99,235,.10);
        }
        .hp-cta-bar input{
          flex:1;border:none;outline:none;background:transparent;
          font-size:14px;font-family:'JetBrains Mono',monospace;
          color:var(--color-text-primary);min-width:0;
        }
        .hp-cta-bar input::placeholder{color:var(--color-text-secondary);}

        /* PAGE FOOTER */
        .hp-foot{
          border-top:1px solid var(--color-border-tertiary);
          padding:20px 48px;
          display:flex;align-items:center;justify-content:space-between;
          background:var(--color-background-primary);
        }
        .hp-foot span{
          font-size:12px;color:var(--color-text-secondary);
          font-family:'JetBrains Mono',monospace;
        }

        /* FADE */
        .fi{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease;}
        .fv{opacity:1;transform:translateY(0);}

        /* RESPONSIVE */
        @media(max-width:960px){
          .hp-hero{grid-template-columns:1fr;gap:0;padding:64px 24px 48px;}
          .hp-hero-r{display:none;}
          .hp-feats{grid-template-columns:1fr 1fr;}
          .hp-feat:nth-child(3n){border-right:1px solid var(--color-border-tertiary);}
          .hp-feat:nth-child(2n){border-right:none;}
          .hp-steps{grid-template-columns:1fr;gap:32px;}
          .hp-steps::before{display:none;}
          .hp-mets{grid-template-columns:1fr 1fr;}
          .hp-met:nth-child(2){border-right:none;}
          .hp-met:nth-child(3){border-right:1px solid var(--color-border-tertiary);}
          .hp-met:nth-child(n+3){border-top:1px solid var(--color-border-tertiary);}
          .hp-stats-inner{grid-template-columns:1fr 1fr;gap:24px;}
          .hp-stat+.hp-stat{border-left:none;}
          .hp-section{padding:64px 24px;}
          .hp-nav{padding:0 24px;}
          .hp-navlinks{display:none;}
          .hp-cta{padding:64px 24px;}
          .hp-foot{padding:20px 24px;}
        }
        @media(max-width:560px){
          .hp-feats{grid-template-columns:1fr;}
          .hp-mets{grid-template-columns:1fr;}
          .hp-met{border-right:none!important;border-top:1px solid var(--color-border-tertiary);}
          .hp-met:first-child{border-top:none;}
        }
      `}</style>

      <div className="hp">

        {/* NAV */}
        <nav className="hp-nav">
          <a className="hp-logo" href="#"><span>git</span>·analyzer</a>
          <ul className="hp-navlinks">
            <li><button onClick={() => scrollTo('features')}>Features</button></li>
            <li><button onClick={() => scrollTo('how-it-works')}>How it works</button></li>
            <li><button onClick={() => scrollTo('metrics')}>Metrics</button></li>
          </ul>
          <div className="hp-nav-r">
            <ThemeToggle />
            <button className="hp-nav-try" onClick={() => scrollTo('hero-input')}>Try it</button>
          </div>
        </nav>

        {/* HERO */}
        <section style={{ background: 'var(--color-background-primary)' }}>
          <div className="hp-hero">
            <div>
              <div className="hp-kicker">
                <span className="hp-kicker-dot" />
                Repository intelligence
              </div>
              <h1 className="hp-h1">
                Understand any<br />GitHub repo,{' '}<em>deeply</em>
              </h1>
              <p className="hp-sub">
                Mine Git history to reveal developer activity, knowledge concentration,
                architectural risks, and code hotspots — all in one dashboard.
              </p>
              <form id="hero-input" onSubmit={handleSubmit}>
                <div className="hp-bar">
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={e => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/pallets/flask"
                    disabled={loading}
                    autoComplete="off"
                  />
                  <button type="submit" disabled={loading} className="hp-bar-btn">
                    {loading ? 'Analyzing…' : 'Analyze →'}
                  </button>
                </div>
                {error && <p className="hp-err">{error}</p>}
              </form>
              <p className="hp-hint" style={{ marginTop: 10 }}>
                Try: github.com/pallets/flask · github.com/django/django
              </p>
            </div>

            <div className="hp-hero-r">
              <div className="hp-gcard">
                <div className="hp-gcard-hd">
                  <span className="hp-gdot" />
                  dependency graph · flask 3.1
                </div>
                <GraphIllustration />
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <div className="hp-stats">
          <div className="hp-stats-inner">
            {[
              { val: '6',    lbl: 'analysis dimensions' },
              { val: '18+',  lbl: 'chart types' },
              { val: '100%', lbl: 'client-side rendering' },
              { val: 'No',   lbl: 'auth required' },
            ].map(({ val, lbl }) => (
              <div className="hp-stat" key={lbl}>
                <div className="hp-stat-val">{val}</div>
                <div className="hp-stat-lbl">{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* FEATURES */}
        <div id="features">
          <div className="hp-section fi">
            <div className="hp-sh">
              <p className="hp-ey">What it analyzes</p>
              <h2 className="hp-st">Six lenses on your codebase</h2>
            </div>
            <div className="hp-feats">
              {[
                { t: 'Developer activity',      d: 'Commit timelines, rankings, and inter-commit interval analysis across the full Git history.' },
                { t: 'Contribution inequality', d: 'Gini coefficient and Lorenz curve showing how evenly work is spread across contributors.' },
                { t: 'Knowledge ownership',     d: 'Line-level ownership tracking and KCI index to detect knowledge silos and bus factor risks.' },
                { t: 'Architectural risk',      d: 'Dependency graphs and PageRank centrality to identify structurally critical files and coupling.' },
                { t: 'Code hotspots',           d: 'Modification frequency surfaces your highest-churn files — the most active change targets.' },
                { t: 'Risk scoring',            d: 'Composite scores combining architectural centrality and ownership concentration into clear signals.' },
              ].map(({ t, d }) => (
                <div className="hp-feat" key={t}>
                  <svg className="hp-feat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M17.66 6.34l-2.12 2.12M6.34 17.66l-2.12 2.12" />
                  </svg>
                  <div className="hp-feat-t">{t}</div>
                  <div className="hp-feat-d">{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HOW IT WORKS */}
        <div id="how-it-works" className="hp-alt">
          <div className="hp-section fi">
            <div className="hp-sh">
              <p className="hp-ey">How it works</p>
              <h2 className="hp-st">Three steps to insight</h2>
            </div>
            <div className="hp-steps">
              {[
                { n: '1', t: 'Paste a repository URL',      d: 'Any public GitHub repository. No authentication, API keys, or configuration needed.' },
                { n: '2', t: 'Analysis runs automatically', d: 'PyDriller extracts commit history, file changes, and authorship data and computes all metrics.' },
                { n: '3', t: 'Explore the dashboard',       d: 'Interactive charts, heatmaps, dependency graphs, and risk tables — all in one place.' },
              ].map(({ n, t, d }) => (
                <div key={n}>
                  <div className="hp-step-num">{n}</div>
                  <div className="hp-step-t">{t}</div>
                  <div className="hp-step-d" style={{ marginTop: 8 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* METRICS */}
        <div id="metrics">
          <div className="hp-section fi">
            <div className="hp-sh">
              <p className="hp-ey">Sample output</p>
              <h2 className="hp-st">What you'll see</h2>
            </div>
            <div className="hp-mets">
              {[
                { l: 'Gini coefficient', v: '0.74',   s: 'High inequality in commits', b: 74 },
                { l: 'Bus factor',       v: '2',       s: 'Critical knowledge risk',    b: 20 },
                { l: 'KCI score',        v: '0.41',    s: 'Moderate concentration',     b: 41 },
                { l: 'Top hotspot',      v: 'app.py',  s: '247 modifications',          b: 88 },
              ].map(({ l, v, s, b }) => (
                <div className="hp-met" key={l}>
                  <div className="hp-met-lbl">{l}</div>
                  <div className="hp-met-val">{v}</div>
                  <div className="hp-met-sub">{s}</div>
                  <div className="hp-met-bar">
                    <div className="hp-met-fill" style={{ width: `${b}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER CTA */}
        <div className="hp-cta">
          <h2 className="hp-cta-t">Ready to analyze your repository?</h2>
          <p className="hp-cta-s">Paste a URL and get a full breakdown in under a minute.</p>
          <form onSubmit={handleSubmit}>
            <div className="hp-cta-bar">
              <input
                type="text"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                placeholder="https://github.com/your/repo"
                disabled={loading}
              />
              <button type="submit" disabled={loading} className="hp-bar-btn">
                {loading ? 'Analyzing…' : 'Get started →'}
              </button>
            </div>
            {error && <p className="hp-err" style={{ marginTop: 10, textAlign: 'left' }}>{error}</p>}
          </form>
        </div>

        {/* PAGE FOOTER */}
        <footer className="hp-foot">
          <span>git·analyzer · built with PyDriller + Flask + React</span>
          <span>PFE 2025</span>
        </footer>

        {loading && <Loader message="Analyzing repository… please wait" />}
      </div>

      <FadeObserver />
    </>
  )
}
