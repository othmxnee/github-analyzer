import Plot from 'react-plotly.js'

function computeTotalValues(ids, parents, values) {
  const childrenByParent = new Map()
  const indexById = new Map()

  ids.forEach((id, index) => {
    indexById.set(id, index)
    if (!childrenByParent.has(id)) childrenByParent.set(id, [])
  })

  parents.forEach((parentId, childIndex) => {
    if (!parentId) return
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, [])
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

  ids.forEach((_, index) => computeAt(index))
  return totals
}

function logNormalize(value, minVal, maxVal) {
  if (maxVal <= minVal) return 0.5
  const logMin = Math.log1p(minVal)
  const logMax = Math.log1p(maxVal)
  if (logMax === logMin) return 0.5
  return (Math.log1p(value) - logMin) / (logMax - logMin)
}

function intensityLabel(nc) {
  if (nc === null) return '—'
  if (nc < 0.25)  return 'Low'
  if (nc < 0.55)  return 'Medium'
  if (nc < 0.80)  return 'High'
  return 'Critical'
}

function RepositoryTreemap({ data }) {
  const treemap = data || {}
  const labels  = treemap.labels  || []
  const parents = treemap.parents || []
  const values  = treemap.values  || []
  const paths   = treemap.paths   || []

  if (labels.length === 0 || values.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No treemap data available</p>
  }

  const ids =
    Array.isArray(treemap.ids) && treemap.ids.length === labels.length
      ? treemap.ids
      : labels.map((label, idx) => `${parents[idx]}::${label}::${idx}`)

  const totalValues = computeTotalValues(ids, parents, values)

  const fileValues = values.map(Number).filter(v => v > 0)
  const minFileValue = fileValues.length ? Math.min(...fileValues) : 0
  const maxFileValue = fileValues.length ? Math.max(...fileValues) : 1

  const normalizedColors = values.map(v => {
    const n = Number(v)
    if (n <= 0) return null
    return logNormalize(n, minFileValue, maxFileValue)
  })

  // White (low) → pink → red (high)
  const colorscale = [
    [0.00, '#FFFFFF'],  // white      — cold / untouched
    [0.25, '#FECACA'],  // light pink
    [0.50, '#F87171'],  // medium red
    [0.75, '#DC2626'],  // red
    [1.00, '#7F1D1D'],  // deep red   — critical hotspot
  ]

  const markerColors = normalizedColors.map(nc =>
    nc === null ? 'rgba(51, 65, 85, 0.5)' : nc
  )

  const customdata = values.map((v, i) => {
    const nc = normalizedColors[i]
    return [paths[i] || labels[i], intensityLabel(nc)]
  })

  return (
    <div style={{ width: '100%', height: '520px' }}>
      <Plot
        data={[
          {
            type: 'treemap',
            ids,
            labels,
            parents,
            values: totalValues,
            customdata,
            branchvalues: 'total',
            marker: {
              colors: markerColors,
              colorscale,
              cmin: 0,
              cmax: 1,
              reversescale: false,
              showscale: true,
              colorbar: {
                tickvals: [0, 0.5, 1],
                ticktext: ['Low', 'Medium', 'High'],
                tickfont: { size: 11, color: '#94a3b8' },
                thickness: 12,
                len: 0.6,
                x: 1.01,
                xanchor: 'left',
                y: 0.5,
                yanchor: 'middle',
                outlinewidth: 0,
                title: {
                  text: 'Activity level',
                  side: 'top',
                  font: { size: 11, color: '#94a3b8' }
                },
              },
              line: {
                width: 1,
                color: 'rgba(148, 163, 184, 0.2)'
              }
            },
            // Text color flips dark on light cells, light on dark cells
            textfont: { size: 12, color: '#1e293b' },
            hovertemplate:
              '<b>%{label}</b><br>' +
              'Path: %{customdata[0]}<br>' +
              'Modifications: %{value}<br>' +
              'Activity: %{customdata[1]}' +
              '<extra></extra>',
            tiling: {
              packing: 'squarify',
              squarifyratio: 1.4,
            },
            pathbar: {
              visible: true,
              thickness: 22,
              textfont: { size: 11, color: '#cbd5e1' },
              side: 'top',
            },
          }
        ]}
        layout={{
          autosize: true,
          margin: { l: 10, r: 80, t: 30, b: 10 },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: '#e5e7eb', family: 'Inter, system-ui, sans-serif' },
        }}
        config={{
          responsive: true,
          displaylogo: false,
          toImageButtonOptions: {
            format: 'png',
            filename: 'repository_treemap',
            scale: 2
          },
          displayModeBar: true,
        }}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default RepositoryTreemap