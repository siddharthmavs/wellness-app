"""Tests for Music Zone endpoints (upload, tracks, stream, like, history, delete)."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")


def _login(email, password="demo1234"):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def alex_token():
    return _login("alex@demo.com")


@pytest.fixture(scope="module")
def jamie_token():
    return _login("jamie@demo.com")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@demo.com")


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


# --- Basic listing ---
def test_list_tracks_200(alex_token):
    r = requests.get(f"{BASE_URL}/api/music/tracks", headers=_hdr(alex_token), timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# --- Upload ---
SMALL_MP3 = b"ID3\x03\x00\x00\x00\x00\x00\x00TESTDATA" + b"\x00" * 512


@pytest.fixture(scope="module")
def uploaded_song(alex_token):
    files = {"file": ("TEST_song.mp3", SMALL_MP3, "audio/mpeg")}
    data = {"title": "TEST_TrackTitle", "artist": "TEST_Artist"}
    r = requests.post(f"{BASE_URL}/api/music/upload", headers=_hdr(alex_token), files=files, data=data, timeout=120)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text[:400]}"
    j = r.json()
    assert j.get("id") and j.get("storage_path")
    assert j["title"] == "TEST_TrackTitle"
    assert j["artist"] == "TEST_Artist"
    return j


def test_upload_appears_in_tracks(alex_token, uploaded_song):
    r = requests.get(f"{BASE_URL}/api/music/tracks", headers=_hdr(alex_token), timeout=30)
    assert r.status_code == 200
    ids = [t["id"] for t in r.json()]
    assert uploaded_song["id"] in ids


def test_upload_non_audio_rejected(alex_token):
    files = {"file": ("bad.txt", b"hello", "text/plain")}
    r = requests.post(f"{BASE_URL}/api/music/upload", headers=_hdr(alex_token), files=files, data={"title": "x"}, timeout=30)
    assert r.status_code == 400


def test_upload_too_large_rejected(alex_token):
    big = b"\x00" * (50 * 1024 * 1024 + 10)
    files = {"file": ("big.mp3", big, "audio/mpeg")}
    r = requests.post(f"{BASE_URL}/api/music/upload", headers=_hdr(alex_token), files=files, data={"title": "big"}, timeout=180)
    assert r.status_code == 400


# --- Stream ---
def test_stream_requires_auth(uploaded_song):
    r = requests.get(f"{BASE_URL}/api/music/stream/{uploaded_song['id']}", timeout=30)
    assert r.status_code == 401


def test_stream_with_query_auth(alex_token, uploaded_song):
    r = requests.get(f"{BASE_URL}/api/music/stream/{uploaded_song['id']}?auth={alex_token}", timeout=60)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("audio/")
    assert len(r.content) > 0


def test_stream_with_bearer(alex_token, uploaded_song):
    r = requests.get(f"{BASE_URL}/api/music/stream/{uploaded_song['id']}", headers=_hdr(alex_token), timeout=60)
    assert r.status_code == 200


# --- Like toggle ---
def test_like_toggle(alex_token, uploaded_song):
    sid = uploaded_song["id"]
    r1 = requests.post(f"{BASE_URL}/api/music/like/{sid}", headers=_hdr(alex_token), timeout=30)
    assert r1.status_code == 200
    liked1 = r1.json()["liked"]

    r_list = requests.get(f"{BASE_URL}/api/music/liked", headers=_hdr(alex_token), timeout=30)
    assert r_list.status_code == 200
    liked_ids = [s["id"] for s in r_list.json()]
    assert (sid in liked_ids) == liked1

    r2 = requests.post(f"{BASE_URL}/api/music/like/{sid}", headers=_hdr(alex_token), timeout=30)
    assert r2.status_code == 200
    assert r2.json()["liked"] != liked1


# --- History ---
def test_history(alex_token, uploaded_song):
    sid = uploaded_song["id"]
    r = requests.post(f"{BASE_URL}/api/music/history/{sid}", headers=_hdr(alex_token), timeout=30)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/music/history/me", headers=_hdr(alex_token), timeout=30)
    assert r2.status_code == 200
    ids = [s["id"] for s in r2.json()]
    assert sid in ids


# --- Delete permissions ---
def test_non_owner_cannot_delete(jamie_token, uploaded_song):
    r = requests.delete(f"{BASE_URL}/api/music/tracks/{uploaded_song['id']}", headers=_hdr(jamie_token), timeout=30)
    assert r.status_code == 403


def test_owner_can_delete_and_gone(alex_token, uploaded_song):
    sid = uploaded_song["id"]
    r = requests.delete(f"{BASE_URL}/api/music/tracks/{sid}", headers=_hdr(alex_token), timeout=30)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE_URL}/api/music/tracks", headers=_hdr(alex_token), timeout=30)
    ids = [t["id"] for t in r2.json()]
    assert sid not in ids
