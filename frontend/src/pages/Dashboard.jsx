import { useEffect, useState, useCallback, useRef, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import TopDevelopersChart from '../components/Charts/TopDevelopersChart'
import TimelineChart from '../components/Charts/TimelineChart'
import LorenzChart from '../components/Charts/LorenzChart'
import KCITable from '../components/Charts/KCITable'
import InDegreeTable from '../components/Charts/PageRankTable'
import RiskTable from '../components/Charts/RiskTable'
import InterCommitTable from '../components/Charts/InterCommitTable'
import TopDevModsChart from '../components/Charts/TopDevModsChart'
import HotspotFilesChart from '../components/Charts/HotspotFilesChart'
import ActivityHeatmap from '../components/Charts/ActivityHeatmap'
import OwnershipTable from '../components/Charts/OwnershipTable'
import OwnershipPlots from '../components/Charts/OwnershipPlots'
import CommitFrequencyChart from '../components/Charts/CommitFrequencyChart'
import ArchitectureGraph from '../components/Charts/ArchitectureGraph'
import BusFactorRiskVisualization from '../components/Charts/BusFactorRiskVisualization'
import ProjectRiskSummary, { downloadPDF } from '../components/Charts/ProjectRiskSummary'
import RepositoryTreemap from '../components/Charts/RepositoryTreemap'
import VoronoiTreemap from '../components/Charts/VoronoiTreemap'
import DevelopersList from '../components/Charts/DevelopersList'
import RoleDistributionChart from '../components/Charts/RoleDistributionChart'
import SkillsHeatmap from '../components/Charts/SkillsHeatmap'
import DeveloperRadarChart from '../components/Charts/DeveloperRadarChart'
import DeveloperScatterPlot from '../components/Charts/DeveloperScatterPlot'
import '../styles/Dashboard.css'

/* ─────────────────────────────────────────
   SVG ICONS
───────────────────────────────────────── */
const Icon = {
  Back: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  GitHub: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  ),
  Download: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  Overview: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Roles: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Developers: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
      <path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/>
    </svg>
  ),
  Knowledge: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  ),
  Hotspots: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Architecture: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Info: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
}

/* ─────────────────────────────────────────
   SECTION HEADER COMPONENT
───────────────────────────────────────── */
function SectionHead({ eyebrow, title, sub }) {
  return (
    <div className="dash-section-head">
      <div>
        <div className="dash-s-eyebrow">{eyebrow}</div>
        <div className="dash-s-title">{title}</div>
        {sub && <div className="dash-s-sub">{sub}</div>}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   ERROR BOUNDARY
───────────────────────────────────────── */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '14px', color: 'var(--red)', fontSize: 12, fontFamily: 'var(--mono)' }}>
          Chart unavailable — {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

/* ─────────────────────────────────────────
   CHART CARD COMPONENT
───────────────────────────────────────── */
function ChartCard({ title, sub, children }) {
  return (
    <div className="card">
      <div className="card-title">
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--t)' }}>{title}</span>
        {sub && <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 'auto', fontFamily: 'var(--mono)' }}>{sub}</span>}
      </div>
      <div style={{ padding: '18px' }}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   STAT CARD (overrides old one)
───────────────────────────────────────── */
function StatCard({ label, value, sublabel, risk }) {
  return (
    <div className={`stat-card${risk ? ` stat-card--${risk}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sublabel && <div className="stat-sublabel">{sublabel}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────
   NAV SECTIONS CONFIG
───────────────────────────────────────── */
const NAV_SECTIONS = [
  { id: 'overview',     label: 'Overview',         Icon: Icon.Overview,      badge: null },
  { id: 'activity',     label: 'Activity',          Icon: Icon.Activity,      badge: null },
  { id: 'knowledge',    label: 'Knowledge & Risk',  Icon: Icon.Knowledge,     badge: 'red' },
  { id: 'hotspots',     label: 'Hotspots',          Icon: Icon.Hotspots,      badge: 'amber' },
  { id: 'architecture', label: 'Architecture',      Icon: Icon.Architecture,  badge: null },
  { id: 'roles',        label: 'Developer Roles',   Icon: Icon.Roles,         badge: null },
  { id: 'developers',   label: 'Developers',        Icon: Icon.Developers,    badge: null },
]

/* ─────────────────────────────────────────
   SCORE COLOR HELPER
───────────────────────────────────────── */
function scoreColor(score) {
  if (score >= 70) return 'green'
  if (score >= 40) return 'amber'
  return 'red'
}

/* ═════════════════════════════════════════
   DASHBOARD
═════════════════════════════════════════ */
export default function Dashboard() {
  const [results, setResults]             = useState(null)
  const [repoUrl, setRepoUrl]             = useState('')
  const [skillsData, setSkillsData]       = useState(null)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError]     = useState(null)
  const [activeSection, setActiveSection] = useState('overview')
  const [isLight, setIsLight]             = useState(false)
  const navigate = useNavigate()

  /* ── load results ── */
  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResults')
    const url    = sessionStorage.getItem('repoUrl')
    if (!stored) { navigate('/'); return }
    setResults(JSON.parse(stored))
    setRepoUrl(url || '')
  }, [navigate])

  /* ── fetch skills (lazy: only starts when user first visits "Developer Roles") ── */
  const skillsStarted = useRef(false)
  useEffect(() => {
    if (!repoUrl || (activeSection !== 'roles' && activeSection !== 'developers') || skillsStarted.current) return
    skillsStarted.current = true
    setSkillsLoading(true)
    setSkillsError(null)

    let interval = null
    let cancelled = false

    const pollOnce = () =>
      fetch(`http://localhost:5000/analyze/skills/result?repo_url=${encodeURIComponent(repoUrl)}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return false
          if (data.status === 'done')  { setSkillsData(data);        setSkillsLoading(false); return true }
          if (data.status === 'error') { setSkillsError(data.error); setSkillsLoading(false); return true }
          return false
        })
        .catch(() => false)

    const run = async () => {
      // Kick off backend job — idempotent, returns immediately if already done/running
      await fetch('http://localhost:5000/analyze/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repoUrl }),
      }).catch(() => {})

      if (cancelled) return
      // First poll immediately — shows cached result on re-visit without any wait
      const done = await pollOnce()
      if (done) return

      interval = setInterval(async () => {
        const finished = await pollOnce()
        if (finished && interval) clearInterval(interval)
      }, 5000)
    }

    run().catch(err => { if (!cancelled) { setSkillsError(err.message); setSkillsLoading(false) } })

    return () => { cancelled = true; if (interval) clearInterval(interval) }
  }, [repoUrl, activeSection])

  const toggleTheme = useCallback(() => {
    setIsLight(v => {
      const next = !v
      document.documentElement.setAttribute('data-theme', next ? 'light' : '')
      document.body.classList.toggle('lm', next)
      return next
    })
  }, [])

  /* ── section switch → scroll main to top ── */
  const switchSection = useCallback((id) => {
    setActiveSection(id)
    document.getElementById('dash-main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (!results) return null

  const {
    summary = {},
    top_developers = [],
    top_devs_mods = [],
    timeline = [],
    commit_frequency = [],
    gini = 0,
    lorenz = { x: [0, 1], y: [0, 1] },
    bus_factor = 0,
    kci = [],
    in_degree = [],
    risk_files = [],
    inter_commit = {},
    hotspot_files = [],
    dev_file_matrix = { developers: [], files: [], values: [] },
    ownership_table = [],
    ownership_plots = [],
    architecture = { nodes: [], edges: [] },
    treemap = { ids: [], labels: [], parents: [], values: [], paths: [] },
    voronoi = { nodes: [], edges: [] },
    busfactor_simulation = { developers: [], simulation: [] },
    project_summary = { health_score: 0, risk_level: 'Unknown', insights: [], recommendations: [] }
  } = results

  const repoSlug = (() => {
    try {
      const parts = repoUrl.replace(/\.git$/, '').split('/')
      return parts.slice(-2).join(' / ')
    } catch { return repoUrl }
  })()

  const giniRisk  = gini > 0.8 ? 'danger' : gini > 0.6 ? 'warning' : 'ok'
  const busRisk   = bus_factor <= 2 ? 'danger' : bus_factor <= 4 ? 'warning' : 'ok'
  const healthScore = project_summary.health_score || 0
  const hwColor   = scoreColor(healthScore)

  /* ─────────────────────────────────────────
     SECTION RENDERERS
  ───────────────────────────────────────── */
  const renderOverview = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-card)' }}>
      <SectionHead
        eyebrow="Overview"
        title="Project Health"
        sub="High-level risk indicators at a glance"
      />
      <div className="stat-grid">
        <StatCard label="Total Commits"   value={summary.total_commits} />
        <StatCard label="Developers"      value={summary.total_developers} />
        <StatCard label="Files Analyzed"  value={summary.total_files} />
        <StatCard label="Modifications"   value={summary.total_modifications} />
        <StatCard
          label="Gini Coefficient"
          value={gini?.toFixed(3) || 'N/A'}
          sublabel="Contribution inequality"
          risk={giniRisk}
        />
        <StatCard
          label="Bus Factor"
          value={bus_factor}
          sublabel="Devs covering 50% of changes"
          risk={busRisk}
        />
      </div>
      <ChartCard title="Repository Risk Summary" sub="Composite score across all risk dimensions">
        <ProjectRiskSummary data={project_summary} />
      </ChartCard>
    </div>
  )

  const renderActivity = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-card)' }}>
      <SectionHead
        eyebrow="Activity"
        title="Developer Activity"
        sub="Who contributes, how often, and how consistently"
      />

      {/* Row 1 — Timeline (wider) + Inter-Commit (narrower) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--gap-card)' }}>
        <ChartCard title="Activity Timeline" sub="Monthly commit volume">
          <TimelineChart data={timeline} />
        </ChartCard>
        <ChartCard title="Inter-Commit Time (Days)">
          <InterCommitTable data={inter_commit} />
        </ChartCard>
      </div>

      {/* Row 2 — Lorenz + Top Developers filling the row equally */}
      <div className="grid-2">
        <ChartCard title="Contribution Inequality (Lorenz Curve)">
          <LorenzChart data={lorenz} gini={gini} />
        </ChartCard>
        <ChartCard title="Top Developers by Commits">
          <TopDevelopersChart data={top_developers} />
        </ChartCard>
      </div>

      {/* Row 3 — Commit frequency full width */}
      <ChartCard title="Developer Activity Over Time">
        <CommitFrequencyChart data={commit_frequency} />
      </ChartCard>

      {/* Row 4 — Dev mods timeline full width */}
      <ChartCard title="Top Developers by File Modifications">
        <TopDevModsChart data={top_devs_mods} />
      </ChartCard>

      {/* Row 5 — Heatmap full width */}
      <ChartCard title="Developer–File Activity Heatmap">
        <ActivityHeatmap data={dev_file_matrix} />
      </ChartCard>
    </div>
  )

  const renderKnowledge = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-card)' }}>
      <SectionHead
        eyebrow="Knowledge & Risk"
        title="Ownership & Bus Factor"
        sub="Who knows what — and what happens if they leave"
      />
      <div className="grid-3">
        <ChartCard title="Knowledge Concentration (KCI)">
          <KCITable data={kci} />
        </ChartCard>
        <ChartCard title="Dependency In-Degree">
          <InDegreeTable data={in_degree} />
        </ChartCard>
        <ChartCard title="Risk Analysis (KCI × In-Degree)">
          <RiskTable data={risk_files} />
        </ChartCard>
      </div>
      <ChartCard title="Bus Factor Risk Simulation">
        <BusFactorRiskVisualization data={busfactor_simulation} />
      </ChartCard>
      <div className="grid-2">
        <ChartCard title="Line Ownership Table">
          <OwnershipTable data={ownership_table} />
        </ChartCard>
        <ChartCard title="Line Ownership Plots">
          <OwnershipPlots data={ownership_plots} />
        </ChartCard>
      </div>
    </div>
  )

  const renderHotspots = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-card)' }}>
      <SectionHead
        eyebrow="Hotspots"
        title="Code Churn & Hotspots"
        sub="Highest-churn files by modification frequency"
      />
      <div className="grid-2">
        <ChartCard title="Top Modified Files (Hotspots)">
          <HotspotFilesChart data={hotspot_files} />
        </ChartCard>
        <ChartCard title="Repository File Hotspots (Treemap)">
          <RepositoryTreemap data={treemap} />
        </ChartCard>
      </div>
      <ChartCard title="Import-Coupled File Hotspots (Voronoi)">
        <VoronoiTreemap data={voronoi} />
      </ChartCard>
    </div>
  )

  const renderArchitecture = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-card)' }}>
      <SectionHead
        eyebrow="Architecture"
        title="Dependency Graph"
        sub="File coupling and PageRank centrality"
      />
      <ChartCard title="Architecture Graph">
        <ArchitectureGraph data={architecture} />
      </ChartCard>
    </div>
  )

  const renderRoles = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-card)' }}>
      <SectionHead
        eyebrow="Developer Roles"
        title="Skills & Role Detection"
        sub="15 metrics per developer · K-Means clustering · PCA projection"
      />
      {skillsLoading && (
        <div className="dash-loading-card">
          <div className="dash-spinner" />
          Mining commit history to detect developer roles — this may take a few minutes…
        </div>
      )}
      {skillsError && (
        <div className="card" style={{ padding: 20, color: 'var(--red)' }}>
          Error: {skillsError}
        </div>
      )}
      {skillsData && !skillsLoading && (
        <>
          <div className="stat-grid">
            <StatCard
              label="Developers Analyzed"
              value={skillsData.total_analyzed}
              sublabel="With 5+ commits"
            />
            {Object.entries(skillsData.role_distribution).map(([role, count]) => (
              <StatCard key={role} label={role} value={count} />
            ))}
          </div>
          <div className="grid-2">
            <ChartCard title="Role Distribution">
              <RoleDistributionChart data={skillsData.role_distribution} />
            </ChartCard>
            <ChartCard title="Developer Skill Profile">
              <DeveloperRadarChart developers={skillsData.developers} />
            </ChartCard>
          </div>
          <ChartCard title="Developer Map — Skill Similarity (PCA)">
            <DeveloperScatterPlot developers={skillsData.developers} />
          </ChartCard>
          <ChartCard title="Developer Skills Heatmap">
            <SkillsHeatmap developers={skillsData.developers} />
          </ChartCard>
        </>
      )}
      {!skillsData && !skillsLoading && !skillsError && (
        <div className="dash-loading-card">
          <div className="dash-spinner" />
          Waiting for skills analysis to start…
        </div>
      )}
    </div>
  )

  const sectionMap = {
    overview:     renderOverview,
    activity:     renderActivity,
    knowledge:    renderKnowledge,
    hotspots:     renderHotspots,
    architecture: renderArchitecture,
    roles:        renderRoles,
    developers:   null,  // rendered inline below (needs full-height layout)
  }

  /* ── date range from timeline ── */
  const dateRange = (() => {
    if (!timeline?.length) return null
    const first = timeline[0]?.date || ''
    const last  = timeline[timeline.length - 1]?.date || ''
    if (!first || !last) return null
    return `${first.slice(0,7)} → ${last.slice(0,7)}`
  })()

  return (
    <>
      {/* ══ TOP BAR ══ */}
      <header className="dash-topbar">
        {/* Logo */}
        <div className="dash-topbar-logo">
          git<span className="dot">·</span>analyzer
        </div>

        {/* Center: back + repo slug */}
        <div className="dash-topbar-center">
          <button className="dash-back-btn" onClick={() => navigate('/')}>
            <Icon.Back />
            New analysis
          </button>
          <div className="dash-divider" />
          <div className="dash-repo-name">{repoSlug}</div>
          <div className="dash-repo-badge">ANALYZED</div>
        </div>

        {/* Right: actions */}
        <div className="dash-topbar-right">
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dash-gh-btn"
          >
            <Icon.GitHub />
            View on GitHub
          </a>
          <button
            className="dash-reanalyze-btn"
            onClick={() => {
              sessionStorage.removeItem('analysisResults')
              navigate('/', { state: { repoUrl, autoSubmit: true } })
            }}
          >
            <Icon.Refresh />
            Re-analyze
          </button>
          <button
            className="dash-pdf-btn"
            onClick={() => downloadPDF(
              project_summary.health_score,
              project_summary.risk_level,
              project_summary.insights || [],
              project_summary.recommendations || [],
              project_summary.dimensions || {}
            )}
          >
            <Icon.Download />
            PDF Report
          </button>
          <button className="dash-mode-btn" onClick={toggleTheme}>
            {isLight ? <Icon.Moon /> : <Icon.Sun />}
            {isLight ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <div className="dash-shell">
        {/* ══ SIDEBAR ══ */}
        <aside className="dash-sidebar">

          {/* Health score widget */}
          <div className="dash-health-widget">
            <div className="dash-hw-label">Health Score</div>
            <div className="dash-hw-score">
              <div className={`dash-hw-num ${hwColor}`}>{healthScore}</div>
              <div className="dash-hw-denom">/ 100</div>
            </div>
            <div className="dash-hw-bar">
              <div
                className={`dash-hw-fill ${hwColor}`}
                style={{ width: `${Math.min(healthScore, 100)}%` }}
              />
            </div>
          </div>

          {/* Nav */}
          <div className="dash-nav-label" style={{ marginTop: 20 }}>Navigation</div>

          {NAV_SECTIONS.map(({ id, label, Icon: NavIcon, badge }) => (
            <div
              key={id}
              className={`dash-nav-item${activeSection === id ? ' active' : ''}`}
              onClick={() => switchSection(id)}
            >
              <NavIcon />
              {label}
              {badge && (
                <span className={`dash-nav-badge ${badge}`}>
                  {badge === 'red' ? 'Risk' : 'High'}
                </span>
              )}
              {id === 'roles' && skillsLoading && (
                <span className="dash-nav-badge amber" style={{ marginLeft: 'auto' }}>live</span>
              )}
            </div>
          ))}

          {/* Meta */}
          <div className="dash-nav-label">Repository</div>
          {summary.total_commits && (
            <div className="dash-nav-meta">
              <Icon.Info />
              {summary.total_commits?.toLocaleString()} commits · {summary.total_developers} devs
            </div>
          )}
          {dateRange && (
            <div className="dash-nav-meta">
              <Icon.Calendar />
              {dateRange}
            </div>
          )}
        </aside>

        {/* ══ MAIN ══ */}
        <main
          id="dash-main-scroll"
          className="dash-main"
          style={activeSection === 'developers' ? { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}}
        >
          {activeSection === 'developers'
            ? <DevelopersList results={results} skillsData={skillsData} skillsLoading={skillsLoading} />
            : (sectionMap[activeSection] || renderOverview)()
          }
        </main>
      </div>
    </>
  )
}