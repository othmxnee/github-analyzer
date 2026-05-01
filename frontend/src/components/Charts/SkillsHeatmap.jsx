const SKILLS = [
  { key: 'pct_frontend', label: 'Frontend' },
  { key: 'pct_backend',  label: 'Backend'  },
  { key: 'pct_test',     label: 'Test'     },
  { key: 'pct_devops',   label: 'DevOps'   },
  { key: 'pct_docs',     label: 'Docs'     },
]

const ROLE_COLORS = {
  'Frontend':   '#4C72B0',
  'Backend':    '#DD8452',
  'Tester':     '#55A868',
  'DevOps':     '#C44E52',
  'Full Stack': '#8172B2',
  'Generalist': '#937860',
}

function heatColor(value) {
  // white → orange → red
  const v = Math.min(1, Math.max(0, value))
  const r = Math.round(255)
  const g = Math.round(255 * (1 - v * 0.85))
  const b = Math.round(255 * (1 - v))
  return `rgb(${r},${g},${b})`
}

export default function SkillsHeatmap({ developers }) {
  if (!developers || developers.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)' }}>No developer data available.</p>
  }

  // Show top 20 by commits
  const top = [...developers]
    .sort((a, b) => b.total_commits - a.total_commits)
    .slice(0, 20)

  const cellSize  = 52
  const rowHeight = 36
  const labelW    = 180

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ width: labelW, textAlign: 'left', padding: '6px 10px',
                         color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Developer
            </th>
            <th style={{ width: 70, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 600 }}>
              Role
            </th>
            {SKILLS.map(s => (
              <th key={s.key} style={{ width: cellSize, textAlign: 'center',
                                       color: 'var(--color-text-muted)', fontWeight: 600, padding: '6px 4px' }}>
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map((dev) => {
            const shortName = dev.developer.split('@')[0].slice(0, 22)
            return (
              <tr key={dev.developer} style={{ height: rowHeight }}>
                {/* Developer name */}
                <td style={{ padding: '4px 10px', color: 'var(--color-text)',
                             whiteSpace: 'nowrap', maxWidth: labelW, overflow: 'hidden',
                             textOverflow: 'ellipsis' }}
                    title={dev.developer}>
                  {shortName}
                  <span style={{ color: 'var(--color-text-muted)', marginLeft: 6, fontSize: 10 }}>
                    ({dev.total_commits} commits)
                  </span>
                </td>

                {/* Role badge */}
                <td style={{ textAlign: 'center', padding: '4px' }}>
                  <span style={{
                    background: ROLE_COLORS[dev.role] || '#aaa',
                    color: '#fff',
                    borderRadius: 4,
                    padding: '2px 7px',
                    fontSize: 10,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}>
                    {dev.role}
                  </span>
                </td>

                {/* Skill cells */}
                {SKILLS.map(s => {
                  const val = dev[s.key] || 0
                  return (
                    <td key={s.key}
                        title={`${s.label}: ${(val * 100).toFixed(1)}%`}
                        style={{
                          background: heatColor(val),
                          textAlign: 'center',
                          color: val > 0.5 ? '#fff' : '#333',
                          fontWeight: 600,
                          fontSize: 11,
                          padding: '4px 2px',
                        }}>
                      {(val * 100).toFixed(0)}%
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}