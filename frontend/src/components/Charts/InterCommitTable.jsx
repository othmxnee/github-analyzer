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

function InterCommitTable({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <p style={{ color: '#9ca3af' }}>No inter-commit time data available</p>
  }

  const entries = Object.entries(data)
  const sortedData = entries.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1])).slice(0, 30)

  const chartData = {
    labels: sortedData.map(([dev]) => dev.substring(0, 25) + (dev.length > 25 ? '...' : '')),
    datasets: [
      {
        label: 'Median Days',
        data: sortedData.map(([, days]) => parseFloat(days)),
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
          text: 'Median Days',
          color: '#9ca3af'
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
        Lower values indicate more frequent commits. Only shows developers with 50+ commits.
      </p>
    </div>
  )
}

export default InterCommitTable
