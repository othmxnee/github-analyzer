import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getRepoAnalysisResult, startRepoAnalysis, startSkillsAnalysis, pollDelay, wait,
} from '../services/api'
import { saveResults } from '../services/resultStore'
import { host, LOCAL_PREFIX, isLocalKey, repoLabel } from '../services/host'
import '../styles/LocalHome.css'

/* Start screen for the desktop app and the VS Code extension.
   Analysis runs on this machine through the local engine bridge, which
   executes the website's own pipeline on a snapshot of the repository's
   committed state. Nothing leaves the computer. */

const PHASES = [
  ['cloning',    'Reading a snapshot of the repository'],
  ['extracting', 'Mining commit history'],
  ['cleaning',   'Cleaning data and merging identities'],
  ['computing',  'Computing ownership, risk and architecture'],
]

const toKey = (path) => LOCAL_PREFIX + path
const toPath = (key) => (isLocalKey(key) ? key.slice(LOCAL_PREFIX.length) : key)

export default function LocalHome() {
  const navigate = useNavigate()
  const location = useLocation()
  const [ctx, setCtx] = useState({ kind: host?.kind, repoPath: null, recent: [] })
  const [repoPath, setRepoPath] = useState(null)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState(null)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const busy = useRef(false)

  const analyze = useCallback(async (path, force = false) => {
    if (!path || busy.current) return
    busy.current = true
    setRepoPath(path)
    setError('')
    setRunning(true)
    setPhase('cloning')
    const t0 = performance.now()
    const tick = setInterval(() => setElapsed((performance.now() - t0) / 1000), 200)
    const key = toKey(path)
    try {
      const start = await startRepoAnalysis(key, force)
      if (start.error) throw new Error(start.error)
      let results = null
      for (let attempt = 0; ; attempt++) {
        const data = await getRepoAnalysisResult(key)
        if (data.status === 'done')  { results = data; break }
        if (data.status === 'error') throw new Error(data.error || 'Analysis failed')
        if (data.phase) setPhase(data.phase)
        await wait(pollDelay(attempt))
      }
      saveResults(key, results)
      startSkillsAnalysis(key).catch(() => {})
      host.rememberRepository?.(path)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Analysis failed')
    } finally {
      clearInterval(tick)
      setRunning(false)
      busy.current = false
    }
  }, [navigate])

  // Host context (repository, recent list, git availability) once.
  const started = useRef(false)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const c = (await host.getContext?.()) || {}
      if (!alive) return
      setCtx(c)
      setRepoPath(p => p || c.repoPath || null)
      if (c.autoStart && c.repoPath && !location.state?.autoSubmit && !started.current) {
        started.current = true
        analyze(c.repoPath, !!c.force)
      }
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Runs requested through navigation: the dashboard's "Re-analyze" button,
  // and host commands (desktop menu, VS Code Analyze / Refresh), which App
  // turns into a navigation to this page.
  useEffect(() => {
    const state = location.state
    if (!state?.repoUrl || !state.autoSubmit) return
    started.current = true
    analyze(toPath(state.repoUrl), state.force ?? true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const pick = async () => {
    const p = await host.pickRepository?.()
    if (p) { setRepoPath(p); analyze(p) }
  }

  const phaseIndex = Math.max(0, PHASES.findIndex(([k]) => k === phase))
  const recent = (ctx.recent || []).filter(p => p !== repoPath).slice(0, 6)

  return (
    <div className="lh">
      <header className="lh-top">
        <div className="lh-logo">git<span className="dot">·</span>analyzer</div>
        <span className="lh-badge">{ctx.kind === 'vscode' ? 'VS Code' : 'Desktop'} · offline</span>
      </header>

      <main className="lh-main">
        <div className="lh-card">
          <div className="lh-eyebrow">Repository</div>
          {repoPath
            ? <>
                <div className="lh-name">{repoLabel(toKey(repoPath))}</div>
                <div className="lh-path" title={repoPath}>{repoPath}</div>
              </>
            : <div className="lh-empty">
                {ctx.kind === 'vscode'
                  ? 'Open a folder that contains a Git repository.'
                  : 'Choose a folder that contains a Git repository.'}
              </div>}

          {running ? (
            <div className="lh-progress" aria-live="polite">
              {PHASES.map(([k, label], i) => (
                <div key={k} className={`lh-step ${i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : ''}`}>
                  <span className="lh-dot" />{label}
                </div>
              ))}
              <div className="lh-elapsed">{elapsed.toFixed(1)} s</div>
            </div>
          ) : (
            <div className="lh-actions">
              {host?.pickRepository && (
                <button className="lh-btn" onClick={pick}>Open repository…</button>
              )}
              <button className="lh-btn primary" disabled={!repoPath} onClick={() => analyze(repoPath)}>
                Analyze
              </button>
            </div>
          )}

          {ctx.git === false && (
            <div className="lh-error">
              Git was not found on this computer. Install Git (git-scm.com) and restart the app.
            </div>
          )}
          {error && <div className="lh-error">{error}</div>}
        </div>

        {!running && recent.length > 0 && (
          <div className="lh-recent">
            <div className="lh-eyebrow">Recent</div>
            {recent.map(p => (
              <button key={p} className="lh-recent-item" onClick={() => analyze(p)} title={p}>
                <span className="lh-recent-name">{repoLabel(toKey(p))}</span>
                <span className="lh-recent-path">{p}</span>
              </button>
            ))}
          </div>
        )}

        <p className="lh-note">
          Runs on this computer. The analysis reads the committed state of the checked-out branch;
          your code and developer data never leave the machine. An unchanged repository reopens instantly.
        </p>
      </main>
    </div>
  )
}
