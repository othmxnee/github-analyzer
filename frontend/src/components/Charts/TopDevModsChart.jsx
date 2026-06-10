import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

function TopDevModsChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No data available</p>
  }

  const rows = data.slice(0, 10)

  const chartData = {
    labels: rows.map(d => d.developer.substring(0, 20) + (d.developer.length > 20 ? '...' : '')),
    datasets: [
      {
        label: 'Modifications',
        data: rows.map(d => d.modifications),
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderColor: '#667eea',
        borderWidth: 1
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' },
        title: {
          display: true,
          text: 'Modifications',
          color: '#9ca3af'
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', maxRotation: 45 }
      }
    }
  }

  return (
    <div style={{ height: '450px' }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default TopDevModsChart
