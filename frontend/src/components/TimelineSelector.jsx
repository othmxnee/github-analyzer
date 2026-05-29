import { useEffect, useRef, useState } from 'react'
import '../styles/Timeline.css'

/* ─────────────────────────────────────────
   Preset windows — each returns {start, end} as ISO YYYY-MM-DD strings
   relative to "now". `null` means open-ended.
───────────────────────────────────────── */
function isoDay(d) {
  return d.toISOString().slice(0, 10)
}

function presetRange(preset) {
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const startOfYear  = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))

  const daysAgo = (n) => {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - n)
    return d
  }

  const tomorrow = (() => { const d = new Date(today); d.setUTCDate(d.getUTCDate() + 1); return d })()

  switch (preset) {
    case 'last_7d':     return { start: isoDay(daysAgo(7)),   end: isoDay(tomorrow) }
    case 'last_30d':    return { start: isoDay(daysAgo(30)),  end: isoDay(tomorrow) }
    case 'last_90d':    return { start: isoDay(daysAgo(90)),  end: isoDay(tomorrow) }
    case 'this_month':  return { start: isoDay(startOfMonth), end: isoDay(tomorrow) }
    case 'last_month': {
      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      const lastMonthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      return { start: isoDay(lastMonthStart), end: isoDay(lastMonthEnd) }
    }
    case 'this_year':   return { start: isoDay(startOfYear),  end: isoDay(tomorrow) }
    case 'all':         return { start: null, end: null }
    default:            return { start: null, end: null }
  }
}

const PRESETS = [
  { id: 'last_7d',    label: 'Last 7 days' },
  { id: 'last_30d',   label: 'Last 30 days' },
  { id: 'last_90d',   label: 'Last 90 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_year',  label: 'This year' },
  { id: 'all',        label: 'All time' },
]

export function describeTimeline(timeline) {
  if (timeline.preset === 'custom') {
    return `${timeline.start || '…'} → ${timeline.end || '…'}`
  }
  return PRESETS.find(p => p.id === timeline.preset)?.label || 'All time'
}

/* Resolve a timeline state object → {start, end} ISO strings (or null). */
export function resolveTimeline(timeline) {
  if (timeline.preset === 'custom') {
    return { start: timeline.start || null, end: timeline.end || null }
  }
  return presetRange(timeline.preset)
}

export const DEFAULT_TIMELINE = {
  preset: 'all',
  start: null,
  end: null,
  compare: false,
  compareMode: 'previous',
}

export const COMPARE_MODES = [
  { id: 'previous',  label: 'Previous period', hint: 'Same length, immediately before' },
  { id: 'last_year', label: 'Same period, last year', hint: 'Exact dates, one year earlier' },
  { id: 'average',   label: 'Project average', hint: 'Avg of equivalent windows in history' },
]

export function compareModeLabel(id) {
  return COMPARE_MODES.find(m => m.id === id)?.label || id
}

/* ─────────────────────────────────────────
   The selector itself
───────────────────────────────────────── */
export default function TimelineSelector({ value, onChange, allowCompare = true }) {
  const [open, setOpen] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const [customStart, setCustomStart] = useState(value.start || '')
  const [customEnd,   setCustomEnd]   = useState(value.end || '')
  const popRef = useRef(null)
  const modeRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => {
    if (!modeOpen) return
    const onClick = (e) => {
      if (modeRef.current && !modeRef.current.contains(e.target)) setModeOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [modeOpen])

  const choosePreset = (id) => {
    if (id === 'custom') {
      // Open custom popover; keep dropdown showing the inputs
      onChange({ ...value, preset: 'custom', start: customStart || null, end: customEnd || null })
      return
    }
    onChange({ ...value, preset: id, start: null, end: null })
    setOpen(false)
  }

  const applyCustom = () => {
    onChange({ ...value, preset: 'custom', start: customStart || null, end: customEnd || null })
    setOpen(false)
  }

  const label = describeTimeline(value)
  const isCompareDisabled = value.preset === 'all'

  return (
    <div className="tl-selector" ref={popRef}>
      <button
        type="button"
        className={`tl-pill ${open ? 'tl-pill--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Choose time window"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="tl-pill-label">{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {allowCompare && (
        <div className="tl-compare-group">
          <button
            type="button"
            className={`tl-compare ${value.compare && !isCompareDisabled ? 'tl-compare--on' : ''} ${isCompareDisabled ? 'tl-compare--disabled' : ''}`}
            disabled={isCompareDisabled}
            onClick={() => onChange({ ...value, compare: !value.compare })}
            title={isCompareDisabled ? 'Pick a finite window to enable comparison' : 'Toggle comparison'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
              <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
            Compare
          </button>

          {value.compare && !isCompareDisabled && (
            <div className="tl-mode" ref={modeRef}>
              <button
                type="button"
                className={`tl-mode-pill ${modeOpen ? 'tl-mode-pill--open' : ''}`}
                onClick={() => setModeOpen(o => !o)}
                title="What to compare against"
              >
                <span className="tl-mode-prefix">to</span>
                <span className="tl-mode-label">{compareModeLabel(value.compareMode || 'previous')}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {modeOpen && (
                <div className="tl-pop tl-pop--mode">
                  <div className="tl-pop-head">Compare against</div>
                  {COMPARE_MODES.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`tl-pop-item tl-pop-item--mode ${value.compareMode === m.id ? 'tl-pop-item--active' : ''}`}
                      onClick={() => {
                        onChange({ ...value, compareMode: m.id })
                        setModeOpen(false)
                      }}
                    >
                      <div className="tl-pop-item-main">
                        <span>{m.label}</span>
                        {value.compareMode === m.id && <span className="tl-pop-check">✓</span>}
                      </div>
                      <div className="tl-pop-item-hint">{m.hint}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="tl-pop">
          <div className="tl-pop-head">Time window</div>
          {PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`tl-pop-item ${value.preset === p.id ? 'tl-pop-item--active' : ''}`}
              onClick={() => choosePreset(p.id)}
            >
              {p.label}
              {value.preset === p.id && <span className="tl-pop-check">✓</span>}
            </button>
          ))}
          <div className="tl-pop-divider" />
          <div className={`tl-pop-custom ${value.preset === 'custom' ? 'tl-pop-custom--active' : ''}`}>
            <div className="tl-pop-custom-label">Custom range</div>
            <div className="tl-pop-custom-row">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                aria-label="Start date"
              />
              <span>→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                aria-label="End date"
              />
            </div>
            <button
              type="button"
              className="tl-pop-apply"
              disabled={!customStart && !customEnd}
              onClick={applyCustom}
            >
              Apply custom range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
