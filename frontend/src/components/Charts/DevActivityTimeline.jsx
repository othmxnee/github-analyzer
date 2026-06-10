import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { useChartColors } from '../../hooks/useTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

/* One developer's monthly activity (file modifications) over time —
   the per-developer version of the "Developer Activity Over Time" chart. */
export default function DevActivityTimeline({ points, height = 150 }) {
  const { grid, tick } = useChartColors()

  if (!points || points.length === 0) {
    return <p style={{ color: 'var(--t3)', fontSize: 11, margin: 0 }}>No activity timeline.</p>
  }

  const sorted = [...points].sort((a, b) => new Date(a.date) - new Date(b.date))

  const data = {
    labels: sorted.map((p) => {
      const d = new Date(p.date)
      return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }),
    datasets: [
      {
        data: sorted.map((p) => p.count),
        borderColor: '#3B6EEA',
        backgroundColor: 'rgba(59,110,234,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'index' },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: grid },
        ticks: { color: tick, font: { size: 9 }, maxTicksLimit: 4, precision: 0 },
      },
      x: {
        grid: { display: false },
        ticks: { color: tick, font: { size: 9 }, maxTicksLimit: 7, maxRotation: 0, autoSkip: true },
      },
    },
  }

  return <div style={{ height }}><Line data={data} options={options} /></div>
}
