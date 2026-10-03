"""Run the full analysis pipeline on a local repo and dump every output.

Used by the golden test in a subprocess with PYTHONHASHSEED=0: part of the
original code orders lists by set iteration, which is only reproducible
with a fixed hash seed.

    python run_pipeline.py <backend_dir> <repo_path> <out.json>
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile


def main():
    backend, repo, out = sys.argv[1:4]
    sys.path.insert(0, backend)
    os.chdir(backend)
    from services import analyzer, skill_service, timeline_service

    work = tempfile.mkdtemp()
    try:
        # Same shallow clone the website and the bridge make.
        subprocess.run(["git", "clone", "-q", "--no-local", f"--depth={analyzer.CLONE_DEPTH}",
                        "--single-branch", repo, work], check=True)
        commits, fms = analyzer.extract_data(work)
        key = "test:" + repo
        analyzer._prime_skill_cache(key, commits, fms)
        dfc, dff = analyzer.clean_data(commits, fms)
        results, internals = analyzer.compute_metrics(work, dfc, dff, commits)
        analyzer._CLEANED_CACHE[key] = {
            "df_commits": dfc, "df_files": dff,
            "ownership_results": internals.get("ownership_results", {}),
            "line_counts": internals.get("line_counts", {}),
            "architecture": internals.get("architecture", {"nodes": [], "edges": []}),
            "kci_data": internals.get("kci_data", {}),
            "in_degree_data": internals.get("in_degree_data", {}),
        }
        skill_service._run_analysis(key)
        skills = skill_service._cache.get(key)
        timeline = {m: timeline_service.compute_metric(key, m, compare=True)
                    for m in timeline_service.list_metrics()}
    finally:
        shutil.rmtree(work, ignore_errors=True)

    def default(o):
        try:
            import numpy as np
            if isinstance(o, np.integer):
                return int(o)
            if isinstance(o, np.floating):
                return float(o)
        except Exception:
            pass
        return str(o)

    with open(out, "w") as f:
        json.dump({"results": results, "skills": skills, "timeline": timeline}, f,
                  default=default, sort_keys=True, indent=1)


if __name__ == "__main__":
    main()
