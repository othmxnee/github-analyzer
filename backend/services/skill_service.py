from pydriller import Repository
from utils.skill_metrics import compute_skill_metrics
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
import numpy as np
import threading

# Cache to store results per repo
_cache = {}
_status = {}  # 'running' | 'done' | 'error'


def _run_analysis(repo_url):
    try:
        _status[repo_url] = 'running'

        commits_data = []
        for commit in Repository(repo_url).traverse_commits():
            modified_files = []
            for f in commit.modified_files:
                path = f.new_path or f.old_path
                modified_files.append({
                    'path':    path,
                    'added':   f.added_lines or 0,
                    'deleted': f.deleted_lines or 0,
                })
            commits_data.append({
                'author_email':   commit.author.email,
                'message':        commit.msg,
                'modified_files': modified_files,
            })

        rows = compute_skill_metrics(commits_data)

        if rows:
            rows = _run_clustering(rows)

        role_distribution = {}
        for row in rows:
            role = row['role']
            role_distribution[role] = role_distribution.get(role, 0) + 1

        _cache[repo_url] = {
            'developers':        rows,
            'role_distribution': role_distribution,
            'total_analyzed':    len(rows),
        }
        _status[repo_url] = 'done'

    except Exception as e:
        _status[repo_url] = 'error'
        _cache[repo_url]  = {'error': str(e)}


def _run_clustering(rows, n_clusters=4):
    FEATURE_COLS = [
        'pct_frontend', 'pct_backend', 'pct_test', 'pct_devops',
        'pct_docs', 'pct_build',
        'kw_frontend', 'kw_backend', 'kw_test', 'kw_devops', 'kw_docs'
    ]
    if len(rows) < n_clusters:
        n_clusters = max(2, len(rows))

    X        = np.array([[r.get(f, 0) for f in FEATURE_COLS] for r in rows])
    scaler   = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    km       = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels   = km.fit_predict(X_scaled)

    for i, row in enumerate(rows):
        row['cluster'] = int(labels[i])
    return rows


def analyze_skills(repo_url):
    """Start background analysis if not already running."""
    if _status.get(repo_url) not in ('running', 'done'):
        t = threading.Thread(target=_run_analysis, args=(repo_url,), daemon=True)
        t.start()
    return {'status': _status.get(repo_url, 'running')}


def get_skills_result(repo_url):
    """Return current status and result if ready."""
    status = _status.get(repo_url, 'not_started')
    if status == 'done':
        return {'status': 'done', **_cache[repo_url]}
    if status == 'error':
        return {'status': 'error', 'error': _cache.get(repo_url, {}).get('error', 'Unknown error')}
    return {'status': status}