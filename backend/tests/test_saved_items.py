"""Saved facts & tips (QA #8): save / list / unsave, idempotent, per-user."""
import os
import uuid
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def _new_user():
    email = f"saver_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "org_name": f"Saver Org {uuid.uuid4().hex[:6]}", "name": "Sam Saver", "email": email, "password": "pass1234"})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def test_save_list_unsave_fact_and_tip():
    s, other = _new_user(), _new_user()
    fact = s.get(f"{API}/facts/today").json()
    tip = s.get(f"{API}/words/today").json()
    assert fact["saved"] is False and tip["saved"] is False
    assert tip["id"].startswith("word-")

    for _ in range(2):  # idempotent
        assert s.put(f"{API}/saved-items", json={"kind": "fact", "item_id": fact["id"]}).json() == {"saved": True}
    assert s.put(f"{API}/saved-items", json={"kind": "tip", "item_id": tip["id"]}).status_code == 200

    items = s.get(f"{API}/saved-items").json()
    assert sorted((i["kind"], i["item_id"]) for i in items) == sorted([("fact", fact["id"]), ("tip", tip["id"])])
    assert next(i for i in items if i["kind"] == "fact")["text"] == fact["fact"]
    assert s.get(f"{API}/facts/today").json()["saved"] is True
    assert s.get(f"{API}/words/today").json()["saved"] is True

    # per user: someone else's view is unaffected
    assert other.get(f"{API}/saved-items").json() == []
    assert other.get(f"{API}/facts/today").json()["saved"] is False

    assert s.delete(f"{API}/saved-items/fact/{fact['id']}").json() == {"saved": False}
    assert [i["kind"] for i in s.get(f"{API}/saved-items").json()] == ["tip"]


def test_unknown_items_rejected_and_login_required():
    s = _new_user()
    assert s.put(f"{API}/saved-items", json={"kind": "fact", "item_id": "nope"}).status_code == 404
    assert s.put(f"{API}/saved-items", json={"kind": "post", "item_id": "f001"}).status_code == 404
    assert requests.get(f"{API}/saved-items").status_code == 401
    assert "saved" in requests.get(f"{API}/words/today").json()  # still public
