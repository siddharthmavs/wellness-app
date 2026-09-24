"""Multi-tenant isolation (BUG-03) and duplicate-organization (BUG-02) regressions.

Two fresh organizations are registered per run. Org A creates content; Org B's admin
and employee then try to read it and to act on it by id. Nothing from A may leak."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"


def _s(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _register_org(name):
    email = f"admin_{uuid.uuid4().hex[:8]}@example.com"
    r = _s().post(f"{API}/auth/register", json={"org_name": name, "name": "Org Admin", "email": email, "password": "pass1234"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def _invite_employee(admin_session, name):
    email = f"emp_{uuid.uuid4().hex[:8]}@example.com"
    inv = admin_session.post(f"{API}/admin/invitations", json={"email": email, "name": name}, timeout=20)
    assert inv.status_code == 200, inv.text
    r = _s().post(f"{API}/auth/accept-invite", json={"token": inv.json()["token"], "password": "pass1234"}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


class Tenant:
    def __init__(self, label):
        self.org_name = f"Tenant {label} {uuid.uuid4().hex[:6]}"
        reg = _register_org(self.org_name)
        self.admin = _s(reg["token"])
        self.admin_user = reg["user"]
        emp = _invite_employee(self.admin, f"{label} Employee")
        self.emp = _s(emp["token"])
        self.emp_user = emp["user"]
        emp2 = _invite_employee(self.admin, f"{label} Colleague")
        self.emp2_user = emp2["user"]


@pytest.fixture(scope="module")
def orgs():
    a, b = Tenant("A"), Tenant("B")
    # Org A creates one of everything
    a.post = a.emp.post(f"{API}/posts", json={"content": "A-secret post"}).json()
    a.help = a.emp.post(f"{API}/help", json={"category": "General", "title": "A-secret help", "content": "x"}).json()
    a.shout = a.emp.post(f"{API}/shoutouts", json={"recipient_ids": [a.emp2_user["id"]], "category": "Teamwork", "message": "A-secret kudos"}).json()
    a.poll = a.admin.post(f"{API}/polls", json={"question": "A-secret poll?", "options": ["x", "y"]}).json()
    a.feedback = a.emp.post(f"{API}/feedback", json={"category": "General", "message": "A-secret feedback"}).json()
    a.challenge = a.admin.post(f"{API}/admin/challenges", json={"title": "A-secret", "reward": 5, "target": 1, "type": "water"}).json()
    a.team = a.admin.post(f"{API}/admin/game-teams", json={"name": "A-team"}).json()
    a.playlist = a.emp.post(f"{API}/playlists", json={"name": "A-mix", "visibility": "public"}).json()
    return a, b


# ---------- BUG-02: duplicate organizations ----------
class TestDuplicateOrganizations:
    def test_case_and_whitespace_variants_are_rejected(self):
        name = f"Wellness Garden {uuid.uuid4().hex[:6]}"
        _register_org(name)
        for variant in (f"  {name.lower()}  ", name.upper(), name.replace(" ", "   ")):
            r = _s().post(f"{API}/auth/register", json={
                "org_name": variant, "name": "Dup", "email": f"dup_{uuid.uuid4().hex[:6]}@example.com", "password": "pass1234",
            })
            assert r.status_code == 409, (variant, r.text)
            assert r.json()["message"] == "An organization with this name already exists."

    def test_rejected_registration_creates_no_user(self):
        name = f"Solo Org {uuid.uuid4().hex[:6]}"
        _register_org(name)
        email = f"ghost_{uuid.uuid4().hex[:6]}@example.com"
        r = _s().post(f"{API}/auth/register", json={"org_name": name, "name": "Ghost", "email": email, "password": "pass1234"})
        assert r.status_code == 409
        login = _s().post(f"{API}/auth/login", json={"email": email, "password": "pass1234"})
        assert login.status_code == 401

    def test_rename_into_existing_name_is_rejected(self, orgs):
        a, b = orgs
        r = b.admin.put(f"{API}/admin/organization", json={"name": f" {a.org_name.upper()} "})
        assert r.status_code == 409
        assert b.admin.get(f"{API}/admin/organization").json()["name"] == b.org_name


# ---------- BUG-03: reads never cross tenants ----------
class TestCrossTenantReads:
    @pytest.mark.parametrize("path", [
        "/posts", "/help", "/shoutouts", "/polls", "/users", "/game-teams",
        "/playlists", "/leaderboard", "/leaderboard/teams", "/events",
        "/shoutouts/digest", "/spotlight/current", "/activities/feed?scope=all",
    ])
    def test_org_b_sees_nothing_from_org_a(self, orgs, path):
        a, b = orgs
        r = b.emp.get(f"{API}{path}")
        assert r.status_code == 200, r.text
        body = r.text
        for marker in ("A-secret", a.emp_user["id"], a.emp2_user["id"], a.admin_user["id"]):
            assert marker not in body, f"{path} leaked {marker}"

    @pytest.mark.parametrize("path", [
        "/admin/users", "/admin/invitations", "/feedback", "/admin/challenges",
        "/admin/game-teams", "/admin/announcements", "/admin/rewards", "/admin/points/log",
        "/admin/analytics", "/admin/quizzes",
    ])
    def test_org_b_admin_sees_nothing_from_org_a(self, orgs, path):
        a, b = orgs
        r = b.admin.get(f"{API}{path}")
        assert r.status_code == 200, r.text
        for marker in ("A-secret", "A-team", a.emp_user["id"], a.admin_user["id"]):
            assert marker not in r.text, f"{path} leaked {marker}"

    def test_analytics_counts_only_own_org(self, orgs):
        _, b = orgs
        d = b.admin.get(f"{API}/admin/analytics").json()
        assert d["total_users"] == 3  # B's admin + 2 employees
        assert d["counts"]["posts"] == 0

    @pytest.mark.parametrize("path", ["/posts", "/help", "/shoutouts", "/polls", "/game-teams",
                                      "/shoutouts/digest", "/spotlight/current", "/plants/leaderboard",
                                      "/games/leaderboard", "/facts/today"])
    def test_list_endpoints_require_login(self, path):
        assert _s().get(f"{API}{path}").status_code == 401

    def test_user_directory_hides_private_fields(self, orgs):
        _, b = orgs
        for u in b.emp.get(f"{API}/users").json():
            assert "email" not in u and "password" not in u and "birthday" not in u


# ---------- BUG-03: id-swapping writes are denied ----------
class TestCrossTenantWrites:
    def test_cannot_touch_other_orgs_content_by_id(self, orgs):
        a, b = orgs
        attempts = [
            b.emp.post(f"{API}/posts/{a.post['id']}/like"),
            b.emp.post(f"{API}/posts/{a.post['id']}/comment", json={"content": "x"}),
            b.emp.post(f"{API}/posts/{a.post['id']}/react", json={"emoji": "heart"}),
            b.emp.post(f"{API}/help/{a.help['id']}/like"),
            b.emp.post(f"{API}/shoutouts/{a.shout['id']}/react", json={"emoji": "heart"}),
            b.emp.post(f"{API}/polls/{a.poll['id']}/vote", json={"option_idx": 0}),
            b.emp.get(f"{API}/playlists/{a.playlist['id']}"),
            b.admin.delete(f"{API}/admin/challenges/{a.challenge['id']}"),
            b.admin.delete(f"{API}/admin/game-teams/{a.team['id']}"),
            b.admin.patch(f"{API}/admin/game-teams/{a.team['id']}", json={"name": "pwned"}),
            b.admin.delete(f"{API}/playlists/{a.playlist['id']}"),
        ]
        for r in attempts:
            assert r.status_code == 404, (r.request.method, r.request.url, r.status_code, r.text)
            assert "A-secret" not in r.text

    def test_cannot_target_other_orgs_users(self, orgs):
        a, b = orgs
        victim = a.emp_user["id"]
        before = a.emp.get(f"{API}/auth/me").json()["points"]
        attempts = [
            b.emp.post(f"{API}/shoutouts", json={"recipient_ids": [victim], "category": "Teamwork", "message": "x"}),
            b.admin.post(f"{API}/admin/points/award", json={"user_id": victim, "points": 999, "reason": "x"}),
            b.admin.post(f"{API}/admin/rewards", json={"user_id": victim, "type": "points", "points": 50, "message": "x"}),
            b.admin.patch(f"{API}/admin/users/{victim}", json={"status": "deactivated"}),
            b.admin.delete(f"{API}/admin/users/{victim}"),
            b.admin.post(f"{API}/admin/announcements", json={"title": "x", "message": "x", "target": "some", "target_user_ids": [victim]}),
        ]
        for r in attempts:
            assert r.status_code == 404, (r.request.url, r.status_code, r.text)
        team = b.admin.post(f"{API}/admin/game-teams", json={"name": "B-team"}).json()
        r = b.admin.put(f"{API}/admin/game-teams/{team['id']}/members", json={"user_ids": [victim]})
        assert r.status_code == 404
        assert a.emp.get(f"{API}/auth/me").json()["points"] == before

    def test_announcement_to_all_stays_in_org(self, orgs):
        a, b = orgs
        b.admin.post(f"{API}/admin/announcements", json={"title": "B-only notice", "message": "hi"})
        assert "B-only notice" not in a.emp.get(f"{API}/notifications/me").text

    def test_config_changes_stay_in_org(self, orgs):
        a, b = orgs
        before = a.admin.get(f"{API}/admin/game-config").json()["level_threshold"]
        b.admin.put(f"{API}/admin/game-config", json={"level_threshold": before + 777})
        assert a.admin.get(f"{API}/admin/game-config").json()["level_threshold"] == before


# ---------- Account access ----------
class TestAccountAccess:
    def test_deactivated_users_token_stops_working(self, orgs):
        a, _ = orgs
        emp = _invite_employee(a.admin, "Soon Deactivated")
        s = _s(emp["token"])
        assert s.get(f"{API}/auth/me").status_code == 200
        assert a.admin.patch(f"{API}/admin/users/{emp['user']['id']}", json={"status": "deactivated"}).status_code == 200
        assert s.get(f"{API}/auth/me").status_code == 401

    def test_seed_endpoint_requires_admin(self, orgs):
        _, b = orgs
        assert _s().post(f"{API}/seed").status_code == 401
        assert b.emp.post(f"{API}/seed").status_code == 403
