import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const [enabled, setEnabled] = useState(false)
  const [alerts, setAlerts] = useState([])
  const { grid, tick } = useChartColors()

  useEffect(() => {
    let alive = true
    getHistory(repoUrl).then(d => { if (alive) { setRuns(d.runs || []); setEnabled(!!d.enabled) } }).catch(() => {})
    getAlerts(repoUrl).then(d => { if (alive) setAlerts(d.alerts || []) }).catch(() => {})
    return () => { alive = false }
  }, [repoUrl])

  const series = [...runs].reverse()       // oldest -> newest
  const showChart = series.length >= 2
  if (!enabled) return null                // server keeps no history: dashboard unchanged

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

  const last = series[series.length - 1]
  return (
    <div className="rh-grid">
      {showChart ? (
        <Card title="History" sub={`${series.length} analyses`}>
          <div style={{ height: 220 }}><Line data={data} options={options} /></div>
        </Card>
      ) : (
        <Card title="History" sub={series.length ? '1 analysis saved' : 'tracking'}>
          <div className="rh-empty">
            {last && <p>Saved on <b>{last.finished_at.slice(0, 10)}</b>: health <b>{last.health_score}</b>, bus factor <b>{last.bus_factor}</b>.</p>}
            <p>Click <b>Watch</b> at the top to re-check this repository every night and get an email when it gets riskier.
               The trend chart appears here from the next analysis.</p>
            <p><Link to="/portfolio">My repositories</Link> lists everything you watch, with the people who are single points of failure across them.</p>
          </div>
        </Card>
      )}
      {alerts.length > 0 ? (
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
      ) : (
        <Card title="Recent alerts" sub="none">
          <div className="rh-empty">
            <p>No alerts for this repository. Alerts are raised when a nightly re-check finds the bus factor dropped,
               the health score fell, orphaned knowledge grew, a main code owner went quiet, or a file became high risk.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
