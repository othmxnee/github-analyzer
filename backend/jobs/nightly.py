"""Nightly re-check of every watched repository, with alerts.

    cd backend && python -m jobs.nightly           # what the scheduler runs
    python -m jobs.nightly --force                 # re-analyze even unchanged repos

For each repository someone watches: ask the host for the latest commit
(`git ls-remote`, cheap) and skip it if nothing changed since the stored
analysis; otherwise analyze it, compare with the previous analysis
(services/alerts.py), store the alerts and send them to the watchers.
Repositories are processed one at a time and dropped from memory after each,
so the job fits the same 512 MB as the web service.

Needs the same environment as the web service: DATABASE_URL, SMTP_*,
FLASK_SECRET_KEY (unsubscribe links), FRONTEND_URL and BACKEND_URL.
"""
import argparse
import json
import logging
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logger = logging.getLogger("jobs.nightly")


def remote_head(source):
    try:
        out = subprocess.run(["git", "ls-remote", source, "HEAD"], capture_output=True, text=True,
                             timeout=60, env={**os.environ, "GIT_TERMINAL_PROMPT": "0"})
        return out.stdout.split()[0] if out.returncode == 0 and out.stdout.strip() else None
    except Exception:
        return None


def _forget(url):
    from services import analyzer, skill_service, timeline_service
    for d in (analyzer._ANALYSIS_CACHE, analyzer._ANALYSIS_STATUS, analyzer._ANALYSIS_PHASE,
              analyzer._ANALYSIS_TIMESTAMPS, analyzer._CLEANED_CACHE, analyzer._RUN_IDS):
        d.pop(url, None)
    skill_service.invalidate_for_repo(url)
    timeline_service.invalidate_for_repo(url)


def run(force=False, resolve_source=None):
    """Process every watched repository. `resolve_source(url)` may map a URL to
    a local clone source (tests). Returns a summary dict."""
    import db
    from services import alerts as alert_rules
    from services import analyzer, watches

    if not db.enabled():
        db.init_from_env()
    summary = {"checked": 0, "unchanged": 0, "analyzed": 0, "failed": 0, "skipped_private": 0,
               "alerts": 0, "emails": 0, "slack": 0}
    for repo in watches.watched_repositories():
        url = repo["url"]
        summary["checked"] += 1
        if repo["private"]:
            summary["skipped_private"] += 1          # needs the GitHub App's credentials
            continue
        source = resolve_source(url) if resolve_source else None
        head = remote_head(source or url)
        if head is None:
            logger.warning("%s: cannot read the remote HEAD, skipping", url)
            summary["failed"] += 1
            continue
        if not force and head == repo["last_head_sha"]:
            summary["unchanged"] += 1
            continue

        t0 = time.time()
        _forget(url)
        analyzer._run_analysis(url, local_path=source, trigger="scheduled")   # synchronous
        if analyzer._ANALYSIS_STATUS.get(url) != "done":
            logger.error("%s: analysis failed: %s", url, (analyzer._ANALYSIS_CACHE.get(url) or {}).get("error"))
            summary["failed"] += 1
            _forget(url)
            continue
        run_id = analyzer.current_run_id(url)
        current = analyzer._ANALYSIS_CACHE[url]
        previous = watches.previous_results(repo["id"], run_id) if run_id else None
        found = alert_rules.evaluate(previous, current)
        if run_id:
            watches.record(repo["id"], run_id, found)
        emails, posts = watches.notify_watchers(repo["id"], url, found)
        summary["analyzed"] += 1
        summary["alerts"] += len(found)
        summary["emails"] += emails
        summary["slack"] += posts
        logger.info("%s: analyzed in %.1fs, %d alert(s)", url, time.time() - t0, len(found))
        _forget(url)
    return summary


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--force", action="store_true", help="re-analyze even if HEAD did not change")
    args = p.parse_args()
    from dotenv import load_dotenv
    load_dotenv()
    print(json.dumps(run(force=args.force)))


if __name__ == "__main__":
    main()
