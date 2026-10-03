"""Fast commit + file-change extraction with PyDriller-identical output.

PyDriller runs one `git diff-tree` subprocess per commit and builds GitPython
objects for every file, which dominates analysis time (and memory) on real
repositories. This module streams the same information from two `git log`
calls instead and reproduces PyDriller's semantics exactly:

* commit order: oldest -> newest, same revision walk as `rev-list --reverse`;
* merge commits: listed, but with no modified files (PyDriller returns []);
* root / shallow-boundary commits: diffed against the empty tree;
* file headers, paths, renames: parsed with GitPython's own regex and path
  decoder, so quoting / octal escapes / renames resolve identically;
* added / deleted lines: PyDriller's counting rule, including its quirk of
  ignoring content lines that start with "+++" / "---";
* dates: GitPython's `from_timestamp` with the author's own UTC offset.

`extract_with_git` returns the same (commits_data, file_modifications) lists
that `analyzer.extract_data` historically built from PyDriller. Any parse
inconsistency raises, and the caller falls back to PyDriller.
"""
import re
import subprocess
from pathlib import Path

from git.diff import Diff
from git.objects.util import from_timestamp, utctz_to_altz

# A line that cannot occur inside patch output: every patch line starts with
# one of ' ', '+', '-', '\\', '@', 'd', 'i', 'o', 'n', 's', 'r', 'c', 'B', 'G'.
_MARK = b"\x01GA\x02"
_MARK_LINE = b"\n" + _MARK

_ADDED_RE = re.compile(r"^\+(?!\+\+)", re.MULTILINE)
_DELETED_RE = re.compile(r"^-(?!--)", re.MULTILINE)
_HEX40 = re.compile(rb"^[0-9a-f]{40}$")

NULL_HEX_SHA = "0" * 40

# Force PyDriller/GitPython's plumbing defaults regardless of the user's git
# config (porcelain `git log` would otherwise honour diff.algorithm,
# diff.noprefix, textconv drivers, colour, log.showRoot ...).
_DIFF_ARGS = [
    "-p", "-M", "--full-index", "--abbrev=40", "--no-color", "--no-ext-diff",
    "--no-textconv", "--diff-algorithm=myers", "--src-prefix=a/",
    "--dst-prefix=b/", "--root", "--diff-merges=off", "-U3",
    "--submodule=short", "--no-relative",
]
# Raw author identity, no signature noise, whatever log.* config says.
_LOG_ARGS = ["--no-mailmap", "--no-show-signature", "--no-notes", "--no-follow"]


def _git(repo_path, *args):
    return subprocess.run(
        ["git", "-C", str(repo_path), "-c", "core.quotepath=true", *args],
        capture_output=True, check=True,
    ).stdout


def _rev_args(only_commits):
    # `-n N --reverse` limits first, then reverses: the N most recent commits,
    # oldest first. PyDriller walks `rev-list --reverse HEAD` and keeps the
    # commits in the same N-set, which yields the identical sequence.
    if only_commits is not None:
        return ["--reverse", f"--max-count={len(only_commits)}", "HEAD"]
    return ["--reverse", "HEAD"]


def _read_commit_meta(repo_path, only_commits):
    out = _git(
        repo_path, "log", *_LOG_ARGS, "-z", "--date=raw",
        "--format=%H%x00%P%x00%an%x00%ae%x00%ad%x00%B",
        *_rev_args(only_commits), "--",
    )
    tokens = out.split(b"\x00")
    if tokens and tokens[-1] == b"":
        tokens.pop()
    if len(tokens) % 6:
        raise ValueError("unexpected git log metadata layout")
    metas = []
    for i in range(0, len(tokens), 6):
        h, parents, name, email, date, msg = tokens[i:i + 6]
        if not _HEX40.match(h):
            raise ValueError("unexpected commit hash in git log output")
        ts, tz = date.decode().split()
        metas.append({
            "hash": h.decode(),
            "parents": len(parents.split()),
            "name": name.decode("utf-8", "replace"),
            "email": email.decode("utf-8", "replace"),
            "date": from_timestamp(int(ts), utctz_to_altz(tz)),
            "msg": msg.decode("utf-8", "replace").strip(),
        })
    if only_commits is not None:
        got = [m["hash"] for m in metas]
        if set(got) != set(only_commits):
            raise ValueError("commit window mismatch")
    return metas


def _iter_patch_chunks(repo_path, only_commits):
    """Yield (hash, patch_bytes) per commit, streaming git's output."""
    cmd = ["git", "-C", str(repo_path), "-c", "core.quotepath=true", "log",
           *_LOG_ARGS, *_DIFF_ARGS, "--format=" + _MARK.decode() + "%H",
           *_rev_args(only_commits), "--"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    buf = b""
    current = None
    try:
        while True:
            block = proc.stdout.read(1 << 20)
            if not block:
                break
            buf += block
            while True:
                if current is None:
                    if not buf.startswith(_MARK):
                        raise ValueError("patch stream out of sync")
                    nl = buf.find(b"\n")
                    if nl < 0:
                        break
                    current = buf[len(_MARK):nl].decode()
                    buf = buf[nl + 1:]
                if buf.startswith(_MARK):
                    # commit with no diff (merge / empty): marker follows directly
                    yield current, b""
                    current = None
                    continue
                if len(buf) < len(_MARK) and _MARK.startswith(buf) and buf:
                    break   # a marker may be split across reads; wait for more
                nxt = buf.find(_MARK_LINE)
                if nxt < 0:
                    break
                yield current, buf[:nxt]
                buf = buf[nxt + 1:]
                current = None
        if current is not None:
            yield current, buf
    finally:
        proc.stdout.close()
        rc = proc.wait()
    if rc != 0:
        raise subprocess.CalledProcessError(rc, cmd)


def _parse_files(patch):
    """GitPython `_index_from_patch_format` + PyDriller ModifiedFile fields."""
    files = []
    headers = list(Diff.re_header.finditer(patch))
    for idx, h in enumerate(headers):
        (a_fallback, b_fallback, _old_mode, _new_mode, rename_from, rename_to,
         new_file_mode, deleted_file_mode, _copied, a_blob_id, b_blob_id,
         _b_mode, a_path, b_path) = h.groups()
        a_raw = Diff._pick_best_path(a_path, rename_from, a_fallback)
        b_raw = Diff._pick_best_path(b_path, rename_to, b_fallback)
        end = headers[idx + 1].start() if idx + 1 < len(headers) else len(patch)
        body = patch[h.end():end].decode("utf-8", "ignore").replace("\r", "")

        a_str = a_raw.decode("utf-8", "replace") if a_raw else None
        b_str = b_raw.decode("utf-8", "replace") if b_raw else None
        old_path = str(Path(a_str)) if a_str else None
        new_path = str(Path(b_str)) if b_str else None

        a_blob = a_blob_id.decode() if a_blob_id else None
        b_blob = b_blob_id.decode() if b_blob_id else None
        if a_blob == NULL_HEX_SHA:
            a_blob = None
        if b_blob == NULL_HEX_SHA:
            b_blob = None
        rf = rename_from.decode("utf-8", "replace") if rename_from else None
        rt = rename_to.decode("utf-8", "replace") if rename_to else None
        if new_file_mode:
            change = "ADD"
        elif deleted_file_mode:
            change = "DELETE"
        elif rf != rt:
            change = "RENAME"
        elif a_blob and b_blob and a_blob != b_blob:
            change = "MODIFY"
        else:
            change = "UNKNOWN"

        if new_path is not None and new_path != "/dev/null":
            filename = Path(new_path).name
        else:
            filename = Path(old_path).name
        files.append((filename, old_path, new_path, change,
                      len(_ADDED_RE.findall(body)), len(_DELETED_RE.findall(body))))
    return files


def extract_with_git(repo_path, only_commits=None):
    metas = _read_commit_meta(repo_path, only_commits)
    by_hash = {}
    for chash, patch in _iter_patch_chunks(repo_path, only_commits):
        by_hash[chash] = patch
    if len(by_hash) != len(metas):
        raise ValueError("patch stream / metadata count mismatch")

    commits_data = []
    file_modifications = []
    for m in metas:
        date = m["date"]
        developer_id = f"{m['name']} <{m['email']}>"
        is_merge = m["parents"] > 1
        commits_data.append({
            "commit_hash": m["hash"],
            "author_name": m["name"],
            "author_email": m["email"],
            "developer_id": developer_id,
            "author_date": date,
            "year": date.year,
            "month": date.month,
            "message": m["msg"],
            "message_length": len(m["msg"]),
            "is_merge": is_merge,
            "parents": m["parents"],
        })
        if is_merge:
            continue   # PyDriller reports no modified files for merges
        for filename, old_path, new_path, change, added, deleted in _parse_files(by_hash[m["hash"]]):
            file_modifications.append({
                "commit_hash": m["hash"],
                "developer_id": developer_id,
                "author_date": date,
                "year": date.year,
                "month": date.month,
                "filename": filename,
                "old_path": old_path,
                "new_path": new_path,
                "change_type": change,
                "lines_added": added,
                "lines_deleted": deleted,
                "churn": added + deleted,
                "path": new_path if new_path else old_path,
                "extension": (
                    filename.split('.')[-1]
                    if filename and '.' in filename
                    else None
                ),
            })
    return commits_data, file_modifications
