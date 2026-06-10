import { useEffect, useMemo, useRef, useState } from 'react'
import '../styles/MetricDetailModal.css'

/* ─────────────────────────────────────────────────────────────────────
   MetricDetailModal
   ---------------------------------------------------------------------
   One reusable "See all" overlay for every top-N card. The cards keep
   showing their top-N chart/table; this modal shows the COMPLETE dataset
   as a searchable, sortable, virtualized table with CSV export.

   Open it by setting `detail` to:
     {
       title, subtitle?, note?,
       fileName?,                       // CSV download name (no extension)
       searchPlaceholder?, searchKeys?, // default: every column key
       defaultSort?: { key, dir },      // dir: 'asc' | 'desc'
       columns: [{ key, label, align?, width?, numeric?, mono?, render? }],
       rows:    [ { ...row } ],
     }
   Pass `onClose` to clear it.
───────────────────────────────────────────────────────────────────── */

const ROW_H = 36          // fixed row height (px) — required for virtualization
const VIEWPORT_H = 460    // scrollable body height (px)
const OVERSCAN = 8        // extra rows above/below the viewport

function csvCell(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildCSV(columns, rows) {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows
    .map((r) => columns.map((c) => csvCell(c.csv ? c.csv(r[c.key], r) : r[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}`
}

function gridStyle(columns) {
  return {
    display: 'grid',
    gridTemplateColumns: columns.map((c) => c.width || '1fr').join(' '),
  }
}

/* Small "See all (N)" button for a card header. */
export function SeeAllButton({ count, onClick, label = 'See all' }) {
  return (
    <button type="button" className="mdm-seeall" onClick={onClick}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 3h6v6M21 3l-9 9M9 21H3v-6M3 21l9-9" />
      </svg>
      <span>{label}{count != null ? ` (${count.toLocaleString()})` : ''}</span>
    </button>
  )
}

export default function MetricDetailModal({ detail, onClose }) {
  const open = !!detail
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(null)        // { key, dir }
  const [scrollTop, setScrollTop] = useState(0)
  const bodyRef = useRef(null)

  // Reset view whenever a new metric is opened.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setSort(detail.defaultSort || null)
    setScrollTop(0)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }, [detail, open])

  // Esc closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const columns = detail?.columns || []
  const allRows = detail?.rows || []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allRows
    const keys = detail.searchKeys || columns.map((c) => c.key)
    return allRows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)))
  }, [query, allRows, detail, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (col?.numeric) return ((Number(av) || 0) - (Number(bv) || 0)) * dir
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir
    })
  }, [filtered, sort, columns])

  if (!open) return null

  const total = sorted.length
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const end = Math.min(total, Math.ceil((scrollTop + VIEWPORT_H) / ROW_H) + OVERSCAN)
  const visible = sorted.slice(start, end)

  const toggleSort = (key) => {
    setSort((s) => {
      const numeric = columns.find((c) => c.key === key)?.numeric
      if (!s || s.key !== key) return { key, dir: numeric ? 'desc' : 'asc' }
      return { key, dir: s.dir === 'desc' ? 'asc' : 'desc' }
    })
    setScrollTop(0)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  const exportCSV = () => {
    const blob = new Blob([buildCSV(columns, sorted)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${detail.fileName || 'metric'}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const grid = gridStyle(columns)

  return (
    <div
      className="mdm-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="mdm-panel" role="dialog" aria-modal="true" aria-label={detail.title}>
        <div className="mdm-head">
          <div className="mdm-title-wrap">
            <div className="mdm-title">{detail.title}</div>
            {detail.subtitle && <div className="mdm-sub">{detail.subtitle}</div>}
          </div>
          <button className="mdm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {detail.content ? (
          <div className="mdm-custom">{detail.content}</div>
        ) : (
        <>
        <div className="mdm-toolbar">
          <input
            className="mdm-search"
            placeholder={detail.searchPlaceholder || 'Search…'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setScrollTop(0)
              if (bodyRef.current) bodyRef.current.scrollTop = 0
            }}
            autoFocus
          />
          <span className="mdm-count">{total.toLocaleString()} {total === 1 ? 'row' : 'rows'}</span>
          <button className="mdm-export" onClick={exportCSV} disabled={!total}>Export CSV</button>
        </div>

        <div className="mdm-table">
          <div className="mdm-row mdm-header-row" style={grid}>
            {columns.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`mdm-th${c.align === 'right' ? ' right' : ''}`}
                onClick={() => toggleSort(c.key)}
              >
                <span>{c.label}</span>
                {sort?.key === c.key && <span className="mdm-arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </button>
            ))}
          </div>

          <div
            className="mdm-body"
            ref={bodyRef}
            style={{ height: VIEWPORT_H }}
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          >
            {total === 0 ? (
              <div className="mdm-empty">No matching rows.</div>
            ) : (
              <div style={{ height: total * ROW_H, position: 'relative' }}>
                <div style={{ transform: `translateY(${start * ROW_H}px)` }}>
                  {visible.map((r, i) => (
                    <div key={start + i} className="mdm-row" style={{ ...grid, height: ROW_H }}>
                      {columns.map((c) => {
                        const raw = r[c.key]
                        return (
                          <div
                            key={c.key}
                            className={`mdm-td${c.align === 'right' ? ' right' : ''}${c.mono ? ' mono' : ''}`}
                            title={c.mono ? String(raw ?? '') : undefined}
                          >
                            {c.render ? c.render(raw, r) : raw}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}

        {detail.note && <div className="mdm-note">{detail.note}</div>}
      </div>
    </div>
  )
}
