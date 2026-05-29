import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { API_URL } from '../services/api'

const ICONS = {
  github: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
  ),
  gitlab: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#FC6D26"><path d="M23.955 13.587l-1.342-4.135-2.664-8.189a.455.455 0 00-.867 0L16.418 9.452H7.582L4.919 1.263a.455.455 0 00-.867 0L1.388 9.452.045 13.587a.924.924 0 00.331 1.023L12 23.054l11.624-8.443a.924.924 0 00.331-1.024"/></svg>
  ),
  bitbucket: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#2684FF"><path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.77-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/></svg>
  ),
}

const PROVIDERS = [
  { id: 'github',    label: 'GitHub' },
  { id: 'gitlab',    label: 'GitLab' },
  { id: 'bitbucket', label: 'Bitbucket' },
]

function ProviderRow({ id, label, user, onLogout }) {
  const connected = !!user
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: '1px solid var(--b)',
    }}>
      <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t)' }}>
        {ICONS[id]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)' }}>{label}</div>
        {connected ? (
          <div style={{ fontSize: 11, color: 'var(--green, #00C896)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Connected as @{user.login}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>Not connected</div>
        )}
      </div>
      {connected ? (
        <button
          onClick={() => onLogout(id)}
          style={{
            fontSize: 11, color: 'var(--t3)', background: 'none',
            border: '1px solid var(--b)', borderRadius: 6,
            padding: '4px 9px', cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      ) : (
        <a
          href={`${API_URL}/auth/${id}`}
          style={{
            fontSize: 11, fontWeight: 500, color: 'var(--t)',
            background: 'var(--bg)', border: '1px solid var(--b)',
            borderRadius: 6, padding: '4px 10px',
            textDecoration: 'none',
          }}
        >
          Sign in
        </a>
      )}
    </div>
  )
}

export default function AuthButton({ auth }) {
  const { loading, providers, connectedCount, logout } = auth
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const rootRef = useRef(null)
  const popupRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return
    const update = () => {
      const r = rootRef.current.getBoundingClientRect()
      const width = 320
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))
      setCoords({ top: r.bottom + 6, left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = e => {
      const inRoot = rootRef.current && rootRef.current.contains(e.target)
      const inPopup = popupRef.current && popupRef.current.contains(e.target)
      if (!inRoot && !inPopup) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (loading) return null

  const label = connectedCount === 0
    ? 'Sign in'
    : connectedCount === 1
      ? `Connected (1)`
      : `Connected (${connectedCount})`

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          fontSize: 13, fontWeight: 500,
          color: 'var(--t)', background: 'var(--card)',
          border: '1px solid var(--b)', borderRadius: 8,
          padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {connectedCount > 0 && (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green, #00C896)' }} />
        )}
        {label}
      </button>

      {open && coords && createPortal(
        <div ref={popupRef} style={{
          position: 'fixed', top: coords.top, left: coords.left,
          width: 320,
          background: 'var(--card)', border: '1px solid var(--b)',
          borderRadius: 10, boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
          zIndex: 9999, overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--b)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t)' }}>Repository providers</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
              Sign in to analyze private repositories.
            </div>
          </div>
          {PROVIDERS.map(p => (
            <ProviderRow
              key={p.id}
              id={p.id}
              label={p.label}
              user={providers[p.id]}
              onLogout={logout}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
