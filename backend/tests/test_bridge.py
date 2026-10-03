"""The desktop / VS Code engine bridge: protocol, identical results, disk cache."""
import json
import os
import subprocess
import sys
import time

import pytest
from conftest import BACKEND, diff, run_pipeline


class Bridge:
    def __init__(self, cache_dir):
        env = {**os.environ, "PYTHONHASHSEED": "0", "GA_CACHE_DIR": cache_dir}
        self.p = subprocess.Popen([sys.executable, os.path.join(BACKEND, "bridge.py")],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.DEVNULL, text=True, env=env)
        self.ready = json.loads(self.p.stdout.readline())
        self.n = 0

    def call(self, **msg):
        self.n += 1
        msg["id"] = self.n
        self.p.stdin.write(json.dumps(msg) + "\n")
        self.p.stdin.flush()
        while True:
            r = json.loads(self.p.stdout.readline())
            if r.get("id") == self.n:
                return r

    def wait_done(self, path, key, timeout=300):
        t0 = time.time()
        while time.time() - t0 < timeout:
            body = self.call(method="GET", path=path, query={"repo_url": key})["body"]
            if body.get("status") in ("done", "error"):
                return body
            time.sleep(0.2)
        raise TimeoutError(path)

    def close(self):
        self.p.stdin.write(json.dumps({"op": "shutdown"}) + "\n")
        self.p.stdin.flush()
        self.p.wait(10)


@pytest.mark.slow
def test_bridge_matches_pipeline_and_caches(sample_repo, tmp_path):
    key = "local:" + sample_repo
    expected = run_pipeline(sample_repo, str(tmp_path / "pipeline.json"))
    cache = str(tmp_path / "cache")

    b = Bridge(cache)
    try:
        assert b.ready["event"] == "ready" and b.ready["git"] is True
        assert b.call(op="ping")["ok"] is True
        b.call(method="POST", path="/analyze", body={"repo_url": key})
        result = b.wait_done("/analyze/result", key)
        assert result["status"] == "done", result.get("error")
        got = {k: v for k, v in result.items() if k not in ("status", "analyzed_at", "avatars")}
        assert not diff(json.loads(json.dumps(expected["results"], sort_keys=True)),
                        json.loads(json.dumps(got, sort_keys=True)))
        b.call(method="POST", path="/analyze/skills", body={"repo_url": key})
        skills = b.wait_done("/analyze/skills/result", key)
        assert {d["developer"]: d["role"] for d in skills["developers"]} == \
               {d["developer"]: d["role"] for d in expected["skills"]["developers"]}
        avatars = b.call(method="POST", path="/analyze/avatars", body={"repo_url": key})["body"]
        assert avatars == {"status": "done", "avatars": {}}     # offline: no lookups
        time.sleep(1.0)                                           # let the disk cache flush
    finally:
        b.close()

    # A new process reopens the unchanged repository from disk, instantly.
    b = Bridge(cache)
    try:
        start = b.call(method="POST", path="/analyze", body={"repo_url": key})["body"]
        assert start["status"] == "done"
        assert b.call(method="GET", path="/analyze/skills/result", query={"repo_url": key})["body"]["status"] == "done"
    finally:
        b.close()
