import { useState, useMemo } from 'react'

const ROLE_COLOR = {
  'Frontend':   '#3B6EEA',
  'Backend':    '#00C896',
  'DevOps':     '#F59E0B',
  'Full Stack': '#A78BFA',
  'Tester':     '#EF4444',
  'Mobile':     '#06B6D4',
  'Generalist': '#7880A0',
}

const SKILL_BARS = [
  { key: 'pct_frontend', label: 'Frontend', color: '#3B6EEA' },
  { key: 'pct_backend',  label: 'Backend',  color: '#00C896' },
  { key: 'pct_test',     label: 'Test',     color: '#EF4444' },
  { key: 'pct_devops',   label: 'DevOps',   color: '#F59E0B' },
  { key: 'pct_docs',     label: 'Docs',     color: '#7880A0' },
]

function avatarBg(email) {
  let h = 0
  for (const c of email) h = (h * 31 + c.charCodeAt(0)) & 0xfffffff
  const p = ['#3B6EEA','#00C896','#F59E0B','#A78BFA','#EF4444','#06B6D4','#7880A0','#DD8452','#55A868']
  return p[h % p.length]
}

function initials(email) {
  const name  = email.split('@')[0]
  const parts = name.split(/[._-]/).filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

function fmtDays(d) {
  if (!d) return '—'
  if (d < 1)  return `${Math.round(d * 24)}h`
  if (d < 7)  return `${d.toFixed(1)}d`
  if (d < 30) return `${(d / 7).toFixed(1)}w`
  return `${(d / 30).toFixed(1)}mo`
}

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function monthsAgo(s) {
  if (!s) return null
  const diff = Date.now() - new Date(s).getTime()
  return diff / (1000 * 60 * 60 * 24 * 30)
}

/* ── sub-components ── */
function SectionBox({ title, children }) {
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--b)',
      borderRadius: 10, padding: '14px 16px', marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase',
                    letterSpacing: '.1em', fontWeight: 700, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function StatPill({ label, value }) {
  return (
    <div style={{
      background: 'var(--bg3)', border: '1px solid var(--b)',
      borderRadius: 8, padding: '9px 12px', textAlign: 'center', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t)',
                    fontFamily: 'var(--mono)', letterSpacing: '-.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2,
                    textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </div>
    </div>
  )
}

function Bar({ value, color, height = 4 }) {
  const pct = Math.min(100, Math.round(value * 100))
  return (
    <div style={{ height, background: 'var(--b)', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color,
                    borderRadius: height, transition: 'width .4s' }} />
    </div>
  )
}

/* ════════════════════════════════════════
   BUILD UNIFIED DEVELOPER MAP
════════════════════════════════════════ */

// Sources use three different key formats:
//   skills   → "email@domain"
//   commits  → "Name <email@domain>"   (developer_id)
//   blame    → "Name"                  (git blame author line)
// We normalize everything to email where possible, falling back to lowercased name.

function buildDevMap(results, skillsData) {
  // Step 1: build name→email from "Name <email>" keys in dev_stats / top_developers
  const nameToEmail = {}
  for (const dev of Object.keys(results.dev_stats || {})) {
    const m = dev.match(/^(.+?)\s*<(.+?)>$/)
    if (m) nameToEmail[m[1].trim().toLowerCase()] = m[2].toLowerCase()
  }
  for (const d of (results.top_developers || [])) {
    const m = d.developer.match(/^(.+?)\s*<(.+?)>$/)
    if (m) nameToEmail[m[1].trim().toLowerCase()] = m[2].toLowerCase()
  }

  // Step 2: canonical key function
  function norm(dev) {
    if (!dev) return ''
    const trimmed = dev.trim()
    // "Name <email>" format
    const angle = trimmed.match(/<(.+?)>/)
    if (angle) return angle[1].toLowerCase()
    // Pure email
    if (trimmed.includes('@')) return trimmed.toLowerCase()
    // Bare name — look up in map built from commits
    return nameToEmail[trimmed.toLowerCase()] || trimmed.toLowerCase()
  }

  const map = {}
  const ensure = dev => {
    const key = norm(dev)
    if (!key) return {}
    if (!map[key]) map[key] = { developer: key }
    return map[key]
  }

  // dev_stats first (limited window: dates/mods for recent contributors)
  for (const [dev, s] of Object.entries(results.dev_stats || {})) Object.assign(ensure(dev), s)

  // Skills applied AFTER dev_stats — skills uses full history so its dates/keywords
  // are more complete and should win for old contributors outside the commit window.
  for (const d of (skillsData?.developers || [])) {
    const e = ensure(d.developer)
    // Always take skill profile fields from skills
    Object.assign(e, d)
  }

  // Ownership table — keyed by bare "Name" (git blame)
  const ownershipByDev = {}
  for (const row of (results.ownership_table || [])) {
    ;(ownershipByDev[norm(row.developer)] ??= []).push({ file: row.file, ownership: row.ownership })
  }
  for (const [key, files] of Object.entries(ownershipByDev)) {
    const e = map[key] ?? (map[key] = { developer: key })
    const sorted = [...files].sort((a, b) => b.ownership - a.ownership)
    e.owned_files   = sorted.slice(0, 10)
    e.files_count   = sorted.length
    e.avg_ownership = sorted.reduce((s, f) => s + f.ownership, 0) / sorted.length
  }

  // inter-commit rhythm — keyed by "Name <email>"
  for (const [dev, days] of Object.entries(results.inter_commit || {}))
    ensure(dev).inter_commit_days = days

  // top_developers — keyed by "Name <email>"
  for (const d of (results.top_developers || [])) {
    const e = ensure(d.developer)
    if (!e.total_commits) e.total_commits = d.commits
  }

  // hotspot activity — keyed by "Name <email>"
  const mx = results.dev_file_matrix || {}
  if (mx.developers && mx.files && mx.values) {
    mx.developers.forEach((dev, di) => {
      const row = mx.values[di] || []
      const act = mx.files.map((file, fi) => ({ file, churn: row[fi] || 0 }))
        .filter(x => x.churn > 0).sort((a, b) => b.churn - a.churn)
      if (act.length) ensure(dev).hotspot_activity = act.slice(0, 8)
    })
  }

  // Bus factor — keyed by bare "Name" (from git blame via simulate_bus_factor_risk)
  const bfDevs = results.busfactor_simulation?.developers || []
  bfDevs.forEach((d, i) => {
    const e = map[norm(d.name)]
    if (e) { e.bf_rank = i + 1; e.bf_ownership = d.ownership }
  })

  // KCI lookup: build set of high-KCI files
  const highKci = new Set((results.kci || []).slice(0, 20).map(k => k.file))
  for (const e of Object.values(map)) {
    if (e.owned_files) {
      e.kci_files = e.owned_files.filter(f => highKci.has(f.file))
    }
  }

  // Resolve total_commits: prefer skills count, fall back to raw commit count from dev_stats
  for (const d of Object.values(map)) {
    if (!d.total_commits && d.total_commits_raw > 0) d.total_commits = d.total_commits_raw
  }

  return Object.values(map)
    .filter(d => d.developer && (d.total_commits > 0 || d.files_count > 0 || d.first_commit))
    .sort((a, b) => (b.total_commits || 0) - (a.total_commits || 0))
}

/* ════════════════════════════════════════
   DEVELOPER PROFILE
════════════════════════════════════════ */
function DevProfile({ dev, skillsReady, repoEndDate }) {
  if (!dev) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--t3)', fontSize: 13 }}>
      Select a developer
    </div>
  )

  const bg       = dev.role ? (ROLE_COLOR[dev.role] || avatarBg(dev.developer)) : avatarBg(dev.developer)
  const name     = dev.developer.split('@')[0]
  const hasSkills = skillsReady && dev.pct_backend !== undefined

  // Active = committed within last 6 months of the repo's own timeline
  const refDate    = repoEndDate ? new Date(repoEndDate) : new Date()
  const lastMs     = dev.last_commit ? new Date(dev.last_commit).getTime() : null
  const mthsInactive = lastMs ? (refDate.getTime() - lastMs) / (1000 * 60 * 60 * 24 * 30) : null
  const isActive   = mthsInactive !== null && mthsInactive < 6

  // Risk label
  const bfRank = dev.bf_rank
  const riskLabel = !bfRank ? null
    : bfRank === 1 ? { label: 'Critical — single point of failure', color: '#EF4444' }
    : bfRank <= 3  ? { label: `Top ${bfRank} knowledge holders`, color: '#F59E0B' }
    : bfRank <= 8  ? { label: `Key contributor (#${bfRank})`, color: '#3B6EEA' }
    : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>

      {/* ── header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', background: bg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 700, color: '#fff', boxShadow: `0 0 0 3px ${bg}33`,
        }}>
          {initials(dev.developer)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dev.developer}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {dev.role && (
              <span style={{ background: bg, color: '#fff', borderRadius: 4,
                             padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                {dev.role}
              </span>
            )}
            {!dev.role && !skillsReady && (
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Role loading…</span>
            )}
            {mthsInactive !== null && (
              <span style={{
                background: isActive ? 'rgba(0,200,150,.15)' : 'rgba(120,128,160,.12)',
                color: isActive ? '#00C896' : 'var(--t3)',
                borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 600,
              }}>
                {isActive ? '● Active' : '○ Inactive'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── activity dates ── */}
      {(dev.first_commit || dev.last_commit) && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 14,
          background: 'var(--bg3)', border: '1px solid var(--b)',
          borderRadius: 8, padding: '10px 14px',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase',
                          letterSpacing: '.1em', marginBottom: 2 }}>First commit</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', fontFamily: 'var(--mono)' }}>
              {fmtDate(dev.first_commit)}
            </div>
          </div>
          <div style={{ width: 1, background: 'var(--b)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase',
                          letterSpacing: '.1em', marginBottom: 2 }}>Last commit</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', fontFamily: 'var(--mono)' }}>
              {fmtDate(dev.last_commit)}
            </div>
          </div>
          {dev.first_commit && dev.last_commit && (() => {
            const months = Math.round(
              (new Date(dev.last_commit) - new Date(dev.first_commit)) / (1000 * 60 * 60 * 24 * 30)
            )
            return (
              <>
                <div style={{ width: 1, background: 'var(--b)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase',
                                letterSpacing: '.1em', marginBottom: 2 }}>Tenure</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', fontFamily: 'var(--mono)' }}>
                    {months < 1 ? '< 1mo' : months < 12 ? `${months}mo` : `${(months/12).toFixed(1)}yr`}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* ── key stats ── */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14, flexWrap: 'wrap' }}>
        {dev.total_commits > 0       && <StatPill label="Commits"      value={dev.total_commits.toLocaleString()} />}
        {dev.total_modifications > 0 && <StatPill label="Modifications" value={dev.total_modifications.toLocaleString()} />}
        {dev.unique_files > 0        && <StatPill label="Unique files"  value={dev.unique_files.toLocaleString()} />}
        {dev.total_lines > 0         && <StatPill label="Lines"         value={dev.total_lines > 9999 ? `${(dev.total_lines/1000).toFixed(1)}k` : dev.total_lines.toLocaleString()} />}
        {dev.avg_ownership > 0       && <StatPill label="Avg ownership" value={`${Math.round(dev.avg_ownership * 100)}%`} />}
        {dev.inter_commit_days > 0   && <StatPill label="Rhythm"        value={`/${fmtDays(dev.inter_commit_days)}`} />}
      </div>

      {/* ── risk exposure ── */}
      {bfRank && (
        <SectionBox title="Risk Exposure">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: riskLabel?.color + '22', border: `2px solid ${riskLabel?.color || '#7880A0'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, fontWeight: 800, color: riskLabel?.color || 'var(--t)',
            }}>
              #{bfRank}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: riskLabel?.color || 'var(--t)' }}>
                {riskLabel?.label || `Knowledge holder #${bfRank}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                Owns <strong>{Math.round((dev.bf_ownership || 0) * 100)}%</strong> of total repo knowledge
              </div>
            </div>
          </div>
          <Bar value={dev.bf_ownership || 0} color={riskLabel?.color || '#7880A0'} height={5} />
        </SectionBox>
      )}

      {/* ── knowledge concentration (high-KCI files) ── */}
      {dev.kci_files?.length > 0 && (
        <SectionBox title={`Knowledge Concentration — ${dev.kci_files.length} high-risk file${dev.kci_files.length > 1 ? 's' : ''}`}>
          {dev.kci_files.map(({ file, ownership }) => {
            const short = file.split('/').slice(-2).join('/')
            return (
              <div key={file} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: '#EF4444', fontFamily: 'var(--mono)',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                 maxWidth: '75%' }} title={file}>
                    ⚠ {short}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t)', flexShrink: 0, marginLeft: 8 }}>
                    {Math.round(ownership * 100)}%
                  </span>
                </div>
                <Bar value={ownership} color="#EF4444" height={4} />
              </div>
            )
          })}
        </SectionBox>
      )}

      {/* ── keyword signature ── */}
      {dev.top_keywords?.length > 0 && (
        <SectionBox title="Commit Keyword Signature">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {dev.top_keywords.map((kw, i) => (
              <span key={kw} style={{
                background: i === 0 ? bg + '25' : 'var(--bg2)',
                border: `1px solid ${i === 0 ? bg + '55' : 'var(--b)'}`,
                color: i === 0 ? bg : 'var(--t2)',
                borderRadius: 20, padding: '3px 11px',
                fontSize: 11, fontWeight: i < 3 ? 600 : 400,
                fontFamily: 'var(--mono)',
              }}>
                {kw}
              </span>
            ))}
          </div>
        </SectionBox>
      )}

      {/* ── skill profile ── */}
      {hasSkills && (
        <SectionBox title="Skill Profile">
          {SKILL_BARS.map(s => {
            const pct = Math.min(100, Math.round((dev[s.key] || 0) * 100))
            return (
              <div key={s.key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--t)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{pct}%</span>
                </div>
                <Bar value={dev[s.key] || 0} color={s.color} />
              </div>
            )
          })}
        </SectionBox>
      )}

      {/* ── top owned files ── */}
      {dev.owned_files?.length > 0 && (
        <SectionBox title="Top Owned Files">
          {dev.owned_files.map(({ file, ownership }) => {
            const short = file.split('/').slice(-2).join('/')
            return (
              <div key={file} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--mono)',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                 maxWidth: '75%' }} title={file}>
                    {short}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t)', flexShrink: 0, marginLeft: 8 }}>
                    {Math.round(ownership * 100)}%
                  </span>
                </div>
                <Bar value={ownership} color={bg} />
              </div>
            )
          })}
        </SectionBox>
      )}

      {/* ── hotspot activity ── */}
      {dev.hotspot_activity?.length > 0 && (
        <SectionBox title="Hotspot Activity">
          {dev.hotspot_activity.map(({ file, churn }) => {
            const max   = dev.hotspot_activity[0].churn
            const short = file.split('/').slice(-2).join('/')
            return (
              <div key={file} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--mono)',
                                 overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                 maxWidth: '75%' }} title={file}>
                    {short}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, marginLeft: 8 }}>
                    {churn.toLocaleString()}
                  </span>
                </div>
                <Bar value={churn / max} color="#F59E0B" />
              </div>
            )
          })}
        </SectionBox>
      )}
    </div>
  )
}

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
export default function DevelopersList({ results, skillsData, skillsLoading }) {
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)

  const developers = useMemo(() => buildDevMap(results, skillsData), [results, skillsData])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return developers
    return developers.filter(d =>
      d.developer.toLowerCase().includes(q) ||
      (d.role || '').toLowerCase().includes(q)
    )
  }, [developers, search])

  const activeDev = selected
    ? (developers.find(d => d.developer === selected) || filtered[0] || null)
    : (filtered[0] || null)

  const skillsReady  = !!skillsData?.developers?.length
  const repoEndDate  = results?.summary?.date_range?.end || null

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>

      {/* ── LEFT: searchable list ── */}
      <div style={{
        width: 280, flexShrink: 0, borderRight: '1px solid var(--b)',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--b)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg3)', border: '1px solid var(--b)',
            borderRadius: 7, padding: '7px 10px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
              placeholder={`Search ${developers.length} developers…`}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none',
                       fontSize: 12, color: 'var(--t)', fontFamily: 'var(--f)' }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setSelected(null) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                               color: 'var(--t3)', fontSize: 15, padding: 0, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 5, textAlign: 'right' }}>
            {filtered.length} of {developers.length}
            {skillsLoading && !skillsReady && (
              <span style={{ marginLeft: 7, color: 'var(--ac)' }}>· roles loading…</span>
            )}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 20, fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>
              No developers found
            </div>
          )}
          {filtered.map((dev, i) => {
            const bg      = dev.role ? (ROLE_COLOR[dev.role] || avatarBg(dev.developer)) : avatarBg(dev.developer)
            const name    = dev.developer.split('@')[0]
            const isActive = activeDev?.developer === dev.developer
            const lastMs  = dev.last_commit ? new Date(dev.last_commit).getTime() : null
            const refMs   = repoEndDate ? new Date(repoEndDate).getTime() : Date.now()
            const active  = lastMs && (refMs - lastMs) / (1000 * 60 * 60 * 24 * 30) < 6
            return (
              <div key={dev.developer} onClick={() => setSelected(dev.developer)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 12px', cursor: 'pointer',
                  background: isActive ? 'var(--ac-d)' : 'transparent',
                  borderLeft: `2px solid ${isActive ? 'var(--ac)' : 'transparent'}`,
                  borderBottom: '1px solid var(--b)', transition: 'background .15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surf)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 10, color: 'var(--t3)', width: 18,
                              textAlign: 'right', flexShrink: 0, fontFamily: 'var(--mono)' }}>
                  {i + 1}
                </div>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>
                    {initials(dev.developer)}
                  </div>
                  {dev.last_commit && (
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 8, height: 8, borderRadius: '50%',
                      background: active ? '#00C896' : 'var(--t3)',
                      border: '1.5px solid var(--bg)',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                    {dev.role
                      ? <span style={{ fontSize: 9, background: bg + '22', color: bg,
                                       borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>
                          {dev.role}
                        </span>
                      : null}
                    <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
                      {dev.total_commits ? `${dev.total_commits}c` : ''}
                      {dev.bf_rank && dev.bf_rank <= 5
                        ? <span style={{ color: dev.bf_rank === 1 ? '#EF4444' : '#F59E0B', marginLeft: 4 }}>
                            ⚑
                          </span>
                        : null}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: profile ── */}
      <DevProfile dev={activeDev} skillsReady={skillsReady} repoEndDate={repoEndDate} />
    </div>
  )
}
