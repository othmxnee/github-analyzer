function riskStyle(level = 'Moderate') {
  const normalized = String(level).toLowerCase()
  if (normalized === 'low') {
    return { className: 'badge-risk badge-risk-low', text: 'Low' }
  }
  if (normalized === 'high') {
    return { className: 'badge-risk badge-risk-high', text: 'High' }
  }
  return { className: 'badge-risk badge-risk-moderate', text: 'Moderate' }
}

function ProjectRiskSummary({ data }) {
  const summary = data || {}
  const healthScore = Number.isFinite(summary.health_score) ? summary.health_score : 0
  const level = summary.risk_level || 'Moderate'
  const insights = summary.insights || []
  const recommendations = summary.recommendations || []
  const badge = riskStyle(level)

  return (
    <div className="project-summary">
      <div className="summary-top">
        <div className="summary-score">
          <span className="summary-score-value">{healthScore}</span>
          <span className="summary-score-denom">/ 100</span>
        </div>
        <div className="summary-meta">
          <div className="summary-title">Repository Health Score</div>
          <div className={badge.className}>{badge.text} Risk</div>
        </div>
      </div>

      <div className="summary-block">
        <h3>Insights</h3>
        {insights.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No insights available.</p>
        ) : (
          <ul>
            {insights.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="summary-block">
        <h3>Recommendations</h3>
        {recommendations.length === 0 ? (
          <p style={{ color: '#9ca3af' }}>No recommendations available.</p>
        ) : (
          <ul>
            {recommendations.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ProjectRiskSummary
