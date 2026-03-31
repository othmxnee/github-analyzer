import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

function riskBand(percent) {
  if (percent < 30) return { label: 'safe', color: '#22c55e' }
  if (percent <= 60) return { label: 'warning', color: '#f59e0b' }
  return { label: 'high risk', color: '#ef4444' }
}

function BusFactorRiskVisualization({ data }) {
  const developers = data?.developers || []
  const simulation = data?.simulation || []

  if (developers.length === 0 || simulation.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No bus factor simulation data available</p>
  }

  const topDevelopers = developers.slice(0, 10)
  const twoRemoved = simulation.find(item => item.removed === 2) || simulation[Math.min(1, simulation.length - 1)]
  const twoRemovedPct = twoRemoved ? twoRemoved.knowledge_lost * 100 : 0
  const twoRemovedBand = riskBand(twoRemovedPct)

  const ownershipData = {
    labels: topDevelopers.map(d => d.name),
    datasets: [
      {
        label: 'Ownership %',
        data: topDevelopers.map(d => +(d.ownership * 100).toFixed(2)),
        backgroundColor: topDevelopers.map(d => riskBand(d.ownership * 100).color)
      }
    ]
  }

  const simulationData = {
    labels: simulation.map(d => d.removed),
    datasets: [
      {
        label: 'Knowledge Lost %',
        data: simulation.map(d => +(d.knowledge_lost * 100).toFixed(2)),
        borderColor: '#4cc9f0',
        backgroundColor: 'rgba(76, 201, 240, 0.15)',
        tension: 0.2,
        fill: true,
        pointBackgroundColor: simulation.map(d => riskBand(d.knowledge_lost * 100).color),
        pointRadius: 3
      }
    ]
  }

  const sharedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af' } } },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.1)' },
        ticks: { color: '#9ca3af' }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 20 }
      }
    }
  }

  return (
    <div className="busfactor-section">
      <div className="grid-2">
        <div style={{ height: '320px' }}>
          <Bar
            data={ownershipData}
            options={{
              ...sharedOptions,
              plugins: { ...sharedOptions.plugins, legend: { display: false } }
            }}
          />
        </div>
        <div style={{ height: '320px' }}>
          <Line data={simulationData} options={sharedOptions} />
        </div>
      </div>

      <p className="busfactor-insight">
        Removing the top 2 developers would remove{' '}
        <strong style={{ color: twoRemovedBand.color }}>{twoRemovedPct.toFixed(1)}%</strong>{' '}
        of project knowledge ({twoRemovedBand.label}).
      </p>
      <div className="risk-legend">
        <span><i style={{ background: '#22c55e' }} /> &lt; 30% = safe</span>
        <span><i style={{ background: '#f59e0b' }} /> 30% to 60% = warning</span>
        <span><i style={{ background: '#ef4444' }} /> &gt; 60% = high risk</span>
      </div>
    </div>
  )
}

export default BusFactorRiskVisualization
