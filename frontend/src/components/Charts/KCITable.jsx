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

function KCITable({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No KCI data available</p>
  }

  const sortedData = [...data].sort((a, b) => b.kci - a.kci).slice(0, 10)

  const chartData = {
    labels: sortedData.map(d => d.file.length > 35 ? d.file.substring(0, 35) + '...' : d.file),
    datasets: [
      {
        label: 'KCI (%)',
        data: sortedData.map(d => d.kci * 100),
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
        ticks: {
          color: '#9ca3af',
          callback: value => `${value}%`
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af' }
      }
    }
  }

  return (
    <div>
      <div style={{ height: '450px' }}>
        <Bar data={chartData} options={options} />
      </div>
      <p style={{
        marginTop: '12px',
        fontSize: '0.8rem',
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        KCI = Knowledge Concentration Index. Higher values indicate concentrated ownership.
      </p>
    </div>
  )
}

export default KCITable
