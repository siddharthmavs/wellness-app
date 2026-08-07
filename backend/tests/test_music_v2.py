"""Music Zone v2: external links (YouTube/Spotify), playlists CRUD/ACL, trending."""
import os
import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")

YT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
SP_URL = "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh"


def _login(email, password="demo1234"):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()


def _hdr(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def alex():
    return _login("alex@demo.com")


@pytest.fixture(scope="module")
def jamie():
    return _login("jamie@demo.com")


@pytest.fixture(scope="module")
def sam():
    return _login("sam@demo.com")


@pytest.fixture(scope="module")
def admin():
    return _login("admin@demo.com")


# Shared state to track created ids for cleanup
_created_songs = []
_created_playlists = []


@pytest.fixture(scope="module", autouse=True)
def _cleanup(alex, admin):
    yield
    at = admin["token"]
    for sid in _created_songs:
        try: requests.delete(f"{BASE_URL}/api/music/tracks/{sid}", headers=_hdr(at), timeout=15)
        except Exception: pass
    for pid in _created_playlists:
        try: requests.delete(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(at), timeout=15)
        except Exception: pass


# ============ /api/music/link ============
class TestMusicLink:
    def test_youtube_link(self, alex):
        r = requests.post(f"{BASE_URL}/api/music/link", headers=_hdr(alex["token"]),
                          json={"url": YT_URL}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert j["source"] == "youtube"
        assert j["external_id"] == "dQw4w9WgXcQ"
        assert j.get("thumbnail_url")
        assert j.get("title")  # oEmbed should have populated it
        assert j.get("link_url", "").endswith("dQw4w9WgXcQ")
        _created_songs.append(j["id"])
        pytest.yt_song_id = j["id"]

    def test_spotify_link(self, alex):
        r = requests.post(f"{BASE_URL}/api/music/link", headers=_hdr(alex["token"]),
                          json={"url": SP_URL}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert j["source"] == "spotify"
        assert j["external_id"].startswith("track:")
        assert "4iV5W9uYEdYUVa79Axb7Rh" in j["external_id"]
        # thumbnail may be None if oembed unreachable, but link should be set
        assert j.get("link_url")
        _created_songs.append(j["id"])
        pytest.sp_song_id = j["id"]

    def test_unsupported_url(self, alex):
        r = requests.post(f"{BASE_URL}/api/music/link", headers=_hdr(alex["token"]),
                          json={"url": "https://example.com/foo.mp3"}, timeout=15)
        assert r.status_code == 400

    def test_empty_url(self, alex):
        r = requests.post(f"{BASE_URL}/api/music/link", headers=_hdr(alex["token"]),
                          json={"url": ""}, timeout=15)
        assert r.status_code == 400

    def test_stream_external_rejected(self, alex):
        # streaming a youtube/spotify song should 400
        sid = pytest.yt_song_id
        r = requests.get(f"{BASE_URL}/api/music/stream/{sid}", headers=_hdr(alex["token"]), timeout=15)
        assert r.status_code == 400


# ============ /api/music/trending ============
class TestTrending:
    def test_seed_and_trending(self, alex, jamie):
        sid = pytest.yt_song_id
        # Log a couple of history entries as multiple users to make aggregation meaningful
        for tok in [alex["token"], alex["token"], jamie["token"]]:
            r = requests.post(f"{BASE_URL}/api/music/history/{sid}", headers=_hdr(tok), timeout=15)
            assert r.status_code == 200
        r = requests.get(f"{BASE_URL}/api/music/trending", headers=_hdr(alex["token"]), timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        found = [t for t in arr if t["id"] == sid]
        assert found, f"seeded track not in trending; got {[t['id'] for t in arr]}"
        assert found[0]["plays"] >= 3
        # thumbnail carried through
        assert found[0].get("thumbnail_url")


# ============ /api/playlists CRUD ============
class TestPlaylistCRUD:
    def test_create_private(self, alex):
        r = requests.post(f"{BASE_URL}/api/playlists", headers=_hdr(alex["token"]),
                          json={"name": "TEST_PL_Private", "visibility": "private"}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        j = r.json()
        assert j["name"] == "TEST_PL_Private"
        assert j["visibility"] == "private"
        assert j["owner_id"] == alex["user"]["id"]
        assert j["track_ids"] == []
        _created_playlists.append(j["id"])
        pytest.pl_private = j["id"]

    def test_create_public(self, alex):
        r = requests.post(f"{BASE_URL}/api/playlists", headers=_hdr(alex["token"]),
                          json={"name": "TEST_PL_Public", "visibility": "public"}, timeout=15)
        assert r.status_code == 200
        pid = r.json()["id"]
        _created_playlists.append(pid)
        pytest.pl_public = pid

    def test_create_shared(self, sam, jamie):
        r = requests.post(f"{BASE_URL}/api/playlists", headers=_hdr(sam["token"]),
                          json={"name": "TEST_PL_Shared", "visibility": "shared",
                                "shared_with": [jamie["user"]["id"]]}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["visibility"] == "shared"
        assert jamie["user"]["id"] in j["shared_with"]
        _created_playlists.append(j["id"])
        pytest.pl_shared = j["id"]

    def test_list_playlists_scoped(self, alex, jamie):
        r = requests.get(f"{BASE_URL}/api/playlists", headers=_hdr(alex["token"]), timeout=15)
        assert r.status_code == 200
        alex_ids = {p["id"] for p in r.json()}
        assert pytest.pl_private in alex_ids
        assert pytest.pl_public in alex_ids
        # alex is owner of private+public, so can_edit true
        for p in r.json():
            if p["id"] == pytest.pl_private:
                assert p["can_edit"] is True

        # jamie should see the shared playlist and the public one, not private
        r2 = requests.get(f"{BASE_URL}/api/playlists", headers=_hdr(jamie["token"]), timeout=15)
        assert r2.status_code == 200
        jamie_ids = {p["id"] for p in r2.json()}
        assert pytest.pl_public in jamie_ids
        assert pytest.pl_shared in jamie_ids
        assert pytest.pl_private not in jamie_ids

    def test_get_playlist_hydrated(self, alex):
        r = requests.get(f"{BASE_URL}/api/playlists/{pytest.pl_private}", headers=_hdr(alex["token"]), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "tracks" in j
        assert j["can_edit"] is True

    # ---- ACL ----
    def test_non_owner_cannot_view_private(self, jamie):
        r = requests.get(f"{BASE_URL}/api/playlists/{pytest.pl_private}", headers=_hdr(jamie["token"]), timeout=15)
        assert r.status_code == 403

    def test_non_owner_can_view_public(self, jamie):
        r = requests.get(f"{BASE_URL}/api/playlists/{pytest.pl_public}", headers=_hdr(jamie["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json()["can_edit"] is False

    def test_shared_user_can_view_shared(self, jamie):
        r = requests.get(f"{BASE_URL}/api/playlists/{pytest.pl_shared}", headers=_hdr(jamie["token"]), timeout=15)
        assert r.status_code == 200

    def test_non_shared_user_cannot_view_shared(self, alex):
        # alex is not in shared_with of sam's shared playlist
        r = requests.get(f"{BASE_URL}/api/playlists/{pytest.pl_shared}", headers=_hdr(alex["token"]), timeout=15)
        assert r.status_code == 403

    def test_non_owner_cannot_edit_private(self, jamie):
        r = requests.patch(f"{BASE_URL}/api/playlists/{pytest.pl_private}",
                           headers=_hdr(jamie["token"]),
                           json={"name": "hacked"}, timeout=15)
        assert r.status_code == 403

    def test_owner_can_edit(self, alex):
        r = requests.patch(f"{BASE_URL}/api/playlists/{pytest.pl_private}",
                           headers=_hdr(alex["token"]),
                           json={"description": "updated desc", "visibility": "shared", "shared_with": []},
                           timeout=15)
        assert r.status_code == 200
        # verify persisted
        r2 = requests.get(f"{BASE_URL}/api/playlists/{pytest.pl_private}", headers=_hdr(alex["token"]), timeout=15)
        assert r2.json()["description"] == "updated desc"
        assert r2.json()["visibility"] == "shared"

    def test_admin_can_delete_others(self, admin, alex):
        # create a throwaway pl as alex, delete as admin
        r = requests.post(f"{BASE_URL}/api/playlists", headers=_hdr(alex["token"]),
                          json={"name": "TEST_PL_AdminKill"}, timeout=15)
        pid = r.json()["id"]
        r2 = requests.delete(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(admin["token"]), timeout=15)
        assert r2.status_code == 200


# ============ Playlist tracks add/remove/reorder ============
class TestPlaylistTracks:
    def test_add_track(self, alex):
        pid = pytest.pl_private
        tid = pytest.yt_song_id
        r = requests.post(f"{BASE_URL}/api/playlists/{pid}/tracks",
                          headers=_hdr(alex["token"]),
                          json={"track_id": tid}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # verify via get
        r2 = requests.get(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(alex["token"]), timeout=15)
        ids = [t["id"] for t in r2.json()["tracks"]]
        assert tid in ids

    def test_add_track_duplicate_returns_already(self, alex):
        pid = pytest.pl_private
        tid = pytest.yt_song_id
        r = requests.post(f"{BASE_URL}/api/playlists/{pid}/tracks",
                          headers=_hdr(alex["token"]),
                          json={"track_id": tid}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j.get("already") is True
        # confirm not duplicated
        r2 = requests.get(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(alex["token"]), timeout=15)
        ids = [t["id"] for t in r2.json()["tracks"]]
        assert ids.count(tid) == 1

    def test_add_second_track_and_reorder(self, alex):
        pid = pytest.pl_private
        # add spotify track
        r = requests.post(f"{BASE_URL}/api/playlists/{pid}/tracks",
                          headers=_hdr(alex["token"]),
                          json={"track_id": pytest.sp_song_id}, timeout=15)
        assert r.status_code == 200
        # reorder (reverse)
        new_order = [pytest.sp_song_id, pytest.yt_song_id]
        r2 = requests.put(f"{BASE_URL}/api/playlists/{pid}/reorder",
                          headers=_hdr(alex["token"]),
                          json={"track_ids": new_order}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["track_ids"] == new_order
        # confirm persisted
        r3 = requests.get(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(alex["token"]), timeout=15)
        assert [t["id"] for t in r3.json()["tracks"]] == new_order

    def test_reorder_with_extra_and_missing(self, alex):
        pid = pytest.pl_private
        # Send order with bogus id and only 1 of 2 real ids -> should keep both, appending missing
        r = requests.put(f"{BASE_URL}/api/playlists/{pid}/reorder",
                         headers=_hdr(alex["token"]),
                         json={"track_ids": [pytest.yt_song_id, "bogus-id"]}, timeout=15)
        assert r.status_code == 200
        ids = r.json()["track_ids"]
        assert pytest.yt_song_id in ids
        assert pytest.sp_song_id in ids
        assert "bogus-id" not in ids

    def test_remove_track(self, alex):
        pid = pytest.pl_private
        tid = pytest.sp_song_id
        r = requests.delete(f"{BASE_URL}/api/playlists/{pid}/tracks/{tid}",
                            headers=_hdr(alex["token"]), timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(alex["token"]), timeout=15)
        ids = [t["id"] for t in r2.json()["tracks"]]
        assert tid not in ids

    def test_non_owner_cannot_add(self, jamie):
        # jamie tries to add to alex's now-shared (but jamie not in shared_with) playlist
        pid = pytest.pl_private  # visibility now "shared" with empty shared_with
        r = requests.post(f"{BASE_URL}/api/playlists/{pid}/tracks",
                          headers=_hdr(jamie["token"]),
                          json={"track_id": pytest.yt_song_id}, timeout=15)
        assert r.status_code == 403


# ============ Playlist DELETE permissions ============
class TestPlaylistDelete:
    def test_non_owner_cannot_delete(self, alex, jamie):
        r = requests.post(f"{BASE_URL}/api/playlists", headers=_hdr(alex["token"]),
                          json={"name": "TEST_PL_ToKill", "visibility": "public"}, timeout=15)
        pid = r.json()["id"]
        _created_playlists.append(pid)
        r2 = requests.delete(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(jamie["token"]), timeout=15)
        assert r2.status_code == 403

    def test_owner_can_delete(self, alex):
        r = requests.post(f"{BASE_URL}/api/playlists", headers=_hdr(alex["token"]),
                          json={"name": "TEST_PL_ToKill2"}, timeout=15)
        pid = r.json()["id"]
        r2 = requests.delete(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(alex["token"]), timeout=15)
        assert r2.status_code == 200
        r3 = requests.get(f"{BASE_URL}/api/playlists/{pid}", headers=_hdr(alex["token"]), timeout=15)
        assert r3.status_code == 404
