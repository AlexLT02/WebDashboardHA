"""Cache headers of the SPA mount: index.html must revalidate, hashed assets may stay."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import SpaStaticFiles


def _client(tmp_path):
    (tmp_path / "index.html").write_text("<html></html>", encoding="utf-8")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "index-legacy-abc123.js").write_text("x", encoding="utf-8")
    app = FastAPI()
    app.mount("/", SpaStaticFiles(directory=str(tmp_path), html=True), name="spa")
    return TestClient(app)


def test_index_is_revalidated(tmp_path):
    client = _client(tmp_path)
    for url in ("/", "/index.html"):
        r = client.get(url)
        assert r.status_code == 200
        assert r.headers["cache-control"] == "no-cache"


def test_hashed_assets_are_immutable(tmp_path):
    r = _client(tmp_path).get("/assets/index-legacy-abc123.js")
    assert r.status_code == 200
    assert "immutable" in r.headers["cache-control"]


def test_etag_revalidation_still_works(tmp_path):
    client = _client(tmp_path)
    etag = client.get("/").headers["etag"]
    assert client.get("/", headers={"If-None-Match": etag}).status_code == 304
