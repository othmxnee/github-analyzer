import '../styles/Timeline.css'

/* Render a small inline delta indicator.
 *
 *   <DeltaBadge pct={23.4} />          → ↑ 23%   (green)
 *   <DeltaBadge pct={-12} />           → ↓ 12%   (red)
 *   <DeltaBadge pct={0} />             → ◦ 0%    (neutral)
 *   <DeltaBadge pct={null} />          → "new"   (no prior period)
 *   <DeltaBadge absDiff={-0.04} format="abs" /> → -0.04 (for Gini)
 *   <DeltaBadge previous={42} format="vs" current={60} /> → vs 42
 *
 * Inverted: when `inverted` is true, "down" is good (e.g. Gini, KCI, risk).
 */
export default function DeltaBadge({
  pct,
  absDiff,
  previous,
  current,
  format = 'pct',
  inverted = false,
  size = 'sm',
  label,
}) {
  if (format === 'vs') {
    return (
      <span className={`delta-badge delta-badge--neutral delta-badge--${size}`} title="Previous period">
        vs {formatNum(previous)}
      </span>
    )
  }

  if (pct === null || pct === undefined) {
    // No prior value — either "new in window" or undefined
    if (previous === null || previous === undefined || previous === 0) {
      return (
        <span className={`delta-badge delta-badge--new delta-badge--${size}`} title="New in this window">
          new
        </span>
      )
    }
    return null
  }

  const isUp = pct > 0.5
  const isDown = pct < -0.5
  const direction = isUp ? 'up' : isDown ? 'down' : 'flat'

  // Green = "good", red = "bad". By default up=good.
  const good = inverted ? isDown : isUp
  const bad  = inverted ? isUp   : isDown
  const tone = good ? 'good' : bad ? 'bad' : 'flat'

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '◦'

  let text
  if (format === 'abs' && absDiff !== undefined && absDiff !== null) {
    text = `${absDiff > 0 ? '+' : ''}${absDiff.toFixed(2)}`
  } else {
    const magnitude = Math.abs(pct)
    text = magnitude >= 100 ? `${Math.round(magnitude)}%` : `${magnitude.toFixed(magnitude < 10 ? 1 : 0)}%`
  }

  return (
    <span className={`delta-badge delta-badge--${tone} delta-badge--${size}`} title={label || `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs previous period`}>
      <span className="delta-badge-arrow">{arrow}</span>
      {text}
    </span>
  )
}

function formatNum(n) {
  if (n === null || n === undefined) return '—'
  if (typeof n !== 'number') return String(n)
  if (Math.abs(n) >= 1000) return n.toLocaleString()
  if (Math.abs(n) < 1 && n !== 0) return n.toFixed(3)
  return String(Math.round(n * 100) / 100)
}
