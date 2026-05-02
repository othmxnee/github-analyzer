import { useState } from 'react'

const ROLE_COLORS = {
  Frontend: '#4C72B0',
  Backend: '#DD8452',
  Tester: '#55A868',
  DevOps: '#C44E52',
  'Full Stack': '#8172B2',
  Mobile: '#CCB974',
  Generalist: '#937860',
}

const VIEWS = [
  {
    key: 'pca',
    label: 'PCA (original)',
    xKey: 'pca_x',
    yKey: 'pca_y',
    description: 'PCA with all 11 features. Fast but noisy — pct_docs and pct_build add noise.',
  },
  {
    key: 'pca_no_noise',
    label: 'PCA (no noise)',
    xKey: 'pca_no_noise_x',
    yKey: 'pca_no_noise_y',
    description: 'PCA with 9 features — pct_docs and pct_build removed. Slightly cleaner separation.',
  },
  {
    key: 'umap',
    label: 'UMAP',
    xKey: 'umap_x',
    yKey: 'umap_y',
    description: 'UMAP preserves local cluster structure. Best visual separation of roles.',
  },
]

function ScatterPlot({ developers, xKey, yKey }) {
  const [tooltip, setTooltip] = useState(null)
  const [hoveredRole, setHoveredRole] = useState(null)

  const roles = [...new Set(developers.map(d => d.role))]

  const allX = developers.map(d => d[xKey] ?? 0)
  const allY = developers.map(d => d[yKey] ?? 0)
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)

  const PAD = 40
  const WIDTH = 600
  const HEIGHT = 400

  const scaleX = x => PAD + ((x - minX) / (maxX - minX || 1)) * (WIDTH - PAD * 2)
  const scaleY = y => HEIGHT - PAD - ((y - minY) / (maxY - minY || 1)) * (HEIGHT - PAD * 2)

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {roles.map(role => (
          <div
            key={role}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              cursor: 'pointer',
              opacity: hoveredRole && hoveredRole !== role ? 0.3 : 1,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={() => setHoveredRole(role)}
            onMouseLeave={() => setHoveredRole(null)}
          >
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: ROLE_COLORS[role] || '#aaa'
            }} />
            <span style={{ fontSize: 12, color: 'var(--color-text)' }}>{role}</span>
          </div>
        ))}
      </div>

      {/* Plot */}
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(t => (
            <g key={t}>
              <line
                x1={PAD} y1={PAD + t * (HEIGHT - PAD * 2)}
                x2={WIDTH - PAD} y2={PAD + t * (HEIGHT - PAD * 2)}
                stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="4 4"
              />
              <line
                x1={PAD + t * (WIDTH - PAD * 2)} y1={PAD}
                x2={PAD + t * (WIDTH - PAD * 2)} y2={HEIGHT - PAD}
                stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="4 4"
              />
            </g>
          ))}

          {/* Dots */}
          {developers.map((dev, i) => {
            const x = scaleX(dev[xKey] ?? 0)
            const y = scaleY(dev[yKey] ?? 0)
            const color = ROLE_COLORS[dev.role] || '#aaa'
            const faded = hoveredRole && hoveredRole !== dev.role

            return (
              <circle
                key={i}
                cx={x} cy={y} r={6}
                fill={color}
                fillOpacity={faded ? 0.1 : 0.85}
                stroke={color}
                strokeWidth={faded ? 0 : 1}
                style={{ cursor: 'pointer', transition: 'fill-opacity 0.2s' }}
                onMouseEnter={() => setTooltip({ dev, x, y })}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute',
            left: `${(tooltip.x / WIDTH) * 100}%`,
            top: `${(tooltip.y / HEIGHT) * 100}%`,
            transform: 'translate(-50%, -120%)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 160,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
              {tooltip.dev.developer.split('@')[0]}
            </div>
            <div style={{ color: ROLE_COLORS[tooltip.dev.role] || '#aaa', fontWeight: 600 }}>
              {tooltip.dev.role}
              {tooltip.dev.role_original === 'Generalist' &&
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> (was Generalist)</span>
              }
            </div>
            <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
              {tooltip.dev.total_commits} commits
            </div>
            <div style={{ color: 'var(--color-text-muted)' }}>
              Frontend: {(tooltip.dev.pct_frontend * 100).toFixed(0)}% |
              Backend: {(tooltip.dev.pct_backend * 100).toFixed(0)}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DeveloperScatterPlot({ developers }) {
  const [activeView, setActiveView] = useState('pca')

  if (!developers || developers.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)' }}>No data available.</p>
  }

  const currentView = VIEWS.find(v => v.key === activeView)

  // Check if UMAP data exists (fallback message if not)
  const hasUmap = developers.some(d => d.umap_x !== undefined)

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {VIEWS.map(view => {
          const isUmapMissing = view.key === 'umap' && !hasUmap
          return (
            <button
              key={view.key}
              onClick={() => !isUmapMissing && setActiveView(view.key)}
              title={isUmapMissing ? 'Install umap-learn on the backend to enable this view' : view.description}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: activeView === view.key
                  ? 'var(--color-accent, #4C72B0)'
                  : 'var(--color-surface)',
                color: activeView === view.key
                  ? '#fff'
                  : isUmapMissing
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text)',
                fontSize: 13,
                fontWeight: activeView === view.key ? 600 : 400,
                cursor: isUmapMissing ? 'not-allowed' : 'pointer',
                opacity: isUmapMissing ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              {view.label}
              {isUmapMissing && ' ⚠️'}
            </button>
          )
        })}
      </div>

      {/* Description */}
      <p style={{
        fontSize: 12,
        color: 'var(--color-text-muted)',
        marginBottom: 12,
        fontStyle: 'italic'
      }}>
        {currentView.description}
      </p>

      {/* Active scatter plot */}
      <ScatterPlot
        key={activeView}
        developers={developers}
        xKey={currentView.xKey}
        yKey={currentView.yKey}
      />

      {/* Footer note */}
      <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>
        Each dot = one developer. Position based on skill similarity ({currentView.label}). Hover for details.
        Developers labeled "(was Generalist)" were resolved using clustering.
      </p>
    </div>
  )
}