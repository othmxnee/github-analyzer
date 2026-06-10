function ActivityHeatmap({ data }) {
  if (!data) {
    return <p style={{ color: '#9ca3af' }}>No heatmap data available</p>
  }

  const developers = data.developers || []
  const files = data.files || []
  const values = data.values || []

  if (developers.length === 0 || files.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No heatmap data available</p>
  }

  const flatValues = values.flat()
  const maxValue = flatValues.length ? Math.max(...flatValues) : 0

  // Theme-aware cell colours: the red intensity scales with churn, and the
  // text flips to white only once the cell is saturated enough — otherwise it
  // uses the theme text colour so numbers stay readable in BOTH dark & light.
  const cellStyle = (value) => {
    if (!maxValue || value <= 0) return { background: 'var(--surf)', color: 'var(--t3)' }
    const v = value / maxValue
    const alpha = Math.min(0.9, 0.15 + v * 0.75)
    return {
      background: `rgba(239, 68, 68, ${alpha})`,
      color: v >= 0.4 ? '#fff' : 'var(--t)',
    }
  }

  const headTh = {
    position: 'sticky', top: 0, zIndex: 1,
    background: 'var(--bg3)', color: 'var(--t3)',
    padding: '6px', textAlign: 'left', fontWeight: 600,
    borderBottom: '1px solid var(--b)',
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: '450px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: files.length * 80 }}>
        <thead>
          <tr>
            <th style={{ ...headTh, left: 0, zIndex: 2 }}>Developer</th>
            {files.map(file => (
              <th key={file} title={file} style={{ ...headTh, fontSize: '0.75rem' }}>
                {file.length > 18 ? file.substring(0, 18) + '...' : file}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {developers.map((dev, rowIdx) => (
            <tr key={dev}>
              <td title={dev} style={{
                color: 'var(--t)', background: 'var(--bg2)', padding: '6px',
                fontSize: '0.8rem', whiteSpace: 'nowrap',
                position: 'sticky', left: 0, zIndex: 1,
              }}>
                {dev.length > 22 ? dev.substring(0, 22) + '...' : dev}
              </td>
              {files.map((file, colIdx) => {
                const value = values[rowIdx]?.[colIdx] || 0
                const cs = cellStyle(value)
                return (
                  <td
                    key={`${dev}-${file}`}
                    style={{
                      background: cs.background,
                      padding: '6px',
                      textAlign: 'center',
                      color: cs.color,
                      fontSize: '0.75rem',
                    }}
                    title={`${dev} → ${file}: ${value}`}
                  >
                    {value > 0 ? Math.round(value) : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{
        marginTop: '12px',
        fontSize: '0.8rem',
        color: 'var(--t3)',
        fontStyle: 'italic'
      }}>
        Cells represent churn (added + deleted lines). Darker cells indicate higher activity.
      </p>
    </div>
  )
}

export default ActivityHeatmap
