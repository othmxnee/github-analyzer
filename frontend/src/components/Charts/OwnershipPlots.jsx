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

function OwnershipPlots({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No ownership plot data available</p>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
      {data.map(item => {
        const chartData = {
          labels: item.developers.map(d => d.substring(0, 20) + (d.length > 20 ? '...' : '')),
          datasets: [
            {
              label: 'Ownership Share',
              data: item.ownership.map(v => v * 100),
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              borderColor: '#3b82f6',
              borderWidth: 1
            }
          ]
        }

        const options = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: item.file,
              color: '#e5e7eb',
              font: { size: 12 }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              ticks: { color: '#9ca3af' },
              title: {
                display: true,
                text: 'Ownership %',
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
          <div key={item.file} style={{ height: '300px' }}>
            <Bar data={chartData} options={options} />
          </div>
        )
      })}
    </div>
  )
}

export default OwnershipPlots
