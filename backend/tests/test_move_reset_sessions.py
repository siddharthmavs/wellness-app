"""Move & Reset guided sessions: server-owned timing, pause/resume, checkpoints and a
single idempotent points award. Elapsed exercise time is simulated by moving the
session's `running_since` back in Mongo instead of sleeping."""
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "frontend" / ".env")
load_dotenv(ROOT / "backend" / ".env")
API = f"{os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')}/api"


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture()
def user():
    reg = requests.post(f"{API}/auth/register", json={
        "org_name": f"Move Org {uuid.uuid4().hex[:8]}", "name": "Mover",
        "email": f"mover_{uuid.uuid4().hex[:8]}@example.com", "password": "pass1234",
    }).json()
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {reg['token']}", "Content-Type": "application/json"})
    return s


def elapse(db, sid, seconds):
    """Pretend the current exercise has been running (visibly) for `seconds`."""
    back = datetime.now(timezone.utc) - timedelta(seconds=seconds)
    db.move_reset_sessions.update_one({"id": sid}, {"$set": {"running_since": back.isoformat()}})


def event(s, sid, kind, index=None):
    return s.post(f"{API}/move-reset/sessions/{sid}/events", json={"type": kind, "index": index})


def run_to_end(s, db, session):
    sid = session["id"]
    for i, ex in enumerate(session["exercises"]):
        elapse(db, sid, ex["seconds"] + 1)
        if i < len(session["exercises"]) - 1:
            nxt = session["exercises"][i + 1]
            r = event(s, sid, "checkpoint" if nxt["checkpoint_before"] else "advance", i)
            assert r.status_code == 200, r.text
    return sid


def points(s):
    return s.get(f"{API}/points/today").json()["points_today"]


def test_start_returns_guided_plan(user):
    sess = user.post(f"{API}/move-reset/sessions").json()
    assert sess["status"] == "RUNNING" and sess["current_index"] == 0
    assert len(sess["exercises"]) == 5
    for ex in sess["exercises"]:
        assert ex["name"] and ex["instruction"] and ex["seconds"] > 0
    assert [e["checkpoint_before"] for e in sess["exercises"]].count(True) >= 1


def test_normal_completion_awards_once(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    sid = run_to_end(user, db, sess)
    before = points(user)
    done = user.post(f"{API}/move-reset/sessions/{sid}/complete")
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["already_completed"] is False and body["completed"] == 1 and body["xp_earned"] > 0
    after = points(user)
    assert after > before
    # replaying the completion (refresh / double click / network retry) awards nothing
    for _ in range(3):
        again = user.post(f"{API}/move-reset/sessions/{sid}/complete").json()
        assert again["already_completed"] is True and again["xp_earned"] == 0
    assert points(user) == after
    assert user.get(f"{API}/move-reset/today").json()["completed"] == 1


def test_cannot_advance_before_the_interval_is_done(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    elapse(db, sess["id"], 5)  # only 5s of a 20s stretch
    r = event(user, sess["id"], "advance", 0)
    assert r.status_code == 409 and "isn't finished" in r.json()["message"]


def test_hidden_time_does_not_count(user, db):
    """Switch tab mid-exercise: the client pauses; time while paused isn't credited."""
    sess = user.post(f"{API}/move-reset/sessions").json()
    sid = sess["id"]
    elapse(db, sid, 8)
    paused = event(user, sid, "pause", 0).json()
    assert paused["status"] == "PAUSED"
    counted = paused["active_seconds"][0]
    assert 7 <= counted <= 10
    # 20 "hidden" seconds pass while paused — simulated by an old running_since, which
    # must be ignored because the session isn't running
    elapse(db, sid, 20)
    view = event(user, sid, "resume", 0).json()
    assert view["status"] == "RUNNING"
    assert view["active_seconds"][0] == pytest.approx(counted, abs=1)
    assert event(user, sid, "advance", 0).status_code == 409  # still ~12s left


def test_checkpoint_cannot_be_bypassed_by_waiting(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    sid = sess["id"]
    elapse(db, sid, 25)
    assert event(user, sid, "advance", 0).status_code == 200
    elapse(db, sid, 25)
    # exercise 3 requires "Start Next Stretch"; a timer-driven advance is refused
    r = event(user, sid, "advance", 1)
    assert r.status_code == 409 and "Start Next Stretch" in r.json()["message"]
    assert event(user, sid, "checkpoint", 1).status_code == 200


def test_ending_early_awards_nothing(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    sid = sess["id"]
    elapse(db, sid, 25)
    event(user, sid, "advance", 0)
    before = points(user)
    assert event(user, sid, "end").json()["status"] == "ABANDONED"
    r = user.post(f"{API}/move-reset/sessions/{sid}/complete")
    assert r.status_code == 409
    assert points(user) == before
    assert user.get(f"{API}/move-reset/today").json()["completed"] == 0


def test_completing_early_is_rejected(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    r = user.post(f"{API}/move-reset/sessions/{sess['id']}/complete")
    assert r.status_code == 409
    assert user.get(f"{API}/move-reset/today").json()["completed"] == 0


def test_refresh_recovers_paused(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    elapse(db, sess["id"], 6)
    active = user.get(f"{API}/move-reset/sessions/active").json()
    assert active["id"] == sess["id"] and active["status"] == "PAUSED"
    assert active["remaining_seconds"] < sess["remaining_seconds"]


def test_expired_session_is_rejected(user, db):
    sess = user.post(f"{API}/move-reset/sessions").json()
    old = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    db.move_reset_sessions.update_one({"id": sess["id"]}, {"$set": {"expires_at": old}})
    assert event(user, sess["id"], "pause", 0).status_code == 409


def test_sessions_are_private_and_legacy_path_is_gone(user):
    sess = user.post(f"{API}/move-reset/sessions").json()
    other = requests.post(f"{API}/auth/register", json={
        "org_name": f"Other Org {uuid.uuid4().hex[:8]}", "name": "Other",
        "email": f"other_{uuid.uuid4().hex[:8]}@example.com", "password": "pass1234",
    }).json()
    h = {"Authorization": f"Bearer {other['token']}"}
    assert requests.post(f"{API}/move-reset/sessions/{sess['id']}/complete", headers=h).status_code == 404
    assert user.post(f"{API}/move-reset/complete", json={"activity": "neck", "duration": 999}).status_code == 410
