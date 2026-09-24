"""Chunk 5 - Admin platform control: points config, game config, manual award/audit,
custom quizzes CRUD, announcements (push), game teams (CRUD + members + shuffle)."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / 'frontend' / '.env')
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@demo.com", "password": "demo1234"}
EMP = {"email": "alex@demo.com", "password": "demo1234"}


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # ensure seed
    s.post(f"{API}/seed", timeout=20)
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def emp_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json=EMP, timeout=20)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    user = r.json()["user"]
    s.headers.update({"Authorization": f"Bearer {token}"})
    s.user = user
    return s


# ---------- Points Config + Game Config ----------
class TestConfigs:
    def test_get_points_config(self, admin_session):
        r = admin_session.get(f"{API}/admin/points-config")
        assert r.status_code == 200
        data = r.json()
        for k in ["water", "eye_care", "stand", "breathing", "mood", "post",
                  "quiz_per_correct", "quiz_perfect_bonus"]:
            assert k in data, f"missing key {k}"

    def test_put_points_config_and_activity_uses_it(self, admin_session, emp_session):
        # Set water = 50
        r = admin_session.put(f"{API}/admin/points-config", json={"water": 50})
        assert r.status_code == 200
        assert r.json()["water"] == 50
        # A fresh employee (the shared demo one may already be at today's per-ritual cap)
        inv = admin_session.post(f"{API}/admin/invitations",
                                 json={"email": f"cfg_{uuid.uuid4().hex[:8]}@example.com", "name": "Cfg Tester"}).json()
        tok = requests.post(f"{API}/auth/accept-invite", json={"token": inv["token"], "password": "demo1234"}).json()["token"]
        r2 = requests.post(f"{API}/activities", json={"type": "water"}, headers={"Authorization": f"Bearer {tok}"})
        assert r2.status_code == 200, r2.text
        assert r2.json()["activity"]["points"] == 50, r2.json()
        # Reset to 10
        admin_session.put(f"{API}/admin/points-config", json={"water": 10})

    def test_get_game_config(self, admin_session):
        r = admin_session.get(f"{API}/admin/game-config")
        assert r.status_code == 200
        data = r.json()
        assert "level_threshold" in data
        assert "streak_gap_hours" in data
        assert "wellness_score_increment" in data

    def test_put_game_config(self, admin_session):
        r = admin_session.put(f"{API}/admin/game-config",
                              json={"level_threshold": 250, "wellness_score_increment": 3})
        assert r.status_code == 200
        d = r.json()
        assert d["level_threshold"] == 250
        assert d["wellness_score_increment"] == 3
        # reset
        admin_session.put(f"{API}/admin/game-config", json={"level_threshold": 200, "wellness_score_increment": 2})

    def test_non_admin_cannot_access(self, emp_session):
        r = emp_session.get(f"{API}/admin/points-config")
        assert r.status_code == 403


# ---------- Manual Points Award + Audit Log ----------
class TestPointsAward:
    def test_award_to_user_and_log(self, admin_session, emp_session):
        uid = emp_session.user["id"]
        # current points
        r0 = admin_session.get(f"{API}/auth/me")
        before = admin_session.get(f"{API}/leaderboard").json()
        before_pts = next((u["points"] for u in before if u["id"] == uid), 0)

        payload = {"user_id": uid, "points": 25, "reason": "TEST_award_user"}
        r = admin_session.post(f"{API}/admin/points/award", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["points"] == 25
        assert data["reason"] == "TEST_award_user"

        # Verify points incremented
        after = admin_session.get(f"{API}/leaderboard").json()
        after_pts = next((u["points"] for u in after if u["id"] == uid), 0)
        assert after_pts >= before_pts + 25

        # Verify in log
        log = admin_session.get(f"{API}/admin/points/log").json()
        assert any(l.get("reason") == "TEST_award_user" for l in log)

    def test_award_to_team(self, admin_session):
        # create a team first
        rt = admin_session.post(f"{API}/admin/game-teams", json={"name": "TEST_AwardTeam", "color": "pink"})
        assert rt.status_code == 200
        tid = rt.json()["id"]
        r = admin_session.post(f"{API}/admin/points/award",
                               json={"team_id": tid, "points": 100, "reason": "TEST_team_award"})
        assert r.status_code == 200
        # verify team_points
        teams = admin_session.get(f"{API}/admin/game-teams").json()
        team = next((t for t in teams if t["id"] == tid), None)
        assert team is not None
        assert team["team_points"] == 100
        # cleanup
        admin_session.delete(f"{API}/admin/game-teams/{tid}")

    def test_award_requires_id(self, admin_session):
        r = admin_session.post(f"{API}/admin/points/award",
                               json={"points": 10, "reason": "no id"})
        assert r.status_code == 400


# ---------- Quizzes CRUD ----------
class TestQuizzes:
    quiz_id = None

    def test_create_quiz(self, admin_session):
        payload = {
            "department": "TESTDEPT",
            "title": "TEST_Quiz",
            "questions": [
                {"q": "1+1?", "options": ["1", "2", "3"], "answer": 1},
                {"q": "Color of sky?", "options": ["red", "blue"], "answer": 1},
            ],
        }
        r = admin_session.post(f"{API}/admin/quizzes", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["department"] == "TESTDEPT"
        assert len(data["questions"]) == 2
        TestQuizzes.quiz_id = data["id"]

    def test_list_quizzes(self, admin_session):
        r = admin_session.get(f"{API}/admin/quizzes")
        assert r.status_code == 200
        assert any(q["id"] == TestQuizzes.quiz_id for q in r.json())

    def test_custom_quiz_served(self, emp_session):
        r = emp_session.get(f"{API}/quizzes?department=TESTDEPT")
        assert r.status_code == 200
        d = r.json()
        assert d.get("custom") is True
        assert d["department"] == "TESTDEPT"
        assert len(d["questions"]) == 2
        # Should NOT include answer field
        assert "answer" not in d["questions"][0]

    def test_fallback_to_hardcoded(self, emp_session):
        r = emp_session.get(f"{API}/quizzes?department=Engineering")
        assert r.status_code == 200
        d = r.json()
        # no custom quiz for Engineering = hardcoded fallback
        assert d.get("custom") is not True
        assert len(d["questions"]) >= 5

    def test_invalid_answer_rejected(self, admin_session):
        r = admin_session.post(f"{API}/admin/quizzes", json={
            "department": "Bad", "questions": [
                {"q": "x?", "options": ["a", "b"], "answer": 5}
            ]
        })
        assert r.status_code == 400

    def test_delete_quiz(self, admin_session):
        if not TestQuizzes.quiz_id:
            pytest.skip("no quiz id")
        r = admin_session.delete(f"{API}/admin/quizzes/{TestQuizzes.quiz_id}")
        assert r.status_code == 200
        # verify gone
        listing = admin_session.get(f"{API}/admin/quizzes").json()
        assert not any(q["id"] == TestQuizzes.quiz_id for q in listing)


# ---------- Announcements ----------
class TestAnnouncements:
    ann_id_all = None
    ann_id_specific = None

    def test_create_all(self, admin_session):
        r = admin_session.post(f"{API}/admin/announcements", json={
            "title": "TEST_AnnAll",
            "message": "Hello team",
            "target": "all",
            "kind": "info",
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == "TEST_AnnAll"
        assert len(d["recipients"]) >= 1
        TestAnnouncements.ann_id_all = d["id"]

    def test_create_specific(self, admin_session, emp_session):
        uid = emp_session.user["id"]
        r = admin_session.post(f"{API}/admin/announcements", json={
            "title": "TEST_AnnSpecific",
            "message": "Just for alex",
            "target": "specific",
            "target_user_ids": [uid],
        })
        assert r.status_code == 200
        d = r.json()
        assert d["recipients"] == [uid]
        TestAnnouncements.ann_id_specific = d["id"]

    def test_my_announcements(self, emp_session):
        r = emp_session.get(f"{API}/announcements/me")
        assert r.status_code == 200
        items = r.json()
        # Should include both
        ids = [a["id"] for a in items]
        assert TestAnnouncements.ann_id_all in ids
        assert TestAnnouncements.ann_id_specific in ids
        # unread flag
        a_specific = next(a for a in items if a["id"] == TestAnnouncements.ann_id_specific)
        assert a_specific["unread"] is True

    def test_mark_read(self, emp_session):
        aid = TestAnnouncements.ann_id_specific
        r = emp_session.post(f"{API}/announcements/{aid}/read")
        assert r.status_code == 200
        # verify unread now false
        items = emp_session.get(f"{API}/announcements/me").json()
        a = next(a for a in items if a["id"] == aid)
        assert a["unread"] is False
        # idempotent
        r2 = emp_session.post(f"{API}/announcements/{aid}/read")
        assert r2.status_code == 200


# ---------- Game Teams ----------
class TestGameTeams:
    team_id = None

    def test_create_team(self, admin_session):
        r = admin_session.post(f"{API}/admin/game-teams",
                               json={"name": "TEST_Red", "color": "pink"})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Red"
        assert d["color"] == "pink"
        assert d["team_points"] == 0
        TestGameTeams.team_id = d["id"]

    def test_list_admin(self, admin_session):
        r = admin_session.get(f"{API}/admin/game-teams")
        assert r.status_code == 200
        items = r.json()
        team = next((t for t in items if t["id"] == TestGameTeams.team_id), None)
        assert team is not None
        assert "member_details" in team

    def test_list_public(self, emp_session):
        r = emp_session.get(f"{API}/game-teams")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)

    def test_patch_team(self, admin_session):
        r = admin_session.patch(f"{API}/admin/game-teams/{TestGameTeams.team_id}",
                                json={"name": "TEST_Red2", "color": "yellow"})
        assert r.status_code == 200
        # verify
        items = admin_session.get(f"{API}/admin/game-teams").json()
        t = next(t for t in items if t["id"] == TestGameTeams.team_id)
        assert t["name"] == "TEST_Red2"
        assert t["color"] == "yellow"

    def test_set_members_one_team_per_user(self, admin_session, emp_session):
        uid = emp_session.user["id"]
        # create second team
        r2 = admin_session.post(f"{API}/admin/game-teams",
                                json={"name": "TEST_Blue", "color": "cyan"})
        tid2 = r2.json()["id"]
        # set user on team1
        r = admin_session.put(f"{API}/admin/game-teams/{TestGameTeams.team_id}/members",
                              json={"user_ids": [uid]})
        assert r.status_code == 200
        assert uid in r.json()["members"]
        # set same user on team2 - should remove from team1
        r = admin_session.put(f"{API}/admin/game-teams/{tid2}/members",
                              json={"user_ids": [uid]})
        assert r.status_code == 200
        # check team1 no longer has user
        items = admin_session.get(f"{API}/admin/game-teams").json()
        t1 = next(t for t in items if t["id"] == TestGameTeams.team_id)
        assert uid not in t1.get("members", [])
        t2 = next(t for t in items if t["id"] == tid2)
        assert uid in t2.get("members", [])
        # cleanup
        admin_session.delete(f"{API}/admin/game-teams/{tid2}")

    def test_delete_team(self, admin_session):
        r = admin_session.delete(f"{API}/admin/game-teams/{TestGameTeams.team_id}")
        assert r.status_code == 200
        # verify
        items = admin_session.get(f"{API}/admin/game-teams").json()
        assert not any(t["id"] == TestGameTeams.team_id for t in items)

    def test_shuffle(self, admin_session):
        r = admin_session.post(f"{API}/admin/game-teams/shuffle",
                               json={"num_teams": 4})
        assert r.status_code == 200, r.text
        teams = r.json()
        assert len(teams) == 4
        # All members distributed
        total_members = sum(len(t.get("members", [])) for t in teams)
        assert total_members >= 6  # at least 6 demo users
        # Each team has a color
        for t in teams:
            assert t.get("color") in ["yellow", "cyan", "pink", "green"]
            assert t.get("auto_shuffled") is True
        # Re-shuffle deletes previous auto teams
        r2 = admin_session.post(f"{API}/admin/game-teams/shuffle", json={"num_teams": 3})
        teams2 = r2.json()
        assert len(teams2) == 3
        all_teams = admin_session.get(f"{API}/admin/game-teams").json()
        auto_count = sum(1 for t in all_teams if t.get("auto_shuffled"))
        assert auto_count == 3
