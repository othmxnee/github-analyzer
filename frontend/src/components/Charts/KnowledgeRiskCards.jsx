/* Headline time-aware knowledge-risk cards for the Knowledge & Risk tab.
   Surfaces the two numbers that matter most for turnover: the bus factor among
   developers who are still active (vs the all-time bus factor), and how much of
   the codebase is owned by people who have left. */

function statRisk(kind, value) {
  if (kind === 'bus') return value <= 2 ? 'danger' : value <= 4 ? 'warning' : 'ok'
  if (kind === 'orphan') return value > 0.40 ? 'danger' : value > 0.20 ? 'warning' : 'ok'
  return 'ok'
}

export default function KnowledgeRiskCards({ activeBusFactor, orphanedKnowledge }) {
  const abf = activeBusFactor || {}
  const ok = orphanedKnowledge || {}

  const active = abf.active_bus_factor ?? 0
  const historical = abf.historical_bus_factor ?? 0
  const months = abf.inactive_months ?? 12
  const gap = historical > active

  const orphanPct = ok.orphaned_pct ?? 0
  const heldPct = abf.knowledge_held_by_active_pct ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="stat-grid">
        <div className={`stat-card stat-card--${statRisk('bus', active)}`}>
          <div className="stat-label">Active Bus Factor</div>
          <div className="stat-value">
            {active}
            <span style={{ fontSize: 13, color: 'var(--t3)', fontWeight: 400 }}> / {historical} all-time</span>
          </div>
          <div className="stat-sublabel">
            {gap
              ? `Drops to ${active}: some knowledge holders are no longer active`
              : `Active team still holds the codebase`}
          </div>
        </div>

        <div className={`stat-card stat-card--${statRisk('orphan', orphanPct)}`}>
          <div className="stat-label">Orphaned Knowledge</div>
          <div className="stat-value">{Math.round(orphanPct * 100)}%</div>
          <div className="stat-sublabel">
            Owned by {ok.inactive_developers ?? 0} developer(s) inactive ≥ {months} months
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Held by Active Team</div>
          <div className="stat-value">
            {heldPct === null ? '—' : `${Math.round(heldPct * 100)}%`}
          </div>
          <div className="stat-sublabel">
            {abf.reaches_half === false
              ? 'Active devs own under half the code — the rest is orphaned'
              : 'Share of all lines authored by still-active developers'}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic', margin: 0 }}>
        "Active" = committed within the last {months} months (measured from the project's most recent commit).
        The gap between the active and all-time bus factor is the real continuity risk.
      </p>
    </div>
  )
}
