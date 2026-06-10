import { useState, Component } from 'react'
import TimelineSelector, { DEFAULT_TIMELINE, describeTimeline } from './TimelineSelector'
import DeltaBadge from './DeltaBadge'
import useTimelineMetric from '../hooks/useTimelineMetric'
import '../styles/Timeline.css'

/* Inline error boundary so a chart crash doesn't take out the card chrome. */
class CardErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 14, color: 'var(--red)', fontSize: 12, fontFamily: 'var(--mono)' }}>
          Chart unavailable — {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

/* ─────────────────────────────────────────
   TimelineCard
   ---------------------------------------
   Drop-in replacement for ChartCard for any metric we have a backend
   /metric/<name> endpoint for. Owns its own timeline state.

   children is a render-prop:
     ({ current, previous, delta, loading }) => ReactNode

   `fallback` is the original (all-time) data the chart accepts — used
   when the user is on "All time" without comparison, so we don't hit the
   network unnecessarily.
───────────────────────────────────────── */
export default function TimelineCard({
  title,
  sub,
  metric,
  repoUrl,
  fallback,
  initialTimeline = DEFAULT_TIMELINE,
  allowCompare = true,
  /** delta hint: 'up_good' (default) or 'down_good' for metrics where less is better */
  deltaDirection = 'up_good',
  /** how to read the aggregate delta out of the payload; defaults to delta.aggregate */
  deltaPath = (delta) => delta?.aggregate,
  /** human label for the aggregate metric, e.g. "commits", "modifications" */
  aggregateLabel = 'total',
  /** optional node rendered in the header controls row (e.g. a "See all" button) */
  headerAction,
  children,
}) {
  const [timeline, setTimeline] = useState(initialTimeline)
  const { data, loading, error, usingFallback } = useTimelineMetric(metric, repoUrl, timeline)

  const current  = usingFallback ? fallback : data?.current
  const previous = usingFallback ? null     : data?.previous
  const delta    = usingFallback ? null     : data?.delta
  const warning  = usingFallback ? null     : data?.warning
  const compareUnavailable = usingFallback ? null : data?.compare_unavailable
  const compareWindow      = usingFallback ? null : data?.compare_window

  const agg = delta ? deltaPath(delta) : null
  const showAggregate = !!agg && timeline.compare
  const compareCaption = compareWindow ? formatCompareCaption(compareWindow) : null

  return (
    <div className="card tl-card">
      <div className="card-title tl-card-title">
        <span className="tl-card-title-text" style={{ fontWeight: 600, fontSize: 12, color: 'var(--t)' }}>{title}</span>
        {sub && <span className="tl-card-sub" style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{sub}</span>}
        <div className="tl-card-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerAction}
          <TimelineSelector
            value={timeline}
            onChange={setTimeline}
            allowCompare={allowCompare}
          />
        </div>
      </div>

      {(showAggregate || warning || compareUnavailable) && (
        <div className="tl-strip">
          {showAggregate && (
            <div className="tl-strip-stat">
              <span className="tl-strip-num">{formatNum(agg.current)}</span>
              <span className="tl-strip-lbl">{aggregateLabel}</span>
              <DeltaBadge
                pct={agg.pct}
                absDiff={agg.abs_diff}
                previous={agg.previous}
                inverted={deltaDirection === 'down_good'}
                size="md"
              />
              <span className="tl-strip-prev">
                vs {formatNum(agg.previous)} in <strong>{compareCaption || 'previous period'}</strong>
              </span>
            </div>
          )}
          {compareUnavailable && (
            <div className="tl-strip-warn" title={compareUnavailable}>
              ⚠ Comparison unavailable — {compareUnavailable}
            </div>
          )}
          {warning && <div className="tl-strip-warn">⚠ {warning}</div>}
        </div>
      )}

      <div style={{ padding: 18, position: 'relative' }}>
        {loading && (
          <div className="tl-loader-overlay">
            <div className="tl-loader-spinner" />
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 12, padding: 8 }}>
            Couldn’t load timeline data: {error}
          </div>
        )}
        <CardErrorBoundary>
          {children({ current, previous, delta, loading, timeline })}
        </CardErrorBoundary>
        {/* Empty-state guard for windowed slices */}
        {!loading && !error && current !== undefined && isEmptyData(current) && timeline.preset !== 'all' && (
          <div className="tl-empty">
            No activity in <strong>{describeTimeline(timeline)}</strong>.
          </div>
        )}
      </div>
    </div>
  )
}

function isEmptyData(d) {
  if (!d) return true
  if (Array.isArray(d)) return d.length === 0
  if (d.items && Array.isArray(d.items)) return d.items.length === 0
  if (d.series && Array.isArray(d.series)) return d.series.length === 0
  if (d.points && Array.isArray(d.points)) return d.points.length === 0
  if (d.nodes && Array.isArray(d.nodes)) return d.nodes.length === 0
  if (d.ids && Array.isArray(d.ids)) return d.ids.length === 0
  return false
}

function formatCompareCaption(cw) {
  if (!cw) return null
  if (cw.mode === 'average') return cw.label || 'project average'
  const start = (cw.start || '').slice(0, 10)
  const end   = (cw.end   || '').slice(0, 10)
  if (!start && !end) return cw.label || null
  const range = `${start} → ${end}`
  if (cw.mode === 'last_year') return `${range} (same period last year)`
  return `${range} (previous period)`
}

function formatNum(n) {
  if (n === null || n === undefined) return '—'
  if (typeof n !== 'number') return String(n)
  if (Math.abs(n) >= 1000) return n.toLocaleString()
  return String(Math.round(n * 1000) / 1000)
}
