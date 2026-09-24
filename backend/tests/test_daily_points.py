"""BUG-01 / QA #6: daily points start at 0 each business day; history is kept;
brand-new accounts start at 0."""
import os
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "frontend" / ".env")
load_dotenv(ROOT / "backend" / ".env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def _s(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(scope="module")
def fresh():
    reg = _s().post(f"{API}/auth/register", json={
        "org_name": f"Daily Org {uuid.uuid4().hex[:8]}", "name": "Daily Admin",
        "email": f"daily_{uuid.uuid4().hex[:8]}@example.com", "password": "pass1234",
    }).json()
    s = _s(reg["token"])
    s.user = reg["user"]
    return s


def test_new_account_starts_at_zero(fresh):
    me = fresh.get(f"{API}/auth/me").json()
    assert me["points"] == 0
    assert me["points_today"] == 0
    d = fresh.get(f"{API}/dashboard").json()
    assert d["points_today"] == 0
    assert d["modules_completed"] == 0


def test_today_counts_only_todays_points_and_keeps_history(fresh, db):
    tz = ZoneInfo(fresh.get(f"{API}/auth/me").json()["org_timezone"])
    yesterday = (datetime.now(tz) - timedelta(days=1)).date().isoformat()
    # Simulate "earned 40 points yesterday"
    db.daily_points.insert_one({"user_id": fresh.user["id"], "date": yesterday, "points": 40, "org_id": fresh.user["org_id"]})
    db.users.update_one({"id": fresh.user["id"]}, {"$inc": {"points": 40}})

    t = fresh.get(f"{API}/points/today").json()
    assert t["points_today"] == 0          # new day starts at 0
    assert t["total_points"] == 40         # cumulative kept

    r = fresh.post(f"{API}/activities", json={"type": "water"})
    assert r.status_code == 200
    earned = r.json()["activity"]["points"]
    assert earned > 0
    t = fresh.get(f"{API}/points/today").json()
    assert t["points_today"] == earned
    assert t["total_points"] == 40 + earned

    hist = {row["date"]: row["points"] for row in fresh.get(f"{API}/points/history").json()["items"]}
    assert hist[yesterday] == 40
    assert hist[t["date"]] == earned


def test_org_timezone_is_the_day_boundary(fresh):
    r = fresh.put(f"{API}/admin/organization", json={"timezone": "Pacific/Kiritimati"})  # UTC+14
    assert r.status_code == 200
    expected = datetime.now(ZoneInfo("Pacific/Kiritimati")).date().isoformat()
    assert fresh.get(f"{API}/points/today").json()["date"] == expected
    assert fresh.put(f"{API}/admin/organization", json={"timezone": "Not/AZone"}).status_code == 400


def test_writes_ignore_client_dates(fresh):
    r = fresh.post(f"{API}/water/drink", json={"amount": 250, "date": "2001-01-01"})
    assert r.status_code == 200
    assert r.json()["date"] == fresh.get(f"{API}/points/today").json()["date"]
