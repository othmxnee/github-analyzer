'use strict';
/*
 * GitHub Analyzer for VS Code (v2 architecture).
 *
 * - Dashboard: the website's React app (webview/, built in embed mode).
 * - Engine:    the website's backend (engine-src/bridge.py), one long-lived
 *              process serving the website's own API routes over a pipe.
 * Results are therefore identical to the website and the desktop app for the
 * same commit. Everything runs locally; nothing is uploaded.
 */
const vscode = require('vscode');
const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { EngineClient } = require('./engine-client');
const { SummaryProvider, DevelopersProvider, RisksProvider } = require('./sidebar');

const IS_WIN = process.platform === 'win32';
const LOCAL = 'local:';
const IDLE_STOP_MS = 10 * 60 * 1000;   // stop the engine 10 min after the dashboard closes
// Modules the engine imports (umap-learn is optional: PCA is used without it).
const ENGINE_IMPORTS = 'flask, flask_cors, flask_limiter, dotenv, requests, pydriller, git, pandas, numpy, networkx, scipy, sklearn';

let ctx;
let out;
let engine = null;
let enginePython = null;
let panel = null;
let idleTimer = null;
let statusItem;
const views = {};
const state = { lastResult: null, lastSkills: null, repoPath: null, routes: [], errors: [] };

// ── small helpers ───────────────────────────────────────────────────────────
function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024, ...opts },
      (err, stdout, stderr) => resolve({ ok: !err, code: err ? err.code : 0, stdout: String(stdout || ''), stderr: String(stderr || '') }));
  });
}

async function gitRoot(dir) {
  if (!dir) return null;
  const r = await run('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { timeout: 15000 });
  return r.ok ? path.normalize(r.stdout.trim()) : null;
}

/** Repository to analyze: the one containing the active file, else the first workspace folder that is a repo. */
async function findRepository() {
  const active = vscode.window.activeTextEditor?.document?.uri;
  if (active && active.scheme === 'file') {
    const root = await gitRoot(path.dirname(active.fsPath));
    if (root) return root;
  }
  for (const f of vscode.workspace.workspaceFolders || []) {
    const root = await gitRoot(f.uri.fsPath);
    if (root) return root;
  }
  return null;
}

async function workspaceRepos() {
  const roots = [];
  for (const f of vscode.workspace.workspaceFolders || []) {
    const r = await gitRoot(f.uri.fsPath);
    if (r && !roots.includes(r)) roots.push(r);
  }
  return roots;
}

// ── engine resolution and setup ─────────────────────────────────────────────
function venvDir() { return path.join(ctx.globalStorageUri.fsPath, 'engine-venv'); }
function venvPython() { return path.join(venvDir(), IS_WIN ? 'Scripts' : 'bin', IS_WIN ? 'python.exe' : 'python'); }

async function pythonOk(py) {
  const r = await run(py, ['-c', `import sys; assert sys.version_info >= (3, 11), "python"; import ${ENGINE_IMPORTS}`], { timeout: 90000 });
  return r.ok;
}

function basePythonCandidates() {
  const configured = vscode.workspace.getConfiguration('githubAnalyzer').get('pythonPath');
  const list = configured ? [configured] : [];
  return list.concat(IS_WIN ? ['py', 'python'] : ['python3', 'python']);
}

/** {cmd, args} for the engine, or null if the user must set it up first. */
async function resolveEngineCommand() {
  const cfg = vscode.workspace.getConfiguration('githubAnalyzer');
  const enginePath = cfg.get('enginePath');
  if (enginePath && fs.existsSync(enginePath)) return { cmd: enginePath, args: [] };
  const bundled = path.join(ctx.extensionPath, 'engine', IS_WIN ? 'analyzer_bridge.exe' : 'analyzer_bridge');
  if (fs.existsSync(bundled)) return { cmd: bundled, args: [] };

  const bridge = path.join(ctx.extensionPath, 'engine-src', 'bridge.py');
  const candidates = [venvPython(), ...basePythonCandidates()];
  for (const py of candidates) {
    if (py === venvPython() && !fs.existsSync(py)) continue;
    if (await pythonOk(py)) { enginePython = py; return { cmd: py, args: [bridge] }; }
  }
  return null;
}

async function findBasePython() {
  for (const py of basePythonCandidates()) {
    const r = await run(py, ['-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { timeout: 30000 });
    if (r.ok) {
      const [maj, min] = r.stdout.trim().split('.').map(Number);
      if (maj === 3 && min >= 11) return py;
      out.appendLine(`[setup] ${py} is Python ${r.stdout.trim()}, need 3.11+`);
    }
  }
  return null;
}

/** Create a private virtualenv in the extension's storage and install the engine's packages. */
async function setupEngine() {
  const base = await findBasePython();
  if (!base) {
    const pick = await vscode.window.showErrorMessage(
      'GitHub Analyzer needs Python 3.11 or newer to run its analysis engine.',
      'Download Python', 'Set Python path');
    if (pick === 'Download Python') vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
    if (pick === 'Set Python path') vscode.commands.executeCommand('workbench.action.openSettings', 'githubAnalyzer.pythonPath');
    return false;
  }
  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'GitHub Analyzer: setting up the analysis engine (one time)',
    cancellable: false,
  }, async (progress) => {
    fs.mkdirSync(ctx.globalStorageUri.fsPath, { recursive: true });
    progress.report({ message: 'creating a private Python environment…' });
    let r = await run(base, ['-m', 'venv', venvDir()], { timeout: 300000 });
    if (!r.ok) { out.appendLine(r.stderr); vscode.window.showErrorMessage('Could not create the engine environment. See Output → GitHub Analyzer.'); return false; }
    progress.report({ message: 'installing packages (a few minutes, needs internet)…' });
    r = await run(venvPython(), ['-m', 'pip', 'install', '--disable-pip-version-check', '-r',
      path.join(ctx.extensionPath, 'engine-src', 'requirements.txt')], { timeout: 30 * 60 * 1000 });
    out.appendLine(r.stdout.slice(-4000));
    if (!r.ok) {
      out.appendLine(r.stderr.slice(-4000));
      out.show(true);
      vscode.window.showErrorMessage('Installing the engine packages failed. See Output → GitHub Analyzer.');
      return false;
    }
    vscode.window.showInformationMessage('GitHub Analyzer: analysis engine ready.');
    return true;
  });
}

/** Running engine client, setting it up on first use. Null if unavailable. */
async function ensureEngine() {
  if (engine) return engine;
  let cmd = await resolveEngineCommand();
  if (!cmd) {
    const pick = await vscode.window.showInformationMessage(
      'GitHub Analyzer runs its analysis locally with Python. Install its packages into a private environment now? (one time: about 200 MB download, 600 MB on disk)',
      { modal: false }, 'Set up engine', 'Use my own Python');
    if (pick === 'Use my own Python') {
      vscode.commands.executeCommand('workbench.action.openSettings', 'githubAnalyzer.pythonPath');
      return null;
    }
    if (pick !== 'Set up engine' || !(await setupEngine())) return null;
    cmd = await resolveEngineCommand();
    if (!cmd) return null;
  }
  out.appendLine(`[engine] using ${cmd.cmd} ${cmd.args.join(' ')}`);
  engine = new EngineClient({
    resolve: () => cmd,
    env: { GA_CACHE_DIR: path.join(ctx.globalStorageUri.fsPath, 'analysis-cache') },
    log: (line) => out.appendLine(line),
  });
  engine.start().catch(err => out.appendLine(`[engine] failed to start: ${err.message}`));
  return engine;
}

function stopEngine() {
  if (engine) { engine.stop(); engine = null; }
}

// ── webview ─────────────────────────────────────────────────────────────────
function bootstrapScript() {
  // Defines window.gaHost for the dashboard (see frontend/src/services/host.js).
  return `(() => {
  const vscode = acquireVsCodeApi();
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  window.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'response') {
      const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
      m.ok ? p.resolve(m.result) : p.reject(new Error(m.error || 'Request failed'));
    } else if (m.type === 'event') {
      (listeners.get(m.event) || []).forEach(cb => { try { cb(m.payload || {}); } catch (err) { console.error(err); } });
    }
  });
  const call = (op, payload) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); vscode.postMessage({ id, op, payload });
  });
  const diag = (payload) => vscode.postMessage({ op: 'diag', payload });
  window.addEventListener('error', (e) => diag({ error: String(e.message || e) }));
  window.addEventListener('unhandledrejection', (e) => diag({ error: String((e.reason && e.reason.message) || e.reason) }));
  document.addEventListener('securitypolicyviolation', (e) => diag({ error: 'CSP blocked ' + e.blockedURI + ' (' + e.violatedDirective + ')' }));
  // Route changes go through history.pushState (no hashchange event), so wrap it.
  const report = () => diag({ route: location.hash || '#/' });
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (...args) { const r = orig.apply(this, args); report(); return r; };
  }
  window.addEventListener('hashchange', report);
  window.addEventListener('popstate', report);
  window.gaHost = {
    kind: 'vscode',
    request: (msg) => call('request', msg),
    getContext: () => call('context'),
    pickRepository: () => call('pick'),
    rememberRepository: (p) => call('remember', p),
    saveFile: (f) => call('save', f),
    on: (event, cb) => {
      const list = listeners.get(event) || []; list.push(cb); listeners.set(event, list);
      return () => listeners.set(event, (listeners.get(event) || []).filter(x => x !== cb));
    },
  };
  diag({ route: location.hash || '#/' });
})();`;
}

function webviewHtml(webview) {
  const webDir = vscode.Uri.joinPath(ctx.extensionUri, 'webview');
  const base = webview.asWebviewUri(webDir).toString().replace(/\/?$/, '/');
  const nonce = crypto.randomBytes(16).toString('base64');
  const src = webview.cspSource;
  const csp = [
    "default-src 'none'",
    `img-src ${src} data: blob:`,
    `style-src ${src} 'unsafe-inline'`,
    `font-src ${src} data:`,
    `script-src 'nonce-${nonce}' ${src}`,
    `connect-src ${src}`,
  ].join('; ');
  let html = fs.readFileSync(path.join(webDir.fsPath, 'index.html'), 'utf8');
  html = html.replace(/<link rel="icon"[^>]*>\s*/i, '');
  html = html.replace(/(src|href)="\.\/assets\//g, `$1="${base}assets/`);
  html = html.replace(/<script type="module"/g, `<script type="module" nonce="${nonce}"`);
  html = html.replace('<head>', `<head>
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <script nonce="${nonce}">${bootstrapScript()}</script>`);
  return html;
}

function post(msg) {
  if (panel) panel.webview.postMessage(msg);
}

function repoName(p) { return p ? path.basename(p) : ''; }

function noteResponse(req, res) {
  const key = (req.query && req.query.repo_url) || (req.body && req.body.repo_url) || '';
  if (!key.startsWith(LOCAL) || !res || !res.body || res.body.status !== 'done') return;
  const repoPath = key.slice(LOCAL.length);
  if (req.path === '/analyze/result') {
    state.lastResult = res.body;
    state.repoPath = repoPath;
    for (const v of Object.values(views)) v.update({ result: res.body, repoName: repoName(repoPath) });
    const ps = res.body.project_summary || {};
    statusItem.text = `$(pulse) ${repoName(repoPath)}: health ${ps.health_score ?? '—'} · bus factor ${res.body.bus_factor ?? '—'}`;
    statusItem.show();
  } else if (req.path === '/analyze/skills/result') {
    state.lastSkills = res.body;
    views.developers.update({ skills: res.body });
  }
}

async function handleMessage(msg, pendingCtx) {
  const { id, op, payload } = msg || {};
  const reply = (result) => post({ type: 'response', id, ok: true, result });
  const fail = (err) => post({ type: 'response', id, ok: false, error: err.message || String(err) });
  try {
    switch (op) {
      case 'request': {
        const eng = await ensureEngine();
        if (!eng) return reply({ status: 503, body: { error: 'The analysis engine is not set up. Run “GitHub Analyzer: Set Up Analysis Engine”.' } });
        const res = await eng.call(payload || {});
        noteResponse(payload || {}, res);
        return reply(res);
      }
      case 'context': {
        const repoPath = pendingCtx.repoPath || await findRepository();
        const recent = (await workspaceRepos()).filter(r => r !== repoPath);
        let git = null;
        if (engine) { try { git = (await engine.start()).git; } catch { git = null; } }
        const c = { kind: 'vscode', repoPath, recent, autoStart: !!pendingCtx.autoStart && !!repoPath, force: !!pendingCtx.force, git };
        pendingCtx.autoStart = false;
        return reply(c);
      }
      case 'pick': {
        const res = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel: 'Analyze repository' });
        if (!res || !res[0]) return reply(null);
        const root = await gitRoot(res[0].fsPath);
        if (!root) vscode.window.showWarningMessage('That folder is not inside a Git repository.');
        return reply(root);
      }
      case 'remember':
        return reply(true);
      case 'save': {
        const folder = state.repoPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || require('os').homedir();
        const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(path.join(folder, payload.fileName || 'export')) });
        if (!target) return reply(false);
        fs.writeFileSync(target.fsPath, Buffer.from(payload.base64 || '', 'base64'));
        vscode.window.showInformationMessage(`Saved ${path.basename(target.fsPath)}`, 'Open').then(pick => {
          if (pick !== 'Open') return;
          if (target.fsPath.endsWith('.csv')) vscode.window.showTextDocument(target);
          else vscode.env.openExternal(target);
        });
        return reply(true);
      }
      case 'diag':
        if (payload && payload.route) state.routes.push(payload.route);
        if (payload && payload.error) { state.errors.push(payload.error); out.appendLine(`[webview] ${payload.error}`); }
        return undefined;
      default:
        return fail(new Error(`Unknown operation ${op}`));
    }
  } catch (err) {
    out.appendLine(`[host] ${op} failed: ${err.stack || err.message}`);
    return fail(err);
  }
}

/** Show the dashboard; optionally start (or force) an analysis of repoPath. */
async function showDashboard({ analyze = false, force = false, repoPath = null } = {}) {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  const target = repoPath || await findRepository();
  if (analyze && !(await ensureEngine())) return;
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    if (analyze && target) post({ type: 'event', event: 'analyze', payload: { repoPath: target, force } });
    return;
  }
  const pendingCtx = { autoStart: analyze, force, repoPath: target };
  panel = vscode.window.createWebviewPanel('githubAnalyzerDashboard', 'GitHub Analyzer', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, 'webview')],
  });
  panel.iconPath = vscode.Uri.joinPath(ctx.extensionUri, 'icon.png');
  panel.webview.onDidReceiveMessage((m) => handleMessage(m, pendingCtx), null, ctx.subscriptions);
  panel.onDidDispose(() => {
    panel = null;
    idleTimer = setTimeout(stopEngine, IDLE_STOP_MS);
  }, null, ctx.subscriptions);
  panel.webview.html = webviewHtml(panel.webview);
}

// ── activation ──────────────────────────────────────────────────────────────
function activate(context) {
  ctx = context;
  out = vscode.window.createOutputChannel('GitHub Analyzer');
  context.subscriptions.push(out);

  views.summary = new SummaryProvider();
  views.developers = new DevelopersProvider();
  views.risks = new RisksProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('githubAnalyzer.summary', views.summary),
    vscode.window.registerTreeDataProvider('githubAnalyzer.developers', views.developers),
    vscode.window.registerTreeDataProvider('githubAnalyzer.risks', views.risks),
  );

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusItem.command = 'githubAnalyzer.openDashboard';
  statusItem.tooltip = 'Open the GitHub Analyzer dashboard';
  context.subscriptions.push(statusItem);

  context.subscriptions.push(
    vscode.commands.registerCommand('githubAnalyzer.analyze', () => showDashboard({ analyze: true })),
    vscode.commands.registerCommand('githubAnalyzer.refresh', () => showDashboard({ analyze: true, force: true })),
    vscode.commands.registerCommand('githubAnalyzer.openDashboard', () => showDashboard({ analyze: !!state.lastResult })),
    vscode.commands.registerCommand('githubAnalyzer.setupEngine', async () => {
      stopEngine();
      if (await setupEngine()) await ensureEngine();
    }),
    vscode.commands.registerCommand('githubAnalyzer.showLog', () => out.show(true)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('githubAnalyzer.pythonPath') || e.affectsConfiguration('githubAnalyzer.enginePath')) stopEngine();
    }),
    { dispose: stopEngine },
  );

  // Exposed for the integration test only.
  return { _test: { state, getEnginePython: () => enginePython, isPanelOpen: () => !!panel } };
}

function deactivate() {
  stopEngine();
}

module.exports = { activate, deactivate };
