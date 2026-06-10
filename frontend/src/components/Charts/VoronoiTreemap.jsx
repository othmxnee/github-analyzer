import { useEffect, useRef, useState } from 'react'
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'

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

function kciDotColor(kci) {
  if (kci < 0.50) return { bg: '#166534', text: '#fff', label: 'Low' }
  if (kci < 0.75) return { bg: '#92400e', text: '#fff', label: 'Moderate' }
  return              { bg: '#991b1b',  text: '#fff', label: 'Critical' }
}

function intensityLabel(t) {
  if (t < 0.25) return 'Low'
  if (t < 0.55) return 'Medium'
  if (t < 0.80) return 'High'
  return 'Critical'
}

function cellArea(cell) {
  let a = 0
  for (let j = 0; j < cell.length - 1; j++)
    a += cell[j][0] * cell[j + 1][1] - cell[j + 1][0] * cell[j][1]
  return Math.abs(a) / 2
}

function cellCentroid(cell) {
  const pts = cell.slice(0, -1)
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ]
}

export default function VoronoiTreemap({ data }) {
  const svgRef  = useRef(null)
  const wrapRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const [dims, setDims]       = useState({ w: 800, h: 520 })

  const nodes = data?.nodes ?? []
  const edges = data?.edges ?? []

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width || 800
      setDims({ w, h: Math.round(w * 0.62) })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

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

    const DOT_R        = 10
    const MIN_AREA_DOT = 600    // min cell area to show dot
    const MIN_AREA_LBL = 1800   // min cell area to show label

    const cellG = svg.append('g')

    pts.forEach((pt, i) => {
      const pathStr = voronoi.renderCell(i)
      if (!pathStr) return

      const cell = voronoi.cellPolygon(i)
      if (!cell) return

      const area = cellArea(cell)
      const [cx, cy] = cellCentroid(cell)

      const g = cellG.append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', (event) => {
          g.select('path').attr('stroke', '#f1f5f9').attr('stroke-width', 2.5)
          setTooltip({ x: event.clientX, y: event.clientY, node: pt })
        })
        .on('mousemove', (event) => {
          setTooltip(prev => prev ? { ...prev, x: event.clientX, y: event.clientY } : null)
        })
        .on('mouseleave', () => {
          g.select('path').attr('stroke', 'rgba(30,41,59,0.45)').attr('stroke-width', 1)
          setTooltip(null)
        })

      g.append('path')
        .attr('d', pathStr)
        .attr('fill', heatColor(pt.t))
        .attr('stroke', 'rgba(30,41,59,0.45)')
        .attr('stroke-width', 1)

      // ── label ──────────────────────────────────────────────────────────
      const hasKci    = typeof pt.kci === 'number' && pt.kci >= 0
      const showDot   = hasKci && area >= MIN_AREA_DOT
      // File name + mods: plain black, same in both modes.
      const textColor = '#000000'
      const fontSize  = area > 6000 ? 12 : 10

      if (area >= MIN_AREA_LBL) {
        // Shift label down a bit when dot is present so they don't overlap
        const labelY = showDot ? cy + DOT_R + 6 : cy
        const subY   = labelY + fontSize + 2

        g.append('text')
          .attr('class', 'voronoi-cell-label')
          .attr('x', cx).attr('y', labelY)
          .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
          .attr('fill', textColor).attr('font-size', fontSize)
          .attr('font-family', 'Inter, system-ui, sans-serif').attr('font-weight', '600')
          .attr('pointer-events', 'none')
          .text(pt.label)

        if (area > 5000) {
          g.append('text')
            .attr('class', 'voronoi-cell-label')
            .attr('x', cx).attr('y', subY)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            .attr('fill', textColor).attr('font-size', 9)
            .attr('font-family', 'Inter, system-ui, sans-serif').attr('font-weight', '500')
            .attr('pointer-events', 'none')
            .text(`${pt.value} mods`)
        }
      }

      // ── KCI dot — only when kci >= 0 AND cell is large enough ──────────
      if (!showDot) return

      const { bg } = kciDotColor(pt.kci)

      // Place dot at centroid top — above the label if label is shown, else centered
      const dotX = cx
      const dotY = area >= MIN_AREA_LBL ? cy - DOT_R - 2 : cy

      g.append('circle')
        .attr('cx', dotX).attr('cy', dotY).attr('r', DOT_R)
        .attr('fill', bg)
        .attr('stroke', 'rgba(255,255,255,0.7)').attr('stroke-width', 1.5)
        .attr('pointer-events', 'none')

      // KCI value inside the dot — always white in both modes
      g.append('text')
        .attr('class', 'voronoi-kci-label')
        .attr('x', dotX).attr('y', dotY)
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#ffffff').attr('font-size', 8).attr('font-weight', '700')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('pointer-events', 'none')
        .text(pt.kci.toFixed(2))
    })

  }, [nodes, edges, dims])

  if (nodes.length === 0) {
    return <p style={{ color: '#9ca3af', padding: '1rem 0' }}>No Voronoi data available.</p>
  }

  const minVal = Math.min(...nodes.map(n => n.value))
  const maxVal = Math.max(...nodes.map(n => n.value))

  return (
    <div style={{ position: 'relative', width: '100%' }} ref={wrapRef}>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: 10,
        fontSize: 12, color: 'var(--color-text-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Low activity</span>
          <div style={{
            width: 120, height: 10, borderRadius: 4,
            background: 'linear-gradient(to right, #fff, #fca5a5, #dc2626, #7f1d1d)',
            border: '0.5px solid var(--color-border-tertiary)',
          }} />
          <span>High activity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[
            { bg: '#166534', label: 'KCI < 0.50 — distributed' },
            { bg: '#92400e', label: 'KCI 0.50–0.75 — moderate' },
            { bg: '#991b1b', label: 'KCI > 0.75 — critical'    },
          ].map(({ bg, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: bg, flexShrink: 0 }} />
              <span style={{ fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8, opacity: 0.7 }}>
        Cell fill = modification activity · Dot = KCI knowledge concentration · Proximity = import coupling
      </div>

      <div style={{
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: 'var(--border-radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-background-secondary)',
      }}>
        <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      </div>

      {tooltip && (() => {
        const hasKci = typeof tooltip.node.kci === 'number' && tooltip.node.kci >= 0
        const { bg, label: kciLabel } = hasKci ? kciDotColor(tooltip.node.kci) : { bg: '', label: '' }
        return (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10,
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            padding: '10px 14px', fontSize: 13, zIndex: 9999,
            pointerEvents: 'none', minWidth: 200,
          }}>
            <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 6, color: 'var(--color-text-primary)' }}>
              {tooltip.node.label}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>
              Path: <span style={{ color: 'var(--color-text-primary)' }}>{tooltip.node.path}</span>
            </div>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: 12, marginTop: 2 }}>
              Modifications:{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{tooltip.node.value}</span>
              {' '}· Activity:{' '}
              <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                {intensityLabel(logNorm(tooltip.node.value, minVal, maxVal))}
              </span>
            </div>
            {hasKci && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: '0.5px solid var(--color-border-tertiary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: bg,
                  flexShrink: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff',
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
            {typeof tooltip.node.bus_factor === 'number' && tooltip.node.bus_factor > 0 && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: '0.5px solid var(--color-border-tertiary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: tooltip.node.bus_factor === 1 ? '#991b1b' : tooltip.node.bus_factor <= 2 ? '#92400e' : '#166534',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: '#fff',
                }}>
                  {tooltip.node.bus_factor}
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 12 }}>
                    Bus factor: {tooltip.node.bus_factor} developer{tooltip.node.bus_factor > 1 ? 's' : ''}
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>
                    {tooltip.node.bus_factor === 1
                      ? 'Losing 1 person risks 50%+ of knowledge'
                      : `Losing ${tooltip.node.bus_factor} people risks 50%+ of knowledge`}
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