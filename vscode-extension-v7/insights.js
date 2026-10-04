'use strict';
/*
 * Knowledge risk where you work, from the last analysis of the repository:
 *  - status bar: who owns the file in the active editor (line ownership);
 *  - Explorer badges: high-risk files ("!") and files owned by people who
 *    stopped contributing ("○").
 * The data is a small snapshot of the last result, written to a file in the
 * extension's storage for this workspace, so it is there right after VS Code
 * restarts, before any new analysis (and survives a crash).
 */
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const HIGH_RISK = 0.7;        // same threshold the alerts use
const SNAPSHOT_FILE = 'last-analysis.json';

/** Keep only what the editor features and the sidebar need. */
function snapshot(repoPath, result, skills) {
  const ok = result.orphaned_knowledge || {};
  return {
    repoPath,
    analyzedAt: result.analyzed_at || null,
    result: {
      summary: result.summary, project_summary: result.project_summary,
      bus_factor: result.bus_factor, gini: result.gini,
      active_bus_factor: result.active_bus_factor && { active_bus_factor: result.active_bus_factor.active_bus_factor },
      orphaned_knowledge: { orphaned_pct: ok.orphaned_pct, inactive_months: ok.inactive_months,
                            orphaned_files: (ok.orphaned_files || []).slice(0, 500) },
      top_developers: (result.top_developers || []).slice(0, 40),
      risk_files: (result.risk_files || []).slice(0, 500),
      ownership_table: (result.ownership_table || []).slice(0, 20000),
      kci: (result.kci || []).slice(0, 5000),
    },
    skills: skills ? { developers: (skills.developers || []).map(d => ({ developer: d.developer, role: d.role })) } : null,
  };
}

/** Path resolver for one refresh: direct path, under src/, else a tracked
    file ending with the key (one `git ls-files` per refresh, at most). */
function makeResolver(repoPath) {
  let tracked = null;
  return (key) => {
    for (const rel of [key, `src/${key}`]) {
      const abs = path.join(repoPath, rel);
      if (fs.existsSync(abs)) return abs;
    }
    if (tracked === null) {
      try {
        tracked = execFileSync('git', ['-C', repoPath, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0');
      } catch { tracked = []; }
    }
    const hit = tracked.find(f => f === key || f.endsWith('/' + key));
    return hit ? path.join(repoPath, hit) : null;
  };
}

/** The engine's path key: forward slashes, no leading "./" or "src/". */
function normKey(rel) {
  let k = rel.split(path.sep).join('/').replace(/^\.\//, '');
  if (k.startsWith('src/')) k = k.slice(4);
  return k;
}

const short = (dev) => String(dev).split('@')[0];
const pct = (x) => `${Math.round(x * 100)}%`;

class Insights {
  constructor(context) {
    this.context = context;
    const dir = (context.storageUri || context.globalStorageUri).fsPath;
    this.snapFile = path.join(dir, SNAPSHOT_FILE);
    try { this.snap = JSON.parse(fs.readFileSync(this.snapFile, 'utf8')); } catch { this.snap = null; }
    this.byFile = new Map();
    this.decorations = new Map();
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this._onDidChange.event;

    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
    this.item.command = 'githubAnalyzer.openDashboard';
    context.subscriptions.push(
      this.item,
      vscode.window.registerFileDecorationProvider(this),
      vscode.window.onDidChangeActiveTextEditor(() => this.refreshStatus()),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('githubAnalyzer.explorerBadges')) this.rebuild();
      }),
    );
    this.rebuild();
  }

  /** Called with every finished analysis / roles result. */
  update(repoPath, result, skills) {
    if (result) this.snap = snapshot(repoPath, result, skills || (this.snap && this.snap.skills));
    else if (skills && this.snap) this.snap.skills = snapshot(repoPath, {}, skills).skills;
    try {
      fs.mkdirSync(path.dirname(this.snapFile), { recursive: true });
      fs.writeFileSync(this.snapFile + '.tmp', JSON.stringify(this.snap));
      fs.renameSync(this.snapFile + '.tmp', this.snapFile);
    } catch { /* restoring after a restart is a convenience */ }
    this.rebuild();
  }

  rebuild() {
    this.byFile = new Map();
    this.decorations = new Map();
    const s = this.snap;
    if (s && s.result) {
      for (const row of s.result.ownership_table || []) {
        if (!this.byFile.has(row.file)) this.byFile.set(row.file, []);
        this.byFile.get(row.file).push(row);
      }
      if (vscode.workspace.getConfiguration('githubAnalyzer').get('explorerBadges', true)) {
        const resolveRepoFile = makeResolver(s.repoPath);
        const months = (s.result.orphaned_knowledge || {}).inactive_months || 12;
        for (const o of (s.result.orphaned_knowledge || {}).orphaned_files || []) {
          const abs = resolveRepoFile(o.file);
          if (abs) this.decorations.set(abs, new vscode.FileDecoration('○',
            `Orphaned knowledge: ${pct(o.ownership)} owned by ${short(o.owner)}, inactive for over ${months} months`,
            new vscode.ThemeColor('list.warningForeground')));
        }
        for (const r of s.result.risk_files || []) {
          if (r.risk_score < HIGH_RISK) continue;
          const abs = resolveRepoFile(r.file);
          const owners = (this.byFile.get(r.file) || []).slice(0, 2).map(o => `${short(o.developer)} ${pct(o.ownership)}`).join(', ');
          if (abs) this.decorations.set(abs, new vscode.FileDecoration('!',
            `High knowledge risk (${r.risk_score.toFixed(2)}): widely imported, known by few${owners ? ` (${owners})` : ''}`,
            new vscode.ThemeColor('list.errorForeground')));
        }
      }
    }
    this._onDidChange.fire(undefined);
    this.refreshStatus();
  }

  provideFileDecoration(uri) {
    return uri.scheme === 'file' ? this.decorations.get(uri.fsPath) : undefined;
  }

  /** Owners of `fsPath` from the snapshot, or null. */
  ownersOf(fsPath) {
    const s = this.snap;
    if (!s || !fsPath) return null;
    const rel = path.relative(s.repoPath, fsPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    return this.byFile.get(normKey(rel)) || this.byFile.get(rel.split(path.sep).join('/')) || null;
  }

  refreshStatus() {
    const doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document;
    const owners = doc && doc.uri.scheme === 'file' ? this.ownersOf(doc.uri.fsPath) : null;
    if (!owners || !owners.length) { this.item.hide(); this.item.text = ''; return; }
    const top = owners.slice(0, 2).map(o => `${short(o.developer)} ${pct(o.ownership)}`).join(' · ');
    this.item.text = `$(person) ${top}`;
    const md = new vscode.MarkdownString(`**Who knows this file** (share of its current lines)\n\n` +
      owners.map(o => `- ${o.developer}: ${pct(o.ownership)}`).join('\n') +
      `\n\n_From the last Git Analyzer run. Click to open the dashboard._`);
    this.item.tooltip = md;
    this.item.show();
  }
}

module.exports = { Insights, snapshot, normKey };
