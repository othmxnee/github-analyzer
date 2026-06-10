/* Developer collaboration network — simple force-directed graph.
   A dot is a developer; a line means they worked on the same files; bigger dot
   = more active. No sub-teams, no brokers — just who works near whom. */
import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const NODE_COLOR = '#667eea'
const short = (d) => {
  let s = String(d)
  if (s.includes('@')) s = s.split('@')[0]
  return s.replace(/^\d+[-+]/, '')
}

export default function CollaborationNetwork({ data }) {
  const net = data || {}
  const rawNodes = net.nodes || []
  const rawEdges = net.edges || []

  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const lockedRef = useRef(false)
  const [width, setWidth] = useState(800)
  const [hover, setHover] = useState(null)

  // Clone so the simulation never mutates the cached results object.
  const graphData = useMemo(() => ({
    nodes: rawNodes.map(n => ({ ...n })),
    links: rawEdges.map(e => ({ ...e })),
  }), [rawNodes, rawEdges])

  const maxAct = useMemo(() => Math.max(...rawNodes.map(n => n.activity || 1), 1), [rawNodes])
  const maxW = useMemo(() => Math.max(...rawEdges.map(e => e.weight || 1), 1), [rawEdges])
  const HEIGHT = 560
  const nodeVal = (n) => Math.max(3, 28 * ((n.activity || 1) / maxAct))
  const nodeRadius = (n) => Math.sqrt(nodeVal(n)) * 4

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(es => {
      const w = es[0]?.contentRect?.width
      if (w) setWidth(Math.max(320, Math.floor(w)))
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { lockedRef.current = false }, [graphData])

  useEffect(() => {
    const g = graphRef.current
    if (!g || rawNodes.length === 0) return
    const charge = g.d3Force('charge')
    if (charge?.strength) charge.strength(-Math.max(180, Math.min(700, 120 + rawNodes.length * 12)))
    const link = g.d3Force('link')
    if (link?.distance) link.distance(l => 40 + 60 * (1 - (l.weight || 1) / maxW))
    if (link?.strength) link.strength(l => 0.15 + 0.5 * ((l.weight || 1) / maxW))
    g.d3ReheatSimulation()
  }, [graphData, rawNodes.length, maxW])

  const neighbors = useMemo(() => {
    if (!hover) return new Set()
    const s = new Set([hover])
    rawEdges.forEach(e => {
      if (e.source === hover) s.add(e.target)
      if (e.target === hover) s.add(e.source)
    })
    return s
  }, [hover, rawEdges])

  if (rawNodes.length < 2) {
    return <p style={{ color: 'var(--t3)' }}>Not enough shared-file activity to build a collaboration graph (single-author or fully siloed repo).</p>
  }

  return (
    <div>
      <div ref={containerRef} style={{ width: '100%', height: HEIGHT, borderRadius: 8, overflow: 'hidden' }}>
        <ForceGraph2D
          ref={graphRef}
          width={width}
          height={HEIGHT}
          graphData={graphData}
          nodeVal={nodeVal}
          nodeRelSize={4}
          nodeLabel={n => `${short(n.id)} — ${n.activity} modifications`}
          nodeColor={() => NODE_COLOR}
          linkColor={l => {
            const s = typeof l.source === 'object' ? l.source.id : l.source
            const t = typeof l.target === 'object' ? l.target.id : l.target
            if (!hover) return 'rgba(148,163,184,0.18)'
            return (s === hover || t === hover) ? 'rgba(102,126,234,0.8)' : 'rgba(148,163,184,0.04)'
          }}
          linkWidth={l => 0.5 + 2.5 * ((l.weight || 1) / maxW)}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={(node, ctx, scale) => {
            const r = nodeRadius(node)
            const dim = hover && !neighbors.has(node.id)
            if (r < 7 && !(hover && neighbors.has(node.id))) return
            const fontSize = Math.max(8, Math.min(12, r * 0.9)) / scale
            ctx.font = `600 ${fontSize}px Manrope, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillStyle = dim ? 'rgba(226,232,240,0.25)' : '#e2e8f0'
            ctx.fillText(short(node.id).slice(0, 16), node.x, node.y + r + 1)
          }}
          onNodeHover={n => setHover(n ? n.id : null)}
          onEngineStop={() => {
            const g = graphRef.current
            if (!g || lockedRef.current) return
            g.zoomToFit(700, 50)
            graphData.nodes.forEach(n => {
              if (Number.isFinite(n.x) && Number.isFinite(n.y)) { n.fx = n.x; n.fy = n.y }
            })
            lockedRef.current = true
          }}
          cooldownTicks={rawNodes.length > 40 ? 260 : 180}
          d3AlphaDecay={0.025}
          d3VelocityDecay={0.4}
          enableNodeDrag={false}
        />
      </div>

      <p style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>
        A dot is a developer; a line means they worked on the same files; bigger dot = more active.
        Files everyone edits are ignored. Hover a node to highlight who it works with.
      </p>
    </div>
  )
}
