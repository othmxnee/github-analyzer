import axios from 'axios'

export const API_URL = 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

const handleError = (error) => {
  if (error.response) {
    const msg = error.response.data?.error
    throw new Error(msg || `Server error: ${error.response.status}`)
  } else if (error.request) {
    throw new Error('Could not connect to the server. Please make sure the backend is running.')
  }
  throw error
}

export const startRepoAnalysis = async (repoUrl, force = false) => {
  try {
    const response = await api.post('/analyze', { repo_url: repoUrl, ...(force ? { force: true } : {}) })
    return response.data
  } catch (error) { handleError(error) }
}

export const getRepoAnalysisResult = async (repoUrl) => {
  try {
    const response = await api.get('/analyze/result', { params: { repo_url: repoUrl } })
    return response.data
  } catch (error) { handleError(error) }
}

export const checkHealth = async () => {
  const response = await api.get('/health')
  return response.data
}

export const getArchitecture = async (repoUrl) => {
  const response = await api.get('/architecture', { params: repoUrl ? { repo_url: repoUrl } : {} })
  return response.data
}

export const getBusFactorSimulation = async (repoUrl) => {
  const response = await api.get('/busfactor/simulation', { params: repoUrl ? { repo_url: repoUrl } : {} })
  return response.data
}

export const getProjectSummary = async (repoUrl) => {
  const response = await api.get('/project-summary', { params: repoUrl ? { repo_url: repoUrl } : {} })
  return response.data
}

export const getAuthStatus = async () => {
  const response = await api.get('/auth/status')
  return response.data
}

export const logout = async (provider) => {
  const response = await api.post('/auth/logout', null, {
    params: provider ? { provider } : {},
  })
  return response.data
}

export const getMyRepos = async (provider = 'github') => {
  const response = await api.get(`/auth/${provider}/repos`)
  return response.data
}

/* Windowed metric fetch — used by useTimelineMetric.
 * Returns { metric, window, current, previous?, delta?, warning? } */
export const getMetricTimeline = async (metric, repoUrl, { start, end, compare, compareMode } = {}) => {
  const params = { repo_url: repoUrl }
  if (start) params.start = start
  if (end)   params.end   = end
  if (compare) {
    params.compare = '1'
    if (compareMode) params.compare_mode = compareMode
  }
  const response = await api.get(`/metric/${metric}`, { params })
  return response.data
}
