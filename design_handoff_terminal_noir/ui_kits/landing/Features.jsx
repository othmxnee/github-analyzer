/* eslint-disable */
const FEATURES = [
  { t: 'Developer Activity',  icon: <Ico.Activity />,
    d: 'Commit timelines, inter-commit cadence, and per-author file modification heatmaps.' },
  { t: 'Knowledge & Risk',    icon: <Ico.Knowledge />,
    d: 'Lorenz curve, Gini coefficient, bus factor, and line-ownership tables — quantify exposure.' },
  { t: 'Code Hotspots',       icon: <Ico.Hotspots />,
    d: 'High-churn files surfaced as bar charts, treemaps, and import-coupled Voronoi diagrams.' },
  { t: 'Architecture Graph',  icon: <Ico.Architecture />,
    d: 'Force-directed dependency graph with PageRank centrality. Find the structural keystones.' },
  { t: 'Developer Roles',     icon: <Ico.Roles />,
    d: 'K-Means clusters every contributor into one of 7 technical roles using 15 metrics each.' },
  { t: 'Project Health',      icon: <Ico.Overview />,
    d: 'A single 0–100 score with insights, recommendations, and a downloadable PDF report.' },
];

function Features() {
  return (
    <section className="hp-section" id="hp-features">
      <div className="hp-inner">
        <div className="hp-reveal">
          <div className="hp-s-label">What it analyzes</div>
          <div className="hp-s-title">Six lenses on your codebase</div>
          <div className="hp-s-sub">Every dimension of repository health, in one dashboard.</div>
        </div>
        <div className="hp-feats hp-reveal">
          {FEATURES.map(({ t, d, icon }) => (
            <div className="hp-feat" key={t}>
              <div className="hp-feat-ico">{icon}</div>
              <div className="hp-feat-t">{t}</div>
              <div className="hp-feat-d">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ROLES = [
  { name: 'Frontend',   color: '#3B6EEA', desc: 'Owns .tsx/.css/.vue, ships UI components.',          badge: 'UI' },
  { name: 'Backend',    color: '#00C896', desc: 'Server-side .py/.go/.rs and database migrations.',   badge: 'API' },
  { name: 'DevOps',     color: '#F59E0B', desc: 'Dockerfiles, CI configs, infra-as-code.',             badge: 'INFRA' },
  { name: 'Full Stack', color: '#A78BFA', desc: 'Mixed signal across UI, server, and infra.',         badge: 'MIXED' },
  { name: 'Tester',     color: '#EF4444', desc: 'Test files, spec coverage, integration suites.',     badge: 'QA' },
  { name: 'Mobile',     color: '#06B6D4', desc: 'iOS / Android / React Native code paths.',           badge: 'IOS · AND' },
  { name: 'Generalist', color: '#7880A0', desc: 'No dominant signal — touches everything.',           badge: 'GENERAL' },
];

function Roles({ isLight }) {
  return (
    <section className="hp-section alt" id="hp-roles">
      <div className="hp-inner">
        <div className="hp-reveal">
          <div className="hp-s-label">Developer Role Detection</div>
          <div className="hp-s-title">Automatically profile every contributor</div>
          <div className="hp-s-sub">
            15 metrics per developer — file extension ratios, folder path patterns, and commit message
            keywords — then K-Means clustering assigns precise technical roles.
          </div>
        </div>
        <div className="hp-roles hp-reveal">
          {ROLES.map(({ name, desc, badge, color }) => (
            <div className="hp-role" key={name}>
              <div className="hp-role-dot" style={{ background: color }} />
              <div className="hp-role-name">{name}</div>
              <div className="hp-role-desc">{desc}</div>
              <div className="hp-role-badge" style={{ background: color + '22', color }}>{badge}</div>
            </div>
          ))}
          <div className="hp-role hp-role-empty">
            <div className="hp-role-empty-n">≥ 5</div>
            <div className="hp-role-empty-l">Minimum commits<br />to include a developer</div>
          </div>
        </div>
        <div className="hp-pca hp-reveal">
          <div className="hp-pca-text">
            <div className="hp-s-label">Skill Map</div>
            <div className="hp-s-title" style={{ marginBottom: 10 }}>PCA developer<br />skill visualization</div>
            <div className="hp-s-sub" style={{ marginBottom: 20 }}>
              Principal Component Analysis projects every contributor onto a 2D map — revealing
              clusters of similar skill profiles, outliers, and the true shape of your team.
            </div>
            <div className="hp-pca-legend">
              {ROLES.map(({ name, color }) => (
                <div className="hp-pca-leg" key={name}>
                  <div className="hp-pca-dot" style={{ background: color }} /> {name}
                </div>
              ))}
            </div>
          </div>
          <div className="hp-pca-vis">
            <div className="hp-pca-wrap"><PCACanvas isLight={isLight} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Features, Roles });
