/* Hidden / logical coupling: files that repeatedly change together in the same
   commit but are NOT linked by an import. An implicit dependency the dependency
   graph can't see — often a sign the two files should be refactored together. */

const tail = (p) => {
  const s = String(p || '')
  return s.length > 34 ? '…' + s.slice(-32) : s
}

export default function CoChangeTable({ data }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) {
    return <p style={{ color: 'var(--t3)' }}>No hidden coupling found — files that change together are also linked by imports.</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--t3)', borderBottom: '1px solid var(--color-border, #2a2a2a)' }}>
            <th style={{ padding: '8px 6px' }}>File A</th>
            <th style={{ padding: '8px 6px' }}>File B</th>
            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Together</th>
            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Always together</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 15).map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border, #1e1e1e)' }}>
              <td style={{ padding: '8px 6px', fontFamily: 'var(--mono)' }} title={r.file_a}>{tail(r.file_a)}</td>
              <td style={{ padding: '8px 6px', fontFamily: 'var(--mono)' }} title={r.file_b}>{tail(r.file_b)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right' }}>{r.co_changes}×</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600,
                           color: r.confidence >= 0.7 ? 'var(--red)' : 'var(--t)' }}>
                {Math.round(r.confidence * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>
        "Always together" = of all the times the busier file changed, how often the other changed with it. A high value with no import link = hidden coupling worth a look.
      </p>
    </div>
  )
}
