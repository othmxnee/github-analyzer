/* Analysis results kept in memory for the SPA, mirrored to sessionStorage
 * when they fit so a page refresh still works.
 *
 * Before, results lived only in sessionStorage. Big repositories hit its
 * ~5 MB quota, and the old fallback silently dropped data (ownership rows,
 * the developer x file matrix) from the dashboard. Now the full result
 * always stays in memory; after a refresh without a stored copy, the
 * dashboard re-reads the backend's cached result instead.
 */
const KEY_RESULTS = 'analysisResults'
const KEY_URL = 'repoUrl'
let memory = { url: null, results: null }

export function saveResults(url, results) {
  memory = { url, results }
  try { sessionStorage.setItem(KEY_URL, url) } catch { /* ignore */ }
  try {
    sessionStorage.setItem(KEY_RESULTS, JSON.stringify(results))
  } catch {
    try { sessionStorage.removeItem(KEY_RESULTS) } catch { /* ignore */ }
  }
}

export function loadResults() {
  if (memory.results) return memory
  try {
    const url = sessionStorage.getItem(KEY_URL)
    const raw = sessionStorage.getItem(KEY_RESULTS)
    return { url, results: raw ? JSON.parse(raw) : null }
  } catch {
    return { url: null, results: null }
  }
}

export function clearResults() {
  memory = { url: null, results: null }
  try { sessionStorage.removeItem(KEY_RESULTS) } catch { /* ignore */ }
}
