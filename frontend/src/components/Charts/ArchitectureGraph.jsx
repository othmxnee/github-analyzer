import { useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

function degreeColor(degree) {
  if (degree >= 15) return '#ef4444'
  if (degree >= 8) return '#f59e0b'
  return '#22c55e'
}

function nodeValue(node) {
  return Math.max(3.5, (node.pagerank || 0) * 360)
}

function shortFileName(filePath = '') {
  const name = String(filePath).split('/').pop() || String(filePath)
  return name.length > 14 ? `${name.slice(0, 11)}...` : name
}

// Returns simulation params that scale with node/edge count so the graph
// stays readable regardless of repository size.
function getSimParams(nodeCount, edgeCount) {
  // Charge: more nodes → stronger repulsion so they don't clump
  // Roughly: -220 for ~20 nodes, scales up to -800 for 100+ nodes
  const charge = -Math.max(220, Math.min(900, 180 + nodeCount * 7))

  // Link distance: spread nodes further apart in denser graphs
  const linkDistance = Math.max(80, Math.min(260, 70 + nodeCount * 1.8))

  // Link strength: weaker for denser graphs so nodes can breathe
  const linkStrength = Math.max(0.05, Math.min(0.35, 0.35 - nodeCount * 0.002))

  // Cooldown: give larger graphs more time to settle
  const cooldownTicks = nodeCount > 60 ? 300 : nodeCount > 30 ? 220 : 180

  // Alpha decay: slower decay → more time to find good layout
  const alphaDecay = nodeCount > 60 ? 0.015 : nodeCount > 30 ? 0.022 : 0.03

  // Velocity decay: more damping for large graphs to avoid chaotic bouncing
  const velocityDecay = nodeCount > 60 ? 0.45 : 0.33

  return { charge, linkDistance, linkStrength, cooldownTicks, alphaDecay, velocityDecay }
}

function ArchitectureGraph({ data }) {
  const graphData = data || { nodes: [], edges: [] }
  const nodes = graphData.nodes || []
  const edges = graphData.edges || []

  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const isLockedRef = useRef(false)

  const [size, setSize] = useState({ width: 900, height: 560 })
  const [hoverNode, setHoverNode] = useState(null)

  // Derive sim params once per graph dataset
  const simParams = useMemo(
    () => getSimParams(nodes.length, edges.length),
    [nodes.length, edges.length]
  )

  // Dynamic height: give large graphs more vertical room
  const graphHeight = useMemo(() => {
    if (nodes.length > 80) return 720
    if (nodes.length > 40) return 640
    return 560
  }, [nodes.length])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize({ width: Math.max(320, Math.floor(rect.width)), height: graphHeight })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [graphHeight])

  // Reset lock whenever the dataset changes
  useEffect(() => {
    isLockedRef.current = false
  }, [nodes.length, edges.length])

  // Apply adaptive force parameters whenever the dataset changes
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return
    const graph = graphRef.current

    const charge = graph.d3Force('charge')
    if (charge?.strength) charge.strength(simParams.charge)

    const link = graph.d3Force('link')
    if (link?.distance) link.distance(simParams.linkDistance)
    if (link?.strength) link.strength(simParams.linkStrength)

    // Add a collision force to physically prevent node overlap
    // react-force-graph exposes d3Force so we can inject custom forces
    try {
      // d3-force collision radius = visual radius of the node + padding
      const d3 = window.d3 // available globally when react-force-graph loads
      if (d3?.forceCollide) {
        const collisionRadius = node => {
          const r = Math.sqrt(nodeValue(node)) * 4
          const padding = nodes.length > 60 ? 14 : 10
          return r + padding
        }
        graph.d3Force('collision', d3.forceCollide(collisionRadius).strength(0.85).iterations(3))
      }
    } catch (_) {
      // forceCollide not available in this build — safe to skip
    }

    graph.d3ReheatSimulation()
  }, [nodes.length, edges.length, simParams])

  const outgoingCounts = useMemo(() => {
    const outMap = new Map()
    nodes.forEach(n => outMap.set(n.id, 0))
    edges.forEach(e => {
      const source = typeof e.source === 'object' ? e.source.id : e.source
      if (!source) return
      if (!outMap.has(source)) outMap.set(source, 0)
      outMap.set(source, outMap.get(source) + 1)
    })
    return outMap
  }, [nodes, edges])

  // Label visibility: skip tiny nodes unless hovered, and shrink font for large graphs
  const labelSizeMultiplier = useMemo(() => {
    if (nodes.length > 80) return 0.32
    if (nodes.length > 40) return 0.38
    return 0.45
  }, [nodes.length])

  const minLabelRadius = useMemo(() => {
    if (nodes.length > 80) return 14
    if (nodes.length > 40) return 11
    return 10
  }, [nodes.length])

  if (nodes.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No architecture data available</p>
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${graphHeight}px` }}>
      <ForceGraph2D
        ref={graphRef}
        width={size.width}
        height={graphHeight}
        graphData={{ nodes, links: edges }}
        nodeVal={nodeValue}
        nodeColor={node => degreeColor(node.degree || 0)}
        nodeCanvasObjectMode={() => 'after'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const radius = Math.sqrt(nodeValue(node)) * 4
          const isHovered = hoverNode?.id === node.id

          // Only draw labels on nodes large enough to read, or hovered
          if (radius < minLabelRadius && !isHovered) return

          const label = shortFileName(node.id)
          const fontSize = Math.max(7, Math.min(11, radius * labelSizeMultiplier)) / globalScale

          ctx.font = `600 ${fontSize}px Manrope, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#f8fafc'
          ctx.fillText(label, node.x, node.y)
        }}
        linkColor={link => {
          if (!hoverNode) return 'rgba(148, 163, 184, 0.25)'
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id
            ? 'rgba(76, 201, 240, 0.9)'
            : 'rgba(148, 163, 184, 0.08)'
        }}
        linkWidth={link => {
          if (!hoverNode) return 0.8
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id ? 2.2 : 0.4
        }}
        linkDirectionalArrowLength={link => {
          if (!hoverNode) return 3
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id ? 6 : 2
        }}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={link => {
          if (!hoverNode) return 'rgba(148, 163, 184, 0.5)'
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id
            ? 'rgba(76, 201, 240, 0.95)'
            : 'rgba(148, 163, 184, 0.2)'
        }}
        nodeLabel={node => {
          const imports = outgoingCounts.get(node.id) || 0
          return `File: ${node.id}<br/>Dependencies: ${imports}<br/>Imported by: ${node.degree || 0}<br/>PageRank: ${(node.pagerank || 0).toFixed(3)}`
        }}
        onNodeHover={node => setHoverNode(node || null)}
        onEngineStop={() => {
          if (!graphRef.current || isLockedRef.current) return
          const graph = graphRef.current

          graph.zoomToFit(800, 40)

          // For very large graphs, zoom out a bit more so all nodes fit
          if (nodes.length > 60) {
            const currentZoom = graph.zoom()
            graph.zoom(currentZoom * 0.88, 400)
          } else {
            const currentZoom = graph.zoom()
            graph.zoom(currentZoom * 1.1, 300)
          }

          graph.centerAt(0, 0, 300)

          // Lock all nodes in place after simulation settles
          nodes.forEach(node => {
            if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
              node.fx = node.x
              node.fy = node.y
            }
          })

          isLockedRef.current = true
        }}
        cooldownTicks={simParams.cooldownTicks}
        d3AlphaDecay={simParams.alphaDecay}
        d3VelocityDecay={simParams.velocityDecay}
        enableNodeDrag={false}
      />

      {hoverNode && (
        <div className="architecture-hint">
          <strong>{hoverNode.id}</strong>
          <span>Dependencies: {outgoingCounts.get(hoverNode.id) || 0}</span>
          <span>Imported by: {hoverNode.degree || 0}</span>
        </div>
      )}
    </div>
  )
}

export default ArchitectureGraph