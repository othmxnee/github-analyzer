import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

function CommitFrequencyChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No developer activity data available</p>
  }

  const dateSet = new Set()
  data.forEach(series => {
    ;(series.points || []).forEach(point => dateSet.add(point.date))
  })
  const sortedDates = Array.from(dateSet).sort((a, b) => new Date(a) - new Date(b))

  const palette = ['#4f46e5', '#f97316', '#22c55e', '#ef4444', '#8b5cf6']

  const chartData = {
    labels: sortedDates.map(dateStr => {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }),
    datasets: data.map((series, idx) => {
      const countsByDate = new Map((series.points || []).map(p => [p.date, p.count]))
      return {
        label: series.developer || `Developer ${idx + 1}`,
        data: sortedDates.map(date => countsByDate.get(date) || 0),
        borderColor: palette[idx % palette.length],
        backgroundColor: palette[idx % palette.length],
        fill: false,
        tension: 0.2,
        pointRadius: 2
      }
    })
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: { color: '#9ca3af' }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Changes',
          color: '#9ca3af'
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9ca3af' }
      },
      x: {
        title: {
          display: true,
          text: 'Time',
          color: '#9ca3af'
        },
        grid: { display: false },
        ticks: { color: '#9ca3af', maxRotation: 45 }
      }
    }
  }

  return (
    <div style={{ height: '450px' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}

export default CommitFrequencyChart
