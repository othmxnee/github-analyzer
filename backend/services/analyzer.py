import os
import shutil
import subprocess
import tempfile
import threading
import traceback
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
)
from utils.treemap import build_treemap_data
from utils.voronoi_treemap import build_voronoi_data


_ANALYSIS_CACHE = {}
_ANALYSIS_STATUS = {}
_LAST_REPO_URL = None


def analyze_repo(repo_url: str):
    global _LAST_REPO_URL
    tmp_dir = tempfile.mkdtemp()
    
    try:
        subprocess.run(
            ["git", "clone", repo_url, tmp_dir],
            check=True,
            capture_output=True
        )

        commits_data, file_modifications = extract_data(tmp_dir)
        df_commits, df_files = clean_data(commits_data, file_modifications)
        results = compute_metrics(tmp_dir, df_commits, df_files)
        _ANALYSIS_CACHE[repo_url] = results
        _LAST_REPO_URL = repo_url
        
        return results
        
    finally:
        if os.path.exists(tmp_dir):
            shutil.rmtree(tmp_dir)


def _run_analysis(repo_url: str):
    global _LAST_REPO_URL

    try:
        _ANALYSIS_STATUS[repo_url] = 'running'
        results = analyze_repo(repo_url)
        _ANALYSIS_CACHE[repo_url] = results
        _LAST_REPO_URL = repo_url
        _ANALYSIS_STATUS[repo_url] = 'done'
    except Exception as exc:
        _ANALYSIS_STATUS[repo_url] = 'error'
        _ANALYSIS_CACHE[repo_url] = {
            'error': str(exc),
            'trace': traceback.format_exc(),
        }


def start_analysis(repo_url: str):
    status = _ANALYSIS_STATUS.get(repo_url)

    if status == 'done':
        return {'status': 'done'}

    if status != 'running':
        thread = threading.Thread(target=_run_analysis, args=(repo_url,), daemon=True)
        thread.start()

    return {'status': _ANALYSIS_STATUS.get(repo_url, 'running')}


def get_analysis_result(repo_url: str):
    status = _ANALYSIS_STATUS.get(repo_url, 'not_started')

    if status == 'done':
        return {'status': 'done', **_ANALYSIS_CACHE[repo_url]}

    if status == 'error':
        cached = _ANALYSIS_CACHE.get(repo_url, {})
        return {
            'status': 'error',
            'error': cached.get('error', 'Unknown error'),
            'trace': cached.get('trace'),
        }

    return {'status': status}


def extract_data(repo_path: str):
    file_modifications = []
    commits_data = []
    developers = set()
    project_start = None
    project_end = None
    for commit in Repository(repo_path).traverse_commits():
        
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
    
    bot_keywords = [
        "bot", "dependabot", "github-actions",
        "ci", "automation", "build"
    ]
    
    def is_bot(dev):
        name = str(dev).lower()
        return any(k in name for k in bot_keywords)
    
    bot_mask = df_commits["developer_id"].apply(is_bot)
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
    
    df_commits["developer_id"] = df_commits["author_email"].str.lower()
    df_files["developer_id"] = df_files["developer_id"].str.lower()
    
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
        "py", "js", "ts", "java", "c", "cpp",
        "go", "rs", "php", "rb", "cs"
    ]


def compute_metrics(repo_path, df_commits, df_files):
    df_files = df_files.copy()
    df_commits = df_commits.copy()
    
    df_files["file_id"] = df_files["path"].astype(str)
    
    repo_root = Path(repo_path)
    
    dev_activity = df_files.groupby("developer_id").size().sort_values(ascending=False)
    commit_activity = df_commits.groupby("developer_id").size().sort_values(ascending=False)
    
    top_developers = commit_activity.head(10)
    top_devs_mods = dev_activity.head(10)
    
    file_hotspots = df_files.groupby("file_id").size().sort_values(ascending=False)
    top_files = file_hotspots.head(10)
    
    timeline_data = df_files.set_index("author_date").resample("ME").size()
    timeline = [
        {"date": str(idx), "count": int(count)}
        for idx, count in timeline_data.items()
    ]
    
    gini_value = compute_gini(dev_activity.values)
    lorenz_data = compute_lorenz(dev_activity)
    
    inter_commit = compute_inter_commit_time(df_commits)
    
    kci_data, line_counts, ownership_results = compute_kci(df_files, repo_root)
    
    architecture_data = build_dependency_graph(repo_root)
    treemap_data = build_treemap_data(df_files)
    voronoi_data = build_voronoi_data(df_files, architecture_data, kci_data, ownership_results, repo_root)
    in_degree_data = {
        node["id"]: node["degree"]
        for node in architecture_data.get("nodes", [])
    }
    if not in_degree_data:
        in_degree_data = compute_in_degree(repo_root)
    
    risk_data = compute_risk_score(kci_data, in_degree_data)
    busfactor_simulation = simulate_bus_factor_risk(ownership_results, line_counts)
    
    # Derive bus_factor from line-ownership simulation (consistent with charts)
    simulation_steps = busfactor_simulation.get("simulation", [])
    bus_factor = len(simulation_steps)  # fallback: all developers
    for step in simulation_steps:
        if step["knowledge_lost"] >= 0.5:
            bus_factor = step["removed"]
            break
    
    summary = {
        "total_commits": int(df_commits["commit_hash"].nunique()),
        "total_developers": int(df_commits["developer_id"].nunique()),
        "total_files": int(df_files["file_id"].nunique()),
        "total_modifications": len(df_files),
        "date_range": {
            "start": str(df_commits["author_date"].min()) if len(df_commits) > 0 else None,
            "end": str(df_commits["author_date"].max()) if len(df_commits) > 0 else None
        }
    }
    
    top_developers_list = [
        {"developer": dev, "commits": int(count)}
        for dev, count in top_developers.items()
    ]
    
    top_devs_mods_list = [
        {"developer": dev, "modifications": int(count)}
        for dev, count in top_devs_mods.items()
    ]
    
    hotspot_files_list = [
        {"file": file, "modifications": int(count)}
        for file, count in top_files.items()
    ]
    
    sorted_kci = sorted(kci_data.items(), key=lambda x: x[1], reverse=True)
    filtered_kci = [
        (file, kci)
        for file, kci in sorted_kci
        if line_counts.get(file, 0) >= 30
    ][:10]
    kci_list = [
        {"file": file, "kci": float(kci)}
        for file, kci in filtered_kci
    ]
    
    sorted_in_degree = sorted(in_degree_data.items(), key=lambda x: x[1], reverse=True)[:10]
    in_degree_list = [
        {"file": file, "in_degree": int(indeg)}
        for file, indeg in sorted_in_degree
    ]
    
    risk_list = [
        {"file": file, "risk_score": float(score)}
        for file, score in risk_data.items()
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
    files_to_plot = list(ownership_results.keys())[:5]
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
    if len(dev_activity) > 0 and len(file_hotspots) > 0:
        matrix = pd.pivot_table(
            df_files,
            index="developer_id",
            columns="file_id",
            values="churn",
            aggfunc="sum",
            fill_value=0
        )
        top_dev_ids = dev_activity.head(15).index
        top_file_ids = file_hotspots.head(20).index
        submatrix = matrix.reindex(index=top_dev_ids, columns=top_file_ids, fill_value=0)
        dev_file_matrix = {
            "developers": list(submatrix.index),
            "files": list(submatrix.columns),
            "values": submatrix.values.tolist()
        }

    commit_frequency = compute_developer_activity_over_time(df_files)

    return {
        "summary": summary,
        "top_developers": top_developers_list,
        "top_devs_mods": top_devs_mods_list,
        "timeline": timeline,
        "commit_frequency": commit_frequency,
        "gini": float(gini_value),
        "lorenz": lorenz_data,
        "bus_factor": int(bus_factor),
        "inter_commit": inter_commit,
        "kci": kci_list,
        "in_degree": in_degree_list,
        "risk_files": risk_list,
        "hotspot_files": hotspot_files_list,
        "dev_file_matrix": dev_file_matrix,
        "ownership_table": ownership_rows,
        "ownership_plots": ownership_plots,
        "architecture": architecture_data,
        "treemap": treemap_data,
        "voronoi": voronoi_data,
        "busfactor_simulation": busfactor_simulation,
        "project_summary": project_summary,
    }


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
    active_devs = commit_counts[commit_counts >= 50].index
    
    filtered = commits_sorted[commits_sorted["developer_id"].isin(active_devs)]
    
    ict = filtered[filtered["delta_days"] > 0].groupby("developer_id")["delta_days"].median()
    
    return {
        dev: float(days) for dev, days in ict.sort_values().head(30).items()
    }


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
        if repo_url in _ANALYSIS_CACHE:
            return _ANALYSIS_CACHE[repo_url]
        return analyze_repo(repo_url)

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


def get_treemap_data(repo_url=None):
    analysis = _resolve_analysis(repo_url)
    return analysis.get("treemap", {"ids": [], "labels": [], "parents": [], "values": [], "paths": []})


def get_voronoi_data(repo_url=None):
    analysis = _resolve_analysis(repo_url)
    return analysis.get("voronoi", {"nodes": [], "edges": []})
