"""Build a deterministic sample Git repository for the test suite.

Fixed authors, dates and content (seeded RNG) give the same commit hashes and
the same analysis on every machine. It exercises the cases the engine cares
about: several roles (backend, frontend, tests, devops, mobile), an email
alias of the same person, a bot, merge commits, an inactive former
contributor (orphaned knowledge), cross-file imports (architecture graph),
renames, deletes, binary files, CRLF, unicode paths, and patch lines that
start with "--" / "++" (PyDriller's line-count quirk).

    python make_repo.py /tmp/sample   # build it by hand
"""
import os
import random
import subprocess
import sys
from datetime import datetime, timedelta, timezone

AUTHORS = {
    "alice": ("Alice Backend", "alice@example.com"),
    "alice2": ("Alice Backend", "alice@personal.example.org"),   # alias of alice
    "bob": ("Bob Frontend", "bob@example.com"),
    "carol": ("Carol Tester", "carol@example.com"),
    "dave": ("Dave Ops", "dave@example.com"),
    "erin": ("Erin Mobile", "erin@example.com"),
    "gary": ("Gary Former", "gary@example.com"),                 # leaves early
    "bot": ("dependabot[bot]", "49699333+dependabot[bot]@users.noreply.github.com"),
}

# Hermetic git: ignore the developer's global/system config (hooks, signing,
# diff drivers...) so the fixture is identical everywhere.
GIT_ENV = {
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_TERMINAL_PROMPT": "0",
}


class Repo:
    def __init__(self, path):
        self.path = path
        self.clock = datetime(2022, 1, 3, 9, 0, tzinfo=timezone.utc)
        os.makedirs(path, exist_ok=True)
        self.git("init", "-q", "-b", "main")

    def git(self, *args, env=None):
        full_env = {**os.environ, **GIT_ENV, **(env or {})}
        subprocess.run(["git", "-C", self.path, *args], check=True, env=full_env,
                       stdout=subprocess.DEVNULL)

    def write(self, rel, content, mode="w"):
        p = os.path.join(self.path, rel)
        os.makedirs(os.path.dirname(p) or self.path, exist_ok=True)
        with open(p, mode, **({} if "b" in mode else {"encoding": "utf-8", "newline": ""})) as f:
            f.write(content)

    def append(self, rel, content):
        self.write(rel, content, mode="a")

    def commit(self, who, message, days=1, tz="+0000", allow_empty=False):
        self.clock += timedelta(days=days)
        name, email = AUTHORS[who]
        stamp = f"{int(self.clock.timestamp())} {tz}"
        env = {
            "GIT_AUTHOR_NAME": name, "GIT_AUTHOR_EMAIL": email, "GIT_AUTHOR_DATE": stamp,
            "GIT_COMMITTER_NAME": name, "GIT_COMMITTER_EMAIL": email, "GIT_COMMITTER_DATE": stamp,
        }
        self.git("add", "-A")
        args = ["commit", "-q", "--no-gpg-sign", "-m", message]
        if allow_empty:
            args.append("--allow-empty")
        self.git(*args, env=env)


def py_module(name, imports, n):
    head = "".join(f"from {m} import helper_{m.split('.')[-1]}\n" for m in imports)
    body = "".join(f"\n\ndef {name}_{i}(x):\n    return x * {i} + 1\n" for i in range(n))
    return f'"""{name} module."""\n{head}\n\ndef helper_{name}(value):\n    return value\n{body}'


def jsx_component(name, imports, n):
    head = "".join(f"import {m} from './{m}'\n" for m in imports)
    props = "".join(f"      <span className=\"p{i}\">{{props.v{i}}}</span>\n" for i in range(n))
    return f"{head}\nexport default function {name}(props) {{\n  return (\n    <div>\n{props}    </div>\n  )\n}}\n"


def build(path):
    rnd = random.Random(42)
    r = Repo(path)

    # Gary (later inactive) founds the project; his code stays largely untouched.
    r.write("README.md", "# Sample project\n\nA fixture for GitHub Analyzer tests.\n")
    r.write("legacy/engine.py", py_module("engine", [], 12))
    r.write("legacy/parser.py", py_module("parser", ["legacy.engine"], 8))
    r.write("db/schema.sql", "-- schema\n-- owner: gary\nCREATE TABLE t (id int);\n---- end\n")
    r.write("assets/logo.png", b"\x89PNG\r\n\x1a\n\x00\x01\x02\x03", mode="wb")
    r.write("notes/crlf.txt", "line1\r\nline2\r\n")
    r.commit("gary", "Initial import", tz="+0100")
    for i in range(4):
        r.append("legacy/engine.py", f"\n\ndef legacy_extra_{i}():\n    return {i}\n")
        r.commit("gary", f"Extend legacy engine {i}", days=3, tz="+0100")

    # Alice builds the backend (two email addresses for the same person).
    r.write("api/core.py", py_module("core", ["legacy.engine"], 6))
    r.write("api/routes.py", py_module("routes", ["api.core", "api.models"], 5))
    r.write("api/models.py", py_module("models", ["api.core"], 4))
    r.commit("alice", "Add API skeleton", days=20)
    for i in range(18):
        target = rnd.choice(["api/core.py", "api/routes.py", "api/models.py", "api/services.py"])
        r.append(target, f"\n\ndef feature_{i}(request):\n    return {{'ok': True, 'n': {i}}}\n")
        r.commit("alice2" if i % 5 == 4 else "alice", f"Backend feature {i}", days=rnd.randint(1, 6))

    # Bob builds the frontend.
    r.write("web/src/components/App.jsx", jsx_component("App", ["Header", "Chart"], 4))
    r.write("web/src/components/Header.jsx", jsx_component("Header", [], 2))
    r.write("web/src/components/Chart.jsx", jsx_component("Chart", ["Header"], 3))
    r.write("web/src/styles/app.css", ".app { color: #222; }\n")
    r.commit("bob", "Frontend skeleton", days=2)
    for i in range(14):
        target = rnd.choice(["web/src/components/App.jsx", "web/src/components/Chart.jsx",
                             "web/src/styles/app.css", "web/src/components/Header.jsx"])
        r.append(target, f"\n/* tweak {i} */\n" if target.endswith(".css") else f"\nexport const c{i} = {i}\n")
        r.commit("bob", f"UI tweak {i}", days=rnd.randint(1, 5))

    # Carol writes tests; Dave does CI and deployment; Erin the Android app.
    for i in range(10):
        r.write(f"tests/test_feature_{i % 4}.py",
                f"from api.core import helper_core\n\n\ndef test_{i}():\n    assert helper_core({i}) == {i}\n",
                mode="a" if i >= 4 else "w")
        r.commit("carol", f"Tests batch {i}", days=rnd.randint(1, 4))
    r.write("Dockerfile", "FROM python:3.13-slim\nCOPY . /app\n")
    r.write(".github/workflows/ci.yml", "name: ci\non: [push]\njobs: {}\n")
    r.write("deploy/release.sh", "#!/bin/sh\necho release\n")
    r.commit("dave", "CI and container", days=2)
    for i in range(8):
        target = rnd.choice(["Dockerfile", ".github/workflows/ci.yml", "deploy/release.sh", "k8s/app.yaml"])
        r.append(target, f"# ops change {i}\n")
        r.commit("dave", f"Ops change {i}", days=rnd.randint(2, 7))
    r.write("android/app/src/main/AndroidManifest.xml", "<manifest package=\"com.example.app\"/>\n")
    r.write("android/app/src/main/java/com/example/MainActivity.kt", "class MainActivity\n")
    r.commit("erin", "Android app", days=3)
    for i in range(6):
        r.append("android/app/src/main/java/com/example/MainActivity.kt", f"fun screen{i}() = {i}\n")
        r.commit("erin", f"Mobile screen {i}", days=rnd.randint(2, 6))

    # Edge cases: SQL comment deletions, "++" lines, CRLF edit, binary edit,
    # unicode + space paths, rename with edit, pure rename, delete, mode
    # change, empty commit, bot commit.
    r.write("db/schema.sql", "CREATE TABLE t (id int);\n++counter;\n")
    r.write("notes/crlf.txt", "line1\r\nline2 changed\r\nline3\r\n")
    r.write("assets/logo.png", b"\x89PNG\r\n\x1a\n\x00\x09\x09\x09", mode="wb")
    r.write("docs/café guide.md", "Bienvenue\n")
    r.commit("alice", "Schema cleanup", days=2, tz="-0800")
    r.git("mv", "api/models.py", "api/entities.py")
    r.append("api/entities.py", "\n\ndef renamed_marker():\n    return 'renamed'\n")
    r.git("mv", "notes/crlf.txt", "notes/windows.txt")
    r.commit("alice", "Rename models to entities", days=2)
    os.chmod(os.path.join(path, "deploy/release.sh"), 0o755)
    r.commit("dave", "Make release script executable", days=1)
    r.git("rm", "-q", "legacy/parser.py")
    r.commit("alice", "Drop the old parser", days=1)
    r.commit("alice", "Empty commit", days=1, allow_empty=True)
    r.write("requirements.txt", "flask==3.1.3\n")
    r.commit("bot", "Bump flask", days=1)

    # A feature branch merged back with a merge commit.
    r.git("checkout", "-q", "-b", "feature/search")
    r.write("api/search.py", py_module("search", ["api.core"], 3))
    r.commit("alice", "Search endpoint", days=2)
    r.git("checkout", "-q", "main")
    r.append("web/src/components/App.jsx", "\nexport const searchBox = true\n")
    r.commit("bob", "Search box", days=1)
    name, email = AUTHORS["alice"]
    r.clock += timedelta(days=1)
    stamp = f"{int(r.clock.timestamp())} +0000"
    r.git("merge", "-q", "--no-ff", "--no-gpg-sign", "feature/search", "-m", "Merge feature/search",
          env={"GIT_AUTHOR_NAME": name, "GIT_AUTHOR_EMAIL": email, "GIT_AUTHOR_DATE": stamp,
               "GIT_COMMITTER_NAME": name, "GIT_COMMITTER_EMAIL": email, "GIT_COMMITTER_DATE": stamp})

    # Recent activity more than a year later: Gary (and others) become
    # inactive, so orphaned knowledge and active vs historical bus factor
    # are exercised.
    for i in range(6):
        r.append("api/core.py", f"\n\ndef recent_{i}():\n    return {i}\n")
        r.commit("alice", f"Recent backend work {i}", days=400 if i == 0 else 10)
    return path


if __name__ == "__main__":
    build(sys.argv[1])
    print(sys.argv[1])
