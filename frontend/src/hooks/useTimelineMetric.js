import { useEffect, useState, useRef } from 'react'
import { getMetricTimeline } from '../services/api'
import { resolveTimeline } from '../components/TimelineSelector'

/* Small in-memory cache keyed by metric|repo|start|end|compare so flipping
 * presets back and forth is instant. The backend caches too, but this keeps
 * the UI silent. */
const _cache = new Map()
const _key   = (metric, repoUrl, w) =>
  `${metric}|${repoUrl}|${w.start || ''}|${w.end || ''}|${w.compare ? '1' : '0'}|${w.compare ? (w.compareMode || 'previous') : ''}`

export function clearTimelineCache() { _cache.clear() }

export default function useTimelineMetric(metric, repoUrl, timeline) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const reqId = useRef(0)

  // If user is on "All time" without comparison, no point hitting the
  // windowed endpoint — caller already has the global data.
  const isAllTimeNoCompare = timeline.preset === 'all' && !timeline.compare

  useEffect(() => {
    if (!repoUrl || !metric) return
    if (isAllTimeNoCompare) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const resolved = resolveTimeline(timeline)
    const window = {
      ...resolved,
      compare:     !!timeline.compare,
      compareMode: timeline.compareMode || 'previous',
    }
    const key = _key(metric, repoUrl, window)

    if (_cache.has(key)) {
      setData(_cache.get(key))
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const myId = ++reqId.current

    getMetricTimeline(metric, repoUrl, window)
      .then(res => {
        if (myId !== reqId.current) return
        _cache.set(key, res)
        setData(res)
        setLoading(false)
      })
      .catch(err => {
        if (myId !== reqId.current) return
        setError(err.message || 'Failed to load metric')
        setLoading(false)
      })
  }, [metric, repoUrl, timeline.preset, timeline.start, timeline.end, timeline.compare, timeline.compareMode, isAllTimeNoCompare])

  return { data, loading, error, usingFallback: isAllTimeNoCompare }
}
