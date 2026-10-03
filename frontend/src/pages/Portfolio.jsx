import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL, getPortfolio, getPortfolioPeople } from '../services/api'
import '../styles/Portfolio.css'

/* Company-wide view: every repository the signed-in user watches, riskiest
   first, and the people who are critical owners across them. */

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const day = (s) => (s ? String(s).slice(0, 10) : '—')
const short = (dev) => String(dev).split('@')[0]

function Change({ value, invert = false }) {
  if (value == null || value === 0) return null
  const worse = invert ? value > 0 : value < 0
  return <span className={`pf-change ${worse ? 'worse' : 'better'}`}>{value > 0 ? '+' : ''}{value}</span>
}

function healthClass(h) {
  if (h == null) return ''
  if (h < 40) return 'bad'
  if (h < 70) return 'warn'
  return 'good'
}

export default function Portfolio() {
  const [repos, setRepos] = useState(null)
  const [people, setPeople] = useState([])
  const [state, setState] = useState('loading')   // loading | signin | disabled | ready | error
  const [error, setError] = useState('')

  useEffect(() => {
    getPortfolio()
      .then(d => {
        if (!d.enabled) { setState('disabled'); return }
        setRepos(d.repositories || [])
        setState('ready')
        return getPortfolioPeople().then(p => setPeople(p.people || []))
      })
      .catch(err => {
        if (/sign in/i.test(err.message)) setState('signin')
        else { setError(err.message); setState('error') }
      })
  }, [])

  const openRepo = (url) => `/?repo=${encodeURIComponent(url)}`

  return (
    <div className="pf">
      <header className="pf-top">
        <Link to="/" className="pf-logo">git<span className="dot">·</span>analyzer</Link>
        <span className="pf-crumb">My repositories</span>
      </header>
      <main className="pf-main">
        {state === 'loading' && <p className="pf-muted">Loading…</p>}
        {state === 'signin' && (
          <div className="pf-card pf-empty">
            <p>Sign in to see the repositories you watch.</p>
            <a className="pf-btn" href={`${API_URL}/auth/github`}>Sign in with GitHub</a>
          </div>
        )}
        {state === 'disabled' && <div className="pf-card pf-empty"><p>This server keeps no history, so there is nothing to show here.</p></div>}
        {state === 'error' && <div className="pf-card pf-empty pf-err">{error}</div>}

        {state === 'ready' && repos.length === 0 && (
          <div className="pf-card pf-empty">
            <p>You don't watch any repository yet.</p>
            <p className="pf-muted">Analyze a repository, then click <b>Watch</b> on its dashboard. It will appear here with its trend and alerts.</p>
            <Link className="pf-btn" to="/">Analyze a repository</Link>
          </div>
        )}

        {state === 'ready' && repos.length > 0 && (
          <>
            <section className="pf-card">
              <div className="pf-card-title">Repositories <span className="pf-muted">riskiest first · change since the previous analysis</span></div>
              <div className="pf-table-wrap">
                <table className="pf-table">
                  <thead><tr>
                    <th>Repository</th><th>Health</th><th>Bus factor</th><th>Active bus factor</th>
                    <th>Orphaned</th><th>Alerts (30 d)</th><th>Analyzed</th>
                  </tr></thead>
                  <tbody>
                    {repos.map(r => (
                      <tr key={r.repo_url}>
                        <td><a href={openRepo(r.repo_url)} className="pf-repo">{r.name}</a>{r.private && <span className="pf-tag">private</span>}</td>
                        <td><span className={`pf-health ${healthClass(r.health_score)}`}>{r.health_score ?? '—'}</span><Change value={r.health_change} /></td>
                        <td className={r.bus_factor === 1 ? 'pf-bad' : ''}>{r.bus_factor ?? '—'}<Change value={r.bus_factor_change} /></td>
                        <td>{r.active_bus_factor ?? '—'}</td>
                        <td>{pct(r.orphaned_pct)}</td>
                        <td>{r.alerts_30d ? <span className="pf-alerts">{r.alerts_30d}</span> : '—'}</td>
                        <td className="pf-muted">{day(r.analyzed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {people.length > 0 && (
              <section className="pf-card">
                <div className="pf-card-title">People <span className="pf-muted">critical owner = holds half of a repository's lines, or the most lines where the bus factor is 1</span></div>
                <div className="pf-table-wrap">
                  <table className="pf-table">
                    <thead><tr><th>Developer</th><th>Critical in</th><th>Ownership by repository</th></tr></thead>
                    <tbody>
                      {people.slice(0, 50).map(p => (
                        <tr key={p.developer}>
                          <td title={p.developer}>{short(p.developer)}</td>
                          <td className={p.critical_repos ? 'pf-bad' : 'pf-muted'}>{p.critical_repos ? `${p.critical_repos} repo${p.critical_repos > 1 ? 's' : ''}` : '—'}</td>
                          <td>
                            <div className="pf-chips">
                              {p.repos.map(r => (
                                <span key={r.repo_url} className={`pf-chip${r.critical ? ' critical' : ''}`}
                                      title={`last commit ${r.last_commit || '?'}`}>
                                  {r.name.split('/').pop()} {pct(r.share)}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
