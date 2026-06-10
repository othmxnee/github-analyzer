from pydriller import Repository
from utils.skill_metrics import compute_skill_metrics
from utils.bot_detection import is_bot
from utils.identity import build_identity_map, canonicalize_email
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import numpy as np
import threading

_cache = {}
_status = {}
_commits_cache: dict = {}   # repo_url → pre-built commits_data from main analysis


def provide_commits_data(repo_url: str, commits_data: list) -> None:
    """Kept for backward compatibility — no longer used by the main analysis."""
    pass


def set_prebuilt_commits(repo_url: str, prebuilt: list) -> None:
    """Stash skill-input commits built by the main analysis (which already
    cloned the repo). The skills pipeline then runs on this instead of
    re-cloning and re-traversing the whole history — the slow part. Each entry
    is a (name, email, message, date, modified_files) tuple, already filtered
    for merges and bots."""
    if prebuilt:
        _commits_cache[repo_url] = prebuilt


def invalidate_for_repo(repo_url: str) -> None:
    """Called by analyzer.start_analysis when a re-analysis is triggered,
    so skills re-runs with fresh full-history data instead of returning stale cache."""
    _commits_cache.pop(repo_url, None)
    _status.pop(repo_url, None)
    _cache.pop(repo_url, None)

FEATURE_COLS = [
    'pct_frontend', 'pct_backend', 'pct_mobile', 'pct_test', 'pct_devops',
    'pct_docs', 'pct_build',
    'kw_frontend', 'kw_backend', 'kw_test', 'kw_devops', 'kw_docs'
]


def _run_clustering(rows, n_clusters=4):
    if len(rows) == 1:
        rows[0]['cluster'] = 0
        return rows

    n_clusters = min(n_clusters, len(rows))

    X = np.array([[r.get(f, 0) for f in FEATURE_COLS] for r in rows])
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)

    for i, row in enumerate(rows):
        row['cluster'] = int(labels[i])
    return rows


def _cluster_validation(rows, k_used, k_min=2, k_max=6):
    """Silhouette analysis to justify the number of clusters.

    Returns the silhouette score for every candidate k and the k that scores
    best, so the choice of k=4 can be defended (or revisited) rather than left
    as an unexplained constant. The actual clustering still uses ``k_used``;
    this is reporting only, so role assignments don't shift under our feet.
    """
    n = len(rows)
    if n < 3:
        return {"scores": [], "best_k": k_used, "k_used": k_used,
                "note": "Too few developers for silhouette analysis."}

    X = np.array([[r.get(f, 0) for f in FEATURE_COLS] for r in rows])
    X_scaled = MinMaxScaler().fit_transform(X)

    scores = []
    upper = min(k_max, n - 1)
    for k in range(k_min, upper + 1):
        try:
            labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(X_scaled)
            if len(set(labels)) < 2:
                continue
            score = float(silhouette_score(X_scaled, labels))
            scores.append({"k": k, "silhouette": round(score, 3)})
        except Exception:
            continue

    best_k = max(scores, key=lambda s: s["silhouette"])["k"] if scores else k_used
    return {"scores": scores, "best_k": best_k, "k_used": k_used}


def _cluster_profiles(rows):
    """Describe each cluster by its average feature profile (its archetype).

    More honest than naming a cluster after a borrowed rule-role: the centroid
    says what the cluster actually does (e.g. "high test + backend").
    """
    _PRETTY = {
        'pct_frontend': 'frontend', 'pct_backend': 'backend', 'pct_mobile': 'mobile',
        'pct_test': 'testing', 'pct_devops': 'devops', 'pct_docs': 'docs',
        'pct_build': 'build', 'kw_frontend': 'frontend (msgs)',
        'kw_backend': 'backend (msgs)', 'kw_test': 'testing (msgs)',
        'kw_devops': 'devops (msgs)', 'kw_docs': 'docs (msgs)',
    }
    by_cluster = {}
    for row in rows:
        by_cluster.setdefault(row.get('cluster', 0), []).append(row)

    profiles = []
    for c, members in sorted(by_cluster.items()):
        means = {f: float(np.mean([m.get(f, 0) for m in members])) for f in FEATURE_COLS}
        top = sorted(means.items(), key=lambda x: x[1], reverse=True)[:2]
        label = " + ".join(_PRETTY.get(f, f) for f, v in top if v > 0.01) or "mixed"
        profiles.append({
            "cluster": int(c),
            "size": len(members),
            "label": label,
            "centroid": {k: round(v, 3) for k, v in means.items()},
        })
    return profiles


def _resolve_generalists(rows):
    # Step 1: find dominant role per cluster (excluding Generalists)
    cluster_roles = {}
    for row in rows:
        c = row['cluster']
        if c not in cluster_roles:
            cluster_roles[c] = {}
        role = row['role']
        if role != 'Generalist':
            cluster_roles[c][role] = cluster_roles[c].get(role, 0) + 1

    # Step 2: dominant role per cluster
    cluster_dominant = {}
    for c, role_counts in cluster_roles.items():
        if role_counts:
            cluster_dominant[c] = max(role_counts, key=role_counts.get)
        else:
            cluster_dominant[c] = 'Generalist'

    # Step 3: resolve Generalists BUT only if they have minimum activity
    for row in rows:
        if row['role'] == 'Generalist':
            row['role_original'] = 'Generalist'

            max_pct = max(
                row.get('pct_frontend', 0),
                row.get('pct_backend', 0),
                row.get('pct_test', 0),
                row.get('pct_devops', 0),
                row.get('pct_mobile', 0),
            )

            if max_pct >= 0.15:
                dominant = cluster_dominant.get(row['cluster'], 'Generalist')
                row['role'] = dominant
            else:
                row['role'] = 'Generalist'
        else:
            row['role_original'] = row['role']

    return rows, cluster_dominant


def _compute_pca_2d(rows, feature_cols, key_x='pca_x', key_y='pca_y'):
    """Compute 2D PCA coordinates using the given feature columns."""
    if len(rows) < 2:
        for row in rows:
            row[key_x] = 0.0
            row[key_y] = 0.0
        return rows

    X = np.array([[r.get(f, 0) for f in feature_cols] for r in rows])
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    n_components = min(2, X_scaled.shape[1], X_scaled.shape[0])
    pca = PCA(n_components=n_components, random_state=42)
    X_pca = pca.fit_transform(X_scaled)

    for i, row in enumerate(rows):
        row[key_x] = round(float(X_pca[i, 0]), 4)
        row[key_y] = round(float(X_pca[i, 1] if X_pca.shape[1] > 1 else 0), 4)

    return rows


def _compute_umap_2d(rows, feature_cols):
    """Compute 2D UMAP coordinates for scatter plot visualization."""
    try:
        import umap
    except ImportError:
        return _compute_pca_2d(rows, feature_cols, key_x='umap_x', key_y='umap_y')

    if len(rows) < 4:
        for row in rows:
            row['umap_x'] = 0.0
            row['umap_y'] = 0.0
        return rows

    X = np.array([[r.get(f, 0) for f in feature_cols] for r in rows])
    scaler = MinMaxScaler()
    X_scaled = scaler.fit_transform(X)

    n_neighbors = min(15, len(rows) - 1)
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=0.1,
        random_state=42
    )
    X_umap = reducer.fit_transform(X_scaled)

    for i, row in enumerate(rows):
        row['umap_x'] = round(float(X_umap[i, 0]), 4)
        row['umap_y'] = round(float(X_umap[i, 1]), 4)

    return rows


_KW_STOP = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','as','is','are','was','were','be','been','this','that','it','its',
    'not','no','so','than','then','when','where','which','who','what','how',
    'also','into','can','now','just','after','some','all','more','other','will',
    'via','etc','per','use','used','using','get','set','new','make','its','too',
    'our','has','had','have','did','been','their','them','they','we','you','your',
}


def _run_analysis(repo_url):
    try:
        _status[repo_url] = 'running'

        # Step 1: full-history traversal (no commit limit) so all contributors are captured.
        # Also collect dates and messages for first/last commit and keyword extraction.
        import re as _re
        from collections import Counter, defaultdict

        # Prefer commit data prebuilt by the main analysis (no re-clone). Fall
        # back to traversing the repo only if that cache is empty (e.g. the
        # server restarted since the repo was analysed).
        raw_commits = _commits_cache.get(repo_url)   # (name, email, msg, date, modified_files)
        if not raw_commits:
            raw_commits = []
            for commit in Repository(repo_url).traverse_commits():
                # Skip merge commits and bot/non-human accounts, matching the
                # activity pipeline's filtering so roles are computed over real,
                # hand-authored work only.
                if commit.merge:
                    continue
                email = (commit.author.email or '').strip().lower()
                if not email or is_bot(email):
                    continue
                modified_files = []
                for f in commit.modified_files:
                    path = f.new_path or f.old_path
                    modified_files.append({
                        'path': path,
                        'added': f.added_lines or 0,
                        'deleted': f.deleted_lines or 0,
                    })
                raw_commits.append(
                    (commit.author.name, email, commit.msg, commit.author_date, modified_files)
                )

        # Merge a contributor's multiple emails into one canonical identity so
        # roles aren't split across aliases (same map logic as the activity
        # pipeline; see utils.identity).
        identity_map = build_identity_map((name, email) for name, email, *_ in raw_commits)

        commits_data = []
        dates_by_dev = defaultdict(list)
        msgs_by_dev = defaultdict(list)
        for name, email, msg, date, modified_files in raw_commits:
            email = canonicalize_email(email, identity_map)
            commits_data.append({
                'author_email': email,
                'message': msg,
                'modified_files': modified_files,
            })
            dates_by_dev[email].append(date)
            if msg:
                msgs_by_dev[email].append(msg)

        # Step 2: compute metrics
        rows = compute_skill_metrics(commits_data)

        if not rows:
            _cache[repo_url] = {
                'developers': [],
                'role_distribution': {},
                'total_analyzed': 0,
            }
            _status[repo_url] = 'done'
            return

        # Enrich each row with first/last commit dates and top keywords from full history.
        def _fmt_date(d):
            if d is None:
                return None
            if hasattr(d, 'date'):
                return str(d.date())
            try:
                import datetime
                return str(d)[:10]
            except Exception:
                return None

        for row in rows:
            dev = row['developer']
            dates = sorted(dates_by_dev.get(dev, []))
            row['first_commit'] = _fmt_date(dates[0]) if dates else None
            row['last_commit'] = _fmt_date(dates[-1]) if dates else None
            words = []
            for msg in msgs_by_dev.get(dev, []):
                tokens = _re.findall(r'[a-z][a-z0-9]{2,}', msg.lower())
                words.extend(t for t in tokens if t not in _KW_STOP)
            row['top_keywords'] = [w for w, _ in Counter(words).most_common(8)]

        # Step 3: clustering (uses all features)
        k_used = min(4, len(rows))
        rows = _run_clustering(rows)
        cluster_validation = _cluster_validation(rows, k_used)

        # Step 4: resolve Generalists using clustering
        rows, cluster_dominant = _resolve_generalists(rows)
        cluster_profiles = _cluster_profiles(rows)

        # Step 5a: PCA with all features
        rows = _compute_pca_2d(rows, FEATURE_COLS, key_x='pca_x', key_y='pca_y')

        # Step 5b: UMAP with all features
        rows = _compute_umap_2d(rows, FEATURE_COLS)

        # Step 6: role distribution summary
        role_distribution = {}
        for row in rows:
            role = row['role']
            role_distribution[role] = role_distribution.get(role, 0) + 1

        _cache[repo_url] = {
            'developers': rows,
            'role_distribution': role_distribution,
            'total_analyzed': len(rows),
            'cluster_dominant': cluster_dominant,
            'cluster_validation': cluster_validation,
            'cluster_profiles': cluster_profiles,
        }
        _status[repo_url] = 'done'

    except Exception as e:
        _status[repo_url] = 'error'
        _cache[repo_url] = {'error': str(e)}


def analyze_skills(repo_url):
    if _status.get(repo_url) not in ('running', 'done'):
        t = threading.Thread(target=_run_analysis, args=(repo_url,), daemon=True)
        t.start()
    return {'status': _status.get(repo_url, 'running')}


def get_skills_result(repo_url):
    status = _status.get(repo_url, 'not_started')
    if status == 'done':
        return {'status': 'done', **_cache[repo_url]}
    if status == 'error':
        return {'status': 'error', 'error': _cache.get(repo_url, {}).get('error', 'Unknown error')}
    return {'status': status}