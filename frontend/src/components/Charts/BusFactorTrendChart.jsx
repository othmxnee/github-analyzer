/* Bus-factor trajectory over the project's life (trailing-window).
   Shows direction — is the team getting more or less fragile — rather than a
   single snapshot. */
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import { useChartColors } from '../../hooks/useTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export default function BusFactorTrendChart({ data }) {
  const { grid, tick, muted } = useChartColors()
  const points = Array.isArray(data) ? data : []

  if (points.length < 2) {
    return <p style={{ color: 'var(--t3)', fontSize: 12 }}>Not enough history to plot a trend yet.</p>
  }

  const labels = points.map(p => String(p.date).slice(0, 7))
  const first = points[0], last = points[points.length - 1]
  const busDelta = (last.bus_factor ?? 0) - (first.bus_factor ?? 0)
  const allFlat = points.every(p => p.bus_factor === first.bus_factor)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Bus factor', data: points.map(p => p.bus_factor), yAxisID: 'y',
        borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.12)',
        fill: true, tension: 0.3, pointRadius: 2,
      },
    ],
  }
  const options = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false } },
    scales: {
      y: { position: 'left', min: 0, grid: { color: grid }, ticks: { color: tick, precision: 0 } },
      x: { grid: { display: false }, ticks: { color: tick, maxTicksLimit: 8 } },
    },
  }
  return (
    <div>
      <div style={{ height: 220 }}><Line data={chartData} options={options} /></div>
      <p style={{ marginTop: 10, fontSize: 11, color: muted, fontStyle: 'italic', lineHeight: 1.6 }}>
        <strong>Bus factor</strong> is the number of developers who together own 50% of the code — lower means more fragile.
        {' '}
        {busDelta < 0
          ? `It fell from ${first.bus_factor} to ${last.bus_factor} — the team is concentrating.`
          : busDelta > 0
            ? `It rose from ${first.bus_factor} to ${last.bus_factor} — knowledge is spreading.`
            : `It held steady at ${last.bus_factor}.`}
        {allFlat && last.bus_factor <= 1
          ? ' The line is flat because one developer has dominated the whole project — fragility never changed.'
          : ' Each point uses a trailing window, so this reflects current fragility, not all-time totals.'}
      </p>
    </div>
  )
}
