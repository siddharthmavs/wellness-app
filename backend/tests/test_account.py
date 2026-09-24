"""Profile Settings / account management (BUG-04) and password reset (QA #4).

Covers: profile field validation and persistence, read-only account fields, avatar
upload validation / replace / remove / presets, password change with re-authentication
and session revocation, forgot-password (no account enumeration) and single-use,
org-scoped admin reset links."""
import os
import struct
import uuid
import zlib
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"
PASSWORD = "pass1234"


def _s(token=None):
    s = requests.Session()
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


def _png(w=2, h=2):
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * w for _ in range(h))
    chunk = lambda tag, data: struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def _register_org():
    email = f"admin_{uuid.uuid4().hex[:8]}@example.com"
    r = _s().post(f"{API}/auth/register", json={
        "org_name": f"Account Org {uuid.uuid4().hex[:6]}", "name": "Acct Admin", "email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


def _invite(admin, name="Pat Person"):
    email = f"emp_{uuid.uuid4().hex[:8]}@example.com"
    inv = admin.post(f"{API}/admin/invitations", json={"email": email, "name": name})
    assert inv.status_code == 200, inv.text
    r = _s().post(f"{API}/auth/accept-invite", json={"token": inv.json()["token"], "password": PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()


def _login(email, password):
    return _s().post(f"{API}/auth/login", json={"email": email, "password": password})


@pytest.fixture(scope="module")
def org():
    reg = _register_org()
    return {"admin": _s(reg["token"]), "admin_user": reg["user"]}


@pytest.fixture()
def member(org):
    data = _invite(org["admin"])
    return {"s": _s(data["token"]), "user": data["user"], "token": data["token"]}


@pytest.fixture(scope="module")
def db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


# ---------- profile ----------
class TestProfile:
    def test_update_persists_across_login(self, member):
        r = member["s"].patch(f"{API}/users/me", json={
            "first_name": "  Priya ", "last_name": "Nair", "nickname": "Pri", "timezone": "Europe/London",
            "language": "en", "bio": "Line one\nLine two"})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "Priya Nair" and r.json()["nickname"] == "Pri"
        login = _login(member["user"]["email"], PASSWORD).json()
        me = _s(login["token"]).get(f"{API}/auth/me").json()
        assert (me["first_name"], me["nickname"], me["timezone"], me["bio"]) == ("Priya", "Pri", "Europe/London", "Line one\nLine two")

    def test_account_fields_are_read_only(self, member, org):
        before = member["s"].get(f"{API}/auth/me").json()
        r = member["s"].patch(f"{API}/users/me", json={
            "email": "hijack@example.com", "role": "admin", "org_id": "other-org", "points": 99999, "status": "x", "nickname": "ok"})
        assert r.status_code == 200, r.text
        after = member["s"].get(f"{API}/auth/me").json()
        for field in ("email", "role", "org_id", "points", "status"):
            assert after[field] == before[field], field
        assert member["s"].get(f"{API}/admin/users").status_code == 403

    @pytest.mark.parametrize("patch, fragment", [
        ({"first_name": "   "}, "First name is required"),
        ({"nickname": "x" * 31}, "at most 30"),
        ({"bio": "x" * 281}, "at most 280"),
        ({"birthday": "2020-13-40"}, "valid YYYY-MM-DD"),
        ({"birthday": "2999-01-01"}, "future"),
        ({"timezone": "Mars/Olympus"}, "Unknown timezone"),
        ({"language": "xx"}, "Unsupported language"),
    ])
    def test_invalid_values_rejected(self, member, patch, fragment):
        r = member["s"].patch(f"{API}/users/me", json=patch)
        assert r.status_code == 400 and fragment in r.json()["message"], r.text

    def test_empty_birthday_clears_it(self, member):
        assert member["s"].patch(f"{API}/users/me", json={"birthday": "1990-05-04"}).json()["birthday"] == "1990-05-04"
        assert member["s"].patch(f"{API}/users/me", json={"birthday": ""}).json()["birthday"] is None

    def test_changes_are_audited(self, member, db):
        member["s"].patch(f"{API}/users/me", json={"job_title": "Designer"})
        row = db.audit_log.find_one({"user_id": member["user"]["id"], "action": "profile_updated"})
        assert row and "job_title" in row["data"]["fields"]


# ---------- avatar ----------
class TestAvatar:
    def test_upload_replace_remove(self, member):
        s = member["s"]
        r1 = s.post(f"{API}/users/me/avatar", files={"file": ("me.png", _png(), "image/png")})
        assert r1.status_code == 200, r1.text
        url1 = r1.json()["avatar"]
        img = requests.get(f"{BASE_URL}{url1}")
        assert img.status_code == 200 and img.headers["content-type"] == "image/png"
        assert img.headers.get("x-content-type-options") == "nosniff"

        r2 = s.post(f"{API}/users/me/avatar", files={"file": ("again.png", _png(3, 3), "image/png")})
        url2 = r2.json()["avatar"]
        assert url2 != url1 and s.get(f"{API}/auth/me").json()["avatar"] == url2

        r3 = s.delete(f"{API}/users/me/avatar")
        assert r3.status_code == 200 and r3.json()["avatar_source"] == "default"
        assert "dicebear" in s.get(f"{API}/auth/me").json()["avatar"]

    @pytest.mark.parametrize("name, body, ctype, fragment", [
        ("evil.png", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "image/png", "PNG, JPG, WebP or GIF"),
        ("notes.txt", b"hello there", "text/plain", "PNG, JPG, WebP or GIF"),
        ("empty.png", b"", "image/png", "empty"),
        ("huge.png", b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024 + 10), "image/png", "5 MB"),
    ], ids=["svg-renamed-png", "text", "empty", "over-5mb"])
    def test_invalid_uploads_rejected(self, member, name, body, ctype, fragment):
        before = member["s"].get(f"{API}/auth/me").json()["avatar"]
        r = member["s"].post(f"{API}/users/me/avatar", files={"file": (name, body, ctype)})
        assert r.status_code == 400 and fragment in r.json()["message"], r.text
        assert member["s"].get(f"{API}/auth/me").json()["avatar"] == before

    def test_preset_selection(self, member):
        presets = member["s"].get(f"{API}/avatar-presets").json()
        style, bg = presets["styles"][2], presets["backgrounds"][1]
        r = member["s"].put(f"{API}/users/me/avatar/preset", json={"style": style, "seed": "Sunny Day", "background": bg})
        assert r.status_code == 200, r.text
        assert f"/7.x/{style}/svg?seed=Sunny%20Day&backgroundColor={bg}" in r.json()["avatar"]
        for bad in ({"style": "../../evil", "seed": "x"}, {"style": style, "seed": "<script>"},
                    {"style": style, "seed": "ok", "background": "red;x"}):
            assert member["s"].put(f"{API}/users/me/avatar/preset", json=bad).status_code == 400

    def test_avatar_path_traversal_is_404(self):
        assert requests.get(f"{API}/avatars/..%2F..%2F/server.py").status_code == 404
        assert requests.get(f"{API}/avatars/{uuid.uuid4()}/..%2Fsecret.png").status_code == 404


# ---------- password change ----------
class TestPasswordChange:
    def test_change_requires_current_password_and_policy(self, member):
        s = member["s"]
        cases = [
            ({"current_password": "wrong-one1", "new_password": "newpass123", "confirm_password": "newpass123"}, "current password is incorrect"),
            ({"current_password": PASSWORD, "new_password": "newpass123", "confirm_password": "newpass124"}, "don't match"),
            ({"current_password": PASSWORD, "new_password": "short1", "confirm_password": "short1"}, "at least 8"),
            ({"current_password": PASSWORD, "new_password": "lettersonly", "confirm_password": "lettersonly"}, "letter and one number"),
            ({"current_password": PASSWORD, "new_password": PASSWORD, "confirm_password": PASSWORD}, "different"),
        ]
        for body, fragment in cases:
            r = s.post(f"{API}/users/me/password", json=body)
            assert r.status_code == 400 and fragment in r.json()["message"], (body, r.text)
        # a wrong current password must not look like an expired session
        assert s.get(f"{API}/auth/me").status_code == 200

    def test_change_revokes_other_sessions(self, member, db):
        old = member["s"]
        other_device = _s(_login(member["user"]["email"], PASSWORD).json()["token"])
        import time; time.sleep(1.1)  # tokens carry whole-second iat
        r = old.post(f"{API}/users/me/password", json={
            "current_password": PASSWORD, "new_password": "brandnew123", "confirm_password": "brandnew123"})
        assert r.status_code == 200, r.text
        assert "password" not in r.text.replace("Password updated", "")
        assert other_device.get(f"{API}/auth/me").status_code == 401
        assert old.get(f"{API}/auth/me").status_code == 401
        assert _s(r.json()["token"]).get(f"{API}/auth/me").status_code == 200
        assert _login(member["user"]["email"], PASSWORD).status_code == 401
        assert _login(member["user"]["email"], "brandnew123").status_code == 200
        assert db.audit_log.find_one({"user_id": member["user"]["id"], "action": "password_changed"})

    def test_repeated_wrong_current_password_is_throttled(self, member):
        bad = {"current_password": "nope12345", "new_password": "whatever123", "confirm_password": "whatever123"}
        codes = [member["s"].post(f"{API}/users/me/password", json=bad).status_code for _ in range(6)]
        assert codes[:5] == [400] * 5 and codes[5] == 429

    def test_signup_paths_enforce_policy(self, org):
        r = _s().post(f"{API}/auth/register", json={
            "org_name": f"Weak {uuid.uuid4().hex[:6]}", "name": "W", "email": f"w_{uuid.uuid4().hex[:6]}@example.com", "password": "abc"})
        assert r.status_code == 400 and "at least 8" in r.json()["message"]
        inv = org["admin"].post(f"{API}/admin/invitations", json={"email": f"w_{uuid.uuid4().hex[:6]}@example.com"}).json()
        r = _s().post(f"{API}/auth/accept-invite", json={"token": inv["token"], "password": "12345678"})
        assert r.status_code == 400 and "letter" in r.json()["message"]


# ---------- forgot / reset ----------
class TestPasswordReset:
    def test_forgot_is_generic_and_creates_hashed_token(self, member, db):
        known = _s().post(f"{API}/auth/forgot-password", json={"email": member["user"]["email"]})
        unknown = _s().post(f"{API}/auth/forgot-password", json={"email": f"nobody_{uuid.uuid4().hex[:6]}@example.com"})
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()
        row = db.password_resets.find_one({"user_id": member["user"]["id"], "created_by": "self"})
        assert row and len(row["token_hash"]) == 64 and "token" not in row

    def test_admin_link_resets_once_and_revokes_sessions(self, org, member):
        r = org["admin"].post(f"{API}/admin/users/{member['user']['id']}/password-reset-link")
        assert r.status_code == 200, r.text
        token = r.json()["reset_link"].rsplit("/", 1)[1]
        check = _s().get(f"{API}/auth/reset-password/{token}")
        assert check.status_code == 200 and check.json()["email"] == member["user"]["email"]

        weak = _s().post(f"{API}/auth/reset-password", json={"token": token, "new_password": "short", "confirm_password": "short"})
        assert weak.status_code == 400
        import time; time.sleep(1.1)
        ok = _s().post(f"{API}/auth/reset-password", json={"token": token, "new_password": "resetpass9", "confirm_password": "resetpass9"})
        assert ok.status_code == 200, ok.text
        assert member["s"].get(f"{API}/auth/me").status_code == 401
        assert _login(member["user"]["email"], "resetpass9").status_code == 200
        again = _s().post(f"{API}/auth/reset-password", json={"token": token, "new_password": "another99", "confirm_password": "another99"})
        assert again.status_code == 400 and "invalid or has expired" in again.json()["message"]

    def test_new_link_supersedes_old_and_expiry_is_enforced(self, org, member, db):
        first = org["admin"].post(f"{API}/admin/users/{member['user']['id']}/password-reset-link").json()["reset_link"].rsplit("/", 1)[1]
        second = org["admin"].post(f"{API}/admin/users/{member['user']['id']}/password-reset-link").json()["reset_link"].rsplit("/", 1)[1]
        assert _s().get(f"{API}/auth/reset-password/{first}").status_code == 400
        assert _s().get(f"{API}/auth/reset-password/{second}").status_code == 200
        db.password_resets.update_many({"user_id": member["user"]["id"], "used_at": None},
                                       {"$set": {"expires_at": "2000-01-01T00:00:00+00:00"}})
        assert _s().get(f"{API}/auth/reset-password/{second}").status_code == 400

    def test_admin_link_is_org_scoped(self, member):
        other_admin = _s(_register_org()["token"])
        r = other_admin.post(f"{API}/admin/users/{member['user']['id']}/password-reset-link")
        assert r.status_code == 404
        assert member["s"].post(f"{API}/admin/users/{member['user']['id']}/password-reset-link").status_code == 403
