import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Chart as ChartJS } from 'chart.js'
import App from './App'
import './styles.css'

/* Global Chart.js animation defaults — applies to every chart in the app.
   Longer durations and per-axis draws so each chart visibly "draws in". */
ChartJS.defaults.animation = {
  duration: 1200,
  easing: 'easeOutCubic',
}
ChartJS.defaults.animations = {
  ...(ChartJS.defaults.animations || {}),
  y:       { from: 0, type: 'number', duration: 1200, easing: 'easeOutCubic' },
  x:       { from: 0, type: 'number', duration: 1200, easing: 'easeOutCubic' },
  numbers: { duration: 1200, easing: 'easeOutCubic' },
  colors:  { duration: 600 },
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
