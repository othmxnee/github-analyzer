import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js'
import { getAlerts, getHistory } from '../services/api'
import { useChartColors } from '../hooks/useTheme'
import '../styles/Watch.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

/* Stored analyses over time and the alerts they raised. Renders nothing when
   the server keeps no history (no database) or there is nothing to show yet,
   so the dashboard looks exactly as before in that case. */
export default function RepoHistory({ repoUrl, Card }) {
  const [runs, setRuns] = useState([])
  const [alerts, setAlerts] = useState([])
  const { grid, tick } = useChartColors()

  useEffect(() => {
    let alive = true
    getHistory(repoUrl).then(d => { if (alive) setRuns(d.runs || []) }).catch(() => {})
    getAlerts(repoUrl).then(d => { if (alive) setAlerts(d.alerts || []) }).catch(() => {})
    return () => { alive = false }
  }, [repoUrl])

  const series = [...runs].reverse()       // oldest -> newest
  const showChart = series.length >= 2
  if (!showChart && alerts.length === 0) return null

  const data = {
    labels: series.map(r => r.finished_at.slice(0, 10)),
    datasets: [
      { label: 'Health score', data: series.map(r => r.health_score), borderColor: '#3B6EEA',
        backgroundColor: '#3B6EEA', yAxisID: 'y', tension: 0.25, pointRadius: 3 },
      { label: 'Bus factor', data: series.map(r => r.bus_factor), borderColor: '#F59E0B',
        backgroundColor: '#F59E0B', yAxisID: 'y1', tension: 0.25, pointRadius: 3 },
    ],
  }
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: { color: tick, boxWidth: 10 } } },
    scales: {
      x: { grid: { color: grid }, ticks: { color: tick, maxRotation: 0, autoSkip: true } },
      y: { min: 0, max: 100, grid: { color: grid }, ticks: { color: tick }, title: { display: true, text: 'Health', color: tick } },
      y1: { position: 'right', min: 0, grid: { drawOnChartArea: false }, ticks: { color: tick, precision: 0 },
            title: { display: true, text: 'Bus factor', color: tick } },
    },
  }

  return (
    <div className="rh-grid">
      {showChart && (
        <Card title="History" sub={`${series.length} analyses`}>
          <div style={{ height: 220 }}><Line data={data} options={options} /></div>
        </Card>
      )}
      {alerts.length > 0 && (
        <Card title="Recent alerts" sub={`${alerts.length}`}>
          <ul className="rh-alerts">
            {alerts.slice(0, 8).map(a => (
              <li key={a.id} className={`rh-alert ${a.severity}`}>
                <div className="rh-alert-title">{a.title}</div>
                <div className="rh-alert-meta">{a.created_at.slice(0, 10)} · {a.message}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
