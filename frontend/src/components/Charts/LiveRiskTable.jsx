/* Recency-weighted file risk as a bar chart (mirrors the Risk Analysis chart).
   Live risk = KCI × normalized in-degree × recency, so a fragile, central file
   that is ALSO being actively changed ranks above an equally fragile but
   dormant one. */
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js'
import { useChartColors } from '../../hooks/useTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

function LiveRiskTable({ data }) {
  const { grid, tick, muted } = useChartColors()

  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--t3)' }}>No live-risk data (needs a resolvable dependency graph).</p>
  }

  const sorted = [...data].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10)
  const fullPaths = sorted.map(d => d.file)

  const chartData = {
    labels: sorted.map(d => (d.file.length > 35 ? '…' + d.file.slice(-33) : d.file)),
    datasets: [
      {
        label: 'Live Risk',
        data: sorted.map(d => d.risk_score),
        backgroundColor: 'rgba(245, 158, 11, 0.8)',
        borderColor: '#f59e0b',
        borderWidth: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          // Show the full path plus the factors behind the score.
          title: (items) => fullPaths[items[0].dataIndex] || items[0].label,
          afterBody: (items) => {
            const d = sorted[items[0].dataIndex]
            return [
              `KCI: ${Math.round((d.kci ?? 0) * 100)}%`,
              `In-degree: ${d.in_degree}`,
              `Last touched: ${Math.round(d.months_idle ?? 0)} months ago`,
            ]
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: grid },
        ticks: { color: tick },
        title: { display: true, text: 'Live Risk Score', color: tick },
      },
      x: {
        grid: { display: false },
        ticks: { color: tick },
      },
    },
  }

  return (
    <div>
      <div style={{ height: '450px' }}>
        <Bar data={chartData} options={options} />
      </div>
      <p style={{ marginTop: '12px', fontSize: '0.8rem', color: muted, fontStyle: 'italic' }}>
        Live Risk = KCI × In-Degree × Recency. A fragile file changed last week ranks above an equally fragile one untouched for years. Hover a bar for the factors.
      </p>
    </div>
  )
}

export default LiveRiskTable
