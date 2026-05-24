import { useState } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend
} from 'recharts'

const ROLE_COLORS = {
  'Frontend':   '#4C72B0',
  'Backend':    '#DD8452',
  'Tester':     '#55A868',
  'DevOps':     '#C44E52',
  'Full Stack': '#8172B2',
  'Generalist': '#937860',
}

const AXES = [
  { key: 'pct_frontend', label: 'Frontend' },
  { key: 'pct_backend',  label: 'Backend'  },
  { key: 'pct_test',     label: 'Test'     },
  { key: 'pct_devops',   label: 'DevOps'   },
  { key: 'pct_mobile',   label: 'Mobile'   },
  { key: 'pct_docs',     label: 'Docs'     },
]

const FLOOR = 4  // minimum value so the shape is never an invisible needle

function buildRadarData(dev) {
  return AXES.map(a => ({
    skill: a.label,
    value: Math.max(FLOOR, Math.round((dev[a.key] || 0) * 100)),
    raw:   Math.round((dev[a.key] || 0) * 100),  // shown in tooltip
  }))
}

export default function DeveloperRadarChart({ developers }) {
  const [selected, setSelected] = useState(null)

  if (!developers || developers.length === 0) {
    return <p style={{ color: 'var(--color-text-muted)' }}>No developer data available.</p>
  }

  const top = [...developers]
    .sort((a, b) => b.total_commits - a.total_commits)
    .slice(0, 30)

  const activeDev = selected
    ? developers.find(d => d.developer === selected)
    : top[0]

  if (!activeDev) return null

  const radarData  = buildRadarData(activeDev)
  const shortName  = activeDev.developer.split('@')[0]
  const roleColor  = ROLE_COLORS[activeDev.role] || '#aaa'

  return (
    <div>
      {/* Developer selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: 'var(--color-text-muted)', fontSize: 13, marginRight: 8 }}>
          Select developer:
        </label>
        <select
          value={activeDev.developer}
          onChange={e => setSelected(e.target.value)}
          style={{
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 13,
          }}
        >
          {top.map(d => (
            <option key={d.developer} value={d.developer}>
              {d.developer.split('@')[0]} ({d.total_commits} commits) — {d.role}
            </option>
          ))}
        </select>
      </div>

      {/* Role badge */}
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          background: roleColor, color: '#fff',
          borderRadius: 6, padding: '3px 12px',
          fontWeight: 700, fontSize: 13,
        }}>
          {activeDev.role}
        </span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          {activeDev.total_commits} commits · {activeDev.total_lines.toLocaleString()} lines
        </span>
      </div>

      {/* Radar chart */}
      <ResponsiveContainer width="100%" height={340}>
        <RadarChart data={radarData} outerRadius={110}>
          <PolarGrid stroke="var(--color-border)" />
          <PolarAngleAxis
            dataKey="skill"
            tick={{ fill: 'var(--color-text)', fontSize: 13, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }}
            tickCount={4}
          />
          <Radar
            name={shortName}
            dataKey="value"
            stroke={roleColor}
            strokeWidth={2.5}
            fill={roleColor}
            fillOpacity={0.45}
            dot={{ r: 4, fill: roleColor, strokeWidth: 0 }}
          />
          <Tooltip
            formatter={(v, _name, props) => [`${props.payload.raw}%`, 'Contribution']}
            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6 }}
            labelStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
            itemStyle={{ color: roleColor }}
          />
          <Legend wrapperStyle={{ color: 'var(--color-text)', fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}