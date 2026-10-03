# GitHub Analyzer for VS Code

See who knows what in your repository, and where you're one resignation away
from trouble: **bus factor, knowledge concentration, orphaned code, hotspots,
architecture risk and developer roles**, in VS Code.

Everything runs **on your machine**. Your code and your team's data are never
uploaded.

## Features

- **The full GitHub Analyzer dashboard** (same as the website): Overview,
  Activity, Knowledge & Risk, Hotspots, Architecture, Developer Roles,
  Developers.
- **Date-range filters** with comparison to the previous period or last year.
- **"See all"** tables with search, sorting and CSV export.
- **PDF health report** with score, insights and recommendations.
- **Sidebar**: repository summary, developers with their roles, riskiest files.
- **Status bar**: health score and bus factor at a glance.

## Getting started

1. Open a folder that is a Git repository.
2. Click the GitHub Analyzer icon in the activity bar, then **▶ Analyze**.
3. The first time, the extension offers to **set up its analysis engine**:
   it installs the Python packages it needs into a private environment
   (once: about 600 MB on disk, needs Python 3.11+ and internet; tested on Python 3.13 and 3.14).

Re-run with **Re-analyze**. An unchanged repository reopens instantly, and a
new commit triggers a fresh analysis automatically.

## Requirements

- **Git** on your PATH.
- **Python 3.11+**, or the GitHub Analyzer desktop app's engine via
  `githubAnalyzer.enginePath` (then no Python is needed).

## Settings

| Setting | Default | Description |
|---|---|---|
| `githubAnalyzer.pythonPath` | empty | Python to run the engine with. Empty uses the private environment or `python3`. |
| `githubAnalyzer.enginePath` | empty | Path to a frozen `analyzer_bridge` engine binary. |

## Privacy

The analysis reads your local repository only. The extension makes no network
requests during analysis. Profile pictures are not fetched in VS Code.

## Build from source

```bash
npm run prepare-assets   # builds the dashboard + copies the engine sources
npm run package          # creates github-analyzer-2.0.0.vsix
```
