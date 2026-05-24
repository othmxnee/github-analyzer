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

function TopDevelopersChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--t2)' }}>No data available</p>
  }

  const chartData = {
    labels: data.map(d =>
      d.developer.substring(0, 20) + (d.developer.length > 20 ? '…' : '')
    ),
    datasets: [
      {
        label: 'Commits',
        data: data.map(d => d.commits),
        backgroundColor: 'rgba(59,110,234,0.5)',
        borderColor: '#3B6EEA',
        borderWidth: 1,
        borderRadius: 3,
      }
    ]
  }

  const maxVal = Math.max(...data.map(d => d.commits))

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
        suggestedMax: maxVal * 1.1,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: '#9BA8C8',
          font: { size: 11 },
          maxTicksLimit: 6,
          precision: 0,
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#9BA8C8',
          font: { size: 10 },
          maxRotation: 45,
        }
      }
    }
  }

  return (
    <div style={{ height: '300px', position: 'relative' }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default TopDevelopersChart