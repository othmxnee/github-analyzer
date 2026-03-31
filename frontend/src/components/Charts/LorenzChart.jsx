import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip
} from 'chart.js'

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip)

function LorenzChart({ data, gini }) {
  if (!data || !data.x || !data.y) {
    return <p style={{ color: '#9ca3af' }}>No data available</p>
  }

  const chartData = {
    datasets: [
      {
        label: 'Lorenz Curve',
        data: data.x.map((x, i) => ({ x, y: data.y[i] })),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        fill: true,
        tension: 0.1
      },
      {
        label: 'Perfect Equality',
        data: [
          { x: 0, y: 0 },
          { x: 1, y: 1 }
        ],
        borderColor: '#ef4444',
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: { color: '#9ca3af' }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 1,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' },
        title: {
          display: true,
          text: 'Cumulative Share of Contributions',
          color: '#9ca3af'
        }
      },
      x: {
        type: 'linear',
        beginAtZero: true,
        max: 1,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' },
        title: {
          display: true,
          text: 'Cumulative Share of Developers',
          color: '#9ca3af'
        }
      }
    }
  }

  return (
    <div>
      <div style={{ height: '300px' }}>
        <Line data={chartData} options={options} />
      </div>
      {gini !== undefined && (
        <p style={{ 
          textAlign: 'center', 
          marginTop: '12px', 
          color: '#667eea',
          fontWeight: 'bold'
        }}>
          Gini Coefficient: {gini.toFixed(4)}
        </p>
      )}
    </div>
  )
}

export default LorenzChart
