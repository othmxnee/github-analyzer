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
import ThemeToggle from '../components/ThemeToggle'

function Dashboard() {
  const [results, setResults] = useState(null)
  const [repoUrl, setRepoUrl] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const stored = sessionStorage.getItem('analysisResults')
    const url = sessionStorage.getItem('repoUrl')

    if (!stored) {
      navigate('/')
      return
    }

    setResults(JSON.parse(stored))
    setRepoUrl(url || '')
  }, [navigate])

  if (!results) {
    return null
  }

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
    busfactor_simulation = { developers: [], simulation: [] },
    project_summary = { health_score: 0, risk_level: 'Unknown', insights: [], recommendations: [] }
  } = results

  const Card = ({ title, children, icon }) => (
    <div className="card">
      <h2 className="card-title">
        {icon && <span>{icon}</span>}
        {title}
      </h2>
      {children}
    </div>
  )

  const StatCard = ({ label, value, sublabel }) => (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="stat-label">{sublabel}</div>}
    </div>
  )

  return (
    <div className="page">
      <div className="container">
        <div className="top-bar">
          <button
            onClick={() => navigate('/')}
            className="btn btn-ghost"
          >
            ← New Analysis
          </button>
          <ThemeToggle />
        </div>

        <h1 className="section-title" style={{ wordBreak: 'break-all' }}>{repoUrl}</h1>

        <Card title="Repository Risk Summary" icon="🩺">
          <ProjectRiskSummary data={project_summary} />
        </Card>

        <Card title="Overview" icon="📊">
          <div className="stat-grid">
            <StatCard label="Total Commits" value={summary.total_commits} />
            <StatCard label="Developers" value={summary.total_developers} />
            <StatCard label="Files Analyzed" value={summary.total_files} />
            <StatCard label="Modifications" value={summary.total_modifications} />
            <StatCard label="Gini Coefficient" value={gini?.toFixed(3) || 'N/A'} sublabel="Inequality measure" />
            <StatCard label="Bus Factor" value={bus_factor} sublabel="Developers for 50% of changes" />
          </div>
        </Card>

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

        <div className="grid-3">
          <Card title="Knowledge Concentration (KCI) - Top Files" icon="🔐">
            <KCITable data={kci} />
          </Card>

          <Card title="Dependency In-Degree - Architectural Importance" icon="🏛️">
            <InDegreeTable data={in_degree} />
          </Card>

          <Card title="Risk Analysis (KCI × In-Degree)" icon="⚠️">
            <RiskTable data={risk_files} />
          </Card>
        </div>

        <div className="grid-3">
          <Card title="Top Developers by File Modifications" icon="🧑‍💻">
            <TopDevModsChart data={top_devs_mods} />
          </Card>

          <Card title="Top Modified Files (Hotspots)" icon="🔥">
            <HotspotFilesChart data={hotspot_files} />
          </Card>

          <Card title="Developer Activity Over Time" icon="📈">
            <CommitFrequencyChart data={commit_frequency} />
          </Card>
        </div>

        <Card title="Developer–File Activity Heatmap" icon="🧭">
          <ActivityHeatmap data={dev_file_matrix} />
        </Card>

        <Card title="Architecture" icon="🕸️">
          <ArchitectureGraph data={architecture} />
        </Card>

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
      </div>
    </div>
  )
}

export default Dashboard
