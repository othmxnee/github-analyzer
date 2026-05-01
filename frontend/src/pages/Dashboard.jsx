import { useEffect, useState } from 'react'
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
import ProjectRiskSummary from '../components/Charts/ProjectRiskSummary'
import RepositoryTreemap from '../components/Charts/RepositoryTreemap'
import VoronoiTreemap from '../components/Charts/VoronoiTreemap'
import RoleDistributionChart from '../components/Charts/RoleDistributionChart'
import SkillsHeatmap from '../components/Charts/SkillsHeatmap'
import DeveloperRadarChart from '../components/Charts/DeveloperRadarChart'
import ThemeToggle from '../components/ThemeToggle'

function Dashboard() {
  const [results, setResults]         = useState(null)
  const [repoUrl, setRepoUrl]         = useState('')
  const [skillsData, setSkillsData]   = useState(null)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillsError, setSkillsError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResults')
    const url    = sessionStorage.getItem('repoUrl')
    if (!stored) { navigate('/'); return }
    setResults(JSON.parse(stored))
    setRepoUrl(url || '')
  }, [navigate])

  // Fetch skills data separately when repoUrl is ready
  useEffect(() => {
    if (!repoUrl) return

    setSkillsLoading(true)
    setSkillsError(null)

    // Step 1: start background analysis
    fetch('http://localhost:5000/analyze/skills', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ repo_url: repoUrl }),
    })

    // Step 2: poll every 5 seconds until done
    const interval = setInterval(() => {
      fetch(`http://localhost:5000/analyze/skills/result?repo_url=${encodeURIComponent(repoUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'done') {
            setSkillsData(data)
            setSkillsLoading(false)
            clearInterval(interval)
          } else if (data.status === 'error') {
            setSkillsError(data.error)
            setSkillsLoading(false)
            clearInterval(interval)
          }
          // if 'running' -> keep polling
        })
        .catch(err => {
          setSkillsError(err.message)
          setSkillsLoading(false)
          clearInterval(interval)
        })
    }, 5000)

    // Cleanup on unmount
    return () => clearInterval(interval)
  }, [repoUrl])

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
    } catch {
      return repoUrl
    }
  })()

  const giniRisk = gini > 0.8 ? 'danger' : gini > 0.6 ? 'warning' : 'ok'
  const busRisk  = bus_factor <= 2 ? 'danger' : bus_factor <= 4 ? 'warning' : 'ok'

  const Card = ({ title, children, icon }) => (
    <div className="card">
      <h2 className="card-title">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      {children}
    </div>
  )

  const StatCard = ({ label, value, sublabel, risk }) => (
    <div className={`stat-card${risk ? ` stat-card--${risk}` : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="stat-sublabel">{sublabel}</div>}
    </div>
  )

  const SectionLabel = ({ icon, title, description }) => (
    <div className="section-group-label">
      <div className="section-group-label__left">
        <span className="section-group-label__icon">{icon}</span>
        <span className="section-group-label__title">{title}</span>
      </div>
      {description && <span className="section-group-label__desc">{description}</span>}
    </div>
  )

  return (
    <div className="page">
      <div className="container">

        {/* ── Top bar ── */}
        <div className="top-bar">
          <button onClick={() => navigate('/')} className="btn btn-ghost">← New Analysis</button>
          <ThemeToggle />
        </div>

        {/* ── Repo header ── */}
        <div className="repo-header">
          <div className="repo-header__slug">{repoSlug}</div>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="repo-header__link"
            title={repoUrl}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
                0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695
                -.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99
                .105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225
                -.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405
                c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225
                0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3
                0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            View on GitHub
          </a>
        </div>

        {/* ════════════════════════════════════
            GROUP 1 — Overview & Health
        ════════════════════════════════════ */}
        <SectionLabel icon="🩺" title="Project Health" description="High-level risk indicators at a glance" />

        <Card title="Overview" icon="📊">
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
        </Card>

        <Card title="Repository Risk Summary" icon="🩺">
          <ProjectRiskSummary data={project_summary} />
        </Card>

        {/* ════════════════════════════════════
            GROUP 2 — Developer Activity
        ════════════════════════════════════ */}
        <SectionLabel icon="👥" title="Developer Activity" description="Who contributes, how often, and how consistently" />

        <div className="grid-2">
          <Card title="Top Developers by Commits" icon="👥">
            <TopDevelopersChart data={top_developers} />
          </Card>
          <Card title="Activity Timeline" icon="📈">
            <TimelineChart data={timeline} />
          </Card>
          <Card title="Contribution Inequality (Lorenz Curve)" icon="⚖️">
            <LorenzChart data={lorenz} gini={gini} />
          </Card>
          <Card title="Inter-Commit Time (Days)" icon="⏱️">
            <InterCommitTable data={inter_commit} />
          </Card>
        </div>

        <div className="grid-2">
          <Card title="Top Developers by File Modifications" icon="🧑‍💻">
            <TopDevModsChart data={top_devs_mods} />
          </Card>
          <Card title="Developer Activity Over Time" icon="📈">
            <CommitFrequencyChart data={commit_frequency} />
          </Card>
        </div>

        <Card title="Developer–File Activity Heatmap" icon="🧭">
          <ActivityHeatmap data={dev_file_matrix} />
        </Card>

        {/* ════════════════════════════════════
            GROUP 3 — Knowledge & Risk
        ════════════════════════════════════ */}
        <SectionLabel icon="⚠️" title="Knowledge & Risk" description="Ownership concentration, bus factor, and file-level risk" />

        <div className="grid-3">
          <Card title="Knowledge Concentration (KCI)" icon="🔐">
            <KCITable data={kci} />
          </Card>
          <Card title="Dependency In-Degree" icon="🏛️">
            <InDegreeTable data={in_degree} />
          </Card>
          <Card title="Risk Analysis (KCI × In-Degree)" icon="⚠️">
            <RiskTable data={risk_files} />
          </Card>
        </div>

        <Card title="Bus Factor Risk Simulation" icon="🧯">
          <BusFactorRiskVisualization data={busfactor_simulation} />
        </Card>

        <div className="grid-2">
          <Card title="Line Ownership Table" icon="📋">
            <OwnershipTable data={ownership_table} />
          </Card>
          <Card title="Line Ownership Plots" icon="📊">
            <OwnershipPlots data={ownership_plots} />
          </Card>
        </div>

        {/* ════════════════════════════════════
            GROUP 4 — Architecture & Hotspots
        ════════════════════════════════════ */}
        <SectionLabel icon="🕸️" title="Architecture & Hotspots" description="Structural dependencies and high-churn files" />

        <Card title="Architecture" icon="🕸️">
          <ArchitectureGraph data={architecture} />
        </Card>

        <div className="grid-2">
          <Card title="Top Modified Files (Hotspots)" icon="🔥">
            <HotspotFilesChart data={hotspot_files} />
          </Card>
          <Card title="Repository File Hotspots (Treemap)" icon="🗂️">
            <RepositoryTreemap data={treemap} />
          </Card>
        </div>

        <Card title="Import-Coupled File Hotspots (Voronoi)" icon="🔷">
          <VoronoiTreemap data={voronoi} />
        </Card>

        {/* ════════════════════════════════════
            GROUP 5 — Developer Skills & Roles  ← NEW
        ════════════════════════════════════ */}
        <SectionLabel
          icon="🧠"
          title="Developer Skills & Roles"
          description="Automatically detected roles based on code contributions"
        />

        {skillsLoading && (
          <Card title="Analyzing developer skills..." icon="🧠">
            <p style={{ color: 'var(--color-text-muted)', padding: '20px 0' }}>
              ⏳ Mining commit history to detect developer roles. This may take a few minutes...
            </p>
          </Card>
        )}

        {skillsError && (
          <Card title="Skills Analysis" icon="🧠">
            <p style={{ color: 'var(--color-danger)' }}>
              Error: {skillsError}
            </p>
          </Card>
        )}

        {skillsData && !skillsLoading && (
          <>
            {/* Summary stat */}
            <Card title="Skills Overview" icon="📊">
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
            </Card>

            <div className="grid-2">
              <Card title="Role Distribution" icon="📊">
                <RoleDistributionChart data={skillsData.role_distribution} />
              </Card>
              <Card title="Developer Skill Profile" icon="🎯">
                <DeveloperRadarChart developers={skillsData.developers} />
              </Card>
            </div>

            <Card title="Developer Skills Heatmap" icon="🌡️">
              <SkillsHeatmap developers={skillsData.developers} />
            </Card>
          </>
        )}

      </div>
    </div>
  )
}

export default Dashboard
