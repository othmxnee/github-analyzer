import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { API_URL, createWatch, listWatches } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import '../styles/Watch.css'

/* "Watch" in the dashboard header: nightly re-checks of this repository with
   alerts by email (confirmed by a link) and/or Slack. Website only. */
export default function WatchButton({ repoUrl }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [slack, setSlack] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const [watching, setWatching] = useState(false)

  useEffect(() => {
    if (!auth.authenticated) return
    listWatches()
      .then(d => setWatching((d.watches || []).some(w => w.repo_url === repoUrl)))
      .catch(() => {})
  }, [auth.authenticated, repoUrl])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setDone('')
    try {
      const r = await createWatch(repoUrl, { email: email.trim(), slackWebhookUrl: slack.trim() })
      setDone(r.message || 'Done.')
      setWatching(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="dash-reanalyze-btn" onClick={() => setOpen(true)} title="Get alerts when risk changes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {watching ? 'Watching' : 'Watch'}
      </button>

      {/* Portal: the dashboard header uses backdrop-filter, which would trap a
          position:fixed dialog inside the header instead of the viewport. */}
      {open && createPortal(
        <div className="wb-backdrop" onClick={() => setOpen(false)}>
          <div className="wb-modal" role="dialog" aria-modal="true" aria-labelledby="wb-title" onClick={e => e.stopPropagation()}>
            <div className="wb-head">
              <div id="wb-title" className="wb-title">Get alerts for this repository</div>
              <button className="wb-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <p className="wb-text">
              Git Analyzer re-checks the repository every night. You get a message when the bus factor drops,
              the health score falls, orphaned knowledge grows, a main code owner goes quiet, or a file becomes high risk.
            </p>
            {!auth.authenticated ? (
              <div className="wb-signin">
                <span>Sign in first, so your alerts are tied to your account.</span>
                <a className="dash-pdf-btn" href={`${API_URL}/auth/github`}>Sign in with GitHub</a>
              </div>
            ) : done ? (
              <>
                <div className="wb-done">{done}</div>
                <div className="wb-actions"><Link className="dash-reanalyze-btn" to="/portfolio">See all your repositories →</Link></div>
              </>
            ) : (
              <form onSubmit={submit} className="wb-form">
                <label className="wb-label">Email
                  <input className="wb-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                         placeholder="you@company.com" autoComplete="email" />
                </label>
                <label className="wb-label"><span>Slack incoming webhook <span className="wb-opt">(optional)</span></span>
                  <input className="wb-input" type="url" value={slack} onChange={e => setSlack(e.target.value)}
                         placeholder="https://hooks.slack.com/services/..." />
                </label>
                {error && <div className="wb-error">{error}</div>}
                <div className="wb-actions">
                  <button type="button" className="dash-reanalyze-btn" onClick={() => setOpen(false)}>Cancel</button>
                  <button type="submit" className="dash-pdf-btn" disabled={busy || (!email.trim() && !slack.trim())}>
                    {busy ? 'Saving…' : 'Start alerts'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
