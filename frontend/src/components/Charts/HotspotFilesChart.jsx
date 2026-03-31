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

function HotspotFilesChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No hotspot data available</p>
  }

  const chartData = {
    labels: data.map(d => d.file.length > 30 ? d.file.substring(0, 30) + '...' : d.file),
    datasets: [
      {
        label: 'Modifications',
        data: data.map(d => d.modifications),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: '#ef4444',
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
        ticks: { color: '#9ca3af', maxRotation: 60 }
      }
    }
  }

  return (
    <div style={{ height: '450px' }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default HotspotFilesChart
