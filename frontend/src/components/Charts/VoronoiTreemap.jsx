import { useEffect, useRef, useState } from 'react'
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'

// ---------------------------------------------------------------------------
// Heat colour  (white → red, log-normalised by modification count)
// ---------------------------------------------------------------------------
function logNorm(value, minVal, maxVal) {
  if (maxVal <= minVal) return 0.5
  const lo = Math.log1p(minVal)
  const hi = Math.log1p(maxVal)
  if (hi === lo) return 0.5
  return (Math.log1p(value) - lo) / (hi - lo)
}

const HEAT_STOPS = [
  [0.00, [255, 255, 255]],
  [0.25, [254, 202, 202]],
  [0.50, [248, 113, 113]],
  [0.75, [220,  38,  38]],
  [1.00, [127,  29,  29]],
]

function heatColor(t) {
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [t0, c0] = HEAT_STOPS[i - 1]
    const [t1, c1] = HEAT_STOPS[i]
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0)
      return `rgb(${Math.round(c0[0]+(c1[0]-c0[0])*u)},${Math.round(c0[1]+(c1[1]-c0[1])*u)},${Math.round(c0[2]+(c1[2]-c0[2])*u)})`
    }
  }
  return 'rgb(127,29,29)'
}

// ---------------------------------------------------------------------------
// KCI dot colour  (green → orange → red)
// ---------------------------------------------------------------------------
function kciDotColor(kci) {
  if (kci < 0)    return { bg: '#64748b', text: '#fff', label: 'N/A' }   // no data → slate
  if (kci < 0.50) return { bg: '#166534', text: '#fff', label: 'Low' }   // green
  if (kci < 0.75) return { bg: '#92400e', text: '#fff', label: 'Moderate' } // amber
  return              { bg: '#991b1b', text: '#fff', label: 'Critical' } // red
}

function intensityLabel(t) {
  if (t < 0.25) return 'Low'
  if (t < 0.55) return 'Medium'
  if (t < 0.80) return 'High'
  return 'Critical'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function VoronoiTreemap({ data }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [dims, setDims]       = useState({ w: 800, h: 520 })

  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  // ── resize observer ───────────────────────────────────────────────────
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width || 800
      setDims({ w, h: Math.round(w * 0.62) })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // ── draw ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const { w, h } = dims
    const values = nodes.map(n => n.value)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)

    const pts = nodes.map(n => ({
      ...n,
      px: n.x * w,
      py: n.y * h,
      t:  logNorm(n.value, minVal, maxVal),
    }))

    const delaunay = d3.Delaunay.from(pts, d => d.px, d => d.py)
    const voronoi  = delaunay.voronoi([0, 0, w, h])

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${w} ${h}`)
       .attr('width', '100%')
       .attr('height', h)

    const DOT_R  = 11   // dot radius in px
    const DOT_MARGIN = 8

    // ── cells ──
    const cellG = svg.append('g')

    pts.forEach((pt, i) => {
      const pathStr = voronoi.renderCell(i)
      if (!pathStr) return

      const g = cellG.append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', (event) => {
          g.select('path')
            .attr('stroke', '#f1f5f9')
            .attr('stroke-width', 2.5)
          setTooltip({ x: event.clientX, y: event.clientY, node: pt })
        })
        .on('mousemove', (event) => {
          setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
        })
        .on('mouseleave', () => {
          g.select('path')
            .attr('stroke', 'rgba(30,41,59,0.45)')
            .attr('stroke-width', 1)
          setTooltip(null)
        })

      // cell background
      g.append('path')
        .attr('d', pathStr)
        .attr('fill', heatColor(pt.t))
        .attr('stroke', 'rgba(30,41,59,0.45)')
        .attr('stroke-width', 1)

      // ── label (only if cell is large enough) ──
      const cell = voronoi.cellPolygon(i)
      if (!cell) return

      let area = 0
      for (let j = 0; j < cell.length - 1; j++) {
        area += cell[j][0] * cell[j + 1][1] - cell[j + 1][0] * cell[j][1]
      }
      area = Math.abs(area) / 2

      const cx = cell.slice(0, -1).reduce((s, p) => s + p[0], 0) / (cell.length - 1)
      const cy = cell.slice(0, -1).reduce((s, p) => s + p[1], 0) / (cell.length - 1)

      const textColor = pt.t < 0.35 ? '#1e293b' : '#f8fafc'
      const fontSize  = area > 6000 ? 12 : 10

      if (area >= 1800) {
        g.append('text')
          .attr('x', cx)
          .attr('y', cy)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('fill', textColor)
          .attr('font-size', fontSize)
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('font-weight', '500')
          .attr('pointer-events', 'none')
          .text(pt.label)

        if (area > 5000) {
          g.append('text')
            .attr('x', cx)
            .attr('y', cy + fontSize + 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', textColor)
            .attr('font-size', 9)
            .attr('font-family', 'Inter, system-ui, sans-serif')
            .attr('opacity', 0.75)
            .attr('pointer-events', 'none')
            .text(`${pt.value} mods`)
        }
      }

      // ── KCI dot (always shown, even on small cells) ──
      if (pt.kci === undefined || pt.kci === null) return

      // Find top-left corner of the cell bounding box for dot placement
      const xCoords = cell.slice(0, -1).map(p => p[0])
      const yCoords = cell.slice(0, -1).map(p => p[1])
      const cellLeft = Math.min(...xCoords)
      const cellTop  = Math.min(...yCoords)

      // Clamp dot so it stays inside the canvas
      const dotX = Math.min(
        Math.max(cellLeft + DOT_MARGIN + DOT_R, DOT_R + 2),
        w - DOT_R - 2
      )
      const dotY = Math.min(
        Math.max(cellTop + DOT_MARGIN + DOT_R, DOT_R + 2),
        h - DOT_R - 2
      )

      const { bg, text: dotTextColor } = kciDotColor(pt.kci)

      g.append('circle')
        .attr('cx', dotX)
        .attr('cy', dotY)
        .attr('r', DOT_R)
        .attr('fill', bg)
        .attr('stroke', 'rgba(255,255,255,0.6)')
        .attr('stroke-width', 1.5)
        .attr('pointer-events', 'none')

      g.append('text')
        .attr('x', dotX)
        .attr('y', dotY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', dotTextColor)
        .attr('font-size', 8)
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(pt.kci < 0 ? '?' : pt.kci.toFixed(2))
    })

  }, [nodes, edges, dims])

  // ── empty state ───────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <p style={{ color: '#9ca3af', padding: '1rem 0' }}>
        No Voronoi data available. Re-run the analysis to generate import-based layout.
      </p>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={wrapRef}>

      {/* ── legends ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 10,
        fontSize: 12, color: 'var(--color-text-secondary)',
      }}>
        {/* heat legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Low activity</span>
          <div style={{
            width: 120, height: 10, borderRadius: 4,
            background: 'linear-gradient(to right, #fff, #fca5a5, #dc2626, #7f1d1d)',
            border: '0.5px solid var(--color-border-tertiary)',
          }} />
          <span>High activity</span>
        </div>

        {/* KCI dot legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[
            { bg: '#166534', label: 'KCI < 0.50 — distributed' },
            { bg: '#92400e', label: 'KCI 0.50–0.75 — moderate' },
            { bg: '#991b1b', label: 'KCI > 0.75 — critical' },
          ].map(({ bg, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%',
                background: bg, flexShrink: 0,
              }} />
              <span style={{ fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* hint line */}
      <div style={{
        fontSize: 11, color: 'var(--color-text-secondary)',
        marginBottom: 8, opacity: 0.7,
      }}>
        Cell fill = modification activity · Dot = KCI knowledge concentration · Proximity = import coupling
      </div>

      {/* ── SVG ── */}
      <div style={{
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-background-secondary)',
      }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      </div>

      {/* ── tooltip ── */}
      {tooltip && (() => {
        const { bg, label: kciLabel } = kciDotColor(tooltip.node.kci)
        return (
          <div style={{
            position: 'fixed',
            left: tooltip.x + 14,
            top:  tooltip.y - 10,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '10px 14px',
            fontSize: 13,
            zIndex: 9999,
            pointerEvents: 'none',
            minWidth: 200,
          }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6,
                          color: 'var(--color-text-primary)' }}>
              {tooltip.node.label}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>
              Path: <span style={{ color: 'var(--color-text-primary)' }}>{tooltip.node.path}</span>
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>
              Modifications:{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {tooltip.node.value}
              </span>
              {' '}· Activity:{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {intensityLabel(logNorm(tooltip.node.value,
                  Math.min(...nodes.map(n=>n.value)),
                  Math.max(...nodes.map(n=>n.value))))}
              </span>
            </div>
            {tooltip.node.kci >= 0 && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: '0.5px solid var(--color-border-tertiary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 600, color: '#fff',
                }}>
                  {tooltip.node.kci.toFixed(2)}
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 12 }}>
                    KCI {tooltip.node.kci.toFixed(2)} — {kciLabel} risk
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
                    {tooltip.node.kci >= 0.75
                      ? 'One developer dominates this file'
                      : tooltip.node.kci >= 0.50
                      ? 'Knowledge shared by 2–3 developers'
                      : 'Knowledge well distributed'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}