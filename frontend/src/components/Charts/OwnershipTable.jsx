function OwnershipTable({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--text)' }}>No ownership data available</p>
  }

  const rows = data
  const maxVisibleRows = 50
  const rowHeight = 26
  const headerHeight = 38
  const bodyHeight = maxVisibleRows * rowHeight

  return (
    <div style={{ height: `${bodyHeight + headerHeight}px`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '45%' }} />
          <col style={{ width: '35%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ color: 'var(--text)', textAlign: 'left', padding: '8px' }}>File</th>
            <th style={{ color: 'var(--text)', textAlign: 'left', padding: '8px' }}>Developer</th>
            <th style={{ color: 'var(--text)', textAlign: 'right', padding: '8px' }}>Ownership</th>
          </tr>
        </thead>
      </table>
      <div style={{ height: `${bodyHeight}px`, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '45%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.file}-${row.developer}-${idx}`}>
                <td style={{ color: 'var(--text)', padding: '6px', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.file}
                </td>
                <td style={{ color: 'var(--text)', padding: '6px', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.developer}
                </td>
                <td style={{ color: 'var(--text)', padding: '6px', fontSize: '0.8rem', textAlign: 'right' }}>
                  {(row.ownership * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{
        marginTop: '12px',
        fontSize: '0.8rem',
        color: 'var(--text)',
        fontStyle: 'italic'
      }}>
        Showing 50 rows at a time (scroll to see more). Top 5 owners per file.
      </p>
    </div>
  )
}

export default OwnershipTable
