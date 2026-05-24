import { useRef } from "react"

function riskStyle(level = "Moderate") {
  const map = {
    low:      { className: "badge-risk badge-risk-low",      text: "Low Risk" },
    moderate: { className: "badge-risk badge-risk-moderate", text: "Moderate Risk" },
    high:     { className: "badge-risk badge-risk-high",     text: "High Risk" },
    critical: { className: "badge-risk badge-risk-critical", text: "Critical Risk" },
  }
  return map[String(level).toLowerCase()] ?? map.moderate
}

const DIM_COLOR = (score) => {
  if (score >= 75) return "#22c55e"
  if (score >= 50) return "#f59e0b"
  if (score >= 25) return "#ef4444"
  return "#991b1b"
}

function DimensionBar({ label, score }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
        <span>{label}</span>
        <span style={{ fontWeight: 500, color: DIM_COLOR(score) }}>{score}/100</span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "var(--color-border-tertiary)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${score}%`,
          background: DIM_COLOR(score), borderRadius: "3px", transition: "width 0.6s ease"
        }} />
      </div>
    </div>
  )
}

export async function downloadPDF(score, level, insights, recommendations, dimensions) {
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  const { jsPDF } = window.jspdf
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const W = 210, margin = 18, contentW = W - margin * 2
  let y = 20

  // Header
  doc.setFillColor(30, 58, 95)
  doc.rect(0, 0, 210, 14, "F")
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255)
  doc.text("Repository Risk Summary", margin, 9.5)
  doc.setFontSize(8); doc.setFont("helvetica", "normal")
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), W - margin, 9.5, { align: "right" })

  y = 26
  const sc = score >= 80 ? [34,197,94] : score >= 60 ? [234,179,8] : score >= 40 ? [239,68,68] : [153,27,27]
  doc.setFontSize(40); doc.setFont("helvetica", "bold"); doc.setTextColor(...sc)
  doc.text(String(score), margin, y + 10)
  doc.setFontSize(13); doc.setTextColor(120,120,120)
  doc.text("/ 100", margin + 22, y + 10)
  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(30,30,30)
  doc.text("Repository Health Score", margin + 50, y + 4)
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(...sc)
  doc.text(String(level).toUpperCase() + " RISK", margin + 50, y + 11)

  y += 24
  doc.setDrawColor(220,220,220); doc.line(margin, y, W - margin, y); y += 8

  // Metric bars
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30,30,30)
  doc.text("Metrics", margin, y); y += 7
  const barH = 3, gap = 9
  for (const [key, val] of Object.entries(dimensions)) {
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60,60,60)
    doc.text(key, margin, y)
    const fc = val >= 75 ? [34,197,94] : val >= 50 ? [234,179,8] : val >= 25 ? [239,68,68] : [153,27,27]
    doc.setTextColor(...fc)
    doc.text(`${val}/100`, W - margin, y, { align: "right" })
    doc.setFillColor(220,220,220)
    doc.roundedRect(margin, y + 2, contentW, barH, 1, 1, "F")
    doc.setFillColor(...fc)
    doc.roundedRect(margin, y + 2, (val / 100) * contentW, barH, 1, 1, "F")
    y += gap
  }

  y += 4; doc.setDrawColor(220,220,220); doc.line(margin, y, W - margin, y); y += 8

  // Insights
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30,30,30)
  doc.text("Insights", margin, y); y += 7
  for (const item of insights) {
    if (y > 265) { doc.addPage(); y = 20 }
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60,60,60)
    doc.text("•", margin, y)
    const lines = doc.splitTextToSize(item, contentW - 6)
    doc.text(lines, margin + 5, y)
    y += lines.length * 5 + 2
  }

  y += 4; doc.line(margin, y, W - margin, y); y += 8

  // Recommendations
  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(30,30,30)
  doc.text("Recommendations", margin, y); y += 7
  for (const item of recommendations) {
    if (y > 265) { doc.addPage(); y = 20 }
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60,60,60)
    doc.text("•", margin, y)
    const lines = doc.splitTextToSize(item, contentW - 6)
    doc.text(lines, margin + 5, y)
    y += lines.length * 5 + 2
  }

  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8); doc.setTextColor(160,160,160)
    doc.text(`Page ${i} of ${pageCount} · Generated by Repository Analyzer`, W / 2, 292, { align: "center" })
  }

  doc.save("repository-risk-summary.pdf")
}

export default function ProjectRiskSummary({ data }) {
  const summary       = data || {}
  const healthScore   = Number.isFinite(summary.health_score) ? summary.health_score : 0
  const level         = summary.risk_level || "Moderate"
  const insights      = summary.insights || []
  const recommendations = summary.recommendations || []
  const dimensions    = summary.dimensions || {}
  const badge         = riskStyle(level)

  return (
    <div className="project-summary">
      <div className="summary-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="summary-score">
            <span className="summary-score-value">{healthScore}</span>
            <span className="summary-score-denom">/ 100</span>
          </div>
          <div className="summary-meta">
            <div className="summary-title">Repository Health Score</div>
            <div className={badge.className}>{badge.text}</div>
          </div>
        </div>
        <button
          onClick={() => downloadPDF(healthScore, level, insights, recommendations, dimensions)}
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: "#fff", border: "none", borderRadius: "8px",
            padding: "10px 18px", fontSize: "13px", fontWeight: 500,
            cursor: "pointer", whiteSpace: "nowrap",
          }}
        >
          ⬇ Download PDF Summary
        </button>
      </div>

      {Object.keys(dimensions).length > 0 && (
        <div className="summary-block" style={{ marginTop: "20px" }}>
          <h3 style={{ marginBottom: "12px" }}>Metrics</h3>
          {Object.entries(dimensions).map(([key, score]) => (
            <DimensionBar key={key} label={key} score={score} />
          ))}
        </div>
      )}

      <div className="summary-block">
        <h3>Insights</h3>
        {insights.length === 0
          ? <p style={{ color: "var(--text)" }}>No insights available.</p>
          : <ul>{insights.map((item, idx) => <li key={idx}>{item}</li>)}</ul>}
      </div>

      <div className="summary-block">
        <h3>Recommendations</h3>
        {recommendations.length === 0
          ? <p style={{ color: "var(--text)" }}>No recommendations available.</p>
          : <ul>{recommendations.map((item, idx) => <li key={idx}>{item}</li>)}</ul>}
      </div>
    </div>
  )
}