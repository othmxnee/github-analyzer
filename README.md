# GitHub Repository Analyzer

A full-stack web application for analyzing GitHub repositories using software metrics and visualization.

## Features

- **Developer Activity Analysis** - Track contributions by developer
- **Contribution Inequality** - Gini coefficient and Lorenz curve visualization
- **Bus Factor** - Minimum developers responsible for 50% of changes
- **Knowledge Concentration (KCI)** - File ownership analysis using git blame
- **PageRank Analysis** - Architectural importance through dependency graph
- **Risk Score** - Combined metric (KCI × PageRank) for identifying critical files
- **Inter-Commit Time** - Developer activity frequency analysis

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: React.js + Vite
- **Visualization**: Chart.js
- **Data Extraction**: PyDriller (Git mining)

## Prerequisites

- Python 3.8+
- Node.js 16+
- Git installed on system

## Installation

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Running the Application

### Start Backend

```bash
cd backend
python app.py
```

The backend will run on `http://localhost:5000`

### Start Frontend

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter a GitHub repository URL (e.g., `https://github.com/pallets/flask`)
2. Click "Analyze Repository"
3. View the interactive dashboard with metrics and visualizations

## Project Structure

```
github-analyzer/
├── backend/
│   ├── app.py                  # Flask application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── services/
│   │   ├── analyzer.py         # Core analysis pipeline
│   │   └── git_utils.py        # Git operations
│   ├── routes/
│   │   └── analyze.py          # POST /analyze endpoint
│   └── utils/
│       └── metrics.py          # Metric computations
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Charts/         # Chart.js visualizations
│   │   ├── pages/
│   │   │   ├── Home.jsx        # URL input page
│   │   │   └── Dashboard.jsx   # Results dashboard
│   │   └── services/
│   │       └── api.js          # API calls
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## API Endpoint

### POST /analyze

Analyzes a GitHub repository and returns metrics.

**Request:**
```json
{
  "repo_url": "https://github.com/pallets/flask"
}
```

**Response:**
```json
{
  "summary": {
    "total_commits": 1000,
    "total_developers": 50,
    "total_files": 200,
    "total_modifications": 5000
  },
  "top_developers": [...],
  "timeline": [...],
  "gini": 0.85,
  "lorenz": {"x": [...], "y": [...]},
  "bus_factor": 3,
  "inter_commit": {...},
  "kci": [...],
  "pagerank": [...],
  "risk_files": [...]
}
```

## Performance Optimizations

- Shallow clone (`--depth=1`) for faster repository download
- Commits limited to ~1000 for analysis
- Large commits (>20 files) are skipped
- KCI computed only for top 50 most modified files
- Tests/examples/docs filtered from PageRank analysis
- Analysis timeout: ~30 seconds

## Metrics Explained

### Gini Coefficient
Measures inequality in contribution distribution. Values closer to 1 indicate high inequality.

### Bus Factor
The minimum number of developers responsible for 50% of the codebase changes.

### KCI (Knowledge Concentration Index)
Maximum ownership share per file based on git blame. Higher values indicate concentrated knowledge.

### PageRank
Network analysis metric showing architectural importance based on import dependencies.

### Risk Score
Combines KCI and PageRank to identify files that are both architecturally critical and have concentrated ownership.

## License

MIT
