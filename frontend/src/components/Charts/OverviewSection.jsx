import { downloadPDF } from "./ProjectRiskSummary"
import { CountUp } from "../../hooks/useMotion"

/* ── helpers ───────────────────────────────────────────────────────── */
function relativeDays(days) {
  if (days == null) return "—"
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.round(days / 7)} weeks ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  const years = (days / 365)
  return years >= 2 ? `${Math.round(years)} years ago` : `${years.toFixed(1)} years ago`
}

function formatAge(days) {
  if (!days || days < 30) return "<1 month"
  if (days < 365) return `${Math.round(days / 30)} months`
  const years = days / 365
  return years >= 2 ? `${Math.round(years)} years` : `${years.toFixed(1)} years`
}

function riskBadge(level = "Moderate") {
  const map = {
    low:      { className: "badge-risk-low",      text: "Low Risk" },
    moderate: { className: "badge-risk-moderate", text: "Moderate Risk" },
    high:     { className: "badge-risk-high",     text: "High Risk" },
    critical: { className: "badge-risk-critical", text: "Critical Risk" },
  }
  return map[String(level).toLowerCase()] ?? map.moderate
}

const sevColor = (s) =>
  s === "high"     ? "var(--red)"
  : s === "moderate" ? "var(--amber)"
  : s === "ok"     ? "var(--green)"
  : "var(--bs)"

const sevBg = (s) =>
  s === "high"     ? "var(--red-d)"
  : s === "moderate" ? "var(--amber-d)"
  : s === "ok"     ? "var(--green-d)"
  : "var(--bg2)"

const dimColor = (score) =>
  score >= 75 ? "var(--green)"
  : score >= 50 ? "var(--amber)"
  : score >= 25 ? "var(--red)"
  : "#991b1b"

const LANG_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#6b7280"]

/* ── sub-components ────────────────────────────────────────────────── */
function IdentityStrip({ repoSlug, language, ageDays, lastActiveDays, isStale }) {
  const items = [
    { label: "REPOSITORY", value: repoSlug },
    { label: "PRIMARY LANGUAGE", value: language || "—" },
    { label: "PROJECT AGE", value: formatAge(ageDays) },
    {
      label: "LAST ACTIVITY",
      value: relativeDays(lastActiveDays),
      color: isStale ? "var(--amber)" : (lastActiveDays > 30 ? "var(--t)" : "var(--green)"),
    },
  ]
  return (
    <div className="overview-identity">
      {items.map((it, i) => (
        <div key={i} className="overview-identity-item">
          <div className="overview-identity-label">{it.label}</div>
          <div className="overview-identity-value" style={it.color ? { color: it.color } : undefined}>
            {it.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function VerdictHero({ score, level, verdict, onDownloadPDF }) {
  const badge = riskBadge(level)
  const color = dimColor(score)
  return (
    <div className="overview-hero">
      <div className="overview-hero-score-block">
        <div className="overview-hero-score" style={{ color }}>
          <CountUp value={score} dur={1100} />
        </div>
        <div className="overview-hero-score-denom">/ 100</div>
      </div>
      <div className="overview-hero-body">
        <div className="overview-hero-title-row">
          <div className="overview-hero-title">Repository Health Score</div>
          <span className={`badge-risk ${badge.className}`}>{badge.text}</span>
        </div>
        <div className="overview-hero-verdict">{verdict}</div>
      </div>
      <button
        className="overview-pdf-icon"
        onClick={onDownloadPDF}
        title="Download PDF summary"
        aria-label="Download PDF summary"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>PDF</span>
      </button>
    </div>
  )
}

function ContextualStat({ label, value, sub, accent, trend }) {
  const trendArrow = trend === "up" ? "↑" : trend === "down" ? "↓" : null
  const trendColor =
    trend === "up"   ? "var(--green)"
    : trend === "down" ? "var(--red)"
    : "var(--t3)"
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
        {trendArrow && (
          <span style={{ color: trendColor, fontSize: 14, marginLeft: 6, fontWeight: 600 }}>{trendArrow}</span>
        )}
      </div>
      {sub && <div className="stat-sublabel">{sub}</div>}
    </div>
  )
}

function LanguageMix({ mix }) {
  if (!mix || mix.length === 0) {
    return <div className="stat-sublabel" style={{ marginTop: 4 }}>No language data</div>
  }
  return (
    <div>
      <div className="overview-langbar">
        {mix.map((l, i) => (
          <div
            key={l.name}
            className="overview-langbar-seg"
            style={{ width: `${l.pct}%`, background: LANG_COLORS[i % LANG_COLORS.length] }}
            title={`${l.name} ${l.pct}%`}
          />
        ))}
      </div>
      <div className="overview-langbar-legend">
        {mix.map((l, i) => (
          <div key={l.name} className="overview-langbar-legend-item">
            <span className="overview-langbar-dot" style={{ background: LANG_COLORS[i % LANG_COLORS.length] }} />
            <span>{l.name}</span>
            <span style={{ color: "var(--t3)" }}>{l.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NamedFinding({ severity, title, detail }) {
  const color = sevColor(severity)
  const bg = sevBg(severity)
  const label =
    severity === "high"     ? "HIGH"
    : severity === "moderate" ? "WATCH"
    : severity === "ok"     ? "OK"
    : "INFO"
  return (
    <div
      className="overview-finding"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="overview-finding-head">
        <span
          className="overview-finding-sev"
          style={{ background: bg, color }}
        >
          {label}
        </span>
        <div className="overview-finding-title">{title}</div>
      </div>
      <div className="overview-finding-detail">{detail}</div>
    </div>
  )
}

function InfoTip({ text }) {
  return (
    <span
      className="overview-info"
      tabIndex={0}
      role="button"
      aria-label={text}
    >
      i
      <span className="overview-info-tip" role="tooltip">{text}</span>
    </span>
  )
}

function DimensionBar({ label, score, info }) {
  const c = dimColor(score)
  return (
    <div className="overview-dim">
      <div className="overview-dim-row">
        <span className="overview-dim-label">
          {info && <InfoTip text={info} />}
          {label}
        </span>
        <span className="overview-dim-score" style={{ color: c }}><CountUp value={score} />/100</span>
      </div>
      <div className="overview-dim-track">
        <div className="overview-dim-fill" style={{ width: `${score}%`, background: c }} />
      </div>
    </div>
  )
}

const DIMENSION_INFO = {
  Activity:     "How recent and frequent commits are. High score = the repo is actively being worked on (recent commits, steady or growing pace). Low score = stale or abandoned.",
  Team:         "How many developers are contributing right now vs. lifetime. High score = several people committed in the last 90 days. Low score = the active team has shrunk to one or two people.",
  Knowledge:    "Whether knowledge of architecturally important files is spread across the team. Computed from KCI (knowledge concentration) × in-degree (how many other files depend on each file). Low score = critical files are owned by a single person — risky if they leave.",
  Distribution: "How evenly contributions are spread across all developers (based on the Gini coefficient). High score = everyone contributes a fair share. Low score = a small core does most of the work and the long tail rarely commits.",
}

/* ── main ──────────────────────────────────────────────────────────── */
export default function OverviewSection({
  repoSlug,
  summary = {},
  overview = {},
  projectSummary = {},
  gini = 0,
  busFactor = 0,
}) {
  const activity = overview.activity || {}
  const languages = overview.languages || { primary: "—", mix: [] }
  const findings = overview.named_findings || []
  const healthDims = overview.health_dimensions || {}
  const verdict = overview.verdict || "Overview is being computed…"

  const healthScore = projectSummary.health_score ?? 0
  const level = projectSummary.risk_level || "Moderate"
  const insights = projectSummary.insights || []
  const recommendations = projectSummary.recommendations || []
  const baseDims = projectSummary.dimensions || {}

  const handlePDF = () =>
    downloadPDF(healthScore, level, insights, recommendations, baseDims, {
      repoSlug,
      verdict,
      activity,
      languages,
      findings,
      healthDimensions: healthDims,
    })

  const giniRisk = gini > 0.8 ? "danger" : gini > 0.6 ? "warning" : null
  const busRisk  = busFactor <= 2 ? "danger" : busFactor <= 4 ? "warning" : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-card)" }}>
      <IdentityStrip
        repoSlug={repoSlug}
        language={languages.primary}
        ageDays={activity.project_age_days}
        lastActiveDays={activity.last_commit_days_ago}
        isStale={activity.is_stale}
      />

      <VerdictHero
        score={healthScore}
        level={level}
        verdict={verdict}
        onDownloadPDF={handlePDF}
      />

      {/* Contextual stats — meaningful numbers, not raw counts */}
      <div className="stat-grid">
        <ContextualStat
          label="Active Developers (90d)"
          value={<CountUp value={activity.active_devs_90d ?? 0} />}
          sub={`of ${activity.total_devs ?? summary.total_developers ?? 0} lifetime contributors`}
        />
        <ContextualStat
          label="Commits / Week (90d)"
          value={<CountUp value={activity.commits_per_week_90d ?? 0} />}
          sub={
            activity.trend === "flat"
              ? "Stable rate"
              : `${activity.trend_pct > 0 ? "+" : ""}${activity.trend_pct ?? 0}% vs prior 90d`
          }
          trend={activity.trend}
        />
        <ContextualStat
          label="Total Commits"
          value={<CountUp value={summary.total_commits ?? 0} />}
          sub={`across ${formatAge(activity.project_age_days)}`}
        />
        <ContextualStat
          label="Files Analyzed"
          value={<CountUp value={summary.total_files ?? 0} />}
          sub={`${(summary.total_modifications ?? 0).toLocaleString()} total modifications`}
        />
        <ContextualStat
          label="Bus Factor"
          value={<CountUp value={busFactor} />}
          sub="Devs covering 50% of code"
          accent={busRisk === "danger" ? "var(--red)" : busRisk === "warning" ? "var(--amber)" : undefined}
        />
        <ContextualStat
          label="Gini Coefficient"
          value={gini != null ? <CountUp value={gini} decimals={2} /> : "—"}
          sub="0 = equal, 1 = skewed"
          accent={giniRisk === "danger" ? "var(--red)" : giniRisk === "warning" ? "var(--amber)" : undefined}
        />
      </div>

      {/* Two-column: Health Dimensions + Language Mix */}
      <div className="overview-two-col">
        <div className="card">
          <div className="card-title">
            <span>Health Dimensions</span>
            <span>Higher is better</span>
          </div>
          <div style={{ padding: "18px" }}>
            {["Activity", "Team", "Knowledge", "Distribution"].map((dim) => (
              <DimensionBar
                key={dim}
                label={dim}
                score={healthDims[dim] ?? 0}
                info={DIMENSION_INFO[dim]}
              />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <span>Language Mix</span>
            <span>By file count</span>
          </div>
          <div style={{ padding: "18px" }}>
            <LanguageMix mix={languages.mix} />
          </div>
        </div>
      </div>

      {/* Named findings — specific, with real names */}
      {findings.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>Key Findings</span>
            <span>Specific, actionable</span>
          </div>
          <div style={{ padding: "18px", display: "grid", gap: 12 }}>
            {findings.map((f, i) => (
              <NamedFinding key={i} {...f} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span>Recommendations</span>
          </div>
          <div style={{ padding: "18px" }}>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--t2)" }}>
              {recommendations.map((r, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
