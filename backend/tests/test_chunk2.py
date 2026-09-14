"""Brutal Wellness Chunk 2 backend tests: admin, shoutouts, help, feedback, insights, dnd, reactions"""
import os
import uuid
import pytest
import requests

def _load_frontend_env():
    p = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', '.env')
    try:
        with open(p) as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except Exception:
        return None
    return None

BASE_URL = (os.environ.get('REACT_APP_BACKEND_URL') or _load_frontend_env() or '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@demo.com"
EMP_EMAIL = "alex@demo.com"
PASSWORD = "demo1234"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, f"login {email} failed: {r.text}"
    return r.json()


@pytest.fixture(scope="module")
def admin_data(session):
    return _login(session, ADMIN_EMAIL)


@pytest.fixture(scope="module")
def emp_data(session):
    return _login(session, EMP_EMAIL)


@pytest.fixture(scope="module")
def admin_headers(admin_data):
    return {"Authorization": f"Bearer {admin_data['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def emp_headers(emp_data):
    return {"Authorization": f"Bearer {emp_data['token']}", "Content-Type": "application/json"}


# ---------- Auth admin role ----------
class TestAdminAuth:
    def test_admin_login_role(self, admin_data):
        assert admin_data["user"]["email"] == ADMIN_EMAIL
        assert admin_data["user"]["role"] == "admin"

    def test_employee_login_role(self, emp_data):
        assert emp_data["user"]["role"] in ("employee", "team_lead")


# ---------- Admin Users ----------
class TestAdminUsers:
    def test_employee_forbidden(self, session, emp_headers):
        r = session.get(f"{API}/admin/users", headers=emp_headers)
        assert r.status_code == 403

    def test_admin_list_users(self, session, admin_headers):
        r = session.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 5
        assert all("password" not in u and "_id" not in u for u in users)

    def test_admin_patch_user(self, session, admin_headers):
        r = session.get(f"{API}/admin/users", headers=admin_headers)
        users = r.json()
        target = next(u for u in users if u["email"] == "riley@demo.com")
        # update points
        r2 = session.patch(f"{API}/admin/users/{target['id']}",
                           json={"department": "Operations", "points": 999},
                           headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["department"] == "Operations"
        assert r2.json()["points"] == 999

    def test_admin_cannot_delete_self(self, session, admin_headers, admin_data):
        r = session.delete(f"{API}/admin/users/{admin_data['user']['id']}", headers=admin_headers)
        assert r.status_code == 400

    def test_admin_delete_user_then_recreate(self, session, admin_headers):
        # create a temp user in the admin's own org via invite + accept, then delete via admin
        email = f"TEST_del_{uuid.uuid4().hex[:6]}@test.com"
        ri = session.post(f"{API}/admin/invitations", json={"name": "TEST Del", "email": email},
                          headers=admin_headers)
        assert ri.status_code == 200, ri.text
        r = session.post(f"{API}/auth/accept-invite",
                         json={"token": ri.json()["token"], "password": "p1234"})
        assert r.status_code == 200
        uid = r.json()["user"]["id"]
        rd = session.delete(f"{API}/admin/users/{uid}", headers=admin_headers)
        assert rd.status_code == 200
        assert rd.json()["deleted"] is True


# ---------- Admin Challenges ----------
class TestAdminChallenges:
    def test_create_list_delete(self, session, admin_headers):
        r = session.post(f"{API}/admin/challenges", json={
            "title": "TEST 5 waters", "reward": 25, "target": 5, "type": "water", "scope": "daily"
        }, headers=admin_headers)
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["title"] == "TEST 5 waters"

        rl = session.get(f"{API}/admin/challenges", headers=admin_headers)
        assert rl.status_code == 200
        assert any(c["id"] == cid for c in rl.json())

        rd = session.delete(f"{API}/admin/challenges/{cid}", headers=admin_headers)
        assert rd.status_code == 200

    def test_employee_forbidden_challenges(self, session, emp_headers):
        r = session.get(f"{API}/admin/challenges", headers=emp_headers)
        assert r.status_code == 403


# ---------- Admin Reminders ----------
class TestReminders:
    def test_get_default(self, session, admin_headers):
        r = session.get(f"{API}/admin/reminders", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("water_interval_min", "eye_care_interval_min", "stand_interval_min", "enabled"):
            assert k in d

    def test_put_save(self, session, admin_headers):
        body = {"water_interval_min": 45, "eye_care_interval_min": 25, "stand_interval_min": 75, "enabled": True}
        r = session.put(f"{API}/admin/reminders", json=body, headers=admin_headers)
        assert r.status_code == 200
        # verify persisted
        r2 = session.get(f"{API}/admin/reminders", headers=admin_headers)
        assert r2.json()["water_interval_min"] == 45
        assert r2.json()["eye_care_interval_min"] == 25


# ---------- Admin Analytics ----------
class TestAnalytics:
    def test_analytics(self, session, admin_headers):
        r = session.get(f"{API}/admin/analytics", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_users", "dau", "wau", "mau", "mood_chart", "activity_chart", "counts", "trend"):
            assert k in d
        assert isinstance(d["trend"], list) and len(d["trend"]) == 7
        for k in ("posts", "shoutouts", "feedback", "help_posts"):
            assert k in d["counts"]


# ---------- Feedback ----------
class TestFeedback:
    def test_employee_create_feedback(self, session, emp_headers):
        r = session.post(f"{API}/feedback", json={
            "category": "Wellness", "message": "TEST feedback msg", "anonymous": False
        }, headers=emp_headers)
        assert r.status_code == 200
        assert r.json()["category"] == "Wellness"

    def test_employee_cannot_list(self, session, emp_headers):
        r = session.get(f"{API}/feedback", headers=emp_headers)
        assert r.status_code == 403

    def test_admin_list_feedback(self, session, admin_headers):
        r = session.get(f"{API}/feedback", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(f["message"] == "TEST feedback msg" for f in items)

    def test_invalid_category(self, session, emp_headers):
        r = session.post(f"{API}/feedback", json={
            "category": "Bogus", "message": "x"
        }, headers=emp_headers)
        assert r.status_code == 400


# ---------- Shoutouts ----------
class TestShoutouts:
    def test_create_shoutout_points(self, session, emp_headers, admin_headers, emp_data):
        # pick 2 recipients via /api/users
        r = session.get(f"{API}/users", headers=emp_headers)
        assert r.status_code == 200
        users = r.json()
        recipients = [u for u in users if u["id"] != emp_data["user"]["id"]][:2]
        rids = [u["id"] for u in recipients]

        before_sender = session.get(f"{API}/auth/me", headers=emp_headers).json()["points"]

        r2 = session.post(f"{API}/shoutouts", json={
            "recipient_ids": rids, "category": "Teamwork", "message": "TEST shoutout you rock"
        }, headers=emp_headers)
        assert r2.status_code == 200, r2.text
        sid = r2.json()["id"]
        assert r2.json()["category"] == "Teamwork"

        after_sender = session.get(f"{API}/auth/me", headers=emp_headers).json()["points"]
        assert after_sender == before_sender + 5

        # verify recipients' points incremented by +10 each (use admin to inspect)
        ulist = session.get(f"{API}/admin/users", headers=admin_headers).json()
        umap = {u["id"]: u for u in ulist}
        for rid in rids:
            assert umap[rid]["points"] >= 10  # at least 10 awarded since session start

        # in list
        rl = session.get(f"{API}/shoutouts")
        assert rl.status_code == 200
        assert any(s["id"] == sid for s in rl.json())

        # react with valid emoji
        rr = session.post(f"{API}/shoutouts/{sid}/react", json={"emoji": "🔥"}, headers=emp_headers)
        assert rr.status_code == 200
        assert "🔥" in rr.json()["reactions"]
        # toggle off
        rr2 = session.post(f"{API}/shoutouts/{sid}/react", json={"emoji": "🔥"}, headers=emp_headers)
        assert emp_data["user"]["id"] not in rr2.json()["reactions"]["🔥"]

    def test_invalid_emoji(self, session, emp_headers):
        # need a shoutout id - just hit any
        rl = session.get(f"{API}/shoutouts").json()
        if not rl:
            pytest.skip("no shoutouts")
        sid = rl[0]["id"]
        r = session.post(f"{API}/shoutouts/{sid}/react", json={"emoji": "💩"}, headers=emp_headers)
        assert r.status_code == 400

    def test_invalid_category(self, session, emp_headers):
        r = session.post(f"{API}/shoutouts", json={
            "recipient_ids": ["x"], "category": "Bogus", "message": "x"
        }, headers=emp_headers)
        assert r.status_code == 400

    def test_empty_recipients(self, session, emp_headers):
        r = session.post(f"{API}/shoutouts", json={
            "recipient_ids": [], "category": "Teamwork", "message": "x"
        }, headers=emp_headers)
        assert r.status_code == 400

    def test_digest(self, session):
        r = session.get(f"{API}/shoutouts/digest")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) <= 3


# ---------- Help Board ----------
class TestHelpBoard:
    def test_create_help_filter(self, session, emp_headers):
        r = session.post(f"{API}/help", json={
            "category": "Housing", "title": "TEST 1BHK near office", "content": "Looking..."
        }, headers=emp_headers)
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["category"] == "Housing"

        rl = session.get(f"{API}/help", params={"category": "Housing"})
        assert rl.status_code == 200
        assert any(p["id"] == pid for p in rl.json())

        # like + toggle
        rk = session.post(f"{API}/help/{pid}/like", headers=emp_headers)
        assert rk.status_code == 200
        assert len(rk.json()["likes"]) == 1
        rk2 = session.post(f"{API}/help/{pid}/like", headers=emp_headers)
        assert len(rk2.json()["likes"]) == 0

        # comment
        rc = session.post(f"{API}/help/{pid}/comment", json={"content": "TEST hcmt"}, headers=emp_headers)
        assert rc.status_code == 200
        assert rc.json()["content"] == "TEST hcmt"

    def test_invalid_category(self, session, emp_headers):
        r = session.post(f"{API}/help", json={
            "category": "Bogus", "title": "x", "content": "y"
        }, headers=emp_headers)
        assert r.status_code == 400

    def test_list_all(self, session):
        r = session.get(f"{API}/help")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Team Leaderboard ----------
class TestTeamLB:
    def test_team_leaderboard(self, session):
        r = session.get(f"{API}/leaderboard/teams")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list) and len(rows) >= 1
        for row in rows:
            for k in ("team", "points", "members", "avg_wellness"):
                assert k in row


# ---------- Insights ----------
class TestInsights:
    def test_weekly(self, session, emp_headers):
        r = session.get(f"{API}/insights/weekly", headers=emp_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("water", "eye_care", "stand", "points_earned", "top_mood", "message", "streak"):
            assert k in d
        assert "this" in d["water"]
        assert "this" in d["eye_care"]


# ---------- DND on profile ----------
class TestDND:
    def test_patch_dnd(self, session, emp_headers):
        r = session.patch(f"{API}/users/me", json={"dnd": True}, headers=emp_headers)
        assert r.status_code == 200
        assert r.json()["dnd"] is True
        # toggle off
        r2 = session.patch(f"{API}/users/me", json={"dnd": False}, headers=emp_headers)
        assert r2.json()["dnd"] is False


# ---------- Fun Wall reactions ----------
class TestPostReactions:
    def test_react_emoji(self, session, emp_headers, emp_data):
        # create a post
        r = session.post(f"{API}/posts", json={"content": "TEST reaction post"}, headers=emp_headers)
        pid = r.json()["id"]
        rr = session.post(f"{API}/posts/{pid}/react", json={"emoji": "❤️"}, headers=emp_headers)
        assert rr.status_code == 200
        assert "❤️" in rr.json()["reactions"]
        assert emp_data["user"]["id"] in rr.json()["reactions"]["❤️"]
        # switch to 😂 (should remove ❤️ from this user)
        rr2 = session.post(f"{API}/posts/{pid}/react", json={"emoji": "😂"}, headers=emp_headers)
        assert "😂" in rr2.json()["reactions"]
        assert emp_data["user"]["id"] not in rr2.json()["reactions"].get("❤️", [])

    def test_invalid_emoji(self, session, emp_headers):
        r = session.get(f"{API}/posts").json()
        if not r:
            pytest.skip("no posts")
        pid = r[0]["id"]
        rr = session.post(f"{API}/posts/{pid}/react", json={"emoji": "💩"}, headers=emp_headers)
        assert rr.status_code == 400


# ---------- Users list ----------
class TestUsersList:
    def test_list_requires_auth(self, session):
        r = session.get(f"{API}/users")
        assert r.status_code == 401

    def test_list_authed(self, session, emp_headers):
        r = session.get(f"{API}/users", headers=emp_headers)
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 6
        assert all("password" not in u for u in users)
