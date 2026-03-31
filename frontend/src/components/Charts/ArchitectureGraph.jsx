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

function ArchitectureGraph({ data }) {
  const graphData = data || { nodes: [], edges: [] }
  const nodes = graphData.nodes || []
  const edges = graphData.edges || []

  const containerRef = useRef(null)
  const graphRef = useRef(null)
  const isLockedRef = useRef(false)

  const [size, setSize] = useState({ width: 900, height: 560 })
  const [hoverNode, setHoverNode] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: 560
      })
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    isLockedRef.current = false
  }, [nodes.length, edges.length])

  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return

    const graph = graphRef.current

    const charge = graph.d3Force('charge')
    if (charge && charge.strength) {
      charge.strength(-220)
    }

    const link = graph.d3Force('link')
    if (link && link.distance) {
      link.distance(110)
    }
    if (link && link.strength) {
      link.strength(0.25)
    }

    graph.d3ReheatSimulation()
  }, [nodes.length, edges.length])

  const outgoingCounts = useMemo(() => {
    const outMap = new Map()

    nodes.forEach(n => {
      outMap.set(n.id, 0)
    })

    edges.forEach(e => {
      const source = typeof e.source === 'object' ? e.source.id : e.source
      if (!source) return
      if (!outMap.has(source)) outMap.set(source, 0)
      outMap.set(source, outMap.get(source) + 1)
    })

    return outMap
  }, [nodes, edges])

  if (nodes.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No architecture data available</p>
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '560px' }}>
      <ForceGraph2D
        ref={graphRef}
        width={size.width}
        height={size.height}
        graphData={{ nodes, links: edges }}
        nodeVal={nodeValue}
        nodeColor={node => degreeColor(node.degree || 0)}
        nodeCanvasObjectMode={() => 'after'}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const radius = Math.sqrt(nodeValue(node)) * 4
          if (radius < 10 && hoverNode?.id !== node.id) return

          const label = shortFileName(node.id)
          const fontSize = Math.max(7, Math.min(11, radius * 0.45)) / globalScale

          ctx.font = `600 ${fontSize}px Manrope, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#f8fafc'
          ctx.fillText(label, node.x, node.y)
        }}
        linkColor={link => {
          if (!hoverNode) return 'rgba(148, 163, 184, 0.35)'
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id
            ? 'rgba(76, 201, 240, 0.9)'
            : 'rgba(148, 163, 184, 0.12)'
        }}
        linkWidth={link => {
          if (!hoverNode) return 1
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id ? 2.2 : 0.6
        }}
        linkDirectionalArrowLength={link => {
          if (!hoverNode) return 3.5
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id ? 6 : 2.5
        }}
        linkDirectionalArrowRelPos={0.95}
        linkDirectionalArrowColor={link => {
          if (!hoverNode) return 'rgba(148, 163, 184, 0.65)'
          const target = typeof link.target === 'object' ? link.target.id : link.target
          return target === hoverNode.id
            ? 'rgba(76, 201, 240, 0.95)'
            : 'rgba(148, 163, 184, 0.25)'
        }}
        nodeLabel={node => {
          const imports = outgoingCounts.get(node.id) || 0
          return `File: ${node.id}<br/>Dependencies: ${imports}<br/>Imported by: ${node.degree || 0}<br/>PageRank: ${(node.pagerank || 0).toFixed(3)}`
        }}
        onNodeHover={node => setHoverNode(node || null)}
        onEngineStop={() => {
          if (!graphRef.current || isLockedRef.current) return

          const graph = graphRef.current

          graph.zoomToFit(900, 20)
          const currentZoom = graph.zoom()
          graph.zoom(currentZoom * 1.15, 300)
          graph.centerAt(0, 0, 300)

          nodes.forEach(node => {
            if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
              node.fx = node.x
              node.fy = node.y
            }
          })

          isLockedRef.current = true
        }}
        cooldownTicks={180}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.33}
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
