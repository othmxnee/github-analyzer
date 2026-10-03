"""Web API behaviour: validation, no local paths on the website, gzip."""
import gzip
import json
import os

import pytest

os.environ.pop("GA_LOCAL_MODE", None)


@pytest.fixture(scope="module")
def client():
    from app import app
    return app.test_client()


def test_health(client):
    assert client.get("/health").get_json() == {"status": "ok"}


def test_rejects_unknown_hosts(client):
    r = client.post("/analyze", json={"repo_url": "https://example.com/a/b"})
    assert r.status_code == 400


def test_website_refuses_local_paths(client, sample_repo):
    r = client.post("/analyze", json={"repo_url": "local:" + sample_repo})
    assert r.status_code == 400


def test_large_json_is_gzipped(client):
    from services import analyzer
    url = "https://github.com/example/big"
    analyzer._ANALYSIS_CACHE[url] = {"payload": "x" * 20000}
    analyzer._ANALYSIS_STATUS[url] = "done"
    analyzer._ANALYSIS_TIMESTAMPS[url] = 0
    try:
        r = client.get(f"/analyze/result?repo_url={url}", headers={"Accept-Encoding": "gzip"})
        assert r.headers.get("Content-Encoding") == "gzip"
        assert json.loads(gzip.decompress(r.data))["payload"] == "x" * 20000
        plain = client.get(f"/analyze/result?repo_url={url}")
        assert "Content-Encoding" not in plain.headers
    finally:
        for d in (analyzer._ANALYSIS_CACHE, analyzer._ANALYSIS_STATUS, analyzer._ANALYSIS_TIMESTAMPS):
            d.pop(url, None)
