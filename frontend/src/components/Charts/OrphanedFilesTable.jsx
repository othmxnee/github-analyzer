/* Files whose dominant author is no longer active — "knowledge already lost".
   Each row: the file, who owns it, how much, and how long they've been gone. */

const tail = (p) => {
  const s = String(p || '')
  return s.length > 42 ? '…' + s.slice(-40) : s
}
const shortDev = (d) => (String(d).includes('@') ? String(d).split('@')[0] : String(d))

export default function OrphanedFilesTable({ data }) {
  const rows = Array.isArray(data) ? data : []
  if (rows.length === 0) {
    return <p style={{ color: 'var(--t3)' }}>No orphaned files — every heavily-owned file still has an active author. 🎉</p>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--t3)', borderBottom: '1px solid var(--color-border, #2a2a2a)' }}>
            <th style={{ padding: '8px 6px' }}>File</th>
            <th style={{ padding: '8px 6px' }}>Last author</th>
            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Owns</th>
            <th style={{ padding: '8px 6px', textAlign: 'right' }}>Inactive</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((r, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border, #1e1e1e)' }}>
              <td style={{ padding: '8px 6px', fontFamily: 'var(--mono)' }} title={r.file}>{tail(r.file)}</td>
              <td style={{ padding: '8px 6px' }} title={r.last_active ? `last commit ${r.last_active}` : ''}>{shortDev(r.owner)}</td>
              <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--red)', fontWeight: 600 }}>
                {Math.round((r.ownership ?? 0) * 100)}%
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--t3)' }}>
                {Math.round(r.months_inactive ?? 0)} mo
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>
        These files are majority-authored by someone who has stopped contributing. Their knowledge is already at risk — prioritise documentation or a hand-over.
      </p>
    </div>
  )
}
