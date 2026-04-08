import Plot from 'react-plotly.js'

function fileGradientColor(value, minValue, maxValue) {
  if (maxValue <= minValue) {
    return 'rgba(239, 68, 68, 0.75)'
  }
  const t = (value - minValue) / (maxValue - minValue)
  const alpha = 0.35 + t * 0.65
  return `rgba(239, 68, 68, ${alpha.toFixed(3)})`
}

function computeTotalValues(ids, parents, values) {
  const childrenByParent = new Map()
  const indexById = new Map()

  ids.forEach((id, index) => {
    indexById.set(id, index)
    if (!childrenByParent.has(id)) {
      childrenByParent.set(id, [])
    }
  })

  parents.forEach((parentId, childIndex) => {
    if (!parentId) return
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, [])
    }
    childrenByParent.get(parentId).push(childIndex)
  })

  const totals = new Array(values.length).fill(0)

  const computeAt = index => {
    if (totals[index] > 0) return totals[index]

    const baseValue = Number(values[index]) || 0
    const nodeId = ids[index]
    const children = childrenByParent.get(nodeId) || []

    if (children.length === 0) {
      totals[index] = baseValue
      return totals[index]
    }

    const childSum = children.reduce((sum, childIdx) => sum + computeAt(childIdx), 0)
    totals[index] = Math.max(baseValue, childSum)
    return totals[index]
  }

  ids.forEach((_, index) => {
    computeAt(index)
  })

  return totals
}

function RepositoryTreemap({ data }) {
  const treemap = data || {}
  const labels = treemap.labels || []
  const parents = treemap.parents || []
  const values = treemap.values || []
  const paths = treemap.paths || []

  if (labels.length === 0 || values.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No treemap data available</p>
  }

  const ids =
    Array.isArray(treemap.ids) && treemap.ids.length === labels.length
      ? treemap.ids
      : labels.map((label, idx) => `${parents[idx]}::${label}::${idx}`)

  const totalValues = computeTotalValues(ids, parents, values)
  const fileValues = values.filter(v => Number(v) > 0)
  const minFileValue = fileValues.length ? Math.min(...fileValues) : 0
  const maxFileValue = fileValues.length ? Math.max(...fileValues) : 1
  const markerColors = values.map(v =>
    Number(v) > 0
      ? fileGradientColor(Number(v), minFileValue, maxFileValue)
      : 'rgba(71, 85, 105, 0.55)'
  )

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <Plot
        data={[
          {
            type: 'treemap',
            ids,
            labels,
            parents,
            values: totalValues,
            customdata: paths,
            branchvalues: 'total',
            marker: {
              colors: markerColors
            },
            hovertemplate:
              '%{customdata}<br>Modifications: %{value}<extra></extra>'
          }
        ]}
        layout={{
          autosize: true,
          margin: { l: 10, r: 10, t: 10, b: 10 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: '#e5e7eb' }
        }}
        config={{ responsive: true, displaylogo: false }}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default RepositoryTreemap
