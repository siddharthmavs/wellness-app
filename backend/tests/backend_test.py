"""Brutal Wellness Backend API tests"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://engage-chaos.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

DEMO_EMAIL = "alex@demo.com"
DEMO_PASSWORD = "demo1234"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(session):
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"Demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# --- Auth ---
class TestAuth:
    def test_register_new_user(self, session):
        # /auth/register now creates a brand-new organization + its first Admin
        # (doc section 1) — employees join only via /auth/accept-invite.
        email = f"TEST_{uuid.uuid4().hex[:8]}@test.com"
        r = session.post(f"{API}/auth/register", json={
            "org_name": "QA Test Org", "name": "TEST User", "email": email, "password": "test1234"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "admin"
        assert data["user"]["org_id"]
        assert data["user"]["points"] == 0
        assert data["user"]["level"] == 1

    def test_register_duplicate(self, session):
        r = session.post(f"{API}/auth/register", json={
            "org_name": "Another Org", "name": "Alex", "email": DEMO_EMAIL, "password": "x"
        })
        assert r.status_code == 400

    def test_login_demo(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == DEMO_EMAIL
        assert isinstance(data["token"], str) and len(data["token"]) > 10

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_no_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401


# --- Activities ---
class TestActivities:
    def test_log_water(self, session, auth_headers):
        before = session.get(f"{API}/auth/me", headers=auth_headers).json()["points"]
        r = session.post(f"{API}/activities", json={"type": "water"}, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["points"] == before + 10
        assert d["activity"]["type"] == "water"
        assert d["activity"]["points"] == 10

    @pytest.mark.parametrize("typ,pts", [("eye_care", 15), ("stand", 10), ("breathing", 20)])
    def test_log_other(self, session, auth_headers, typ, pts):
        before = session.get(f"{API}/auth/me", headers=auth_headers).json()["points"]
        r = session.post(f"{API}/activities", json={"type": typ}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["points"] == before + pts

    def test_my_activities(self, session, auth_headers):
        r = session.get(f"{API}/activities/me", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1


# --- Leaderboard ---
class TestLeaderboard:
    @pytest.mark.parametrize("period", ["all", "daily", "weekly", "monthly"])
    def test_leaderboard(self, session, auth_headers, period):
        r = session.get(f"{API}/leaderboard", params={"period": period}, headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        if period == "all":
            assert len(data) >= 5  # 5 demo users
            for u in data:
                assert "_id" not in u
                assert "password" not in u


# --- Mood ---
class TestMood:
    def test_create_and_get_mood(self, session, auth_headers):
        r = session.post(f"{API}/mood", json={"emoji": "😀", "label": "happy", "note": "TEST"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["emoji"] == "😀"
        r2 = session.get(f"{API}/mood/me", headers=auth_headers)
        assert r2.status_code == 200
        assert any(m["note"] == "TEST" for m in r2.json())


# --- Posts ---
class TestPosts:
    def test_create_post_and_list(self, session, auth_headers):
        r = session.post(f"{API}/posts", json={"content": "TEST post brutal"}, headers=auth_headers)
        assert r.status_code == 200
        post_id = r.json()["id"]
        r2 = session.get(f"{API}/posts")
        assert r2.status_code == 200
        ids = [p["id"] for p in r2.json()]
        assert post_id in ids
        return post_id

    def test_like_and_comment(self, session, auth_headers):
        r = session.post(f"{API}/posts", json={"content": "TEST like target"}, headers=auth_headers)
        pid = r.json()["id"]
        # like
        r2 = session.post(f"{API}/posts/{pid}/like", headers=auth_headers)
        assert r2.status_code == 200
        assert len(r2.json()["likes"]) == 1
        # toggle off
        r3 = session.post(f"{API}/posts/{pid}/like", headers=auth_headers)
        assert len(r3.json()["likes"]) == 0
        # comment
        r4 = session.post(f"{API}/posts/{pid}/comment", json={"content": "TEST cmt"}, headers=auth_headers)
        assert r4.status_code == 200
        assert r4.json()["content"] == "TEST cmt"

    def test_like_404(self, session, auth_headers):
        r = session.post(f"{API}/posts/nonexistent-id/like", headers=auth_headers)
        assert r.status_code == 404


# --- Notifications, Challenges, Badges ---
class TestMisc:
    def test_notif_random(self, session, auth_headers):
        r = session.get(f"{API}/notifications/random", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("title", "message", "type", "color"):
            assert k in d

    def test_challenges(self, session, auth_headers):
        r = session.get(f"{API}/challenges", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 4
        for c in data:
            assert "progress" in c and "done" in c

    def test_badges(self, session):
        r = session.get(f"{API}/badges")
        assert r.status_code == 200
        assert len(r.json()) >= 5


# --- AI Insight ---
class TestAI:
    def test_mood_insight(self, session, auth_headers):
        r = session.post(f"{API}/ai/mood-insight", json={"moods": ["😀 happy", "😴 tired"]}, headers=auth_headers)
        assert r.status_code == 200
        assert "insight" in r.json()
        assert len(r.json()["insight"]) > 0


# --- Seed ---
class TestSeed:
    def test_demo_users_exist(self, session, auth_headers):
        r = session.get(f"{API}/leaderboard?period=all", headers=auth_headers)
        assert r.status_code == 200
        emails = [u["email"] for u in r.json()]
        for e in ["alex@demo.com", "jamie@demo.com", "sam@demo.com", "riley@demo.com", "casey@demo.com"]:
            assert e in emails, f"Missing seeded user {e}"
