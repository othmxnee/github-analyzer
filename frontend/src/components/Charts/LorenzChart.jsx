import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function LorenzChart({ data, gini }) {
  if (!data || !data.x || !data.y) {
    return <p style={{ color: 'var(--t2)' }}>No data available</p>
  }

  // Lorenz curve has N+1 points for N developers. With <2 contributors,
  // inequality is undefined — showing Gini=0 ("perfect equality") is misleading.
  if (data.x.length <= 2) {
    return (
      <div style={{
        height: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 32px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>—</div>
        <div style={{ color: 'var(--t)', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          Inequality metrics not applicable
        </div>
        <div style={{ color: 'var(--t2)', fontSize: 12, lineHeight: 1.6, maxWidth: 380 }}>
          The Gini coefficient and Lorenz curve require at least 2 contributors.
          This repository has a single developer who authored 100% of commits.
        </div>
      </div>
    )
  }

  const chartData = {
    datasets: [
      {
        label: 'Lorenz Curve',
        data: data.x.map((x, i) => ({ x, y: data.y[i] })),
        borderColor: '#3B6EEA',
        backgroundColor: 'rgba(59,110,234,0.15)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Perfect Equality',
        data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        borderColor: '#EF4444',
        borderDash: [5, 5],
        borderWidth: 1.5,
        fill: false,
        pointRadius: 0,
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,   // ← key fix: respects the container height
    plugins: {
      legend: {
        labels: {
          color: '#9BA8C8',
          font: { size: 11 },
          boxWidth: 12,
          padding: 12,
        }
      },
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
        max: 1,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: '#9BA8C8',
          font: { size: 10 },
          maxTicksLimit: 6,
        },
        title: {
          display: true,
          text: 'Cumulative Share of Contributions',
          color: '#5A6380',
          font: { size: 10 },
        }
      },
      x: {
        type: 'linear',
        beginAtZero: true,
        max: 1,
        grid: { color: 'rgba(255,255,255,0.06)' },
        ticks: {
          color: '#9BA8C8',
          font: { size: 10 },
          maxTicksLimit: 6,
        },
        title: {
          display: true,
          text: 'Cumulative Share of Developers',
          color: '#5A6380',
          font: { size: 10 },
        }
      }
    }
  }

  return (
    <div>
      <div style={{ height: '260px', position: 'relative' }}>
        <Line data={chartData} options={options} />
      </div>
      {gini !== undefined && (
        <p style={{
          textAlign: 'center',
          marginTop: '10px',
          color: '#3B6EEA',
          fontWeight: 700,
          fontSize: 13,
          fontFamily: 'var(--mono, monospace)',
        }}>
          Gini Coefficient: {gini.toFixed(4)}
        </p>
      )}
    </div>
  )
}

export default LorenzChart