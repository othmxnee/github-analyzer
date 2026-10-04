/* Embedding host (desktop app or VS Code extension).
 *
 * The same React build runs in three places. On the website there is no
 * host and the API is plain HTTP. Inside the desktop app (Electron preload)
 * or the VS Code webview (bootstrap script) a `window.gaHost` object is
 * injected before this bundle loads:
 *
 *   gaHost.kind                       'desktop' | 'vscode'
 *   gaHost.request({method, path, query, body}) -> Promise<{status, body}>
 *   gaHost.getContext()               -> Promise<{repoPath, recent, autoStart}>
 *   gaHost.pickRepository()           -> Promise<string|null>   (desktop)
 *   gaHost.saveFile({fileName, mime, base64})  -> Promise<boolean>
 *   gaHost.on(event, cb)              host -> page events, e.g. 'analyze'
 */
export const host = typeof window !== 'undefined' ? (window.gaHost || null) : null
export const isEmbedded = !!host

export const LOCAL_PREFIX = 'local:'
export const isLocalKey = (key) => typeof key === 'string' && key.startsWith(LOCAL_PREFIX)

/* Human label for a repository key: "owner / repo" for hosted repos, the
   folder name for local ones. */
export function repoLabel(key) {
  if (!key) return ''
  if (isLocalKey(key)) {
    const p = key.slice(LOCAL_PREFIX.length).replace(/[\\/]+$/, '')
    return p.split(/[\\/]/).pop() || p
  }
  try {
    return key.replace(/\.git$/, '').split('/').slice(-2).join(' / ')
  } catch { return key }
}

/* Save a generated file (PDF / CSV). Browsers download it; the embedded
   hosts show a native save dialog, since webviews block downloads. */
export async function saveFile(fileName, mime, data) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime })
  if (host?.saveFile) {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return host.saveFile({ fileName, mime, base64: btoa(bin) })
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/* ── Open a repository file from the dashboard (desktop app / VS Code) ── */
let currentRepo = null
export const setCurrentRepo = (key) => { currentRepo = key }
export const canOpenFiles = () => !!(host?.openFile && isLocalKey(currentRepo))
export function openFile(file) {
  if (!canOpenFiles() || !file) return
  host.openFile({ repoPath: currentRepo.slice(LOCAL_PREFIX.length), file })
}
/* Spread into a Chart.js options object whose bars are files: a click on a
   bar opens that file, and the cursor shows it is clickable. */
export function fileClickChartOptions(paths) {
  if (!canOpenFiles()) return {}
  return {
    onClick: (_evt, els) => { if (els?.length) openFile(paths[els[0].index]) },
    onHover: (evt, els) => {
      const t = evt?.native?.target
      if (t) t.style.cursor = els?.length ? 'pointer' : 'default'
    },
  }
}
