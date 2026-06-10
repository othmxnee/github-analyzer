import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { useChartColors } from '../../hooks/useTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// Bus-factor risk bands — same thresholds & palette as the legend shown above
// this section (BusFactorRiskVisualization): a file whose single largest owner
// holds >60% of its lines is a knowledge silo.
const SAFE = '#22c55e'    // < 30% — knowledge is distributed
const WARN = '#f59e0b'    // 30–60%
const DANGER = '#ef4444'  // > 60% — one owner dominates

// Cool-gray ramp for the 2nd–5th owners so the risk-colored lead owner pops.
const OTHER_OWNERS = ['#4A5578', '#5C6890', '#7280A8', '#9AA6C4']
const OTHERS_FILL = 'rgba(155,168,200,0.16)'
const MAX_OWNERS = 5

function riskColor(share) {
  if (share > 0.6) return DANGER
  if (share >= 0.3) return WARN
  return SAFE
}

function shortFile(path, max = 40) {
  return path.length <= max ? path : '…' + path.slice(-(max - 1))
}
function shortDev(d, max = 26) {
  return d.length > max ? d.slice(0, max - 1) + '…' : d
}

// Legend helpers
function box(bg, border) {
  return (
    <span style={{
      width: 12,
      height: 12,
      borderRadius: 3,
      flex: '0 0 auto',
      background: bg,
      border: `1px solid ${border || 'transparent'}`,
    }} />
  )
}
function Key({ swatch, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {swatch}
      <span>{children}</span>
    </span>
  )
}

/**
 * 100%-stacked horizontal bar of per-file line ownership.
 * Input: flat rows [{ file, developer, ownership }] (ownership is a 0–1 share,
 * top 5 owners per file). Files are grouped client-side and sorted by their
 * dominant owner's share so the riskiest (most concentrated) files float to top.
 */
function OwnershipConcentration({ data, limit = 25 }) {
  const { grid, tick, muted } = useChartColors()

  if (!data || data.length === 0) {
    return <p style={{ color: 'var(--t2)' }}>No ownership data available</p>
  }

  const byFile = new Map()
  for (const r of data) {
    if (!byFile.has(r.file)) byFile.set(r.file, [])
    byFile.get(r.file).push({ dev: r.developer, share: r.ownership })
  }

  const ranked = [...byFile.entries()]
    .map(([file, owners]) => {
      owners.sort((a, b) => b.share - a.share)
      return { file, owners, top: owners[0]?.share || 0 }
    })
    .sort((a, b) => b.top - a.top)
  const files = ranked.slice(0, limit)
  const truncated = files.length < ranked.length

  const labels = files.map(f => shortFile(f.file))

  // One dataset per owner rank (lead, #2…#5) + an "Others" remainder so every
  // bar fills to 100% even though only the top 5 owners are tracked per file.
  const ownerDatasets = Array.from({ length: MAX_OWNERS }, (_, rank) => ({
    label: rank === 0 ? 'Lead owner' : `Owner #${rank + 1}`,
    data: files.map(f => (f.owners[rank]?.share || 0) * 100),
    _devs: files.map(f => f.owners[rank]?.dev || null),
    backgroundColor: rank === 0
      ? files.map(f => riskColor(f.top))
      : OTHER_OWNERS[rank - 1],
    borderColor: 'rgba(7,9,15,0.55)',
    borderWidth: { left: 1, right: 1 },
    stack: 'own',
    maxBarThickness: 22,
  }))

  const othersDataset = {
    label: 'Others',
    data: files.map(f => {
      const tracked = f.owners
        .slice(0, MAX_OWNERS)
        .reduce((s, o) => s + o.share, 0)
      return Math.max(0, (1 - tracked) * 100)
    }),
    _devs: files.map(() => null),
    backgroundColor: OTHERS_FILL,
    borderColor: 'rgba(7,9,15,0.55)',
    borderWidth: { left: 1, right: 1 },
    stack: 'own',
    maxBarThickness: 22,
  }

  const chartData = { labels, datasets: [...ownerDatasets, othersDataset] }

  // Draw the lead owner's % (the headline concentration figure) at the end of
  // each bar, colored by its risk band.
  const leadLabelPlugin = {
    id: 'ownershipLeadLabel',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart
      const meta = chart.getDatasetMeta(0)
      if (!meta) return
      ctx.save()
      ctx.font = '600 11px monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      const xEnd = scales.x.getPixelForValue(100)
      files.forEach((f, i) => {
        const bar = meta.data[i]
        if (!bar) return
        ctx.fillStyle = riskColor(f.top)
        ctx.fillText(`${(f.top * 100).toFixed(0)}%`, xEnd + 8, bar.y)
      })
      ctx.restore()
    },
  }

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 44 } },
    interaction: { mode: 'nearest', axis: 'y', intersect: true },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#111520',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        titleColor: '#EEEEF3',
        bodyColor: '#9BA8C8',
        filter: item => item.parsed.x > 0.05,
        callbacks: {
          title: items => files[items[0].dataIndex]?.file ?? '',
          label: ctx => {
            const v = ctx.parsed.x
            if (!v) return null
            const ds = ctx.dataset
            if (ds.label === 'Others') return `Other contributors: ${v.toFixed(1)}%`
            const name = ds._devs?.[ctx.dataIndex]
            return `${name ? shortDev(name) : ds.label}: ${v.toFixed(1)}%`
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        min: 0,
        max: 100,
        grid: { color: grid },
        ticks: {
          color: tick,
          font: { size: 10 },
          stepSize: 25,
          callback: v => `${v}%`,
        },
        title: {
          display: true,
          text: "Share of file's lines (%)",
          color: muted,
          font: { size: 10 },
        },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: tick,
          font: { size: 10, family: 'monospace' },
          autoSkip: false,
        },
      },
    },
  }

  const height = files.length * 28 + 64

  return (
    <div>
      <div style={{ height: `${height}px`, position: 'relative' }}>
        <Bar data={chartData} options={options} plugins={[leadLabelPlugin]} />
      </div>
      <div style={{
        marginTop: 12,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 16px',
        alignItems: 'center',
        fontSize: '0.74rem',
        color: 'var(--t2)',
      }}>
        <span style={{
          color: 'var(--t3)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontSize: '0.66rem',
        }}>
          Lead owner
        </span>
        <Key swatch={box(SAFE)}>&lt;30% · distributed</Key>
        <Key swatch={box(WARN)}>30–60% · concentrating</Key>
        <Key swatch={box(DANGER)}>&gt;60% · single-owner risk</Key>
        <span style={{ width: 1, height: 13, background: 'var(--b)' }} />
        <Key swatch={box(`linear-gradient(90deg, ${OTHER_OWNERS.join(', ')})`)}>
          owners #2–#5
        </Key>
        <Key swatch={box(OTHERS_FILL, 'rgba(155,168,200,0.4)')}>
          others (beyond top 5)
        </Key>
      </div>
      <p style={{
        marginTop: 10,
        fontSize: '0.78rem',
        color: 'var(--t2)',
        lineHeight: 1.6,
      }}>
        Each bar is one file's lines totalling 100%, split among its owners. Only the
        lead owner is colored — by knowledge-concentration risk; the grays merely
        separate the remaining owners. Hover a segment for the developer and exact
        share. Sorted most-concentrated first;{' '}
        {truncated ? `top ${files.length} of ${ranked.length} shown` : `all ${files.length} files`}.
      </p>
    </div>
  )
}

export default OwnershipConcentration
