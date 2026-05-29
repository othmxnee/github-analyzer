import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

function TimelineChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--t2)' }}>No data available</p>
  }

  const chartData = {
    labels: data.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }),
    datasets: [
      {
        label: 'Modifications',
        data: data.map(d => d.count),
        borderColor: '#3B6EEA',
        backgroundColor: 'rgba(59,110,234,0.15)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111520',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#EEEEF3',
        bodyColor: '#9BA8C8',
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: '#9BA8C8',
          font: { size: 10 },
          maxTicksLimit: 5,
          precision: 0,
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#9BA8C8',
          font: { size: 10 },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 20,
        }
      }
    }
  }

  return (
    <div style={{ height: '380px', position: 'relative' }}>
      <Line data={chartData} options={options} />
    </div>
  )
}

export default TimelineChart