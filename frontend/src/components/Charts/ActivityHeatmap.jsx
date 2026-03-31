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

  const getCellColor = (value) => {
    if (!maxValue || value <= 0) return 'rgba(255, 255, 255, 0.03)'
    const alpha = Math.min(0.9, 0.15 + (value / maxValue) * 0.75)
    return `rgba(239, 68, 68, ${alpha})`
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: '450px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: files.length * 80 }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', top: 0, background: '#12172a', color: '#9ca3af', padding: '6px', textAlign: 'left' }}>
              Developer
            </th>
            {files.map(file => (
              <th
                key={file}
                style={{
                  position: 'sticky',
                  top: 0,
                  background: '#12172a',
                  color: '#9ca3af',
                  padding: '6px',
                  fontSize: '0.75rem',
                  textAlign: 'left'
                }}
              >
                {file.length > 18 ? file.substring(0, 18) + '...' : file}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {developers.map((dev, rowIdx) => (
            <tr key={dev}>
              <td style={{ color: '#e5e7eb', padding: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {dev.length > 22 ? dev.substring(0, 22) + '...' : dev}
              </td>
              {files.map((file, colIdx) => {
                const value = values[rowIdx]?.[colIdx] || 0
                return (
                  <td
                    key={`${dev}-${file}`}
                    style={{
                      background: getCellColor(value),
                      padding: '6px',
                      textAlign: 'center',
                      color: value > 0 ? '#111827' : '#9ca3af',
                      fontSize: '0.75rem'
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
        color: '#6b7280',
        fontStyle: 'italic'
      }}>
        Cells represent churn (added + deleted lines). Darker cells indicate higher activity.
      </p>
    </div>
  )
}

export default ActivityHeatmap
