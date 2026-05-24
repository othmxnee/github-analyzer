import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip
} from 'chart.js'
import { useChartColors } from '../../hooks/useTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip)

function PageRankTable({ data }) {
  const { grid, tick, muted } = useChartColors()

  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--t3)' }}>No in-degree data available</p>
  }

  const sortedData = [...data].sort((a, b) => b.in_degree - a.in_degree).slice(0, 10)
  const fullPaths = sortedData.map(d => d.file)

  const chartData = {
    labels: sortedData.map(d => d.file.length > 35 ? '…' + d.file.slice(-33) : d.file),
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
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => fullPaths[items[0].dataIndex] || items[0].label,
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: grid },
        ticks: { color: tick },
        title: {
          display: true,
          text: 'In-Degree',
          color: tick
        }
      },
      x: {
        grid: { display: false },
        ticks: { color: tick }
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
        color: muted,
        fontStyle: 'italic'
      }}>
        Higher in-degree indicates architecturally important files with many dependencies.
      </p>
    </div>
  )
}

export default PageRankTable
