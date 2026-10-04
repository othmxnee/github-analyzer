# Change Log

## [2.1.0]

- **Who knows this file**: the status bar shows the main owners of the file
  you're editing (share of its current lines); hover for the full list.
- **Explorer badges**: `!` on high-risk files (widely imported, known by few),
  `○` on files owned by people who stopped contributing. Setting:
  `githubAnalyzer.explorerBadges`.
- **Click a file name** in the dashboard (charts, tables, "See all" lists)
  to open it beside the dashboard.
- **History**: every analyzed commit is saved locally; the overview shows the
  trend of health and bus factor across commits.
- The last results are restored when VS Code starts, before any new analysis.

## [2.0.1]

- Renamed the extension to **Git Analyzer**.
- New Marketplace page: rewritten description, screenshots, gallery banner.

## [2.0.0]

The extension now runs the website's own engine and dashboard instead of its
own copies, so its results match the website and the desktop app exactly.

- **Same dashboard as the website**: every section, chart, timeline filter,
  "See all" table, CSV export and the PDF health report.
- **Same engine as the website**: the role detection, ownership, risk and
  knowledge metrics are the website's code (v1.x used an older, separate copy
  with older role rules and gave different roles).
- **Faster**: one long-lived engine process with a background warm-up. A
  first analysis takes a few seconds, and an unchanged repository reopens
  instantly, even after restarting VS Code.
- **Accurate snapshot**: analyzes the committed state of the checked-out
  branch, so node_modules, virtualenvs and uncommitted edits don't skew results.
- **Easy setup**: "Set Up Analysis Engine" installs the Python packages into a
  private environment. You can instead point `githubAnalyzer.enginePath` at
  the desktop app's engine and need no Python at all.
- Status bar shows the health score and bus factor of the last analysis.
- Removed: the `minCommits` setting (the website engine applies its own rules).

## [1.1.0]

- "See all" detail views with CSV export, Architecture tab, Project Health
  card, orphaned knowledge, active vs historical bus factor, line ownership.

## [1.0.0]

Initial release.
