import { Chart as ChartJS } from 'chart.js'

/* Global Chart.js animation defaults (imported by the dashboard, so the
   landing page does not download Chart.js) — applies to every chart in the app.
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
