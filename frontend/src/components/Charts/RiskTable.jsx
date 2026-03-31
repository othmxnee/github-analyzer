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

function RiskTable({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No risk data available</p>
  }

  const sortedData = [...data].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10)

  const chartData = {
    labels: sortedData.map(d => d.file.length > 35 ? d.file.substring(0, 35) + '...' : d.file),
    datasets: [
      {
        label: 'Risk Score',
        data: sortedData.map(d => d.risk_score),
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
          text: 'Risk Score',
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
        Risk = In-Degree × KCI. High risk indicates files that are both architecturally critical and have concentrated ownership.
      </p>
    </div>
  )
}

export default RiskTable
