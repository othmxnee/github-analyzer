import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const ROLE_COLORS = {
  'Frontend':    '#4C72B0',
  'Backend':     '#DD8452',
  'Tester':      '#55A868',
  'DevOps':      '#C44E52',
  'Full Stack':  '#8172B2',
  'Generalist':  '#937860',
}

export default function RoleDistributionChart({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <p style={{ color: 'var(--color-text-muted)' }}>No role data available.</p>
  }

  const chartData = Object.entries(data)
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="role"
          tick={{ fill: 'var(--color-text)', fontSize: 13 }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: 'var(--color-text)', fontSize: 12 }}
          label={{ value: 'Developers', angle: -90, position: 'insideLeft',
                   fill: 'var(--color-text-muted)', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          labelStyle={{ color: 'var(--color-text)' }}
          itemStyle={{ color: 'var(--color-text)' }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: 'var(--color-text)', fontSize: 12 }}>
          {chartData.map((entry) => (
            <Cell key={entry.role} fill={ROLE_COLORS[entry.role] || '#aaa'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}