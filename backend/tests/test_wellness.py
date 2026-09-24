"""Wellness backend - water, eye break, move & reset, breathing, rewards/XP,
activity log, streaks, dashboard, weekly insights, settings and notifications
(MyWellness backend requirements, sections 3-13), plus the game-team battles
and learning-bite interaction modes added on the current branch."""
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


def _session(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def user_session():
    """A throwaway employee in the seeded Demo Organization (so game-team/bounty fixtures
    that assume demo-org seed data still line up), with known-empty daily counters."""
    s = _session()
    s.post(f"{API}/seed", timeout=20)
    admin_r = s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert admin_r.status_code == 200, admin_r.text
    admin_token = admin_r.json()["token"]

    email = f"wellness_{uuid.uuid4().hex[:10]}@demo.com"
    inv = s.post(f"{API}/admin/invitations", json={"name": "Wellness Bot", "email": email},
                headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert inv.status_code == 200, inv.text
    r = s.post(f"{API}/auth/accept-invite",
               json={"token": inv.json()["token"], "password": "demo1234"}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    s.headers.update({"Authorization": f"Bearer {body['token']}"})
    s.user = body["user"]
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = _session()
    s.post(f"{API}/seed", timeout=20)
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


# ---------- User settings (section 13.2) ----------
class TestSettings:
    def test_defaults_then_update(self, user_session):
        r = user_session.get(f"{API}/settings", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["water"]["goal"] == 2000
        assert data["notifications"]["notifications_enabled"] is True

        r = user_session.put(f"{API}/settings",
                             json={"theme": "dark", "water": {"goal": 2500}}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["theme"] == "dark"
        assert r.json()["water"]["goal"] == 2500
        # untouched sections survive the partial update
        assert r.json()["eye_break"]["goal"] == 3

    def test_validation(self, user_session):
        assert user_session.put(f"{API}/settings", json={"theme": "neon"}, timeout=20).status_code == 400
        r = user_session.put(f"{API}/settings", json={"eye_break": {"schedule": ["25:00"]}}, timeout=20)
        assert r.status_code == 400

    def test_requires_auth(self):
        assert _session().get(f"{API}/settings", timeout=20).status_code == 401


# ---------- 3. Water ----------
class TestWater:
    def test_goal_and_drink_flow(self, user_session):
        r = user_session.put(f"{API}/water/goal", json={"goal": 1000}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["goal"] == 1000

        assert user_session.put(f"{API}/water/goal", json={"goal": 10}, timeout=20).status_code == 400
        assert user_session.post(f"{API}/water/drink", json={"amount": 0}, timeout=20).status_code == 400

        r = user_session.post(f"{API}/water/drink", json={"amount": 400}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["consumed"] == 400 and data["progress"] == 40.0
        assert data["completed"] is False and data["goal_bonus"] is None

    def test_goal_completion_rewards_once(self, user_session):
        r = user_session.post(f"{API}/water/drink", json={"amount": 700}, timeout=20)
        data = r.json()
        assert data["completed"] is True and data["rewarded"] is True
        assert data["goal_bonus"]["awarded"] is True
        assert data["goal_bonus"]["xp"] > 0

        # Drinking more must not hand out the daily bonus a second time.
        again = user_session.post(f"{API}/water/drink", json={"amount": 100}, timeout=20).json()
        assert again["goal_bonus"] is None

    def test_today_and_history(self, user_session):
        today = user_session.get(f"{API}/water/today", timeout=20).json()
        assert today["consumed"] == 1200 and today["completed"] is True

        hist = user_session.get(f"{API}/water/history?days=7", timeout=20).json()
        assert hist["goals_completed"] == 1
        assert hist["items"] and hist["items"][0]["date"] == today["date"]

    def test_reset(self, user_session):
        r = user_session.post(f"{API}/water/reset", json={}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["consumed"] == 0 and data["completed"] is False and data["rewarded"] is False
        assert data["entries"] == []


# ---------- 4. Eye break ----------
class TestEyeBreak:
    def test_goal_and_schedule(self, user_session):
        assert user_session.put(f"{API}/eye-break/goal", json={"goal": 2}, timeout=20).status_code == 200
        r = user_session.put(f"{API}/eye-break/schedule",
                             json={"schedule": ["13:00", "10:00", "10:00"]}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["schedule"] == ["10:00", "13:00"]   # de-duplicated + sorted
        assert user_session.put(f"{API}/eye-break/schedule",
                                json={"schedule": ["9:5"]}, timeout=20).status_code == 400

    def test_slot_counted_once(self, user_session):
        first = user_session.post(f"{API}/eye-break/complete",
                                  json={"slot": "10:00", "duration": 20}, timeout=20).json()
        assert first["completed"] == 1 and first["already_completed"] is False

        dup = user_session.post(f"{API}/eye-break/complete", json={"slot": "10:00"}, timeout=20).json()
        assert dup["already_completed"] is True and dup["completed"] == 1

    def test_goal_reached_awards_bonus(self, user_session):
        second = user_session.post(f"{API}/eye-break/complete", json={"slot": "13:00"}, timeout=20).json()
        assert second["completed"] == 2 and second["goal_reached"] is True
        assert second["goal_bonus"]["awarded"] is True

        hist = user_session.get(f"{API}/eye-break/history?days=7", timeout=20).json()
        assert hist["goals_completed"] == 1 and hist["total_breaks"] == 2


# ---------- 5. Move & Reset ----------
class TestMoveReset:
    def test_activity_catalogue(self, user_session):
        items = user_session.get(f"{API}/move-reset/activities", timeout=20).json()
        ids = {i["id"] for i in items}
        assert {"neck", "shoulder", "hands", "walking"} <= ids

    def test_complete_flow(self, user_session):
        assert user_session.put(f"{API}/move-reset/goal", json={"goal": 2}, timeout=20).status_code == 200
        assert user_session.post(f"{API}/move-reset/complete",
                                 json={"activity": "yoga"}, timeout=20).status_code == 400

        first = user_session.post(f"{API}/move-reset/complete",
                                  json={"activity": "neck", "slot": "10:30", "duration": 60}, timeout=20).json()
        assert first["completed"] == 1
        assert first["completed_activities"][0]["activity"] == "neck"

        dup = user_session.post(f"{API}/move-reset/complete",
                                json={"activity": "neck", "slot": "10:30"}, timeout=20).json()
        assert dup["already_completed"] is True

        second = user_session.post(f"{API}/move-reset/complete",
                                   json={"activity": "walking"}, timeout=20).json()
        assert second["completed"] == 2 and second["goal_bonus"]["awarded"] is True


# ---------- 6. Breathing ----------
class TestBreathing:
    def test_sessions_and_duration(self, user_session):
        assert user_session.put(f"{API}/breathing/goal", json={"goal": 2}, timeout=20).status_code == 200
        assert user_session.post(f"{API}/breathing/session",
                                 json={"duration": 99999}, timeout=20).status_code == 400

        user_session.post(f"{API}/breathing/session", json={"duration": 60}, timeout=20)
        second = user_session.post(f"{API}/breathing/session", json={"duration": 90}, timeout=20).json()
        assert second["completed"] == 2 and second["total_duration"] == 150
        assert second["goal_bonus"]["awarded"] is True
        assert second["sessions"][0]["duration"] == 60

        hist = user_session.get(f"{API}/breathing/history?days=7", timeout=20).json()
        assert hist["total_duration"] == 150


# ---------- 7. Rewards / XP ----------
class TestRewards:
    def test_summary(self, user_session):
        data = user_session.get(f"{API}/rewards", timeout=20).json()
        assert data["xp"] > 0 and data["level"] >= 1 and data["coins"] > 0
        assert data["xp_into_level"] + data["xp_to_next_level"] == data["level_threshold"]

    def test_history(self, user_session):
        data = user_session.get(f"{API}/rewards/history", timeout=20).json()
        sources = {i["type"] for i in data["items"]}
        assert {"water_goal", "eye_break_goal", "move_reset_goal", "breathing_goal"} <= sources

    def test_claim_is_revalidated_server_side(self, user_session):
        assert user_session.post(f"{API}/rewards/claim",
                                 json={"source": "nope"}, timeout=20).status_code == 400
        # water was reset above, so its goal is no longer met
        assert user_session.post(f"{API}/rewards/claim",
                                 json={"source": "water_goal"}, timeout=20).status_code == 400
        # eye break goal is met but already rewarded
        assert user_session.post(f"{API}/rewards/claim",
                                 json={"source": "eye_break_goal"}, timeout=20).status_code == 409

    def test_existing_admin_rewards_untouched(self, user_session):
        """XP transactions must not leak into the admin-issued rewards inbox."""
        r = user_session.get(f"{API}/rewards/me", timeout=20)
        assert r.status_code == 200
        assert all("dedupe_key" not in item for item in r.json())


# ---------- 8. Activity log ----------
class TestActivityLog:
    def test_feed_and_history(self, user_session):
        feed = user_session.get(f"{API}/activities/feed?limit=5", timeout=20).json()
        assert isinstance(feed, list) and feed
        assert {"type", "category", "action", "xp_earned"} <= set(feed[0])

        hist = user_session.get(f"{API}/activities/history?days=7", timeout=20).json()
        assert hist["total"] > 0
        assert {"WATER", "EYE_BREAK", "MOVE_RESET", "BREATHING"} <= set(hist["by_category"])
        assert hist["xp_earned"] > 0

    def test_filter_by_category(self, user_session):
        hist = user_session.get(f"{API}/activities/history?days=7&category=WATER", timeout=20).json()
        assert set(hist["by_category"]) == {"WATER"}


# ---------- 11. Streaks ----------
class TestStreaks:
    def test_streak_from_activity_records(self, user_session):
        data = user_session.get(f"{API}/streaks", timeout=20).json()
        assert data["current_streak"] == 1
        assert data["longest_streak"] >= 1
        assert data["active_today"] is True
        assert data["total_active_days"] == 1


# ---------- 9. Dashboard ----------
class TestDashboard:
    def test_combined_summary(self, user_session):
        data = user_session.get(f"{API}/dashboard", timeout=20).json()
        for key in ("water", "eye_break", "move_reset", "breathing"):
            assert {"completed", "goal", "progress"} <= set(data[key]) or key == "water"
        assert data["water"]["goal"] > 0
        assert data["eye_break"]["completed"] == 2
        assert data["breathing"]["goal"] == 2
        assert data["xp"] > 0 and data["level"] >= 1
        assert data["modules_total"] == 4
        assert data["modules_completed"] == 3      # water was reset
        assert data["activities_today"] > 0


# ---------- 10. Weekly insights ----------
class TestWeeklyInsights:
    def test_new_metrics_without_breaking_old_shape(self, user_session):
        data = user_session.get(f"{API}/insights/weekly", timeout=20).json()
        # legacy keys the WeeklyInsightsCard renders
        assert "change_pct" in data["water"] and "change_pct" in data["eye_care"]
        assert "points_earned" in data and "top_mood" in data and "message" in data
        # new aggregation from the doc
        assert data["week"].startswith("20") and "-W" in data["week"]
        assert data["eye_breaks_completed"] == 2
        assert data["breathing_sessions"] == 2
        assert data["move_reset_completed"] == 2
        assert data["total_activities"] > 0
        assert data["current_streak"] == 1
        assert data["best_day"]


# ---------- 12. Notifications ----------
class TestNotifications:
    def test_settings_roundtrip(self, user_session):
        data = user_session.get(f"{API}/notifications/settings", timeout=20).json()
        assert data["notifications_enabled"] is True

        updated = user_session.put(f"{API}/notifications/settings",
                                   json={"water": False}, timeout=20).json()
        assert updated["water"] is False and updated["eye_care"] is True
        assert user_session.put(f"{API}/notifications/settings", json={}, timeout=20).status_code == 400

    def test_device_registration(self, user_session):
        token = f"tok-{uuid.uuid4().hex}"
        r = user_session.post(f"{API}/notifications/register-device",
                              json={"token": token, "platform": "web"}, timeout=20)
        assert r.status_code == 200, r.text
        device = r.json()
        assert device["active"] is True and device["provider"] == "webpush"

        # re-registering the same token updates instead of duplicating
        again = user_session.post(f"{API}/notifications/register-device",
                                  json={"token": token, "platform": "web"}, timeout=20).json()
        assert again["id"] == device["id"]
        assert len(user_session.get(f"{API}/notifications/devices", timeout=20).json()) == 1

        assert user_session.post(f"{API}/notifications/register-device",
                                 json={"token": "x", "platform": "fridge"}, timeout=20).status_code == 400

        assert user_session.delete(f"{API}/notifications/devices/{device['id']}", timeout=20).status_code == 200
        assert user_session.delete(f"{API}/notifications/devices/nope", timeout=20).status_code == 404

    def test_schedule_respects_disabled_types(self, user_session):
        data = user_session.get(f"{API}/notifications/schedule", timeout=20).json()
        types = {e["type"] for e in data["events"]}
        assert "water" not in types          # disabled in test_settings_roundtrip
        assert "eye_care" in types

    def test_history_endpoints(self, user_session):
        listing = user_session.get(f"{API}/notifications", timeout=20).json()
        assert {"items", "count", "unread"} <= set(listing)
        history = user_session.get(f"{API}/notifications/history?days=7", timeout=20).json()
        assert {"items", "total", "by_status"} <= set(history)

    def test_dispatch_is_admin_only(self, user_session, admin_session):
        assert user_session.post(f"{API}/notifications/dispatch", timeout=20).status_code == 403
        r = admin_session.post(f"{API}/notifications/dispatch?window_minutes=5", timeout=30)
        assert r.status_code == 200, r.text
        assert "dispatched" in r.json()


# ---------- Learning bites (current branch) ----------
class TestLearningBites:
    def test_quiz_payload_present(self, user_session):
        bites = user_session.get(f"{API}/learning-bites?department=Engineering", timeout=20).json()
        assert bites
        for b in bites:
            assert isinstance(b["options"], list) and len(b["options"]) >= 2
            assert 0 <= b["correct_index"] < len(b["options"])
            assert b["resource_url"].startswith("http")

    def test_modes_and_dedupe(self, user_session):
        first = user_session.post(f"{API}/learning-bites/lb1/tried",
                                  json={"mode": "quiz"}, timeout=20).json()
        assert first["awarded"] > 0 and first["mode"] == "quiz"

        again = user_session.post(f"{API}/learning-bites/lb1/tried",
                                  json={"mode": "quiz"}, timeout=20).json()
        assert again["already"] is True

        assert user_session.post(f"{API}/learning-bites/lb2/tried",
                                 json={"mode": "reflect", "meta": "  "}, timeout=20).status_code == 400
        assert user_session.post(f"{API}/learning-bites/lb2/tried",
                                 json={"mode": "telepathy"}, timeout=20).status_code == 400
        assert user_session.post(f"{API}/learning-bites/nope/tried",
                                 json={}, timeout=20).status_code == 404

        ok = user_session.post(f"{API}/learning-bites/lb2/tried",
                               json={"mode": "reflect", "meta": "useful"}, timeout=20)
        assert ok.status_code == 200


# ---------- Game teams: bounties, challenges, occasion shuffle (current branch) ----------
class TestGameTeamBattles:
    def test_shuffle_requires_admin(self, user_session):
        assert user_session.post(f"{API}/game-teams/shuffle",
                                 json={"theme": "Nope"}, timeout=20).status_code == 403

    def test_occasion_shuffle(self, admin_session, user_session):
        r = admin_session.post(f"{API}/game-teams/shuffle",
                               json={"theme": "Fun Friday Shuffle"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["theme"] == "Fun Friday Shuffle"
        assert len(r.json()["teams"]) == 4

        teams = user_session.get(f"{API}/game-teams", timeout=20).json()
        assert any(user_session.user["id"] in (t.get("members") or []) for t in teams)

    def test_bounty_claim(self, user_session, admin_session):
        teams = user_session.get(f"{API}/game-teams", timeout=20).json()
        mine = next(t for t in teams if user_session.user["id"] in (t.get("members") or []))
        other = next(t for t in teams if t["id"] != mine["id"])

        # Earlier runs claim the seeded bounties in this persistent DB; bring our own.
        created = admin_session.post(f"{API}/admin/game-teams/bounties",
                                     json={"title": f"TEST bounty {uuid.uuid4().hex[:6]}", "reward": 40}, timeout=20)
        assert created.status_code == 200, created.text
        bounties = user_session.get(f"{API}/game-teams/bounties", timeout=20).json()
        bounty = next(b for b in bounties if b["id"] == created.json()["id"])
        assert bounty["status"] == "OPEN"

        claimed = user_session.post(f"{API}/game-teams/bounties/{bounty['id']}/claim",
                                    json={"team_id": mine["id"]}, timeout=20)
        assert claimed.status_code == 200, claimed.text
        assert claimed.json()["status"] == "CLAIMED"

        # already claimed, and you cannot claim for a team you are not on
        assert user_session.post(f"{API}/game-teams/bounties/{bounty['id']}/claim",
                                 json={"team_id": mine["id"]}, timeout=20).status_code == 409
        second = admin_session.post(f"{API}/admin/game-teams/bounties",
                                    json={"title": f"TEST bounty {uuid.uuid4().hex[:6]}", "reward": 10}, timeout=20).json()
        assert user_session.post(f"{API}/game-teams/bounties/{second['id']}/claim",
                                 json={"team_id": other["id"]}, timeout=20).status_code == 403

        after = user_session.get(f"{API}/game-teams", timeout=20).json()
        mine_after = next(t for t in after if t["id"] == mine["id"])
        assert mine_after["team_points"] == mine["team_points"] + bounty["reward"]

    def test_challenge_lifecycle(self, user_session, admin_session):
        teams = user_session.get(f"{API}/game-teams", timeout=20).json()
        mine = next(t for t in teams if user_session.user["id"] in (t.get("members") or []))
        other = next(t for t in teams if t["id"] != mine["id"])

        payload = {"challenger_team_id": mine["id"], "target_team_id": other["id"], "wager": 50}
        r = user_session.post(f"{API}/game-teams/challenge", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        challenge = r.json()
        assert challenge["status"] == "PENDING" and challenge["wager"] == 50

        assert user_session.post(f"{API}/game-teams/challenge", json=payload, timeout=20).status_code == 409
        assert user_session.post(f"{API}/game-teams/challenge",
                                 json={**payload, "target_team_id": mine["id"]}, timeout=20).status_code == 400
        assert user_session.post(f"{API}/game-teams/challenge",
                                 json={**payload, "wager": 5000}, timeout=20).status_code == 400
        assert user_session.post(f"{API}/game-teams/challenge",
                                 json={"challenger_team_id": other["id"],
                                       "target_team_id": mine["id"], "wager": 50},
                                 timeout=20).status_code == 403

        resolved = admin_session.post(
            f"{API}/admin/game-teams/challenges/{challenge['id']}/resolve",
            json={"winner_team_id": mine["id"]}, timeout=20)
        assert resolved.status_code == 200, resolved.text
        assert resolved.json()["status"] == "RESOLVED"
        assert admin_session.post(
            f"{API}/admin/game-teams/challenges/{challenge['id']}/resolve",
            json={"winner_team_id": mine["id"]}, timeout=20).status_code == 409


# ---------- Error envelope ----------
class TestErrorEnvelope:
    def test_detail_and_message(self, user_session):
        r = user_session.post(f"{API}/water/drink", json={"amount": -1}, timeout=20)
        assert r.status_code == 400
        assert r.json()["detail"] == r.json()["message"]

    def test_validation_error_carries_message(self, user_session):
        r = user_session.post(f"{API}/water/drink", json={}, timeout=20)
        assert r.status_code == 422
        assert "amount" in r.json()["message"]
