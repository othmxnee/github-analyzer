import DeltaBadge from './DeltaBadge'
import '../styles/Timeline.css'

/* Per-item comparison rows: name + current value + delta badge.
 *
 *   items: [{ key, current, previous, pct }]   from backend delta.per_item
 *   valueLabel: short word for the value column header (e.g. "commits")
 *   keyShorten: optional fn to truncate the key (e.g. file path tail)
 */
export default function ComparisonList({
  items = [],
  valueLabel = 'value',
  keyShorten = (k) => k,
  inverted = false,
  max = 10,
}) {
  if (!items || items.length === 0) return null
  const rows = items.slice(0, max)
  return (
    <div className="tl-compare-list">
      <div className="tl-compare-list-head">Per-item change vs previous period</div>
      {rows.map(row => (
        <div className="tl-compare-row" key={row.key}>
          <span className="tl-compare-row-name" title={row.key}>{keyShorten(row.key)}</span>
          <span className="tl-compare-row-val">{row.current} {valueLabel}</span>
          <DeltaBadge
            pct={row.pct}
            previous={row.previous}
            inverted={inverted}
          />
        </div>
      ))}
    </div>
  )
}
