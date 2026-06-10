import logging
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import traceback
from collections import defaultdict
from pathlib import Path

import pandas as pd
from pydriller import Repository
from utils.metrics import (
    compute_gini,
    compute_lorenz,
    compute_kci,
    compute_in_degree,
    compute_risk_score,
    build_dependency_graph,
    simulate_bus_factor_risk,
    generate_project_summary,
    build_overview_data,
    normalize_path,
    _bus_score,
    _gini_score,
)

logger = logging.getLogger(__name__)

MAX_COMMITS = 2000

from utils.bot_detection import is_bot as _is_bot_id
from utils.voronoi_treemap import build_voronoi_data
from utils.identity import build_identity_map, canonicalize_email, merged_alias_count
from utils.knowledge_risk import (
    compute_dev_last_active,
    compute_orphaned_knowledge,
    compute_active_bus_factor,
    compute_live_risk,
)
from utils.collaboration import build_collaboration_network, build_cochange_coupling

INACTIVE_MONTHS = 12  # a developer/file is "inactive" after this many idle months


_ANALYSIS_CACHE = {}
_ANALYSIS_STATUS = {}
_ANALYSIS_PHASE = {}        # repo_url -> current phase string while running
_ANALYSIS_TIMESTAMPS = {}   # repo_url -> unix timestamp of last completed analysis
_LAST_REPO_URL = None

# Cleaned dataframes + ownership snapshots kept so windowed timeline metrics
# can re-slice without re-cloning. Same keys as _ANALYSIS_CACHE.
_CLEANED_CACHE = {}   # repo_url -> {"df_commits": ..., "df_files": ..., "ownership_results": ..., "line_counts": ..., "architecture": ..., "kci_data": ...}

CACHE_TTL = 30 * 60        # 30 minutes — auto-rerun after this on next request
CACHE_MAX_AGE = 24 * 3600  # 24 hours  — hard eviction (frees memory)


def _evict_stale_entries():
    """Remove entries older than CACHE_MAX_AGE. Called lazily on each new analysis."""
    cutoff = time.time() - CACHE_MAX_AGE
    stale = [url for url, ts in list(_ANALYSIS_TIMESTAMPS.items()) if ts < cutoff]
    for url in stale:
        _ANALYSIS_CACHE.pop(url, None)
        _ANALYSIS_STATUS.pop(url, None)
        _ANALYSIS_PHASE.pop(url, None)
        _ANALYSIS_TIMESTAMPS.pop(url, None)
        _CLEANED_CACHE.pop(url, None)




def _build_clone_url(repo_url: str, token: str, provider: str) -> str:
    """Inject an OAuth token into a clone URL using the provider's expected scheme."""
    if not token:
        return repo_url
    if provider == 'gitlab':
        userinfo = f'oauth2:{token}'
    elif provider == 'bitbucket':
        userinfo = f'x-token-auth:{token}'
    else:  # github (and default)
        userinfo = token
    return repo_url.replace('https://', f'https://{userinfo}@', 1)


def _run_analysis(repo_url: str, token: str = None, provider: str = None):
    global _LAST_REPO_URL
    tmp_dir = tempfile.mkdtemp()
    try:
        _ANALYSIS_STATUS[repo_url] = 'running'

        _ANALYSIS_PHASE[repo_url] = 'cloning'
        clone_url = _build_clone_url(repo_url, token, provider)
        result = subprocess.run(
            ["git", "clone", clone_url, tmp_dir],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            if 'not found' in stderr.lower() or 'repository not found' in stderr.lower():
                raise ValueError(f"Repository not found: {repo_url}")
            if 'rate limit' in stderr.lower():
                raise ValueError("Rate limit reached on the Git host. Wait a few minutes and try again.")
            if 'could not resolve host' in stderr.lower() or 'unable to access' in stderr.lower():
                raise ValueError("Network error: could not reach the Git host. Check your connection.")
            if 'authentication failed' in stderr.lower() or 'invalid credentials' in stderr.lower():
                raise ValueError("Authentication failed. Sign in to the matching provider for private repos.")
            raise ValueError(f"git clone failed: {stderr or f'exit code {result.returncode}'}")

        _ANALYSIS_PHASE[repo_url] = 'extracting'
        commits_data, file_modifications = extract_data(tmp_dir)

        # Hand the skills pipeline the commit data from this same clone so the
        # Roles tab doesn't have to re-clone and re-traverse the whole history.
        _prime_skill_cache(repo_url, commits_data, file_modifications)

        _ANALYSIS_PHASE[repo_url] = 'cleaning'
        df_commits, df_files = clean_data(commits_data, file_modifications)

        _ANALYSIS_PHASE[repo_url] = 'computing'
        results, internals = compute_metrics(tmp_dir, df_commits, df_files, commits_data)

        # Profile pictures are resolved separately, as a background job kicked
        # off by the dashboard (see avatar_service + /analyze/avatars), so they
        # never delay analysis. Start with an empty map.
        results["avatars"] = {}

        _ANALYSIS_CACHE[repo_url] = results
        # Persist cleaned dataframes + ownership snapshots so the timeline
        # service can compute windowed metrics without re-cloning.
        _CLEANED_CACHE[repo_url] = {
            "df_commits":        df_commits,
            "df_files":          df_files,
            "ownership_results": internals.get("ownership_results", {}),
            "line_counts":       internals.get("line_counts", {}),
            "architecture":      internals.get("architecture", {"nodes": [], "edges": []}),
            "kci_data":          internals.get("kci_data", {}),
            "in_degree_data":    internals.get("in_degree_data", {}),
        }
        _LAST_REPO_URL = repo_url
        _ANALYSIS_TIMESTAMPS[repo_url] = time.time()
        _ANALYSIS_STATUS[repo_url] = 'done'
        _ANALYSIS_PHASE.pop(repo_url, None)
    except Exception as exc:
        _ANALYSIS_STATUS[repo_url] = 'error'
        _ANALYSIS_PHASE.pop(repo_url, None)
        _ANALYSIS_CACHE[repo_url] = {
            'error': str(exc),
            'trace': traceback.format_exc(),
        }
    finally:
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)


def _prime_skill_cache(repo_url, commits_data, file_modifications):
    """Build the skills pipeline's input from the main clone and stash it.

    Produces one (name, email, message, date, modified_files) tuple per
    non-merge, non-bot commit — exactly what skill_service expects — so the
    Roles tab runs on cached data instead of cloning the repo a second time
    and walking its whole history (the slow path). Bounded by the same
    MAX_COMMITS cap as the activity pipeline.
    """
    try:
        files_by_commit = defaultdict(list)
        for fm in file_modifications:
            files_by_commit[fm.get("commit_hash")].append({
                "path":    fm.get("path"),
                "added":   fm.get("lines_added") or 0,
                "deleted": fm.get("lines_deleted") or 0,
            })

        prebuilt = []
        for c in commits_data:
            if c.get("is_merge"):
                continue
            email = (c.get("author_email") or "").strip().lower()
            if not email or _is_bot_id(email):
                continue
            prebuilt.append((
                c.get("author_name"),
                email,
                c.get("message"),
                c.get("author_date"),
                files_by_commit.get(c.get("commit_hash"), []),
            ))

        from services.skill_service import set_prebuilt_commits
        set_prebuilt_commits(repo_url, prebuilt)
    except Exception:
        # Priming is a pure optimisation; never let it break the main analysis.
        logger.exception("Failed to prime skill cache for %s", repo_url)


def start_analysis(repo_url: str, force: bool = False, token: str = None, provider: str = None):
    _evict_stale_entries()

    status = _ANALYSIS_STATUS.get(repo_url)

    if status != 'running':
        # Honour force flag or auto-expire after TTL
        ts = _ANALYSIS_TIMESTAMPS.get(repo_url, 0)
        if force or (status == 'done' and time.time() - ts > CACHE_TTL):
            _ANALYSIS_STATUS.pop(repo_url, None)
            _ANALYSIS_CACHE.pop(repo_url, None)
            _ANALYSIS_TIMESTAMPS.pop(repo_url, None)
            _CLEANED_CACHE.pop(repo_url, None)
            status = None
            # Invalidate skills cache so it re-runs from scratch on next request
            from services.skill_service import invalidate_for_repo
            invalidate_for_repo(repo_url)
            # Also clear windowed-timeline LRU so stale slices aren't served
            from services.timeline_service import invalidate_for_repo as invalidate_timeline
            invalidate_timeline(repo_url)
            # Drop the avatar job so photos re-resolve on next dashboard load
            from services.avatar_service import invalidate_for_repo as invalidate_avatars
            invalidate_avatars(repo_url)

    if status == 'done':
        return {'status': 'done', 'analyzed_at': _ANALYSIS_TIMESTAMPS.get(repo_url)}

    if status != 'running':
        thread = threading.Thread(target=_run_analysis, args=(repo_url, token, provider), daemon=True)
        thread.start()

    return {'status': _ANALYSIS_STATUS.get(repo_url, 'running')}


def get_analysis_result(repo_url: str):
    status = _ANALYSIS_STATUS.get(repo_url, 'not_started')

    if status == 'done':
        return {
            'status': 'done',
            'analyzed_at': _ANALYSIS_TIMESTAMPS.get(repo_url),
            **_ANALYSIS_CACHE[repo_url],
        }

    if status == 'error':
        cached = _ANALYSIS_CACHE.get(repo_url, {})
        return {
            'status': 'error',
            'error': cached.get('error', 'Unknown error'),
            'trace': cached.get('trace'),
        }

    return {'status': status, 'phase': _ANALYSIS_PHASE.get(repo_url, 'starting')}


def get_developer_emails(repo_url: str):
    """Lowercased developer emails for an analyzed repo (for avatar resolution).

    Reads the authoritative `developer_id` column from the cleaned commits;
    falls back to the cached result's `dev_stats` keys if that's been evicted.
    Returns [] if the repo hasn't been analyzed.
    """
    cleaned = _CLEANED_CACHE.get(repo_url)
    if cleaned is not None:
        df = cleaned.get("df_commits")
        if df is not None and "developer_id" in df:
            return df["developer_id"].dropna().astype(str).str.lower().unique().tolist()
    cached = _ANALYSIS_CACHE.get(repo_url, {})
    return [str(k).lower() for k in (cached.get("dev_stats") or {}).keys()]


def extract_data(repo_path: str):
    file_modifications = []
    commits_data = []
    developers = set()
    project_start = None
    project_end = None

    # Limit to MAX_COMMITS most-recent commits to keep analysis fast
    only_commits = None
    try:
        count_out = subprocess.run(
            ["git", "-C", repo_path, "rev-list", "--count", "HEAD"],
            capture_output=True, text=True, check=True,
        )
        total = int(count_out.stdout.strip())
        if total > MAX_COMMITS:
            hash_out = subprocess.run(
                ["git", "-C", repo_path, "log", f"--max-count={MAX_COMMITS}", "--format=%H"],
                capture_output=True, text=True, check=True,
            )
            only_commits = [h.strip() for h in hash_out.stdout.strip().splitlines() if h.strip()]
    except Exception:
        pass

    repo_iter = Repository(repo_path, only_commits=only_commits) if only_commits else Repository(repo_path)

    for commit in repo_iter.traverse_commits():
        
        if project_start is None or commit.author_date < project_start:
            project_start = commit.author_date
            
        if project_end is None or commit.author_date > project_end:
            project_end = commit.author_date
        
        author_name = commit.author.name
        author_email = commit.author.email
        developer_id = f"{author_name} <{author_email}>"
        
        developers.add(developer_id)
        
        commits_data.append({
            "commit_hash": commit.hash,
            "author_name": author_name,
            "author_email": author_email,
            "developer_id": developer_id,
            "author_date": commit.author_date,
            "year": commit.author_date.year,
            "month": commit.author_date.month,
            "message": commit.msg,
            "message_length": len(commit.msg),
            "is_merge": commit.merge,
            "parents": len(commit.parents)
        })
        
        for f in commit.modified_files:
            file_modifications.append({
                "commit_hash": commit.hash,
                "developer_id": developer_id,
                "author_date": commit.author_date,
                "year": commit.author_date.year,
                "month": commit.author_date.month,
                "filename": f.filename,
                "old_path": f.old_path,
                "new_path": f.new_path,
                "change_type": str(f.change_type).split('.')[-1],
                "lines_added": f.added_lines,
                "lines_deleted": f.deleted_lines,
                "churn": f.added_lines + f.deleted_lines,
                "path": f.new_path if f.new_path else f.old_path,
                "extension": (
                    f.filename.split('.')[-1]
                    if f.filename and '.' in f.filename
                    else None
                )
            })
        
    return commits_data, file_modifications


def clean_data(commits_data, file_modifications, code_extensions=None):
    df_files = pd.DataFrame(file_modifications)
    df_commits = pd.DataFrame(commits_data)
    
    if len(df_commits) == 0 or len(df_files) == 0:
        raise ValueError("No data extracted from repository")
    
    df_files = df_files.drop_duplicates()
    df_commits = df_commits.drop_duplicates()
    
    df_files = df_files[df_files["developer_id"].notna()]
    df_commits = df_commits[df_commits["developer_id"].notna()]
    
    bot_mask = df_commits["developer_id"].apply(_is_bot_id)
    bots = df_commits.loc[bot_mask, "developer_id"].unique()
    
    df_commits = df_commits[~bot_mask]
    df_files = df_files[~df_files["developer_id"].isin(bots)]
    
    merge_hashes = df_commits[df_commits["is_merge"] == True]["commit_hash"]
    df_commits = df_commits[df_commits["is_merge"] == False]
    df_files = df_files[~df_files["commit_hash"].isin(merge_hashes)]
    
    if code_extensions is None:
        code_extensions = _default_extensions()
    df_files = df_files[df_files["extension"].isin(code_extensions)]
    
    df_files = df_files[df_files["path"].notna()]
    df_files = df_files[df_files["path"] != ""]

    # ── Identity resolution (alias merging) ──────────────────────────────
    # One contributor often commits under several emails. Build a map from
    # every email to a single canonical email (see utils.identity) so that the
    # contributor count, Gini, and bus factor are computed over real people,
    # not split aliases. Keyed by canonical email from here on.
    identity_map = build_identity_map(
        zip(df_commits["author_name"], df_commits["author_email"])
    )
    df_commits["developer_id"] = (
        df_commits["author_email"].str.lower().map(
            lambda e: canonicalize_email(e, identity_map)
        )
    )
    # df_files holds "name <email>"; pull the email out, then canonicalize so
    # both frames share the same per-developer key.
    _angle_re = re.compile(r'<(.+?)>')

    def _canon_from_dev_id(dev_id):
        m = _angle_re.search(str(dev_id))
        email = m.group(1) if m else str(dev_id)
        return canonicalize_email(email, identity_map)

    df_files["developer_id"] = df_files["developer_id"].map(_canon_from_dev_id)
    df_commits.attrs["identity_map"] = identity_map
    df_commits.attrs["merged_aliases"] = merged_alias_count(identity_map)
    
    df_files = df_files[df_files["churn"] > 0]
    
    df_commits["author_date"] = pd.to_datetime(
        df_commits["author_date"],
        utc=True,
        errors="coerce"
    )
    df_files["author_date"] = pd.to_datetime(
        df_files["author_date"],
        utc=True,
        errors="coerce"
    )
    
    if len(df_commits) == 0 or len(df_files) == 0:
        raise ValueError("No valid data after cleaning. The repository may have no commits matching the criteria.")
    
    return df_commits, df_files


def _default_extensions():
    return [
        "py", "js", "ts", "tsx", "jsx",
        "java", "kt", "scala",
        "c", "cpp", "cc", "cxx", "h", "hpp",
        "go", "rs", "php", "rb", "cs",
        "vue", "svelte", "swift", "dart",
    ]


_KW_STOP = {
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','as','is','are','was','were','be','been','this','that','it','its',
    'not','no','so','than','then','when','where','which','who','what','how',
    'also','into','can','now','just','after','some','all','more','other','will',
    'via','etc','per','use','used','using','get','set','new','make','its','too',
    'our','has','had','have','did','been','their','them','they','we','you','your',
}


def _compute_dev_stats(commits_data_raw, df_files, identity_map=None):
    """Per-developer statistics.

    Uses raw (pre-clean) commits for dates and keywords so that merge-commit-only
    and devops-only contributors are not excluded. Uses code-filtered df_files
    for modification counts (which are extension-specific by design).

    identity_map canonicalizes emails so a contributor's aliases are merged into
    one row, matching the canonical keys used everywhere else.
    """
    from collections import Counter, defaultdict
    import re as _re
    identity_map = identity_map or {}
    # Aggregate dates, messages, and commit counts from raw commits
    # (includes merges and all file types — gives full picture for all contributors)
    dates_by_dev  = defaultdict(list)
    msgs_by_dev   = defaultdict(list)
    commit_counts = Counter()
    for c in commits_data_raw:
        email = str(c.get('author_email', '') or '').strip().lower()
        if not email or email == 'none' or _is_bot_id(email):
            continue
        email = canonicalize_email(email, identity_map)
        commit_counts[email] += 1
        d = c.get('author_date')
        if d is not None:
            dates_by_dev[email].append(d)
        msg = c.get('message', '')
        if msg:
            msgs_by_dev[email].append(msg)

    # Modification counts from code-filtered df_files
    _angle_re = _re.compile(r'<(.+?)>')
    def _email_from_dev_id(dev_id):
        m = _angle_re.search(str(dev_id))
        email = m.group(1) if m else str(dev_id)
        return canonicalize_email(email, identity_map)

    df_files_norm = df_files.copy()
    df_files_norm["developer_id"] = df_files_norm["developer_id"].apply(_email_from_dev_id)
    mod_count  = df_files_norm.groupby("developer_id").size()
    uniq_files = df_files_norm.groupby("developer_id")["file_id"].nunique()

    def _fmt_date(d):
        if d is None:
            return None
        if hasattr(d, 'date'):
            return str(d.date())
        try:
            return str(pd.to_datetime(str(d)).date())
        except Exception:
            return None

    stats = {}
    all_devs = set(dates_by_dev) | set(mod_count.index) | set(uniq_files.index)
    for dev in all_devs:
        dates = sorted(dates_by_dev.get(dev, []))
        words = []
        for msg in msgs_by_dev.get(dev, []):
            tokens = _re.findall(r'[a-z][a-z0-9]{2,}', msg.lower())
            words.extend(t for t in tokens if t not in _KW_STOP)
        top_kw = [w for w, _ in Counter(words).most_common(8)]
        stats[dev] = {
            "first_commit":        _fmt_date(dates[0])  if dates else None,
            "last_commit":         _fmt_date(dates[-1]) if dates else None,
            "total_modifications": int(mod_count.get(dev, 0)),
            "unique_files":        int(uniq_files.get(dev, 0)),
            "top_keywords":        top_kw,
            "total_commits_raw":   int(commit_counts.get(dev, 0)),
        }
    return stats


def compute_metrics(repo_path, df_commits, df_files, commits_data_raw=None):
    df_files = df_files.copy()
    df_commits = df_commits.copy()
    
    df_files["file_id"] = df_files["path"].astype(str)
    
    repo_root = Path(repo_path)
    
    dev_activity = df_files.groupby("developer_id").size().sort_values(ascending=False)
    commit_activity = df_commits.groupby("developer_id").size().sort_values(ascending=False)

    file_hotspots = df_files.groupby("file_id").size().sort_values(ascending=False)
    top_files = file_hotspots.head(10)  # still used by the project summary's hotspot list
    
    timeline_data = df_files.set_index("author_date").resample("ME").size()
    timeline = [
        {"date": str(idx), "count": int(count)}
        for idx, count in timeline_data.items()
    ]
    
    gini_value = compute_gini(dev_activity.values)
    lorenz_data = compute_lorenz(dev_activity)

    # Effort-based Gini: inequality measured by lines *added* per developer
    # rather than by number of file-touches. A one-character fix and a
    # 500-line feature both count as one "touch", so the count-based Gini can
    # understate concentration of real work. Reporting both lets the inequality
    # conclusion be checked against the choice of basis.
    dev_added = df_files.groupby("developer_id")["lines_added"].sum()
    gini_effort = compute_gini(dev_added.values)
    lorenz_effort = compute_lorenz(dev_added)
    
    inter_commit = compute_inter_commit_time(df_commits)
    
    kci_data, line_counts, ownership_results = compute_kci(df_files, repo_root)

    # git blame uses author names, but all other data is keyed by email.
    # Build name→email from df_commits and normalize ownership_results.
    _name_to_email = {}
    for _, row in df_commits[['author_name', 'developer_id']].drop_duplicates().iterrows():
        name = str(row.get('author_name', '')).strip().lower()
        email = str(row['developer_id'])  # already lowercase email after clean_data
        if name and '@' in email:
            _name_to_email[name] = email

    def _norm_blame_owners(owners):
        result = {}
        for author, share in owners.items():
            key = _name_to_email.get(author.lower(), author.lower())
            result[key] = result.get(key, 0.0) + share
        return result

    ownership_results = {f: _norm_blame_owners(owners) for f, owners in ownership_results.items()}

    architecture_data = build_dependency_graph(repo_root)
    voronoi_data = build_voronoi_data(df_files, architecture_data, kci_data, ownership_results, repo_root)
    # Normalize paths so they match KCI keys (both strip leading src/)
    in_degree_data = {
        normalize_path(node["id"]): node["degree"]
        for node in architecture_data.get("nodes", [])
    }
    if not in_degree_data:
        in_degree_data = {
            normalize_path(k): v
            for k, v in compute_in_degree(repo_root).items()
        }
    
    risk_data = compute_risk_score(kci_data, in_degree_data)
    busfactor_simulation = simulate_bus_factor_risk(ownership_results, line_counts)
    
    # Derive bus_factor from line-ownership simulation (consistent with charts)
    simulation_steps = busfactor_simulation.get("simulation", [])
    bus_factor = len(simulation_steps)  # fallback: all developers
    for step in simulation_steps:
        if step["knowledge_lost"] >= 0.5:
            bus_factor = step["removed"]
            break

    # ── Time-aware knowledge risk ────────────────────────────────────────
    dev_last_active, reference_ts = compute_dev_last_active(df_commits)
    # Last-modified date per (normalized) file, for the recency factor.
    file_last_modified = {}
    for path, ts in zip(df_files["file_id"], df_files["author_date"]):
        key = normalize_path(str(path))
        cur = file_last_modified.get(key)
        if cur is None or ts > cur:
            file_last_modified[key] = ts

    orphaned_knowledge = compute_orphaned_knowledge(
        ownership_results, line_counts, dev_last_active, reference_ts,
        inactive_months=INACTIVE_MONTHS, top_n=None,
    )
    active_bus_factor = compute_active_bus_factor(
        ownership_results, line_counts, dev_last_active, reference_ts,
        historical_bus_factor=int(bus_factor), inactive_months=INACTIVE_MONTHS,
    )
    live_risk = compute_live_risk(
        kci_data, in_degree_data, file_last_modified, reference_ts,
        half_life_months=INACTIVE_MONTHS, top_n=None,
    )

    # ── Collaboration + co-change structure ──────────────────────────────
    collaboration = build_collaboration_network(df_files)
    cochange_coupling = build_cochange_coupling(
        df_files, architecture_data.get("edges", []), top_n=None,
    )

    summary = {
        "total_commits": int(df_commits["commit_hash"].nunique()),
        "total_developers": int(df_commits["developer_id"].nunique()),
        "total_files": int(df_files["file_id"].nunique()),
        "total_modifications": len(df_files),
        "merged_aliases": int(df_commits.attrs.get("merged_aliases", 0)),
        "date_range": {
            "start": str(df_commits["author_date"].min()) if len(df_commits) > 0 else None,
            "end": str(df_commits["author_date"].max()) if len(df_commits) > 0 else None
        }
    }
    
    # Full sorted lists — the frontend charts still display only the top-N
    # (they slice client-side); the "See all" modal needs the complete data.
    top_developers_list = [
        {"developer": dev, "commits": int(count)}
        for dev, count in commit_activity.items()
    ]

    top_devs_mods_list = [
        {"developer": dev, "modifications": int(count)}
        for dev, count in dev_activity.items()
    ]

    hotspot_files_list = [
        {"file": file, "modifications": int(count)}
        for file, count in file_hotspots.items()
    ]

    sorted_kci = sorted(kci_data.items(), key=lambda x: x[1], reverse=True)
    filtered_kci = [
        (file, kci)
        for file, kci in sorted_kci
        if line_counts.get(file, 0) >= 30
    ]
    kci_list = [
        {"file": file, "kci": float(kci)}
        for file, kci in filtered_kci
    ]

    sorted_in_degree = sorted(in_degree_data.items(), key=lambda x: x[1], reverse=True)
    in_degree_list = [
        {"file": file, "in_degree": int(indeg)}
        for file, indeg in sorted_in_degree
    ]

    # Full risk list for the table/modal; risk_data above stays top-10 for the
    # project summary + overview so their derived insights are unchanged.
    risk_full = compute_risk_score(kci_data, in_degree_data, top_n=None)
    risk_list = [
        {"file": file, "risk_score": float(score)}
        for file, score in risk_full.items()
    ]

    project_summary = generate_project_summary(
        {
            "gini": float(gini_value),
            "bus_factor": int(bus_factor),
            "kci_data": kci_data,
            "risk_scores": risk_data,
            "hotspots": list(top_files.items()),
            "architecture": architecture_data,
        }
    )

    overview = build_overview_data(
        df_commits=df_commits,
        df_files=df_files,
        ownership_results=ownership_results,
        line_counts=line_counts,
        risk_data=risk_data,
        busfactor_simulation=busfactor_simulation,
        gini_value=float(gini_value),
        bus_factor=int(bus_factor),
        project_summary=project_summary,
    )
    
    ownership_rows = []
    for file, owners in ownership_results.items():
        top_owners = sorted(owners.items(), key=lambda x: x[1], reverse=True)[:5]
        for dev, share in top_owners:
            ownership_rows.append({
                "file": file,
                "developer": dev,
                "ownership": float(share)
            })
    
    ownership_plots = []
    # Sort by KCI (highest concentration first), then by line count as tiebreaker.
    # ownership_results keys come from git blame traversal in insertion order —
    # that order is meaningless. We want the files where knowledge is most concentrated.
    files_to_plot = sorted(
        ownership_results.keys(),
        key=lambda f: (kci_data.get(f, 0.0), line_counts.get(f, 0)),
        reverse=True,
    )[:5]
    for file in files_to_plot:
        owners = ownership_results.get(file, {})
        if not owners:
            continue
        top_owners = sorted(owners.items(), key=lambda x: x[1], reverse=True)[:5]
        ownership_plots.append({
            "file": file,
            "developers": [dev for dev, _ in top_owners],
            "ownership": [float(share) for _, share in top_owners]
        })
    
    dev_file_matrix = {"developers": [], "files": [], "values": []}
    # Full version (all developers × the 80 busiest files) for the heatmap's
    # "See all" modal — the card itself still shows the compact 30×30 view.
    dev_file_matrix_full = {"developers": [], "files": [], "values": []}
    if len(dev_activity) > 0 and len(file_hotspots) > 0:
        matrix = pd.pivot_table(
            df_files,
            index="developer_id",
            columns="file_id",
            values="churn",
            aggfunc="sum",
            fill_value=0
        )
        top_dev_ids = dev_activity.head(30).index
        top_file_ids = file_hotspots.head(30).index
        submatrix = matrix.reindex(index=top_dev_ids, columns=top_file_ids, fill_value=0)
        dev_file_matrix = {
            "developers": list(submatrix.index),
            "files": list(submatrix.columns),
            "values": submatrix.values.tolist()
        }

        full_file_ids = file_hotspots.head(80).index
        full_matrix = matrix.reindex(index=dev_activity.index, columns=full_file_ids, fill_value=0)
        dev_file_matrix_full = {
            "developers": list(full_matrix.index),
            "files": list(full_matrix.columns),
            "values": full_matrix.values.tolist()
        }

    # Per-developer monthly activity (file modifications) — powers the
    # individual activity-over-time chart in the Developers tab.
    dev_timeline = {}
    _dtl = df_files[["developer_id", "author_date"]].dropna().copy()
    if len(_dtl) > 0:
        _dtl["month"] = _dtl["author_date"].dt.to_period("M").astype(str)
        for (dev, month), cnt in _dtl.groupby(["developer_id", "month"]).size().items():
            dev_timeline.setdefault(dev, []).append({"date": f"{month}-01", "count": int(cnt)})

    commit_frequency = compute_developer_activity_over_time(df_files)
    _kci_dim = project_summary.get("dimensions", {}).get("KCI × In-Degree", 50)
    health_trend = compute_health_trend(df_commits, df_files, kci_score=_kci_dim)
    identity_map = df_commits.attrs.get("identity_map", {})
    dev_stats = _compute_dev_stats(commits_data_raw or [], df_files, identity_map)

    results = {
        "summary": summary,
        "top_developers": top_developers_list,
        "top_devs_mods": top_devs_mods_list,
        "timeline": timeline,
        "commit_frequency": commit_frequency,
        "gini": float(gini_value),
        "gini_effort": float(gini_effort),
        "lorenz": lorenz_data,
        "lorenz_effort": lorenz_effort,
        "bus_factor": int(bus_factor),
        "inter_commit": inter_commit,
        "kci": kci_list,
        "in_degree": in_degree_list,
        "risk_files": risk_list,
        "live_risk_files": live_risk,
        "orphaned_knowledge": orphaned_knowledge,
        "active_bus_factor": active_bus_factor,
        "collaboration": collaboration,
        "cochange_coupling": cochange_coupling,
        "hotspot_files": hotspot_files_list,
        "dev_file_matrix": dev_file_matrix,
        "dev_file_matrix_full": dev_file_matrix_full,
        "dev_timeline": dev_timeline,
        "ownership_table": ownership_rows,
        "ownership_plots": ownership_plots,
        "architecture": architecture_data,
        "voronoi": voronoi_data,
        "busfactor_simulation": busfactor_simulation,
        "project_summary": project_summary,
        "overview": overview,
        "health_trend": health_trend,
        "dev_stats": dev_stats,
    }

    internals = {
        "ownership_results": ownership_results,
        "line_counts":       line_counts,
        "architecture":      architecture_data,
        "kci_data":          kci_data,
        "in_degree_data":    in_degree_data,
    }

    return results, internals


def _churn_bus_factor(df_files_window):
    """Bus factor proxy from churn ownership over a window (for the trend only).

    The headline bus factor uses git-blame line ownership against the final
    tree, which can't be recomputed for a past window. Per-developer share of
    churn is a reasonable stand-in: the smallest set of developers whose
    combined churn share reaches 50%.
    """
    if len(df_files_window) == 0 or "churn" not in df_files_window.columns:
        return 0
    dev_churn = df_files_window.groupby("developer_id")["churn"].sum().sort_values(ascending=False)
    total = float(dev_churn.sum())
    if total <= 0:
        return 0
    cumulative = 0.0
    for i, v in enumerate(dev_churn.values, start=1):
        cumulative += v / total
        if cumulative >= 0.5:
            return i
    return int(len(dev_churn))


def compute_health_trend(df_commits, df_files, kci_score=50, n_points=8):
    """Trajectory of contribution health over the project's life.

    At several points in time we recompute Gini and a churn-based bus factor
    over a *trailing window* (not cumulative), so a team that is concentrating
    over time shows a falling bus factor / rising Gini rather than a flat line.

    Health uses the SAME formula and weights as the headline score
    (bus 0.40 / gini 0.35 / kci 0.25). The KCI×in-degree dimension can't be
    recomputed per time-window cheaply, so we hold it at its current
    whole-repo value (``kci_score``); the last trend point therefore lines up
    with the headline Health Score instead of contradicting it.
    """
    if df_commits is None or len(df_commits) == 0 or len(df_files) == 0:
        return []

    start = df_commits["author_date"].min()
    end = df_commits["author_date"].max()
    span_days = (end - start).days
    if span_days < 30:
        return []

    window = pd.Timedelta(days=max(90, span_days // 4))
    sample_points = pd.date_range(start + window, end, periods=min(n_points, max(2, span_days // 30)))

    trend = []
    for t in sample_points:
        w_start = t - window
        cf = df_files[(df_files["author_date"] > w_start) & (df_files["author_date"] <= t)]
        if len(cf) == 0:
            continue
        dev_activity = cf.groupby("developer_id").size()
        if len(dev_activity) == 0:
            continue
        gini = compute_gini(dev_activity.values)
        bus = _churn_bus_factor(cf)
        # Same formula/weights as the headline score; KCI held at its current
        # value so the trend doesn't contradict the headline number.
        health = round(_bus_score(bus) * 0.40 + _gini_score(gini) * 0.35 + kci_score * 0.25)
        trend.append({
            "date": str(t.date()),
            "gini": round(float(gini), 3),
            "bus_factor": int(bus),
            "health": int(health),
            "active_developers": int(len(dev_activity)),
        })
    return trend


def compute_inter_commit_time(df_commits):
    if len(df_commits) == 0:
        return {}
    
    commits_sorted = df_commits.sort_values(["developer_id", "author_date"]).copy()
    commits_sorted["prev_commit"] = commits_sorted.groupby("developer_id")["author_date"].shift(1)
    commits_sorted["delta_days"] = (
        (commits_sorted["author_date"] - commits_sorted["prev_commit"])
        .dt.total_seconds() / 86400
    )
    
    commit_counts = commits_sorted["developer_id"].value_counts()
    active_devs = commit_counts[commit_counts >= 3].index

    filtered = commits_sorted[commits_sorted["developer_id"].isin(active_devs)]

    ict = filtered[filtered["delta_days"] > 0].groupby("developer_id")["delta_days"].median()

    return {dev: float(days) for dev, days in ict.items()}


def compute_developer_activity_over_time(df_files, top_n=5):
    if len(df_files) == 0:
        return []

    top_devs = df_files["developer_id"].value_counts().head(top_n).index
    df_top = df_files[df_files["developer_id"].isin(top_devs)].copy()

    timeline = (
        df_top.set_index("author_date")
        .groupby("developer_id")
        .resample("ME")
        .size()
        .reset_index(name="activity")
    )

    series = []
    for dev in top_devs:
        subset = timeline[timeline["developer_id"] == dev]
        points = [
            {"date": str(row["author_date"]), "count": int(row["activity"])}
            for _, row in subset.iterrows()
        ]
        series.append({"developer": dev, "points": points})

    return series


def _resolve_analysis(repo_url=None):
    if repo_url:
        if _ANALYSIS_STATUS.get(repo_url) == 'done' and repo_url in _ANALYSIS_CACHE:
            return _ANALYSIS_CACHE[repo_url]
        raise ValueError(
            f"No completed analysis for '{repo_url}'. POST /analyze and wait for status=done."
        )

    if _LAST_REPO_URL and _LAST_REPO_URL in _ANALYSIS_CACHE:
        return _ANALYSIS_CACHE[_LAST_REPO_URL]

    raise ValueError("No cached analysis found. Run /analyze first or provide repo_url.")


def get_architecture(repo_url=None):
    analysis = _resolve_analysis(repo_url)
    return analysis.get("architecture", {"nodes": [], "edges": []})


def get_busfactor_simulation(repo_url=None):
    analysis = _resolve_analysis(repo_url)
    return analysis.get("busfactor_simulation", {"developers": [], "simulation": []})


def get_project_summary_data(repo_url=None):
    analysis = _resolve_analysis(repo_url)
    return analysis.get(
        "project_summary",
        {"health_score": 0, "risk_level": "Unknown", "insights": [], "recommendations": []},
    )


def get_voronoi_data(repo_url=None):
    analysis = _resolve_analysis(repo_url)
    return analysis.get("voronoi", {"nodes": [], "edges": []})


def get_cleaned_data(repo_url=None):
    """Return cached cleaned dataframes + ownership snapshots for the repo.

    Used by services/timeline_service.py to compute windowed metrics.
    Raises if no completed analysis exists.
    """
    url = repo_url or _LAST_REPO_URL
    if not url or url not in _CLEANED_CACHE:
        raise ValueError(
            f"No cached cleaned data for '{url}'. POST /analyze and wait for status=done."
        )
    return _CLEANED_CACHE[url]
