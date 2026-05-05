"""Backend tests for Chunk 4 (polish): mood productivity + rewards CRUD."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    d = r.json()
    return d["token"], d["user"]


@pytest.fixture(scope="session")
def admin_auth():
    t, u = _login("admin@demo.com", "demo1234")
    return {"headers": {"Authorization": f"Bearer {t}"}, "user": u, "token": t}


@pytest.fixture(scope="session")
def alex_auth():
    t, u = _login("alex@demo.com", "demo1234")
    return {"headers": {"Authorization": f"Bearer {t}"}, "user": u, "token": t}


@pytest.fixture(scope="session")
def jamie_auth():
    t, u = _login("jamie@demo.com", "demo1234")
    return {"headers": {"Authorization": f"Bearer {t}"}, "user": u, "token": t}


# -------- Mood productivity --------
class TestMoodProductivity:
    def test_log_mood_with_productivity(self, alex_auth):
        r = requests.post(
            f"{API}/mood",
            json={"emoji": "😎", "label": "Vibing", "note": "TEST_chunk4", "productivity": "High"},
            headers=alex_auth["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["productivity"] == "High"
        assert d["label"] == "Vibing"
        assert "id" in d

    def test_log_mood_without_productivity(self, alex_auth):
        # productivity is optional
        r = requests.post(
            f"{API}/mood",
            json={"emoji": "🙂", "label": "Okay", "note": "TEST_chunk4_no_prod"},
            headers=alex_auth["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("productivity") in (None, "")

    def test_get_mood_me_returns_productivity(self, alex_auth):
        # ensure at least one record contains productivity key
        r = requests.get(f"{API}/mood/me", headers=alex_auth["headers"], timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        latest = items[0]
        assert "productivity" in latest  # field surfaced
        # Confirm a previously-set High exists somewhere
        assert any(m.get("productivity") == "High" for m in items)


# -------- Rewards --------
class TestRewards:
    def test_admin_issue_points_reward_increments_user_points(self, admin_auth, alex_auth):
        # snapshot points before
        before = requests.get(f"{API}/auth/me", headers=alex_auth["headers"]).json()
        pts_before = before.get("points", 0)

        r = requests.post(
            f"{API}/admin/rewards",
            json={
                "user_id": alex_auth["user"]["id"],
                "type": "points",
                "points": 25,
                "message": "TEST_chunk4 great work",
            },
            headers=admin_auth["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        rew = r.json()
        assert rew["type"] == "points"
        assert rew["points"] == 25
        assert rew["user_id"] == alex_auth["user"]["id"]
        assert rew["claimed"] is False
        assert "id" in rew

        # verify user's points increased by 25
        after = requests.get(f"{API}/auth/me", headers=alex_auth["headers"]).json()
        assert after.get("points", 0) == pts_before + 25, (
            f"expected points to increase by 25 (was {pts_before}, now {after.get('points')})"
        )

    def test_admin_issue_coupon_reward(self, admin_auth, jamie_auth):
        r = requests.post(
            f"{API}/admin/rewards",
            json={
                "user_id": jamie_auth["user"]["id"],
                "type": "coupon",
                "message": "TEST_chunk4 free coffee",
                "code": "BREW20",
            },
            headers=admin_auth["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["type"] == "coupon"
        assert d["code"] == "BREW20"

    def test_admin_issue_shoutout_reward(self, admin_auth, jamie_auth):
        r = requests.post(
            f"{API}/admin/rewards",
            json={
                "user_id": jamie_auth["user"]["id"],
                "type": "shoutout",
                "message": "TEST_chunk4 you the best",
            },
            headers=admin_auth["headers"], timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["type"] == "shoutout"

    def test_invalid_reward_type_rejected(self, admin_auth, alex_auth):
        r = requests.post(
            f"{API}/admin/rewards",
            json={"user_id": alex_auth["user"]["id"], "type": "bogus", "message": "x"},
            headers=admin_auth["headers"], timeout=15,
        )
        assert r.status_code in (400, 422)

    def test_reward_to_unknown_user_404(self, admin_auth):
        r = requests.post(
            f"{API}/admin/rewards",
            json={"user_id": "non-existent-uuid", "type": "shoutout", "message": "x"},
            headers=admin_auth["headers"], timeout=15,
        )
        assert r.status_code == 404

    def test_non_admin_cannot_issue_reward(self, alex_auth, jamie_auth):
        r = requests.post(
            f"{API}/admin/rewards",
            json={"user_id": jamie_auth["user"]["id"], "type": "shoutout", "message": "x"},
            headers=alex_auth["headers"], timeout=15,
        )
        assert r.status_code == 403

    def test_admin_list_all_rewards(self, admin_auth):
        r = requests.get(f"{API}/admin/rewards", headers=admin_auth["headers"], timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1

    def test_non_admin_cannot_list_all_rewards(self, alex_auth):
        r = requests.get(f"{API}/admin/rewards", headers=alex_auth["headers"], timeout=15)
        assert r.status_code == 403

    def test_my_rewards(self, alex_auth):
        r = requests.get(f"{API}/rewards/me", headers=alex_auth["headers"], timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        # must be alex's
        for it in items:
            assert it["user_id"] == alex_auth["user"]["id"]

    def test_claim_reward_flow(self, admin_auth, alex_auth):
        # issue a fresh shoutout reward for alex
        issued = requests.post(
            f"{API}/admin/rewards",
            json={"user_id": alex_auth["user"]["id"], "type": "shoutout", "message": "TEST_chunk4 claimable"},
            headers=admin_auth["headers"], timeout=15,
        ).json()
        rid = issued["id"]
        assert issued["claimed"] is False

        # alex claims
        c = requests.post(f"{API}/rewards/{rid}/claim", headers=alex_auth["headers"], timeout=15)
        assert c.status_code == 200, c.text
        assert c.json().get("claimed") is True

        # verify persisted in /rewards/me
        me = requests.get(f"{API}/rewards/me", headers=alex_auth["headers"], timeout=15).json()
        match = next((x for x in me if x["id"] == rid), None)
        assert match is not None
        assert match["claimed"] is True

    def test_claim_other_users_reward_404(self, admin_auth, alex_auth, jamie_auth):
        # issue reward to jamie; alex tries to claim
        issued = requests.post(
            f"{API}/admin/rewards",
            json={"user_id": jamie_auth["user"]["id"], "type": "shoutout", "message": "TEST_chunk4 jamie-only"},
            headers=admin_auth["headers"], timeout=15,
        ).json()
        rid = issued["id"]
        r = requests.post(f"{API}/rewards/{rid}/claim", headers=alex_auth["headers"], timeout=15)
        assert r.status_code == 404

    def test_claim_unknown_reward_404(self, alex_auth):
        r = requests.post(f"{API}/rewards/non-existent/claim", headers=alex_auth["headers"], timeout=15)
        assert r.status_code == 404
