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

function PageRankTable({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No in-degree data available</p>
  }

  const sortedData = [...data].sort((a, b) => b.in_degree - a.in_degree).slice(0, 10)

  const chartData = {
    labels: sortedData.map(d => d.file.length > 35 ? d.file.substring(0, 35) + '...' : d.file),
    datasets: [
      {
        label: 'In-Degree',
        data: sortedData.map(d => d.in_degree),
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
          text: 'In-Degree',
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
        Higher in-degree indicates architecturally important files with many dependencies.
      </p>
    </div>
  )
}

export default PageRankTable
