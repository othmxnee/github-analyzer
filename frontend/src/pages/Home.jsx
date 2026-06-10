import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getRepoAnalysisResult, startRepoAnalysis } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useReveal, useEntrance, CountUp, useInView } from '../hooks/useMotion'
import AuthButton from '../components/AuthButton'
import RepoPicker from '../components/RepoPicker'

const SUPPORTED_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org']
const isSupportedRepoUrl = url => SUPPORTED_HOSTS.some(h => url.includes(h))
import '../styles/Home.css'

/* ═════════════════════════════════════════
   PARTICLE CANVAS — mouse-reactive
   Nodes drift on a slow random walk; the cursor gently attracts nearby nodes
   and brightens the links around it. Node radii pulse subtly so the field
   breathes even when the mouse is still.
═════════════════════════════════════════ */
function ParticleCanvas({ isLight }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const host = c.parentElement

    const size = () => {
      const r = host.getBoundingClientRect()
      c.width  = r.width  * dpr
      c.height = r.height * dpr
      c.style.width  = r.width  + 'px'
      c.style.height = r.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    const onResize = () => size()
    window.addEventListener('resize', onResize)

    const W = () => c.width / dpr
    const H = () => c.height / dpr
    const N = 60
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      ph: Math.random() * Math.PI * 2,
    }))

    const mouse = { x: -9999, y: -9999, active: false }
    const onMove = e => {
      const r = c.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
      mouse.active = true
    }
    const onLeave = () => { mouse.active = false; mouse.x = -9999; mouse.y = -9999 }
    host.addEventListener('mousemove', onMove)
    host.addEventListener('mouseleave', onLeave)

    const lineCol = isLight ? '37,88,212' : '59,110,234'
    const dotCol  = isLight ? '55,64,96'  : '155,168,200'

    let raf, t = 0
    const draw = () => {
      t += 0.016
      const w = W(), h = H()
      ctx.clearRect(0, 0, w, h)

      if (mouse.active) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 180)
        g.addColorStop(0, `rgba(${lineCol},${isLight ? 0.06 : 0.10})`)
        g.addColorStop(1, `rgba(${lineCol},0)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }

      for (let i = 0; i < N; i++) {
        const p = pts[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1

        if (mouse.active) {
          const dx = mouse.x - p.x, dy = mouse.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < 200 && dist > 0.5) {
            const f = (1 - dist / 200) * 0.06
            p.vx += (dx / dist) * f
            p.vy += (dy / dist) * f
          }
        }
        p.vx *= 0.985
        p.vy *= 0.985
        const sp = Math.hypot(p.vx, p.vy)
        if (sp < 0.12) {
          p.vx += (Math.random() - 0.5) * 0.06
          p.vy += (Math.random() - 0.5) * 0.06
        }

        for (let j = i + 1; j < N; j++) {
          const q = pts[j]
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d < 145) {
            const near = mouse.active
              ? Math.max(0, 1 - Math.min(
                  Math.hypot(mouse.x - p.x, mouse.y - p.y),
                  Math.hypot(mouse.x - q.x, mouse.y - q.y)
                ) / 220)
              : 0
            const base = 0.26 * (1 - d / 145)
            ctx.strokeStyle = `rgba(${lineCol},${base + near * 0.5})`
            ctx.lineWidth = 1 + near * 0.8
            ctx.beginPath()
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }

        const pr = 1.5 + Math.sin(t + p.ph) * 0.6
        const glow = mouse.active ? Math.max(0, 1 - Math.hypot(mouse.x - p.x, mouse.y - p.y) / 200) : 0
        ctx.fillStyle = glow > 0.02
          ? `rgba(${lineCol},${0.55 + glow * 0.45})`
          : `rgba(${dotCol},0.55)`
        ctx.beginPath()
        ctx.arc(p.x, p.y, pr + glow * 2, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      host.removeEventListener('mousemove', onMove)
      host.removeEventListener('mouseleave', onLeave)
    }
  }, [isLight])

  return (
    <canvas
      ref={canvasRef}
      style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0, display:'block' }}
    />
  )
}

/* ═════════════════════════════════════════
   PCA CANVAS
═════════════════════════════════════════ */
function PCACanvas({ isLight }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,320,220)
    const COLORS  = ['#3B6EEA','#00C896','#F59E0B','#A78BFA','#EF4444','#06B6D4','#7880A0']
    const CENTERS = [[80,160],[220,140],[240,60],[150,100],[100,60],[200,190],[150,160]]
    const COUNTS  = [18,24,8,12,7,6,11]
    const devs = []
    CENTERS.forEach(([cx,cy],r) => {
      for (let i=0;i<COUNTS[r];i++) devs.push({x:cx+(Math.random()-.5)*48,y:cy+(Math.random()-.5)*44,r})
    })
    const gc  = isLight ? 'rgba(0,0,0,0.06)'  : 'rgba(255,255,255,0.05)'
    const axc = isLight ? 'rgba(0,0,0,0.18)'  : 'rgba(255,255,255,0.15)'
    for (let x=0;x<=320;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,220);ctx.strokeStyle=gc;ctx.lineWidth=.5;ctx.stroke()}
    for (let y=0;y<=220;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(320,y);ctx.strokeStyle=gc;ctx.lineWidth=.5;ctx.stroke()}
    ctx.strokeStyle=axc;ctx.lineWidth=.8
    ctx.beginPath();ctx.moveTo(16,110);ctx.lineTo(304,110);ctx.stroke()
    ctx.beginPath();ctx.moveTo(160,8);ctx.lineTo(160,212);ctx.stroke()
    ctx.fillStyle=axc;ctx.font='9px monospace'
    ctx.fillText('PC1 →',268,106);ctx.fillText('PC2',164,18)
    for (const d of devs){
      ctx.beginPath();ctx.arc(d.x,d.y,4.5,0,Math.PI*2)
      ctx.fillStyle=COLORS[d.r]+'BB';ctx.fill()
      ctx.strokeStyle=COLORS[d.r];ctx.lineWidth=1;ctx.stroke()
    }
  }, [isLight])
  return <canvas ref={canvasRef} width={320} height={220} style={{width:'100%',height:'100%',display:'block'}}/>
}

/* ═════════════════════════════════════════
   DATA
═════════════════════════════════════════ */
const FEATURES = [
  { t:'Developer activity',      d:'Commit timelines, rankings, and inter-commit interval analysis across the full Git history.',        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { t:'Contribution inequality', d:'Gini coefficient and Lorenz curve showing how evenly work is spread across contributors.',           icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { t:'Knowledge ownership',     d:'Line-level ownership tracking and KCI index to detect knowledge silos and bus factor risks.',        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { t:'Architectural risk',      d:'Dependency graphs and PageRank centrality to identify structurally critical files and coupling.',    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5.5" y2="16.5"/><line x1="12" y1="8" x2="18.5" y2="16.5"/></svg> },
  { t:'Code hotspots',           d:'Modification frequency surfaces your highest-churn files — the most active change targets.',        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0"/></svg> },
  { t:'Risk scoring',            d:'Composite scores combining architectural centrality and ownership concentration into clear signals.',icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
]

const ROLES = [
  { name:'Frontend Developer',   desc:'Detected via extension ratios, folder paths, and UI-related commit keywords.',                       badge:'Extension + path',  color:'#3B6EEA' },
  { name:'Backend Developer',    desc:'Lines-weighted: 200 backend lines beats 1 frontend line for correct classification.',               badge:'Lines-weighted',    color:'#00C896' },
  { name:'DevOps Engineer',      desc:'CI/CD files, infra folders, and DevOps-specific commit message patterns.',                          badge:'Folder + keywords', color:'#F59E0B' },
  { name:'Full Stack Developer', desc:'Balanced frontend and backend metrics with no single dominant category.',                            badge:'Balanced profile',  color:'#A78BFA' },
  { name:'Tester',               desc:'Test% >40% AND dominates over backend and frontend — avoids false positives.',                       badge:'Dominance cond.',   color:'#EF4444' },
  { name:'Mobile Developer',     desc:'Mobile-specific file extensions and folder patterns across iOS and Android stacks.',                 badge:'Extension detect.', color:'#06B6D4' },
  { name:'Generalist',           desc:'K-Means clustering resolves ambiguous profiles — at least one metric above 15% required.',           badge:'K-Means cluster',   color:'#7880A0' },
]

const METRICS = [
  { label:'Gini Coefficient', val:0.74,    decimals:2, sub:'High inequality in commits',  bar:74,  cls:'' },
  { label:'Bus Factor',       val:2,       decimals:0, sub:'Critical knowledge risk',     bar:20,  cls:'red' },
  { label:'KCI Score',        val:0.41,    decimals:2, sub:'Moderate concentration',      bar:41,  cls:'green' },
  { label:'Top Hotspot',      val:'app.py',            sub:'247 modifications',           bar:88,  cls:'mono' },
  { label:'Contributors',     val:142,     decimals:0, sub:'Minimum 5 commits each',      bar:60,  cls:'green' },
  { label:'Commits analyzed', val:3847,    decimals:0, sub:'Full history mined',          bar:100, cls:'' },
]

/* ═════════════════════════════════════════
   HOME
═════════════════════════════════════════ */
const PHASES = [
  { key: 'cloning',    label: 'Cloning repository' },
  { key: 'extracting', label: 'Extracting history'  },
  { key: 'cleaning',   label: 'Cleaning data'       },
  { key: 'computing',  label: 'Computing metrics'   },
]

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('repoHistory') || '[]') } catch { return [] }
}

function saveHistory(url) {
  try {
    const hist = loadHistory()
    const updated = [url, ...hist.filter(u => u !== url)].slice(0, 5)
    localStorage.setItem('repoHistory', JSON.stringify(updated))
  } catch {}
}

export default function Home() {
  const [repoUrl, setRepoUrl]           = useState('')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [isLight, setIsLight]           = useState(false)
  const [phase, setPhase]               = useState('cloning')
  const [repoHistory, setRepoHistory]   = useState(loadHistory)
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useReveal()
  useEntrance('.hero-badge, .hero-h1, .hero-sub, .hero-island', 120, 80)

  /* ── handle OAuth error redirect from backend ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('auth_error')
    if (authError) {
      setError('Sign-in failed. Please try again.')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth' })
  const wait     = ms => new Promise(r => setTimeout(r, ms))  // eslint-disable-line

  /* ── auto-submit when coming back from Dashboard "Re-analyze" ── */
  useEffect(() => {
    const state = location.state
    if (!state?.repoUrl) return
    setRepoUrl(state.repoUrl)
    if (state.autoSubmit) {
      handleSubmit(null, state.repoUrl, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTheme = useCallback(() => {
    setIsLight(v => {
      const next = !v
      document.documentElement.setAttribute('data-theme', next ? 'light' : '')
      document.body.classList.toggle('lm', next)
      return next
    })
  }, [])

  const handleSubmit = async (e, fallbackUrl, force = false) => {
    e?.preventDefault()
    const url = fallbackUrl || repoUrl
    setError('')
    if (!url.trim())             { setError('Please enter a repository URL'); return }
    if (!isSupportedRepoUrl(url)){ setError('Supported hosts: github.com, gitlab.com, bitbucket.org'); return }
    setLoading(true)
    setPhase('cloning')
    try {
      const start = await startRepoAnalysis(url, force)
      if (start.error) throw new Error(start.error)
      let results = null
      while (true) {
        const data = await getRepoAnalysisResult(url)
        if (data.status === 'done')  { results = data; break }
        if (data.status === 'error') throw new Error(data.error || 'Analysis failed')
        if (data.phase) setPhase(data.phase)
        await wait(5000)
      }
      try {
        sessionStorage.setItem('analysisResults', JSON.stringify(results))
        sessionStorage.setItem('repoUrl', url)
      } catch (storageErr) {
        // sessionStorage quota exceeded (large repo) — store a trimmed version
        const trimmed = {
          ...results,
          ownership_table: (results.ownership_table || []).slice(0, 200),
          dev_file_matrix: { developers: [], files: [], values: [] },
        }
        try {
          sessionStorage.setItem('analysisResults', JSON.stringify(trimmed))
          sessionStorage.setItem('repoUrl', url)
        } catch {
          setError('Repository data is too large to display in the browser. Try a smaller repository.')
          setLoading(false)
          return
        }
      }
      saveHistory(url)
      setRepoHistory(loadHistory())
      // Kick off skills analysis in the background so it's ready when user clicks the tab
      fetch('http://localhost:5000/analyze/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ repo_url: url }),
      }).catch(() => {})
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Unknown error'
      setError(msg === 'developer_id' || !msg ? 'Analysis failed. Check the URL and try again.' : msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ══ NAVBAR ══ */}
      <nav className="hp-nav">
        <div className="hp-logo">git<span className="dot">·</span>analyzer</div>
        <ul className="hp-navlinks">
          <li><button onClick={() => scrollTo('hp-features')}>Features</button></li>
          <li><button onClick={() => scrollTo('hp-roles')}>Developer roles</button></li>
          <li><button onClick={() => scrollTo('hp-how')}>How it works</button></li>
          <li><button onClick={() => scrollTo('hp-metrics')}>Metrics</button></li>
        </ul>
        <div className="hp-nav-right">
          <AuthButton auth={auth} />
          <button className="hp-mode-btn" onClick={toggleTheme}>
            {isLight
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>
            }
            {isLight ? 'Dark mode' : 'Light mode'}
          </button>
          <button className="hp-nav-cta" onClick={() => scrollTo('hp-input')}>Try it →</button>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section className="hp-hero">
        <ParticleCanvas isLight={isLight} />
        <div className="hp-hero-inner">
          <div className="hp-badge hero-badge">
            <span className="hp-badge-dot" />
            Repository intelligence
          </div>
          <h1 className="hp-h1 hero-h1">
            Paste a repo.
            <span className="hp-h1-accent">See everything.</span>
          </h1>
          <p className="hp-sub hero-sub">
            Git history doesn't lie. Developer activity, knowledge concentration,
            architectural risks, and team roles — extracted automatically.
          </p>

          <div className="hp-island hero-island" id="hp-input">
            <div className="hp-island-label">
              {loading ? 'Analyzing repository' : 'Analyze a repository'}
            </div>

            {loading ? (
              <div className="hp-progress">
                <div className="hp-progress-url">{repoUrl}</div>
                <div className="hp-progress-steps">
                  {PHASES.map((p, i) => {
                    const currentIdx = PHASES.findIndex(ph => ph.key === phase)
                    const isDone   = i < currentIdx
                    const isActive = i === currentIdx
                    return (
                      <div key={p.key} className={`hp-pstep${isActive ? ' active' : isDone ? ' done' : ''}`}>
                        <div className="hp-pstep-icon">
                          {isDone   ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : isActive ? <div className="hp-pstep-spin"/>
                          : null}
                        </div>
                        <span>{p.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="hp-input-row">
                  <div className="hp-prompt">&gt;</div>
                  <input
                    className="hp-input"
                    type="text"
                    value={repoUrl}
                    onChange={e => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/pallets/flask"
                    disabled={loading}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button type="submit" className="hp-submit" disabled={loading}>
                    Analyze →
                  </button>
                </div>
                {error && <div className="hp-err">{error}</div>}
              </form>
            )}

            <div className="hp-island-footer">
              {repoHistory.length > 0 && !loading && (
                <div className="hp-history">
                  <span className="hp-history-label">Recent</span>
                  <div className="hp-pills">
                    {repoHistory.map(u => {
                      const short = u
                        .replace('https://github.com/', '')
                        .replace('https://gitlab.com/', '')
                        .replace('https://bitbucket.org/', '')
                      return (
                        <div key={u} className="hp-pill hp-pill-history" onClick={() => setRepoUrl(u)} title={u}>
                          {short}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {!loading && (
                <div className="hp-footer-row">
                  <div className="hp-pills">
                    {['pallets/flask','django/django','torvalds/linux'].map(r => (
                      <div key={r} className="hp-pill" onClick={() => setRepoUrl(`https://github.com/${r}`)}>
                        {r}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {auth.authenticated && <RepoPicker onSelect={setRepoUrl} providers={auth.providers} />}
                    <div className="hp-note">
                      {auth.authenticated
                        ? <span style={{ color: 'var(--green)' }}>Private repos unlocked</span>
                        : 'Sign in for private repos'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="hp-scroll-hint">
          <div className="hp-scroll-arr">
            <span>Scroll</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <div className="hp-stats">
        {[
          { n: 6,      l: 'Analysis dimensions' },
          { n: 18,     l: 'Chart types', suffix: '+' },
          { n: 15,     l: 'Metrics per developer' },
          { n: 7,      l: 'Roles detected' },
          { n: 'Zero', l: 'Auth required' },
        ].map(({ n, l, suffix }) => (
          <div className="hp-stat" key={l}>
            <div className="hp-stat-n">
              {typeof n === 'number' ? <CountUp value={n} suffix={suffix || ''} /> : n}
            </div>
            <div className="hp-stat-l">{l}</div>
          </div>
        ))}
      </div>

      {/* ══ REPO TICKER (infinite marquee) ══ */}
      <RepoTicker />

      {/* ══ FEATURES ══ */}
      <div className="hp-divider"/>
      <section className="hp-section" id="hp-features">
        <div className="hp-inner">
          <div className="hp-reveal">
            <div className="hp-s-label">What it analyzes</div>
            <div className="hp-s-title">Six lenses on your codebase</div>
            <div className="hp-s-sub">Every dimension of repository health, in one dashboard.</div>
          </div>
          <div className="hp-feats hp-reveal">
            {FEATURES.map(({t,d,icon}) => (
              <div className="hp-feat" key={t}>
                <div className="hp-feat-ico">{icon}</div>
                <div className="hp-feat-t">{t}</div>
                <div className="hp-feat-d">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ROLES ══ */}
      <div className="hp-divider"/>
      <section className="hp-section alt" id="hp-roles">
        <div className="hp-inner">
          <div className="hp-reveal">
            <div className="hp-s-label">Developer Role Detection</div>
            <div className="hp-s-title">Automatically profile every contributor</div>
            <div className="hp-s-sub">
              15 metrics per developer — file extension ratios, folder path patterns, and commit message
              keywords — then K-Means clustering assigns precise technical roles.
            </div>
          </div>
          <div className="hp-roles hp-reveal">
            {ROLES.map(({name,desc,badge,color}) => (
              <div className="hp-role" key={name}>
                <div className="hp-role-dot" style={{background:color}}/>
                <div className="hp-role-name">{name}</div>
                <div className="hp-role-desc">{desc}</div>
                <div className="hp-role-badge" style={{background:color+'22',color}}>{badge}</div>
              </div>
            ))}
            <div className="hp-role hp-role-empty">
              <div className="hp-role-empty-n">≥ 5</div>
              <div className="hp-role-empty-l">Minimum commits<br/>to include a developer</div>
            </div>
          </div>
          <div className="hp-pca hp-reveal">
            <div className="hp-pca-text">
              <div className="hp-s-label">Skill Map</div>
              <div className="hp-s-title" style={{marginBottom:10}}>PCA developer<br/>skill visualization</div>
              <div className="hp-s-sub" style={{marginBottom:20}}>
                Principal Component Analysis projects every contributor onto a 2D map — revealing clusters
                of similar skill profiles, outliers, and the true shape of your team.
              </div>
              <div className="hp-pca-legend">
                {[{label:'Frontend',color:'#3B6EEA'},{label:'Backend',color:'#00C896'},{label:'DevOps',color:'#F59E0B'},{label:'Full Stack',color:'#A78BFA'},{label:'Tester',color:'#EF4444'},{label:'Mobile',color:'#06B6D4'},{label:'Generalist',color:'#7880A0'}].map(({label,color}) => (
                  <div className="hp-pca-leg" key={label}>
                    <div className="hp-pca-dot" style={{background:color}}/>
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="hp-pca-vis">
              <div className="hp-pca-wrap"><PCACanvas isLight={isLight}/></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <div className="hp-divider"/>
      <section className="hp-section" id="hp-how">
        <div className="hp-inner">
          <div className="hp-reveal">
            <div className="hp-s-label">How it works</div>
            <div className="hp-s-title">Three steps to insight</div>
            <div className="hp-s-sub">No setup. No configuration. No API keys. Just a GitHub URL.</div>
          </div>
          <div className="hp-steps hp-reveal">
            {[
              {n:'01',t:'Paste a repository URL',d:'Any public GitHub repository. No authentication, API keys, or configuration needed.',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>},
              {n:'02',t:'Analysis runs automatically',d:'PyDriller extracts commit history, file changes, and authorship data and computes all 15 metrics per developer.',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>},
              {n:'03',t:'Explore the dashboard',d:'Interactive charts, heatmaps, dependency graphs, PCA skill maps, and risk tables — all in one place.',icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>},
            ].map(({n,t,d,icon},i) => (
              <div className="hp-step" key={n} style={i>0?{borderLeft:'1px solid var(--b)'}:{}}>
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
              <div className="hp-s-title" style={{marginBottom:12}}>Live analysis output</div>
              <div className="hp-s-sub" style={{marginBottom:24}}>
                Watch the platform extract and compute in real time — from raw Git history to role-annotated developer profiles.
              </div>
              {[
                {color:'var(--green)',title:'PyDriller extraction',detail:'— full commit history, file diffs, and author metadata'},
                {color:'var(--ac)',title:'15 metrics per developer',detail:'— file extensions, folder paths, commit keywords'},
                {color:'var(--amber)',title:'K-Means + PCA',detail:'— clustering resolves ambiguous profiles, PCA maps skill space'},
              ].map(({color,title,detail}) => (
                <div key={title} style={{display:'flex',alignItems:'flex-start',gap:12,marginBottom:14}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:color,flexShrink:0,marginTop:7}}/>
                  <div style={{fontSize:13,color:'var(--t2)',lineHeight:1.65}}>
                    <strong style={{color:'var(--t)',fontWeight:600}}>{title}</strong>{' '}{detail}
                  </div>
                </div>
              ))}
            </div>
            <div className="hp-term-win">
              <div className="hp-term-bar">
                <div className="hp-t-dot" style={{background:'#FF5F56'}}/>
                <div className="hp-t-dot" style={{background:'#FFBD2E'}}/>
                <div className="hp-t-dot" style={{background:'#27C93F'}}/>
                <span className="hp-term-file">analysis.log — pallets/flask</span>
              </div>
              <TypewriterTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ══ METRICS ══ */}
      <div className="hp-divider"/>
      <section className="hp-section alt" id="hp-metrics">
        <div className="hp-inner">
          <div className="hp-reveal">
            <div className="hp-s-label">Sample output</div>
            <div className="hp-s-title">What you will see</div>
            <div className="hp-s-sub">Real metrics from <span style={{fontFamily:'var(--mono)',color:'var(--ac)',fontSize:13}}>pallets/flask</span>.</div>
          </div>
          <MetricsGrid />
        </div>
      </section>

      {/* ══ CTA ══ */}
      <div className="hp-cta hp-reveal">
        <h2 className="hp-cta-h">Ready to analyze your repository?</h2>
        <p className="hp-cta-sub">Paste a URL and get a full breakdown in under a minute.</p>
        <form onSubmit={handleSubmit}>
          <div className="hp-cta-bar">
            <input className="hp-cta-input" type="text" value={repoUrl} onChange={e=>setRepoUrl(e.target.value)} placeholder="https://github.com/your/repo" disabled={loading}/>
            <button type="submit" className="hp-cta-btn" disabled={loading}>{loading?'Analyzing…':'Get started →'}</button>
          </div>
          {error && <div className="hp-err" style={{marginTop:10,textAlign:'center'}}>{error}</div>}
        </form>
      </div>

      {/* ══ FOOTER ══ */}
      <footer className="hp-footer">
        <div className="hp-footer-logo">git<span>·</span>analyzer</div>
        <div className="hp-footer-stack">Built with PyDriller · Flask · React</div>
        <div className="hp-footer-year">PFE 2025</div>
      </footer>

    </>
  )
}

/* ═════════════════════════════════════════
   METRICS GRID — bars fill once scrolled into view
═════════════════════════════════════════ */
function MetricsGrid() {
  const [ref, inView] = useInView()
  return (
    <div ref={ref} className="hp-mets hp-reveal">
      {METRICS.map(({label,val,decimals,sub,bar,cls}) => (
        <div className="hp-mc" key={label}>
          <div className="hp-mc-label">{label}</div>
          <div className={`hp-mc-val${cls?' '+cls:''}`}>
            {typeof val === 'number'
              ? <CountUp value={val} decimals={decimals || 0} />
              : val}
          </div>
          <div className="hp-mc-sub">{sub}</div>
          <div className="hp-mc-bar">
            <div className={`hp-mc-fill${cls&&cls!=='mono'?' '+cls:''}`} style={{width: inView ? `${bar}%` : 0}}/>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ═════════════════════════════════════════
   REPO TICKER — infinite horizontal marquee
═════════════════════════════════════════ */
const TICKER_REPOS = [
  'pallets/flask', 'django/django', 'torvalds/linux', 'vercel/next.js',
  'facebook/react', 'rust-lang/rust', 'kubernetes/kubernetes', 'pytorch/pytorch',
  'tensorflow/tensorflow', 'golang/go', 'nodejs/node', 'vuejs/core',
]

function RepoTicker() {
  const row = [...TICKER_REPOS, ...TICKER_REPOS]
  return (
    <div className="hp-ticker">
      <div className="hp-ticker-track">
        {row.map((r, i) => (
          <span className="hp-ticker-item" key={i}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57"/>
            </svg>
            {r}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ═════════════════════════════════════════
   TYPEWRITER TERMINAL — types each line char-by-char, then loops
═════════════════════════════════════════ */
const TERM_LINES = [
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
]

function TypewriterTerminal() {
  const [ref, inView] = useInView()
  const [done, setDone] = useState([])
  const [cur,  setCur]  = useState('')
  const [li,   setLi]   = useState(0)
  const [ci,   setCi]   = useState(0)

  useEffect(() => {
    if (!inView) return
    if (li >= TERM_LINES.length) {
      const hold = setTimeout(() => { setDone([]); setCur(''); setLi(0); setCi(0) }, 2600)
      return () => clearTimeout(hold)
    }
    const line = TERM_LINES[li]
    if (ci <= line.text.length) {
      const speed = 16 + Math.random() * 26
      const tm = setTimeout(() => { setCur(line.text.slice(0, ci)); setCi(ci + 1) }, speed)
      return () => clearTimeout(tm)
    }
    const pause = setTimeout(() => {
      setDone(d => [...d, line])
      setCur('')
      setLi(li + 1)
      setCi(0)
    }, 90 + (line.text.startsWith('→') ? 220 : 40))
    return () => clearTimeout(pause)
  }, [inView, li, ci])

  const curColor = TERM_LINES[li]?.c || 'bright'
  return (
    <div className="hp-term-body" ref={ref}>
      {done.map((l, i) => (
        <span key={i} className={`hp-tl ${l.c}`}>{l.text || ' '}</span>
      ))}
      {li < TERM_LINES.length && (
        <span className={`hp-tl ${curColor}`}>{cur}<span className="hp-cursor" /></span>
      )}
      {li >= TERM_LINES.length && (
        <span className="hp-tl bright">{' '}<span className="hp-cursor" /></span>
      )}
    </div>
  )
}