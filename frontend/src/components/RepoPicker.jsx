import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getMyRepos, logout as apiLogout, API_URL } from '../services/api'

const LockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
  </svg>
)

const PROVIDER_LABELS = { github: 'GitHub', gitlab: 'GitLab', bitbucket: 'Bitbucket' }

function ErrorPanel({ provider, message, onReconnect, onRetry }) {
  const is401 = String(message).includes('401') || /authent/i.test(message)
  const btnStyle = {
    fontSize: 12, fontWeight: 500,
    color: 'var(--t)', background: 'var(--bg)',
    border: '1px solid var(--b)', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
  }
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(239,68,68,0.12)', color: '#EF4444',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px', fontSize: 20, fontWeight: 600,
      }}>!</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', marginBottom: 6 }}>
        Couldn't load {PROVIDER_LABELS[provider]} repos
      </div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 16, lineHeight: 1.55, wordBreak: 'break-word' }}>
        {is401
          ? `Your ${PROVIDER_LABELS[provider]} session has expired or the token is invalid.`
          : message}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button type="button" onClick={onRetry} style={btnStyle}>Retry</button>
        <button type="button" onClick={onReconnect} style={btnStyle}>
          Reconnect {PROVIDER_LABELS[provider]}
        </button>
      </div>
    </div>
  )
}

export default function RepoPicker({ onSelect, providers }) {
  const connectedProviders = useMemo(
    () => Object.keys(PROVIDER_LABELS).filter(p => providers && providers[p]),
    [providers]
  )

  const [open, setOpen] = useState(false)
  const [activeProvider, setActiveProvider] = useState(connectedProviders[0] || 'github')
  const [reposByProvider, setReposByProvider] = useState({})
  const [errorByProvider, setErrorByProvider] = useState({})
  const [loadingByProvider, setLoadingByProvider] = useState({})
  const [query, setQuery] = useState('')

  // Keep active tab valid as providers connect/disconnect
  useEffect(() => {
    if (connectedProviders.length > 0 && !connectedProviders.includes(activeProvider)) {
      setActiveProvider(connectedProviders[0])
    }
  }, [connectedProviders, activeProvider])

  // Reset search whenever the active tab changes — UX, prevents stale query
  useEffect(() => { setQuery('') }, [activeProvider])

  // Fetch repos lazily per provider (cached by provider for the modal session).
  // Once a provider has either succeeded OR failed, don't refetch automatically —
  // user can click "Reconnect" / "Retry" to try again.
  useEffect(() => {
    if (!open) return
    if (reposByProvider[activeProvider] !== undefined) return
    if (errorByProvider[activeProvider]) return
    if (loadingByProvider[activeProvider]) return
    setLoadingByProvider(prev => ({ ...prev, [activeProvider]: true }))
    getMyRepos(activeProvider)
      .then(data => {
        setReposByProvider(prev => ({ ...prev, [activeProvider]: data.repos || [] }))
      })
      .catch(err => {
        const msg = err.response?.data?.error || err.message || 'Failed to load repos'
        setErrorByProvider(prev => ({ ...prev, [activeProvider]: msg }))
      })
      .finally(() => {
        setLoadingByProvider(prev => ({ ...prev, [activeProvider]: false }))
      })
  }, [open, activeProvider, reposByProvider, errorByProvider, loadingByProvider])

  // Manual retry: clear the cached error for the active provider — useEffect refetches.
  const retry = () => {
    setErrorByProvider(prev => ({ ...prev, [activeProvider]: '' }))
  }

  // ESC closes the modal
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const repos = reposByProvider[activeProvider]
  const error = errorByProvider[activeProvider]
  const loading = loadingByProvider[activeProvider]

  const filtered = useMemo(() => {
    if (!repos) return []
    const q = query.trim().toLowerCase()
    if (!q) return repos
    return repos.filter(r => (r.full_name || '').toLowerCase().includes(q))
  }, [repos, query])

  const pick = repo => {
    onSelect(repo.html_url)
    setOpen(false)
  }

  const reconnect = async () => {
    await apiLogout(activeProvider).catch(() => {})
    window.location.href = `${API_URL}/auth/${activeProvider}`
  }

  if (connectedProviders.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: 'var(--t2)',
          background: 'var(--card)', border: '1px solid var(--b)',
          borderRadius: 6, padding: '4px 9px',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <FolderIcon />
        My repos
      </button>

      {open && createPortal(
        <div
          onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: '100%', maxWidth: 560,
              height: '100%', maxHeight: 640,
              background: 'var(--card)',
              border: '1px solid var(--b)', borderRadius: 12,
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '14px 18px', borderBottom: '1px solid var(--b)',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t)' }}>Choose a repository</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                  From your connected accounts
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  border: '1px solid var(--b)', background: 'var(--bg)',
                  color: 'var(--t2)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Provider tabs */}
            {connectedProviders.length > 1 && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--b)' }}>
                {connectedProviders.map(p => {
                  const active = p === activeProvider
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setActiveProvider(p)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontSize: 12, fontWeight: active ? 600 : 500,
                        color: active ? 'var(--t)' : 'var(--t3)',
                        background: active ? 'var(--bg)' : 'transparent',
                        border: 'none',
                        borderBottom: active ? '2px solid var(--ac)' : '2px solid transparent',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Search */}
            {!error && (
              <div style={{ padding: 12, borderBottom: '1px solid var(--b)' }}>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={`Search ${PROVIDER_LABELS[activeProvider]} repositories…`}
                  style={{
                    width: '100%', fontSize: 13, padding: '8px 11px',
                    border: '1px solid var(--b)', borderRadius: 6,
                    background: 'var(--bg)', color: 'var(--t)',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {loading && (
                <div style={{ padding: 24, fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>
                  Loading your {PROVIDER_LABELS[activeProvider]} repos…
                </div>
              )}
              {!loading && error && (
                <ErrorPanel provider={activeProvider} message={error} onReconnect={reconnect} onRetry={retry} />
              )}
              {!loading && !error && filtered.length === 0 && (
                <div style={{ padding: 24, fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>
                  {repos && repos.length === 0 ? 'No repositories found.' : 'No matches.'}
                </div>
              )}
              {!loading && !error && filtered.map(repo => (
                <button
                  key={`${activeProvider}:${repo.full_name}`}
                  type="button"
                  onClick={() => pick(repo)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '11px 16px',
                    border: 'none', borderBottom: '1px solid var(--b)',
                    background: 'transparent', cursor: 'pointer',
                    textAlign: 'left', fontFamily: 'inherit',
                    color: 'var(--t)', fontSize: 13,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {repo.private && <LockIcon />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {repo.full_name}
                    </div>
                    {repo.description && (
                      <div style={{
                        fontSize: 11, color: 'var(--t3)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {repo.description}
                      </div>
                    )}
                  </div>
                  {repo.language && (
                    <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>{repo.language}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            {!error && repos && repos.length > 0 && (
              <div style={{
                padding: '8px 16px', fontSize: 11, color: 'var(--t3)',
                borderTop: '1px solid var(--b)', textAlign: 'center',
              }}>
                {filtered.length} of {repos.length} repositories
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
