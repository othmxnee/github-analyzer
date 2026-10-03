import { host, isEmbedded } from './host'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

/* One transport for every endpoint. Website: fetch over HTTP with the
   session cookie. Desktop / VS Code: the host forwards the same request to
   the local engine bridge, which runs the website's own Flask routes. */
async function request(method, path, { query, body } = {}) {
  if (isEmbedded) {
    const res = await host.request({ method, path, query: query || {}, body: body ?? null })
    const data = res?.body ?? {}
    if (res.status >= 400) throw new Error(data.error || `Engine error: ${res.status}`)
    return data
  }
  const qs = query ? '?' + new URLSearchParams(
    Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString() : ''
  let res
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not connect to the server. Please make sure the backend is running.')
  }
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error page */ }
  if (!res.ok) throw new Error(data.error || `Server error: ${res.status}`)
  return data
}

/* Poll delay: quick first checks so short analyses finish without a
   multi-second idle wait, then back off. Local engines are polled faster
   because there is no network or server load to protect. */
export const pollDelay = (attempt) =>
  isEmbedded ? Math.min(1000, 250 + attempt * 150)
             : Math.min(5000, 1000 + attempt * 500)

export const wait = (ms) => new Promise(r => setTimeout(r, ms))

export const startRepoAnalysis = (repoUrl, force = false) =>
  request('POST', '/analyze', { body: { repo_url: repoUrl, ...(force ? { force: true } : {}) } })

export const getRepoAnalysisResult = (repoUrl) =>
  request('GET', '/analyze/result', { query: { repo_url: repoUrl } })

export const startSkillsAnalysis = (repoUrl) =>
  request('POST', '/analyze/skills', { body: { repo_url: repoUrl } })

export const getSkillsResult = (repoUrl) =>
  request('GET', '/analyze/skills/result', { query: { repo_url: repoUrl } })

export const startAvatarJob = (repoUrl) =>
  request('POST', '/analyze/avatars', { body: { repo_url: repoUrl } })

export const getAvatarResult = (repoUrl) =>
  request('GET', '/analyze/avatars/result', { query: { repo_url: repoUrl } })

export const checkHealth = () => request('GET', '/health')

export const getArchitecture = (repoUrl) =>
  request('GET', '/architecture', { query: repoUrl ? { repo_url: repoUrl } : {} })

export const getBusFactorSimulation = (repoUrl) =>
  request('GET', '/busfactor/simulation', { query: repoUrl ? { repo_url: repoUrl } : {} })

export const getProjectSummary = (repoUrl) =>
  request('GET', '/project-summary', { query: repoUrl ? { repo_url: repoUrl } : {} })

export const getAuthStatus = () => request('GET', '/auth/status')

export const logout = (provider) =>
  request('POST', '/auth/logout' + (provider ? `?provider=${encodeURIComponent(provider)}` : ''))

export const getMyRepos = (provider = 'github') => request('GET', `/auth/${provider}/repos`)

/* Windowed metric fetch — used by useTimelineMetric.
 * Returns { metric, window, current, previous?, delta?, warning? } */
export const getMetricTimeline = (metric, repoUrl, { start, end, compare, compareMode } = {}) => {
  const query = { repo_url: repoUrl }
  if (start) query.start = start
  if (end)   query.end   = end
  if (compare) {
    query.compare = '1'
    if (compareMode) query.compare_mode = compareMode
  }
  return request('GET', `/metric/${metric}`, { query })
}

/* ── Stored history and alerts (website with a database only) ── */
export const getHistory = (repoUrl) => request('GET', '/history', { query: { repo_url: repoUrl } })
export const getAlerts = (repoUrl) => request('GET', '/alerts', { query: { repo_url: repoUrl } })
export const createWatch = (repoUrl, { email, slackWebhookUrl } = {}) =>
  request('POST', '/watch', { body: { repo_url: repoUrl, email: email || null, slack_webhook_url: slackWebhookUrl || null } })
export const listWatches = () => request('GET', '/watches')
export const deleteWatch = (id) => request('DELETE', `/watch/${id}`)
