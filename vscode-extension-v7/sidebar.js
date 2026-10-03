'use strict';
/* Sidebar views fed by the same results the dashboard shows (the website's
   /analyze/result and /analyze/skills/result payloads). */
const vscode = require('vscode');

const ROLE_ICONS = {
  Frontend: '🔵', Backend: '🟠', Tester: '🟢', DevOps: '🔴',
  'Full Stack': '🟣', Mobile: '🟡', Generalist: '⚪',
};

class Item extends vscode.TreeItem {
  constructor(label, description, tooltip) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    if (tooltip) this.tooltip = tooltip;
    this.command = { command: 'githubAnalyzer.openDashboard', title: 'Open Dashboard' };
  }
}

class BaseProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.result = null;
    this.skills = null;
    this.repoName = null;
  }
  update({ result, skills, repoName }) {
    if (result !== undefined) this.result = result;
    if (skills !== undefined) this.skills = skills;
    if (repoName !== undefined) this.repoName = repoName;
    this._onDidChangeTreeData.fire();
  }
  getTreeItem(el) { return el; }
}

const short = (id) => String(id || '').split('@')[0];
const day = (s) => (s ? String(s).slice(0, 10) : '?');
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

class SummaryProvider extends BaseProvider {
  getChildren() {
    const r = this.result;
    if (!r) return [new Item('No analysis yet', 'Run “Analyze Repository” (▶)')];
    const s = r.summary || {};
    const ps = r.project_summary || {};
    const abf = r.active_bus_factor || {};
    return [
      new Item('📁 Repository', this.repoName || ''),
      new Item('Health score', `${ps.health_score ?? '—'} / 100 · ${ps.risk_level ?? ''}`),
      new Item('Bus factor', `${r.bus_factor ?? '—'} (active: ${abf.active_bus_factor ?? '—'})`),
      new Item('Gini coefficient', r.gini != null ? r.gini.toFixed(2) : '—'),
      new Item('Orphaned knowledge', pct((r.orphaned_knowledge || {}).orphaned_pct)),
      new Item('Commits', String(s.total_commits ?? '—')),
      new Item('Developers', String(s.total_developers ?? '—')),
      new Item('Files analyzed', String(s.total_files ?? '—')),
      new Item('Period', `${day((s.date_range || {}).start)} → ${day((s.date_range || {}).end)}`),
    ];
  }
}

class DevelopersProvider extends BaseProvider {
  getChildren() {
    const r = this.result;
    if (!r) return [new Item('No data', 'Run analysis first')];
    const roles = new Map(((this.skills || {}).developers || []).map(d => [d.developer, d.role]));
    return (r.top_developers || []).slice(0, 40).map(d => {
      const role = roles.get(d.developer);
      const icon = role ? (ROLE_ICONS[role] || '⚪') : '·';
      return new Item(`${icon} ${short(d.developer)}`, `${role ? role + ' — ' : ''}${d.commits} commits`, d.developer);
    });
  }
}

function riskIcon(score) {
  if (score >= 0.7) return '🔴';
  if (score >= 0.4) return '🟡';
  return '🟢';
}

class RisksProvider extends BaseProvider {
  getChildren() {
    const r = this.result;
    if (!r) return [new Item('No data', 'Run analysis first')];
    const items = (r.risk_files || []).slice(0, 25).map(f =>
      new Item(`${riskIcon(f.risk_score)} ${String(f.file).split('/').pop()}`, `risk ${f.risk_score.toFixed(2)}`, f.file));
    return items.length ? items : [new Item('No risky files found', '')];
  }
}

module.exports = { SummaryProvider, DevelopersProvider, RisksProvider };
