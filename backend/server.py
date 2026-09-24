from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Any, Dict, List, Optional
import uuid
import time
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import bcrypt
import jwt as pyjwt
import random
import unicodedata
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 7

app = FastAPI(title="Brutal Wellness API")
api = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ---------- Helpers ----------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("status") == "deactivated":
        raise HTTPException(401, "This account has been deactivated")
    # Tokens issued before a password change/reset are no longer valid.
    changed = user.get("password_changed_at")
    if changed and payload.get("iat") and payload["iat"] < int(datetime.fromisoformat(changed).timestamp()):
        raise HTTPException(401, "Session expired — please sign in again")
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user

def org_q(user: dict, **extra) -> dict:
    """Mongo filter pinned to the caller's organization. The org always comes from the
    authenticated user record, never from request input, so a changed id/URL/body can
    only ever match rows in the caller's own tenant."""
    return {"org_id": user.get("org_id"), **extra}

async def org_member_ids(org_id: Optional[str]) -> List[str]:
    return await db.users.distinct("id", {"org_id": org_id})

async def require_org_users(user: dict, user_ids) -> List[dict]:
    """Every id must be a member of the caller's org, otherwise 404 (no existence leak)."""
    ids = list(dict.fromkeys(user_ids or []))
    found = await db.users.find(org_q(user, id={"$in": ids}), {"_id": 0, "password": 0}).to_list(len(ids) or 1)
    if len(found) != len(ids):
        raise HTTPException(404, "User not found in your organization")
    return found

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

async def create_notification(user_id: str, kind: str, title: str, message: str, icon: str = "🔔", data: dict = None):
    """Insert a notification into db.notifications for a given user."""
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "kind": kind,           # shoutout | reward | announcement | wellness | birthday | badge
        "title": title,
        "message": message,
        "icon": icon,
        "data": data or {},
        "read": False,
        "created_at": now_iso(),
    })

# ---------- Models ----------
class OrgRegisterReq(BaseModel):
    """Admin sign-up: creates a brand-new organization plus its first Admin account (doc section 1.1)."""
    org_name: str
    name: str
    email: EmailStr
    password: str

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class InviteCreateReq(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    role: Optional[str] = "employee"
    department: Optional[str] = None

class AcceptInviteReq(BaseModel):
    token: str
    password: str
    name: Optional[str] = None

class OrganizationPatch(BaseModel):
    name: Optional[str] = None
    support_email: Optional[EmailStr] = None
    work_email_domain: Optional[str] = None
    timezone: Optional[str] = None  # IANA name; defines the org's daily reset boundary

class ActivityReq(BaseModel):
    type: str  # water, eye_care, stand, breathing
    points: Optional[int] = None

class MoodReq(BaseModel):
    emoji: str
    label: str
    note: Optional[str] = ""
    productivity: Optional[str] = None  # High | Med | Low

class PostReq(BaseModel):
    content: str
    image: Optional[str] = None  # base64 data URL

class CommentReq(BaseModel):
    content: str

class AIInsightReq(BaseModel):
    moods: Optional[List[str]] = None

# ---------- Auth ----------
AVATAR_COLORS = ["FFE600", "00E5FF", "FF4D6D", "00C853"]
INVITE_EXPIRE_DAYS = 7
DEFAULT_TIMEZONE = os.environ.get("DEFAULT_ORG_TIMEZONE", "Asia/Kolkata")
DUPLICATE_ORG_MSG = "An organization with this name already exists."

def normalize_org_name(name: str) -> str:
    """Case-, accent-width- and whitespace-insensitive identity for org names (BUG-02):
    ' Wellness  Garden ' and 'wellness garden' collide."""
    return " ".join(unicodedata.normalize("NFKC", name or "").split()).casefold()

def _split_name(name: str):
    name = (name or "").strip()
    if " " in name:
        first, last = name.split(" ", 1)
        return first, last
    return name, ""

def _new_user_doc(org_id: str, name: str, email: str, password: str, role: str,
                   department: str = "General") -> dict:
    first, last = _split_name(name)
    created = now_iso()
    return {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "name": name,
        "first_name": first,
        "last_name": last,
        "email": email.lower(),
        "password": hash_password(password),
        "department": department or "General",
        "job_title": "",
        "birthday": None,
        "work_anniversary": created[:10],  # doc section 2: defaults to the join date
        "bio": "",
        "points": 0,
        "streak": 0,
        "level": 1,
        "wellness_score": 50,
        "badges": [],
        "avatar": f"https://api.dicebear.com/7.x/bottts-neutral/svg?seed={name}&backgroundColor={random.choice(AVATAR_COLORS)}",
        "role": role,
        "status": "active",
        "dnd": False,
        "created_at": created,
        "last_activity": created,
    }

def invite_status(inv: dict) -> str:
    """Invitation status is mostly stored, but expiry is computed lazily (doc section 3.1)."""
    if inv.get("status") in ("accepted", "cancelled"):
        return inv["status"]
    try:
        if datetime.now(timezone.utc) > datetime.fromisoformat(inv["expires_at"]):
            return "expired"
    except Exception:
        pass
    return "pending"

@api.post("/auth/register")
async def register(body: OrgRegisterReq):
    """Admin creates a brand-new organization; open self-signup for employees no longer exists —
    employees join only via POST /auth/accept-invite (doc section 1)."""
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    org_name = " ".join(body.org_name.split())
    if not org_name:
        raise HTTPException(400, "Organization name is required")
    normalized = normalize_org_name(org_name)
    if await db.organizations.find_one({"name_normalized": normalized}, {"_id": 1}):
        raise HTTPException(409, DUPLICATE_ORG_MSG)
    org_id = str(uuid.uuid4())
    org = {
        "id": org_id,
        "name": org_name,
        "name_normalized": normalized,
        "support_email": body.email.lower(),
        "work_email_domain": body.email.lower().split("@")[-1],
        "timezone": DEFAULT_TIMEZONE,
        "created_at": now_iso(),
    }
    try:
        # The unique index on name_normalized closes the race between the check above
        # and this insert when two registrations for the same name arrive together.
        await db.organizations.insert_one(org)
    except DuplicateKeyError:
        raise HTTPException(409, DUPLICATE_ORG_MSG)
    user = _new_user_doc(org_id, body.name, body.email, body.password, role="admin")
    await db.users.insert_one(dict(user))
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": create_token(user["id"]), "user": user}

@api.get("/invitations/{token}")
async def preview_invitation(token: str):
    """Public (unauthenticated) preview so the accept-invite page can show who/what org before signup."""
    inv = await db.invitations.find_one({"token": token}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invitation not found")
    status = invite_status(inv)
    if status != "pending":
        raise HTTPException(400, f"This invitation is {status}")
    org = await db.organizations.find_one({"id": inv["org_id"]}, {"_id": 0})
    return {"email": inv["email"], "name": inv.get("name"), "role": inv.get("role"),
            "org_name": (org or {}).get("name", "")}

@api.post("/auth/accept-invite")
async def accept_invite(body: AcceptInviteReq):
    inv = await db.invitations.find_one({"token": body.token}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invitation not found")
    status = invite_status(inv)
    if status != "pending":
        raise HTTPException(400, f"This invitation is {status}")
    if await db.users.find_one({"email": inv["email"]}):
        raise HTTPException(400, "Email already registered")
    name = (body.name or inv.get("name") or inv["email"].split("@")[0]).strip()
    user = _new_user_doc(inv["org_id"], name, inv["email"], body.password,
                          role=inv.get("role") or "employee", department=inv.get("department"))
    await db.users.insert_one(dict(user))
    await db.invitations.update_one(
        {"token": body.token},
        {"$set": {"status": "accepted", "accepted_at": now_iso(), "user_id": user["id"]}},
    )
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": create_token(user["id"]), "user": user}

@api.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password", "")):
        raise HTTPException(401, "Invalid credentials")
    if user.get("status") == "deactivated":
        raise HTTPException(403, "This account has been deactivated")
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": create_token(user["id"]), "user": user}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    org = await db.organizations.find_one({"id": user.get("org_id")}, {"_id": 0, "name": 1, "timezone": 1}) or {}
    return {
        **user,
        "org_name": org.get("name"),
        "org_timezone": org.get("timezone") or DEFAULT_TIMEZONE,
        "today": await org_today(user),
        "points_today": await points_today(user),
    }

@api.get("/points/today")
async def get_points_today(user=Depends(get_current_user)):
    """Daily points for the org's current business day (BUG-01): starts at 0 each day,
    while `total_points` keeps the lifetime/cumulative figure."""
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "points": 1}) or {}
    return {
        "date": await org_today(user),
        "timezone": str(await org_timezone(user.get("org_id"))),
        "points_today": await points_today(user),
        "total_points": fresh.get("points", 0),
    }

@api.get("/points/history")
async def get_points_history(days: int = 30, user=Depends(get_current_user)):
    days = max(1, min(365, days))
    rows = await db.daily_points.find({"user_id": user["id"]}, {"_id": 0, "date": 1, "points": 1}).sort("date", -1).to_list(days)
    return {"items": rows}

# ---------- Activities / Points ----------
POINTS_MAP = {"water": 10, "eye_care": 15, "stand": 10, "breathing": 20, "mood": 5, "post": 10}

# Canonical activity categories (doc section 8). The `type` field keeps the historical
# lowercase vocabulary so existing aggregations/leaderboards keep working; `category`
# is the normalised label used by the wellness modules, dashboard and insights.
WELLNESS_CATEGORY = {
    "water": "WATER",
    "eye_care": "EYE_BREAK",
    "stand": "MOVE_RESET",
    "breathing": "BREATHING",
    "pomodoro": "POMODORO",
}
CATEGORY_TO_TYPE = {v: k for k, v in WELLNESS_CATEGORY.items()}

def next_streak(user: dict, gc: dict) -> int:
    """Streak: +1 on the first activity of a new calendar day; reset to 1 after a long gap."""
    streak = user.get("streak", 0)
    last = user.get("last_activity")
    today = datetime.now(timezone.utc).date()
    if not last:
        return 1
    try:
        last_dt = datetime.fromisoformat(last)
        delta_hours = (datetime.now(timezone.utc) - last_dt).total_seconds() / 3600
        last_date = last_dt.date()
        if delta_hours > gc.get("streak_gap_hours", 36):
            return 1
        if last_date < today:
            # new day, continue streak
            return max(streak, 0) + 1
        # same day, keep
        return max(streak, 1)
    except Exception:
        return max(streak, 1)

async def apply_activity_rewards(user: dict, pts: int) -> dict:
    """Persist points/level/wellness-score/streak progression for one logged activity."""
    gc = await get_game_config(user.get("org_id"))
    new_score = min(100, user.get("wellness_score", 50) + gc.get("wellness_score_increment", 2))
    streak = next_streak(user, gc)
    # $inc (not $set from the caller's snapshot) so concurrent awards can't overwrite each other
    updated = await db.users.find_one_and_update(
        {"id": user["id"]},
        {"$inc": {"points": int(pts)},
         "$set": {"wellness_score": new_score, "streak": streak, "last_activity": now_iso()}},
        projection={"_id": 0, "points": 1},
        return_document=ReturnDocument.AFTER,
    )
    new_points = (updated or {}).get("points", 0)
    new_level = 1 + new_points // max(1, gc.get("level_threshold", 200))
    await db.users.update_one({"id": user["id"]}, {"$set": {"level": new_level}})
    await record_daily_points(user["id"], pts, user.get("org_id"))
    return {"points": new_points, "level": new_level, "wellness_score": new_score, "streak": streak,
            "points_today": await points_today(user)}

# Rituals that can be logged directly. "stand" (Move & Reset) is deliberately absent:
# its points only come from a server-validated session (POST /move-reset/sessions/...).
LOGGABLE_ACTIVITIES = {"water", "eye_care", "breathing", "pomodoro"}
DAILY_AWARD_CAP_PER_TYPE = 12

@api.post("/activities")
async def log_activity(body: ActivityReq, user=Depends(get_current_user)):
    if body.type not in LOGGABLE_ACTIVITIES:
        raise HTTPException(400, f"type must be one of: {', '.join(sorted(LOGGABLE_ACTIVITIES))}")
    pc = await get_points_config(user.get("org_id"))
    # Points always come from the org's config; a client-sent value is ignored.
    pts = int(pc.get(body.type, 5))
    since = await org_day_start_utc(user, await org_today(user))
    already = await db.activities.count_documents(
        {"user_id": user["id"], "type": body.type, "points": {"$gt": 0}, "created_at": {"$gte": since}}
    )
    if already >= DAILY_AWARD_CAP_PER_TYPE:
        pts = 0  # still logged, but no more points today for this ritual
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": body.type,
        "category": WELLNESS_CATEGORY.get(body.type, "OTHER"),
        "action": "LOGGED",
        "points": pts,
        "xp_earned": pts,
        "created_at": now_iso(),
    }
    await db.activities.insert_one(activity)
    activity.pop("_id", None)
    totals = await apply_activity_rewards(user, pts)
    return {"activity": activity, **totals}

@api.get("/activities/me")
async def my_activities(user=Depends(get_current_user)):
    items = await db.activities.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

# ---------- Leaderboard / Journey ----------
@api.get("/leaderboard")
async def leaderboard(period: str = "all", user=Depends(get_current_user)):
    """Doc section 5 — Journey is the ORGANIZATION's leaderboard, scoped to the caller's org."""
    org_id = user.get("org_id")
    # period: daily, weekly, monthly, all
    users = await db.users.find({"org_id": org_id}, {"_id": 0, "password": 0}).sort("points", -1).to_list(50)
    if period == "all":
        return users
    # recalc based on activities window
    now = datetime.now(timezone.utc)
    windows = {"daily": 1, "weekly": 7, "monthly": 30}
    days = windows.get(period, 7)
    since = (now - timedelta(days=days)).isoformat()
    org_user_ids = [u["id"] for u in users]
    pipeline = [
        {"$match": {"created_at": {"$gte": since}, "user_id": {"$in": org_user_ids}}},
        {"$group": {"_id": "$user_id", "points": {"$sum": "$points"}}},
        {"$sort": {"points": -1}},
        {"$limit": 50},
    ]
    agg = await db.activities.aggregate(pipeline).to_list(50)
    result = []
    for row in agg:
        u = await db.users.find_one({"id": row["_id"], "org_id": org_id}, {"_id": 0, "password": 0})
        if u:
            u["points"] = row["points"]
            result.append(u)
    return result

# ---------- Mood ----------
@api.post("/mood")
async def log_mood(body: MoodReq, user=Depends(get_current_user)):
    entry = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "emoji": body.emoji,
        "label": body.label,
        "note": body.note or "",
        "productivity": body.productivity or None,
        "created_at": now_iso(),
    }
    await db.moods.insert_one(entry)
    entry.pop("_id", None)
    return entry

@api.get("/mood/me")
async def my_moods(user=Depends(get_current_user)):
    items = await db.moods.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(30)
    return items

# ---------- Fun Wall Posts ----------
@api.post("/posts")
async def create_post(body: PostReq, user=Depends(get_current_user)):
    post = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_avatar": user.get("avatar", ""),
        "content": body.content,
        "image": body.image or "",
        "likes": [],
        "comments": [],
        "created_at": now_iso(),
    }
    await db.posts.insert_one(post)
    post.pop("_id", None)
    # award points
    await credit_points(user["id"], POINTS_MAP["post"], user.get("org_id"))
    return post

@api.get("/posts")
async def list_posts(user=Depends(get_current_user)):
    items = await db.posts.find(org_q(user), {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/posts/{post_id}/like")
async def like_post(post_id: str, user=Depends(get_current_user)):
    post = await db.posts.find_one(org_q(user, id=post_id), {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    likes = post.get("likes", [])
    if user["id"] in likes:
        likes.remove(user["id"])
    else:
        likes.append(user["id"])
    await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})
    return {"likes": likes}

@api.post("/posts/{post_id}/comment")
async def comment_post(post_id: str, body: CommentReq, user=Depends(get_current_user)):
    post = await db.posts.find_one(org_q(user, id=post_id), {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    comment = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_avatar": user.get("avatar", ""),
        "content": body.content,
        "created_at": now_iso(),
    }
    comments = post.get("comments", []) + [comment]
    await db.posts.update_one({"id": post_id}, {"$set": {"comments": comments}})
    return comment

# ---------- Notifications ----------
WELLNESS_NOTIFS = [
    {"type": "water", "title": " Hey legend, drink water", "message": "It's been a while. Hydrate or deteriorate.", "color": "#00E5FF"},
    {"type": "eye_care", "title": " Your eyes are tired bro", "message": "20-20-20. Look away for 20 seconds at something 20ft away.", "color": "#FFE600"},
    {"type": "stand", "title": " You are becoming a chair", "message": "Stand up. Stretch. Be a human.", "color": "#FF4D6D"},
    {"type": "breathing", "title": " Breathe, champion", "message": "Quick 4-7-8 breathing. Reset your brain.", "color": "#00C853"},
]

@api.get("/notifications/random")
async def random_notif(user=Depends(get_current_user)):
    n = random.choice(WELLNESS_NOTIFS)
    return {"id": str(uuid.uuid4()), **n}

class WellnessNotifReq(BaseModel):
    type: str   # water | eye_care | stand | breathing

@api.post("/notifications/wellness")
async def log_wellness_notif(body: WellnessNotifReq, user=Depends(get_current_user)):
    """Frontend calls this when a wellness reminder fires so it appears in the bell."""
    mapping = {
        "water":     ("🚰", "💧 Time to drink water!",    "Hydrate or deteriorate, legend."),
        "eye_care":  ("👀", "👀 Eye break time!",          "20-20-20. You got this."),
        "stand":     ("🧍", "🧍 Stand up!",               "You're becoming a chair. Move."),
        "breathing": ("🌬️", "🌬️ Breathing break!",        "4-7-8. In... hold... out."),
    }
    if body.type not in mapping:
        raise HTTPException(400, "Unknown wellness type")
    icon, title, message = mapping[body.type]
    await create_notification(user_id=user["id"], kind="wellness", title=title, message=message, icon=icon)
    return {"ok": True}

@api.post("/notifications/birthday")
async def log_birthday_notif(user=Depends(get_current_user)):
    """Frontend calls this on login when today has birthday/anniversary events."""
    today_events = await db.events.find(org_q(user), {"_id": 0}).to_list(100)
    today_md = datetime.now(timezone.utc).date().strftime("%m-%d")
    out = []
    for e in today_events:
        if e.get("date", "")[5:10] == today_md and e.get("user_id") != user["id"]:
            u = await db.users.find_one(org_q(user, id=e["user_id"]), {"_id": 0, "name": 1})
            if u:
                label = "🎂 Birthday" if e["type"] == "birthday" else "🎉 Anniversary"
                await create_notification(
                    user_id=user["id"],
                    kind="birthday",
                    title=f"{label}: {u['name']} today!",
                    message=e.get("note") or f"Don't forget to wish {u['name']} well!",
                    icon="🎂" if e["type"] == "birthday" else "🎉",
                    data={"event_id": e["id"]},
                )
                out.append(u["name"])
    return {"notified": out}

@api.get("/notifications/me")
async def my_notifications(user=Depends(get_current_user)):
    """Returns unified notifications (db.notifications) + admin announcements, newest first."""
    notifs = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # also surface admin announcements as notifications
    announcements = await db.announcements.find({"recipients": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in announcements:
        a["kind"] = "announcement"
        a["icon"] = {"info": "ℹ️", "alert": "⚠️", "party": "🎉"}.get(a.get("kind") or "info", "📢")
        a["read"] = user["id"] in (a.get("read_by") or [])
        a["user_id"] = user["id"]
    combined = notifs + announcements
    combined.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return combined[:80]

@api.post("/notifications/{nid}/read")
async def mark_notification_read(nid: str, user=Depends(get_current_user)):
    # try notifications collection first
    result = await db.notifications.update_one(
        {"id": nid, "user_id": user["id"]},
        {"$set": {"read": True}},
    )
    if result.modified_count == 0:
        # might be an announcement
        await db.announcements.update_one({"id": nid, "recipients": user["id"]}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}},
    )
    # mark all their announcements read too
    ann_ids = await db.announcements.distinct("id", {"recipients": user["id"]})
    for aid in ann_ids:
        await db.announcements.update_one({"id": aid}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}

# ---------- Badges ----------
BADGES = [
    {"id": "first_drop", "name": "First Drop", "emoji": "", "desc": "Logged first water break", "color": "#00E5FF"},
    {"id": "eye_master", "name": "Eye Master", "emoji": "", "desc": "10 eye breaks", "color": "#FFE600"},
    {"id": "streak_5", "name": "Fire Starter", "emoji": "", "desc": "5 day streak", "color": "#FF4D6D"},
    {"id": "mood_mood", "name": "Feels Expert", "emoji": "", "desc": "Logged 7 moods", "color": "#00C853"},
    {"id": "social", "name": "Meme Lord", "emoji": "", "desc": "Posted on Fun Wall", "color": "#FFE600"},
]

@api.get("/badges")
async def all_badges():
    return BADGES

# ---------- Challenges ----------
CHALLENGES = [
    {"id": "water_5", "title": " Drink water 5 times", "reward": 50, "target": 5, "type": "water"},
    {"id": "eye_3", "title": " 3 eye breaks today", "reward": 30, "target": 3, "type": "eye_care"},
    {"id": "stand_3", "title": " Stand 3 times", "reward": 30, "target": 3, "type": "stand"},
    {"id": "mood_1", "title": " Log your mood", "reward": 20, "target": 1, "type": "mood"},
]

@api.get("/challenges")
async def get_challenges(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    result = []
    for ch in CHALLENGES:
        count = await db.activities.count_documents({
            "user_id": user["id"],
            "type": ch["type"],
            "created_at": {"$gte": today}
        })
        if ch["type"] == "mood":
            count = await db.moods.count_documents({"user_id": user["id"], "created_at": {"$gte": today}})
        result.append({**ch, "progress": min(count, ch["target"]), "done": count >= ch["target"]})
    return result

# ---------- AI Insight ----------
@api.post("/ai/mood-insight")
async def ai_mood_insight(body: AIInsightReq, user=Depends(get_current_user)):
    # fetch last 7 moods if not provided
    moods = body.moods
    if not moods:
        items = await db.moods.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(7)
        moods = [f"{m['emoji']} {m['label']}" for m in items]
    if not moods:
        return {"insight": "No mood data yet. Log your vibes and I'll cook up some wisdom. "}

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"mood-{user['id']}",
            system_message="You are a sassy, fun wellness coach. Give short (2-3 sentences max), playful, encouraging insights. Use casual tone. No corporate speak."
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=f"Here are my recent moods: {', '.join(moods)}. Give me a fun insight and a tiny tip.")
        resp = await chat.send_message(msg)
        return {"insight": str(resp)}
    except Exception as e:
        logger.exception("AI insight failed")
        return {"insight": f"Your vibe has been a mix of {', '.join(moods[:3])}. Keep logging — self-awareness is the cheat code. "}

# ---------- Seed ----------
DEFAULT_ORG_NAME = "Demo Organization"

async def get_or_create_default_org() -> str:
    """Every user needs an org_id. Pre-existing/demo data lives in one idempotently-seeded
    'Demo Organization' so nothing already in the DB breaks when multi-org support is added."""
    # Identified by an explicit marker, not by name — a customer org can't claim it by
    # registering the same name. Legacy demo orgs (pre-marker) are stamped on first lookup.
    org = await db.organizations.find_one({"is_demo": True}, {"_id": 0, "id": 1})
    if org:
        return org["id"]
    legacy = await db.organizations.find(
        {"name": DEFAULT_ORG_NAME, "is_demo": {"$exists": False}}, {"_id": 0, "id": 1, "created_at": 1}
    ).sort("created_at", 1).to_list(1)
    if legacy:
        await db.organizations.update_one({"id": legacy[0]["id"]}, {"$set": {"is_demo": True}})
        return legacy[0]["id"]
    org_id = str(uuid.uuid4())
    await db.organizations.insert_one({
        "id": org_id,
        "name": DEFAULT_ORG_NAME,
        "name_normalized": normalize_org_name(DEFAULT_ORG_NAME),
        "is_demo": True,
        "support_email": "admin@demo.com",
        "work_email_domain": "demo.com",
        "timezone": DEFAULT_TIMEZONE,
        "created_at": now_iso(),
    })
    return org_id

@api.post("/seed")
async def seed_route(admin=Depends(require_admin)):
    return await seed_data()

async def seed_data():
    # idempotent — only inserts missing demo users/posts
    existing_count = await db.users.count_documents({})
    default_org_id = await get_or_create_default_org()

    demo_users = [
        {"name": "Admin Boss", "email": "admin@demo.com", "password": "demo1234", "department": "Management", "points": 500, "color": "000000", "role": "admin"},
        {"name": "Alex Chaos", "email": "alex@demo.com", "password": "demo1234", "department": "Engineering", "points": 1250, "color": "FFE600", "role": "employee"},
        {"name": "Jamie Vibe", "email": "jamie@demo.com", "password": "demo1234", "department": "Design", "points": 980, "color": "00E5FF", "role": "employee"},
        {"name": "Sam Hustle", "email": "sam@demo.com", "password": "demo1234", "department": "Marketing", "points": 1420, "color": "FF4D6D", "role": "team_lead"},
        {"name": "Riley Zen", "email": "riley@demo.com", "password": "demo1234", "department": "HR", "points": 750, "color": "00C853", "role": "employee"},
        {"name": "Casey Boss", "email": "casey@demo.com", "password": "demo1234", "department": "Product", "points": 1680, "color": "FFE600", "role": "team_lead"},
    ]
    for du in demo_users:
        existing = await db.users.find_one({"email": du["email"]})
        if existing:
            # Ensure role is up-to-date for existing seeded users
            if existing.get("role") != du.get("role", "employee"):
                await db.users.update_one(
                    {"email": du["email"]},
                    {"$set": {"role": du.get("role", "employee")}},
                )
            continue
        uid = str(uuid.uuid4())
        first, last = _split_name(du["name"])
        await db.users.insert_one({
            "id": uid,
            "org_id": default_org_id,
            "name": du["name"],
            "first_name": first,
            "last_name": last,
            "email": du["email"],
            "password": hash_password(du["password"]),
            "department": du["department"],
            "job_title": "",
            "points": du["points"],
            "streak": random.randint(2, 14),
            "level": 1 + du["points"] // 200,
            "wellness_score": random.randint(60, 95),
            "badges": random.sample([b["id"] for b in BADGES], k=random.randint(1, 3)),
            "avatar": f"https://api.dicebear.com/7.x/bottts-neutral/svg?seed={du['name']}&backgroundColor={du['color']}",
            "role": du.get("role", "employee"),
            "status": "active",
            "dnd": False,
            "created_at": now_iso(),
            "last_activity": now_iso(),
        })

    # Seed posts only if no posts yet
    existing_posts = await db.posts.count_documents({"org_id": default_org_id})
    if existing_posts > 0:
        return {"seeded": True, "users_inserted": "idempotent", "posts": 0}

    demo_posts = [
        {"user_name": "Alex Chaos", "content": "When Monday hits and the coffee hasn't ", "image": ""},
        {"user_name": "Jamie Vibe", "content": "Legit feel like I merged with my chair  stand up y'all", "image": ""},
        {"user_name": "Sam Hustle", "content": "Day 7 streak of NOT looking at screen during lunch ", "image": ""},
        {"user_name": "Casey Boss", "content": "Just learned the 20-20-20 rule. My eyes: ", "image": ""},
    ]
    users = await db.users.find({"org_id": default_org_id}, {"_id": 0, "password": 0}).to_list(10)
    user_map = {u["name"]: u for u in users}
    for p in demo_posts:
        u = user_map.get(p["user_name"])
        if not u:
            continue
        await db.posts.insert_one({
            "id": str(uuid.uuid4()),
            "org_id": default_org_id,
            "user_id": u["id"],
            "user_name": u["name"],
            "user_avatar": u.get("avatar", ""),
            "content": p["content"],
            "image": p["image"],
            "likes": random.sample([x["id"] for x in users], k=random.randint(1, 3)),
            "comments": [],
            "created_at": now_iso(),
        })

    return {"seeded": True, "users": len(demo_users), "posts": len(demo_posts)}

# ---------- Fun Wall / Kudos reactions ----------
class ReactReq(BaseModel):
    emoji: str  # reaction key: laugh | heart | clap | fire

# Plain-text keys: an emoji-stripping pass once turned the emoji keys into four identical
# empty strings, so every reaction landed in one shared bucket (QA #10/#12).
ALLOWED_REACTIONS = ["laugh", "heart", "clap", "fire"]

def _clean_reactions(reactions: Optional[dict]) -> dict:
    return {k: v for k, v in (reactions or {}).items() if k in ALLOWED_REACTIONS}

@api.post("/posts/{post_id}/react")
async def react_post(post_id: str, body: ReactReq, user=Depends(get_current_user)):
    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(400, "Invalid reaction")
    post = await db.posts.find_one(org_q(user, id=post_id), {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    reactions = _clean_reactions(post.get("reactions"))
    # one reaction per user per post: picking a new one moves it
    for e, users in list(reactions.items()):
        if user["id"] in users and e != body.emoji:
            reactions[e] = [u for u in users if u != user["id"]]
    arr = reactions.get(body.emoji, [])
    if user["id"] in arr:
        arr.remove(user["id"])
    else:
        arr.append(user["id"])
    reactions[body.emoji] = arr
    await db.posts.update_one({"id": post_id}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}

# ---------- User profile updates (doc section 2) ----------
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

class UserPatch(BaseModel):
    dnd: Optional[bool] = None
    bio: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    birthday: Optional[str] = None            # YYYY-MM-DD
    work_anniversary: Optional[str] = None    # YYYY-MM-DD

@api.patch("/users/me")
async def update_me(body: UserPatch, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    for field in ("birthday", "work_anniversary"):
        if field in updates and not DATE_RE.match(updates[field]):
            raise HTTPException(400, f"{field} must be YYYY-MM-DD")
    if "first_name" in updates or "last_name" in updates:
        first = updates.get("first_name", user.get("first_name", ""))
        last = updates.get("last_name", user.get("last_name", ""))
        updates["name"] = f"{first} {last}".strip() or user.get("name")
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated

# ---------- Shoutouts ----------
SHOUTOUT_CATEGORIES = ["Helpfulness", "Teamwork", "Problem Solving", "Going Extra Mile", "Just Because"]

class ShoutoutReq(BaseModel):
    recipient_ids: List[str]
    category: str
    message: str

@api.post("/shoutouts")
async def create_shoutout(body: ShoutoutReq, user=Depends(get_current_user)):
    if body.category not in SHOUTOUT_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    if not body.recipient_ids:
        raise HTTPException(400, "Pick at least one recipient")
    if user["id"] in body.recipient_ids:
        raise HTTPException(400, "You can't shout yourself out")
    members = await require_org_users(user, body.recipient_ids)
    recipients = [{"id": m["id"], "name": m["name"], "avatar": m.get("avatar", "")} for m in members]
    recipient_ids = [r["id"] for r in recipients]
    shout = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "sender_id": user["id"],
        "sender_name": user["name"],
        "sender_avatar": user.get("avatar", ""),
        "recipients": recipients,
        "category": body.category,
        "message": body.message[:280],
        "reactions": {},
        "created_at": now_iso(),
    }
    await db.shoutouts.insert_one(shout)
    shout.pop("_id", None)
    # points + notifications for each recipient
    await credit_points(user["id"], 5, user.get("org_id"))
    for rid in recipient_ids:
        await credit_points(rid, 10, user.get("org_id"))
        await create_notification(
            user_id=rid,
            kind="shoutout",
            title=f"📣 {user['name']} shouted you out!",
            message=f"{body.category}: {body.message[:120]}",
            icon="📣",
            data={"shoutout_id": shout["id"], "sender": user["name"]},
        )
    return shout

@api.get("/shoutouts")
async def list_shoutouts(user=Depends(get_current_user)):
    items = await db.shoutouts.find(org_q(user), {"_id": 0}).sort("created_at", -1).to_list(100)
    for s in items:
        s["reactions"] = _clean_reactions(s.get("reactions"))
    return items

PUBLIC_USER_FIELDS = {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1, "job_title": 1,
                      "points": 1, "streak": 1, "level": 1, "wellness_score": 1}

@api.get("/shoutouts/digest")
async def shoutouts_digest(user=Depends(get_current_user)):
    # top 3 receivers this week
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    items = await db.shoutouts.find(org_q(user, created_at={"$gte": since}), {"_id": 0}).to_list(500)
    counts = {}
    for s in items:
        for r in s.get("recipients", []):
            counts[r["id"]] = counts.get(r["id"], 0) + 1
    top_ids = sorted(counts.keys(), key=lambda k: -counts[k])[:3]
    top = []
    for uid in top_ids:
        u = await db.users.find_one(org_q(user, id=uid), PUBLIC_USER_FIELDS)
        if u:
            u["shoutouts_received"] = counts[uid]
            top.append(u)
    return top

@api.post("/shoutouts/{sid}/react")
async def react_shout(sid: str, body: ReactReq, user=Depends(get_current_user)):
    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(400, "Invalid reaction")
    s = await db.shoutouts.find_one(org_q(user, id=sid), {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    reactions = _clean_reactions(s.get("reactions"))
    arr = reactions.get(body.emoji, [])
    if user["id"] in arr:
        arr.remove(user["id"])
    else:
        arr.append(user["id"])
    reactions[body.emoji] = arr
    await db.shoutouts.update_one({"id": sid}, {"$set": {"reactions": reactions}})
    return {"reactions": reactions}

# ---------- Help Board ----------
HELP_CATEGORIES = ["Housing", "Travel", "Buy-Sell", "Recommendations", "General"]

class HelpPostReq(BaseModel):
    category: str
    title: str
    content: str
    image: Optional[str] = None

@api.post("/help")
async def create_help(body: HelpPostReq, user=Depends(get_current_user)):
    if body.category not in HELP_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    post = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_avatar": user.get("avatar", ""),
        "category": body.category,
        "title": body.title[:120],
        "content": body.content,
        "image": body.image or "",
        "likes": [],
        "comments": [],
        "created_at": now_iso(),
    }
    await db.help_posts.insert_one(post)
    post.pop("_id", None)
    return post

@api.get("/help")
async def list_help(category: Optional[str] = None, user=Depends(get_current_user)):
    q = org_q(user)
    if category and category != "All":
        q["category"] = category
    items = await db.help_posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api.post("/help/{pid}/like")
async def like_help(pid: str, user=Depends(get_current_user)):
    p = await db.help_posts.find_one(org_q(user, id=pid), {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    likes = p.get("likes", [])
    if user["id"] in likes:
        likes.remove(user["id"])
    else:
        likes.append(user["id"])
    await db.help_posts.update_one({"id": pid}, {"$set": {"likes": likes}})
    return {"likes": likes}

@api.post("/help/{pid}/comment")
async def comment_help(pid: str, body: CommentReq, user=Depends(get_current_user)):
    p = await db.help_posts.find_one(org_q(user, id=pid), {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    c = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_avatar": user.get("avatar", ""),
        "content": body.content,
        "created_at": now_iso(),
    }
    comments = p.get("comments", []) + [c]
    await db.help_posts.update_one({"id": pid}, {"$set": {"comments": comments}})
    return c

# ---------- Feedback ----------
FEEDBACK_CATEGORIES = ["Wellness", "Social", "Technical", "General"]

class FeedbackReq(BaseModel):
    category: str
    message: str
    anonymous: Optional[bool] = False

@api.post("/feedback")
async def create_feedback(body: FeedbackReq, user=Depends(get_current_user)):
    if body.category not in FEEDBACK_CATEGORIES:
        raise HTTPException(400, "Invalid category")
    fb = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": None if body.anonymous else user["id"],
        "user_name": "Anonymous" if body.anonymous else user["name"],
        "category": body.category,
        "message": body.message,
        "status": "Received",
        "anonymous": bool(body.anonymous),
        "created_at": now_iso(),
    }
    await db.feedback.insert_one(fb)
    fb.pop("_id", None)
    return fb

@api.get("/feedback")
async def list_feedback(admin=Depends(require_admin)):
    items = await db.feedback.find(org_q(admin), {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

# ---------- Team leaderboard (Journey — Teams mode, doc section 5) ----------
@api.get("/leaderboard/teams")
async def team_leaderboard(user=Depends(get_current_user)):
    pipeline = [
        {"$match": {"org_id": user.get("org_id")}},
        {"$group": {"_id": "$department", "points": {"$sum": "$points"}, "members": {"$sum": 1}, "avg_score": {"$avg": "$wellness_score"}}},
        {"$sort": {"points": -1}},
    ]
    rows = await db.users.aggregate(pipeline).to_list(50)
    return [{"team": r["_id"], "points": r["points"], "members": r["members"], "avg_wellness": round(r.get("avg_score", 0) or 0, 1)} for r in rows]

# ---------- Weekly insights ----------
@api.get("/insights/weekly")
async def weekly_insights(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    this_start = (now - timedelta(days=7)).isoformat()
    last_start = (now - timedelta(days=14)).isoformat()

    async def count(coll, q):
        return await coll.count_documents(q)

    uid = user["id"]
    # Activities
    water_this = await count(db.activities, {"user_id": uid, "type": "water", "created_at": {"$gte": this_start}})
    water_last = await count(db.activities, {"user_id": uid, "type": "water", "created_at": {"$gte": last_start, "$lt": this_start}})
    eye_this = await count(db.activities, {"user_id": uid, "type": "eye_care", "created_at": {"$gte": this_start}})
    eye_last = await count(db.activities, {"user_id": uid, "type": "eye_care", "created_at": {"$gte": last_start, "$lt": this_start}})
    stand_this = await count(db.activities, {"user_id": uid, "type": "stand", "created_at": {"$gte": this_start}})

    pts_pipeline = [
        {"$match": {"user_id": uid, "created_at": {"$gte": this_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}},
    ]
    pts_agg = await db.activities.aggregate(pts_pipeline).to_list(1)
    pts_this = (pts_agg[0]["total"] if pts_agg else 0)

    # Moods this week
    moods = await db.moods.find({"user_id": uid, "created_at": {"$gte": this_start}}, {"_id": 0}).to_list(50)
    mood_counts = {}
    for m in moods:
        mood_counts[m["label"]] = mood_counts.get(m["label"], 0) + 1
    top_mood = max(mood_counts.items(), key=lambda x: x[1])[0] if mood_counts else "—"

    def pct_change(a, b):
        if b == 0:
            return 100 if a > 0 else 0
        return round(((a - b) / b) * 100)

    messages = [
        "Fantastic week! Keep it going, champ. ",
        "Solid grind this week. Brain thanks you. ",
        "Vibes were immaculate. Don't stop now. ",
        "Okay-ish week. Let's crush it next one. ",
    ]
    water_change = pct_change(water_this, water_last)
    score_weighted = water_this + eye_this + stand_this
    idx = min(3, max(0, 3 - score_weighted // 3))
    message = messages[idx]

    # ---- doc section 10 metrics, aggregated from the wellness logs ----
    week_start = (now - timedelta(days=6)).date().isoformat()
    day_filter = {"user_id": uid, "date": {"$gte": week_start}}

    water_logs = await db.water_logs.find(day_filter, {"_id": 0}).to_list(31)
    eye_logs = await db.eye_break_logs.find(day_filter, {"_id": 0}).to_list(31)
    move_logs = await db.move_reset_logs.find(day_filter, {"_id": 0}).to_list(31)
    breath_logs = await db.breathing_logs.find(day_filter, {"_id": 0}).to_list(31)

    water_goals_completed = sum(1 for l in water_logs if l.get("completed"))
    eye_breaks_completed = sum(int(l.get("completed") or 0) for l in eye_logs)
    move_reset_completed = sum(int(l.get("completed") or 0) for l in move_logs)
    breathing_sessions = sum(int(l.get("completed") or 0) for l in breath_logs)

    week_activities = await db.activities.find(
        {"user_id": uid, "created_at": {"$gte": this_start}}, {"_id": 0}
    ).to_list(1000)
    xp_earned = sum(a.get("xp_earned", a.get("points", 0)) or 0 for a in week_activities)

    per_day = {}
    for a in week_activities:
        try:
            d = datetime.fromisoformat(a["created_at"]).date().isoformat()
        except (ValueError, KeyError, TypeError):
            continue
        per_day[d] = per_day.get(d, 0) + 1
    best_day = max(per_day.items(), key=lambda x: x[1])[0] if per_day else None

    streak_data = await compute_streaks(uid)
    iso_year, iso_week, _ = now.isocalendar()

    return {
        "range": {"from": this_start, "to": now.isoformat()},
        "water": {"this": water_this, "last": water_last, "change_pct": water_change},
        "eye_care": {"this": eye_this, "last": eye_last, "change_pct": pct_change(eye_this, eye_last)},
        "stand": {"this": stand_this},
        "points_earned": pts_this,
        "top_mood": top_mood,
        "streak": user.get("streak", 0),
        "wellness_score": user.get("wellness_score", 50),
        "message": message,
        # --- wellness module rollup ---
        "week": f"{iso_year}-W{iso_week:02d}",
        "water_goals_completed": water_goals_completed,
        "eye_breaks_completed": eye_breaks_completed,
        "move_reset_completed": move_reset_completed,
        "breathing_sessions": breathing_sessions,
        "total_activities": len(week_activities),
        "xp_earned": xp_earned,
        "activities_per_day": per_day,
        "best_day": best_day,
        "current_streak": streak_data["current_streak"],
        "longest_streak": streak_data["longest_streak"],
    }

# ---------- Admin routes ----------
@api.get("/admin/users")
async def admin_users(admin=Depends(require_admin)):
    """Doc section 3.2 — the current organization's users only, never other orgs'."""
    users = await db.users.find({"org_id": admin.get("org_id")}, {"_id": 0, "password": 0}).to_list(500)
    return users

class AdminUserPatch(BaseModel):
    role: Optional[str] = None
    department: Optional[str] = None
    points: Optional[int] = None
    status: Optional[str] = None  # active | deactivated

async def _get_org_user(uid: str, admin: dict) -> dict:
    u = await db.users.find_one({"id": uid, "org_id": admin.get("org_id")}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(404, "User not found in your organization")
    return u

@api.patch("/admin/users/{uid}")
async def admin_update_user(uid: str, body: AdminUserPatch, admin=Depends(require_admin)):
    await _get_org_user(uid, admin)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates.get("status") not in (None, "active", "deactivated"):
        raise HTTPException(400, "status must be 'active' or 'deactivated'")
    if updates:
        await db.users.update_one({"id": uid}, {"$set": updates})
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    return u

@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin=Depends(require_admin)):
    if uid == admin["id"]:
        raise HTTPException(400, "Cannot delete self")
    await _get_org_user(uid, admin)
    await db.users.delete_one({"id": uid})
    return {"deleted": True}

# ---------- Organization & Invitations (doc sections 1, 3.1, 3.2) ----------
@api.get("/admin/organization")
async def get_organization(admin=Depends(require_admin)):
    org = await db.organizations.find_one({"id": admin.get("org_id")}, {"_id": 0})
    if not org:
        raise HTTPException(404, "Organization not found")
    return org

@api.put("/admin/organization")
async def update_organization(body: OrganizationPatch, admin=Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "name" in updates:
        updates["name"] = " ".join(updates["name"].split())
        if not updates["name"]:
            raise HTTPException(400, "Organization name is required")
        updates["name_normalized"] = normalize_org_name(updates["name"])
        clash = await db.organizations.find_one(
            {"name_normalized": updates["name_normalized"], "id": {"$ne": admin.get("org_id")}}, {"_id": 1}
        )
        if clash:
            raise HTTPException(409, DUPLICATE_ORG_MSG)
    if "timezone" in updates:
        try:
            ZoneInfo(updates["timezone"])
        except Exception:
            raise HTTPException(400, "Unknown timezone")
    if updates:
        await db.organizations.update_one({"id": admin.get("org_id")}, {"$set": updates})
        _ORG_TZ_CACHE.pop(admin.get("org_id"), None)
    return await db.organizations.find_one({"id": admin.get("org_id")}, {"_id": 0})

def _invite_public(inv: dict) -> dict:
    """Admin-only view of one of their own org's invitations — the accept link (which embeds
    the token) is included so the admin can always re-copy/share it, not just at creation."""
    inv = {**inv, "status": invite_status(inv)}
    token = inv.pop("token", None)
    if token and inv["status"] in ("pending", "expired"):
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        inv["accept_link"] = f"{frontend_url}/accept-invite/{token}"
    return inv

@api.get("/admin/invitations")
async def list_invitations(admin=Depends(require_admin)):
    invites = await db.invitations.find({"org_id": admin.get("org_id")}, {"_id": 0}).sort("invited_at", -1).to_list(500)
    return [_invite_public(i) for i in invites]

@api.post("/admin/invitations")
async def create_invitation(body: InviteCreateReq, admin=Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "This email already belongs to a user")
    existing = await db.invitations.find_one({"org_id": admin.get("org_id"), "email": email}, {"_id": 0})
    if existing and invite_status(existing) == "pending":
        raise HTTPException(400, "An invitation is already pending for this email")
    role = body.role if body.role in ("employee", "admin", "team_lead") else "employee"
    inv = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "email": email,
        "name": body.name,
        "role": role,
        "department": body.department,
        "status": "pending",
        "token": secrets.token_urlsafe(24),
        "invited_by": admin["id"],
        "invited_at": now_iso(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRE_DAYS)).isoformat(),
        "accepted_at": None,
    }
    await db.invitations.insert_one(dict(inv))
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    inv["accept_link"] = f"{frontend_url}/accept-invite/{inv['token']}"
    inv.pop("_id", None)
    return inv

@api.post("/admin/invitations/{iid}/resend")
async def resend_invitation(iid: str, admin=Depends(require_admin)):
    """No email provider is configured; 'resend' just refreshes the token/expiry so the admin
    can re-share the accept link."""
    inv = await db.invitations.find_one({"id": iid, "org_id": admin.get("org_id")}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invitation not found")
    if invite_status(inv) not in ("pending", "expired"):
        raise HTTPException(400, "Only pending or expired invitations can be resent")
    token = secrets.token_urlsafe(24)
    expires_at = (datetime.now(timezone.utc) + timedelta(days=INVITE_EXPIRE_DAYS)).isoformat()
    await db.invitations.update_one(
        {"id": iid}, {"$set": {"token": token, "status": "pending", "expires_at": expires_at}}
    )
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    inv.update({"token": token, "status": "pending", "expires_at": expires_at})
    inv["accept_link"] = f"{frontend_url}/accept-invite/{token}"
    return inv

@api.delete("/admin/invitations/{iid}")
async def cancel_invitation(iid: str, admin=Depends(require_admin)):
    inv = await db.invitations.find_one({"id": iid, "org_id": admin.get("org_id")}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invitation not found")
    await db.invitations.update_one({"id": iid}, {"$set": {"status": "cancelled"}})
    return {"cancelled": True}

class ChallengeCreate(BaseModel):
    title: str
    reward: int
    target: int
    type: str
    scope: Optional[str] = "daily"  # daily|weekly

@api.post("/admin/challenges")
async def admin_create_challenge(body: ChallengeCreate, admin=Depends(require_admin)):
    ch = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "title": body.title,
        "reward": body.reward,
        "target": body.target,
        "type": body.type,
        "scope": body.scope,
        "created_at": now_iso(),
    }
    await db.challenges_custom.insert_one(ch)
    ch.pop("_id", None)
    return ch

@api.get("/admin/challenges")
async def admin_list_challenges(admin=Depends(require_admin)):
    items = await db.challenges_custom.find(org_q(admin), {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.delete("/admin/challenges/{cid}")
async def admin_del_challenge(cid: str, admin=Depends(require_admin)):
    res = await db.challenges_custom.delete_one(org_q(admin, id=cid))
    if res.deleted_count == 0:
        raise HTTPException(404, "Challenge not found")
    return {"deleted": True}

class ReminderConfig(BaseModel):
    water_interval_min: int = 60
    eye_care_interval_min: int = 20
    stand_interval_min: int = 90
    enabled: bool = True

@api.get("/admin/reminders")
async def get_reminder_config(admin=Depends(require_admin)):
    key = f"reminders:{admin.get('org_id')}"
    cfg = await db.config.find_one({"key": key}, {"_id": 0})
    if not cfg:
        cfg = {"key": key, "org_id": admin.get("org_id"), **ReminderConfig().model_dump()}
        await db.config.insert_one(dict(cfg))
    return cfg

@api.put("/admin/reminders")
async def set_reminder_config(body: ReminderConfig, admin=Depends(require_admin)):
    key = f"reminders:{admin.get('org_id')}"
    await db.config.update_one(
        {"key": key},
        {"$set": {"key": key, "org_id": admin.get("org_id"), **body.model_dump()}},
        upsert=True,
    )
    return body.model_dump()

@api.get("/admin/analytics")
async def admin_analytics(admin=Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_iso = now.date().isoformat()
    week_iso = (now - timedelta(days=7)).isoformat()
    month_iso = (now - timedelta(days=30)).isoformat()

    # activities/moods are per-user rows; scope them through the org's member list
    members = await org_member_ids(admin.get("org_id"))
    in_org = {"user_id": {"$in": members}}

    total_users = len(members)
    dau = len(await db.activities.distinct("user_id", {**in_org, "created_at": {"$gte": today_iso}}))
    wau = len(await db.activities.distinct("user_id", {**in_org, "created_at": {"$gte": week_iso}}))
    mau = len(await db.activities.distinct("user_id", {**in_org, "created_at": {"$gte": month_iso}}))

    # mood heatmap this week
    moods = await db.moods.find({**in_org, "created_at": {"$gte": week_iso}}, {"_id": 0}).to_list(1000)
    mood_counts = {}
    for m in moods:
        mood_counts[m["label"]] = mood_counts.get(m["label"], 0) + 1
    mood_chart = [{"label": k, "count": v} for k, v in mood_counts.items()]

    # activities per type this week
    act_pipeline = [
        {"$match": {**in_org, "created_at": {"$gte": week_iso}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    acts = await db.activities.aggregate(act_pipeline).to_list(50)
    act_chart = [{"type": a["_id"], "count": a["count"]} for a in acts]

    # posts, shoutouts, feedback counts
    posts = await db.posts.count_documents(org_q(admin))
    shouts = await db.shoutouts.count_documents(org_q(admin))
    fb = await db.feedback.count_documents(org_q(admin))
    help_p = await db.help_posts.count_documents(org_q(admin))

    # 7-day activity trend
    trend = []
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        d_next = (now - timedelta(days=i - 1)).date().isoformat()
        cnt = await db.activities.count_documents({**in_org, "created_at": {"$gte": d, "$lt": d_next}})
        trend.append({"day": d[-5:], "count": cnt})

    return {
        "total_users": total_users,
        "dau": dau, "wau": wau, "mau": mau,
        "mood_chart": mood_chart,
        "activity_chart": act_chart,
        "counts": {"posts": posts, "shoutouts": shouts, "feedback": fb, "help_posts": help_p},
        "trend": trend,
    }

# ---------- Music ----------
PLAYLISTS = {
    "focus": {
        "id": "focus",
        "name": " Focus Mode",
        "color": "#00E5FF",
        "tracks": [
            {"id": "f1", "title": "Lofi Brain", "artist": "Beats Inc", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "duration": 372},
            {"id": "f2", "title": "Deep Work", "artist": "Studio One", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", "duration": 425},
            {"id": "f3", "title": "Code Flow", "artist": "DevBeats", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", "duration": 410},
        ],
    },
    "relax": {
        "id": "relax",
        "name": " Relax Vibes",
        "color": "#00C853",
        "tracks": [
            {"id": "r1", "title": "Slow Sunday", "artist": "Chillax", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", "duration": 235},
            {"id": "r2", "title": "Cloud Drift", "artist": "Ambient FM", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", "duration": 318},
            {"id": "r3", "title": "Ocean Mind", "artist": "Soft Loops", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3", "duration": 290},
        ],
    },
    "energy": {
        "id": "energy",
        "name": " Energy Boost",
        "color": "#FF4D6D",
        "tracks": [
            {"id": "e1", "title": "Power Hour", "artist": "PumpUp", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3", "duration": 198},
            {"id": "e2", "title": "Wake The Heck Up", "artist": "Loud Kid", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", "duration": 244},
            {"id": "e3", "title": "Lift Off", "artist": "Rocket", "url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3", "duration": 280},
        ],
    },
}

@api.get("/music/playlists")
async def music_playlists():
    return list(PLAYLISTS.values())

# ---------- Polls ----------
class PollCreate(BaseModel):
    question: str
    options: List[str]
    expires_in_days: Optional[int] = 7

@api.post("/polls")
async def create_poll(body: PollCreate, user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "team_lead"):
        raise HTTPException(403, "Lead/admin only")
    if len(body.options) < 2 or len(body.options) > 5:
        raise HTTPException(400, "Need 2-5 options")
    poll = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "question": body.question,
        "options": [{"text": o, "votes": []} for o in body.options],
        "creator_id": user["id"],
        "creator_name": user["name"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=body.expires_in_days or 7)).isoformat(),
        "created_at": now_iso(),
    }
    await db.polls.insert_one(poll)
    poll.pop("_id", None)
    return poll

@api.get("/polls")
async def list_polls(user=Depends(get_current_user)):
    items = await db.polls.find(org_q(user), {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/polls/{pid}/vote")
async def vote_poll(pid: str, body: dict, user=Depends(get_current_user)):
    option_idx = body.get("option_idx")
    if not isinstance(option_idx, int):
        raise HTTPException(400, "option_idx required")
    poll = await db.polls.find_one(org_q(user, id=pid), {"_id": 0})
    if not poll:
        raise HTTPException(404, "Not found")
    options = poll.get("options", [])
    if not 0 <= option_idx < len(options):
        raise HTTPException(400, "Invalid option")
    # remove user's prior vote
    had_voted = False
    for o in options:
        if user["id"] in o.get("votes", []):
            o["votes"].remove(user["id"])
            had_voted = True
    options[option_idx].setdefault("votes", []).append(user["id"])
    await db.polls.update_one({"id": pid}, {"$set": {"options": options}})
    if not had_voted:  # changing your vote doesn't earn the participation points again
        await credit_points(user["id"], 2, user.get("org_id"))
    return {"options": options}

# ---------- Events (birthdays/anniversaries, doc section 7) ----------
class EventCreate(BaseModel):
    type: str  # birthday | anniversary
    user_id: str
    date: str  # YYYY-MM-DD (recurs annually)
    note: Optional[str] = ""

@api.post("/events")
async def create_event(body: EventCreate, admin=Depends(require_admin)):
    target = await db.users.find_one({"id": body.user_id, "org_id": admin.get("org_id")}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(404, "User not found in your organization")
    ev = {"id": str(uuid.uuid4()), "org_id": admin.get("org_id"), **body.model_dump(), "created_at": now_iso()}
    await db.events.insert_one(ev)
    ev.pop("_id", None)
    return ev

def _synth_profile_events(users: List[dict]) -> List[dict]:
    """Events should reflect profile info directly — a birthday/work-anniversary field
    saved on a profile shows up here with no separate admin step (doc section 7)."""
    this_year = datetime.now(timezone.utc).year
    out = []
    for u in users:
        if u.get("birthday"):
            out.append({
                "id": f"birthday:{u['id']}", "type": "birthday", "user_id": u["id"],
                "date": u["birthday"], "note": "", "user_name": u.get("name"),
                "user_avatar": u.get("avatar"), "department": u.get("department"),
            })
        if u.get("work_anniversary"):
            years = None
            try:
                years = this_year - int(u["work_anniversary"][:4])
            except Exception:
                pass
            out.append({
                "id": f"anniversary:{u['id']}", "type": "anniversary", "user_id": u["id"],
                "date": u["work_anniversary"], "note": "", "user_name": u.get("name"),
                "user_avatar": u.get("avatar"), "department": u.get("department"),
                "years_completed": years,
            })
    return out

async def _org_events(org_id: str) -> List[dict]:
    items = await db.events.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    for e in items:
        u = await db.users.find_one({"id": e["user_id"], "org_id": org_id}, {"_id": 0, "name": 1, "avatar": 1, "department": 1})
        if u:
            e["user_name"] = u.get("name")
            e["user_avatar"] = u.get("avatar")
            e["department"] = u.get("department")
    manual_keys = {(e["user_id"], e["type"]) for e in items}
    org_users = await db.users.find({"org_id": org_id}, {"_id": 0}).to_list(500)
    for s in _synth_profile_events(org_users):
        if (s["user_id"], s["type"]) not in manual_keys:
            items.append(s)
    return items

@api.get("/events")
async def list_events(user=Depends(get_current_user)):
    return await _org_events(user.get("org_id"))

@api.get("/events/today")
async def events_today(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    md = today.strftime("%m-%d")
    items = await _org_events(user.get("org_id"))
    return [e for e in items if e.get("date", "")[5:10] == md]

# ---------- Did You Know? (daily fact) ----------
FACTS_BANK = [
    {"id": "f001", "category": "AI & ML", "fact": "GPT-3 was trained on ~570GB of text — that's about a million books.", "color": "#FFE600"},
    {"id": "f002", "category": "Web Dev", "fact": "JavaScript was created in just 10 days by Brendan Eich in 1995.", "color": "#00E5FF"},
    {"id": "f003", "category": "Cybersecurity", "fact": "Over 30,000 websites get hacked daily — most via outdated plugins.", "color": "#FF4D6D"},
    {"id": "f004", "category": "Science", "fact": "A teaspoon of neutron star material weighs about 6 billion tons.", "color": "#00C853"},
    {"id": "f005", "category": "History of Tech", "fact": "The first 1GB hard drive (1980) cost $40,000 and weighed 550 lbs.", "color": "#FFE600"},
    {"id": "f006", "category": "AI & ML", "fact": "Deep learning models can have over 175 billion parameters.", "color": "#00E5FF"},
    {"id": "f007", "category": "Web Dev", "fact": "There are over 1.9 billion websites on the internet today.", "color": "#FF4D6D"},
    {"id": "f008", "category": "Cybersecurity", "fact": "The most common password is still '123456' — yes, in 2026.", "color": "#00C853"},
    {"id": "f009", "category": "Science", "fact": "Octopuses have three hearts and blue blood.", "color": "#FFE600"},
    {"id": "f010", "category": "History of Tech", "fact": "The first computer bug was a literal moth, found in 1947.", "color": "#00E5FF"},
    {"id": "f011", "category": "AI & ML", "fact": "Google search uses RankBrain, an AI, to handle 15% of new queries.", "color": "#FF4D6D"},
    {"id": "f012", "category": "Web Dev", "fact": "CSS turned 30 in 2026 — older than most engineers using it.", "color": "#00C853"},
    {"id": "f013", "category": "Science", "fact": "Bananas are slightly radioactive due to potassium-40.", "color": "#FFE600"},
    {"id": "f014", "category": "History of Tech", "fact": "Email predates the World Wide Web by ~20 years.", "color": "#00E5FF"},
]

@api.get("/facts/today")
async def fact_today(user=Depends(get_current_user)):
    idx = datetime.now(timezone.utc).timetuple().tm_yday % len(FACTS_BANK)
    f = FACTS_BANK[idx]
    reactions = await db.fact_reactions.find_one(org_q(user, fact_id=f["id"]), {"_id": 0}) or {"reactions": {}}
    return {**f, "reactions": reactions.get("reactions", {})}

class FactReact(BaseModel):
    fact_id: str
    reaction: str  # mind_blown | knew_it | hmm

ALLOWED_FACT_REACTS = ["mind_blown", "knew_it", "hmm"]

@api.post("/facts/react")
async def react_fact(body: FactReact, user=Depends(get_current_user)):
    if body.reaction not in ALLOWED_FACT_REACTS:
        raise HTTPException(400, "Invalid reaction")
    if not any(f["id"] == body.fact_id for f in FACTS_BANK):
        raise HTTPException(404, "Fact not found")
    doc = await db.fact_reactions.find_one(org_q(user, fact_id=body.fact_id), {"_id": 0}) or {"reactions": {}}
    reactions = doc.get("reactions", {})
    # remove other reactions by this user
    for r, users in list(reactions.items()):
        if user["id"] in users:
            reactions[r] = [u for u in users if u != user["id"]]
    arr = reactions.get(body.reaction, [])
    if user["id"] not in arr:
        arr.append(user["id"])
        # award +2 once per day per user (idempotent: check today's already)
    reactions[body.reaction] = arr
    await db.fact_reactions.update_one(
        org_q(user, fact_id=body.fact_id),
        {"$set": {"fact_id": body.fact_id, "org_id": user.get("org_id"), "reactions": reactions}},
        upsert=True,
    )
    return {"reactions": reactions}

# ---------- Word of the Day ----------
WORDS_BANK = [
    {"word": "Idempotent", "pron": "ai-dem-poh-tent", "def": "An operation that produces the same result no matter how many times you call it.", "example": "DELETE requests should be idempotent.", "tags": ["Backend", "QA"]},
    {"word": "Hoisting", "pron": "hoy-sting", "def": "JavaScript's behavior of moving declarations to the top of their scope.", "example": "Var hoisting can lead to subtle bugs.", "tags": ["Frontend"]},
    {"word": "Throughput", "pron": "throo-put", "def": "The rate at which a system processes work, usually requests per second.", "example": "We doubled API throughput by adding a cache.", "tags": ["Backend", "BA"]},
    {"word": "Race Condition", "pron": "race-kon-di-shun", "def": "A bug where output depends on uncontrollable timing of events.", "example": "Always lock the resource to avoid a race condition.", "tags": ["Backend", "QA"]},
    {"word": "Memoization", "pron": "mem-oh-eye-zay-shun", "def": "Caching expensive function results so repeated calls return faster.", "example": "useMemo memoizes a value across renders.", "tags": ["Frontend", "General"]},
    {"word": "Tech Debt", "pron": "tek-det", "def": "The implied cost of choosing an easy solution now over a better, slower one.", "example": "Refactor weekly to keep tech debt low.", "tags": ["General", "BA"]},
    {"word": "Webhook", "pron": "web-hook", "def": "An HTTP callback that fires when an event happens in a system.", "example": "Stripe sends a webhook on payment success.", "tags": ["Backend", "BA"]},
    {"word": "Flaky Test", "pron": "flay-kee", "def": "A test that passes and fails intermittently without code changes.", "example": "Quarantine flaky tests until fixed.", "tags": ["QA"]},
    {"word": "A11y", "pron": "ay-eleven-why", "def": "Numeronym for 'accessibility' (11 letters between A and y).", "example": "Run a11y audits on every release.", "tags": ["Frontend", "General"]},
    {"word": "Yak Shaving", "pron": "yak-shay-ving", "def": "Doing seemingly pointless tasks that lead up to the actual task.", "example": "Half my day was yak shaving build configs.", "tags": ["General"]},
]

@api.get("/words/today")
async def word_today():
    idx = datetime.now(timezone.utc).timetuple().tm_yday % len(WORDS_BANK)
    return {"id": f"w{idx}", **WORDS_BANK[idx]}

# ---------- Mini Game scores ----------
class GameScore(BaseModel):
    game: str  # bubble_pop | memory_match | word_scramble | zen_doodle
    score: int

@api.post("/games/scores")
async def submit_score(body: GameScore, user=Depends(get_current_user)):
    sc = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_avatar": user.get("avatar", ""),
        "game": body.game,
        "score": body.score,
        "created_at": now_iso(),
    }
    await db.game_scores.insert_one(sc)
    sc.pop("_id", None)
    # Award some points (capped)
    pts = min(20, body.score // 10)
    if pts > 0:
        await credit_points(user["id"], pts, user.get("org_id"))
    return {"score": sc, "points_awarded": pts}

@api.get("/games/leaderboard")
async def game_leaderboard(game: Optional[str] = None, user=Depends(get_current_user)):
    q = org_q(user)
    if game:
        q["game"] = game
    pipeline = [
        {"$match": q},
        {"$group": {"_id": {"user_id": "$user_id", "user_name": "$user_name", "user_avatar": "$user_avatar"}, "best": {"$max": "$score"}}},
        {"$sort": {"best": -1}},
        {"$limit": 20},
    ]
    rows = await db.game_scores.aggregate(pipeline).to_list(20)
    return [{"user_id": r["_id"]["user_id"], "user_name": r["_id"]["user_name"], "user_avatar": r["_id"]["user_avatar"], "best": r["best"]} for r in rows]

# ---------- Quizzes ----------
QUIZZES = {
    "Engineering": [
        {"q": "What does ACID stand for in DB?", "options": ["Atomicity, Consistency, Isolation, Durability", "All Caps Inside Database", "Async Calls In Daemon", "A Cool Indexing Diagram"], "answer": 0},
        {"q": "Which HTTP method is idempotent?", "options": ["POST", "PATCH", "PUT", "CONNECT"], "answer": 2},
        {"q": "What is JWT mainly used for?", "options": ["Email", "Auth/session", "DB queries", "CSS styling"], "answer": 1},
        {"q": "Which is NOT a NoSQL database?", "options": ["MongoDB", "Redis", "PostgreSQL", "Cassandra"], "answer": 2},
        {"q": "Big-O of binary search?", "options": ["O(n)", "O(log n)", "O(n log n)", "O(1)"], "answer": 1},
    ],
    "Design": [
        {"q": "What's WCAG?", "options": ["Web Color Group", "Web Content Accessibility Guidelines", "Web Component Architecture", "Wide Canvas Graphics"], "answer": 1},
        {"q": "Min contrast ratio for AA text?", "options": ["3:1", "4.5:1", "7:1", "2:1"], "answer": 1},
        {"q": "Hick's Law is about?", "options": ["Decision time vs choices", "Color theory", "Typography", "Animations"], "answer": 0},
        {"q": "What's a 'design token'?", "options": ["NFT", "Reusable design value (color/size)", "Subscription unit", "User session"], "answer": 1},
        {"q": "Which is a UI law?", "options": ["Newton's Third", "Fitts's Law", "Boyle's Law", "Gauss's Law"], "answer": 1},
    ],
    "Marketing": [
        {"q": "What's CTR?", "options": ["Cost To Run", "Click-Through Rate", "Conversion Tracking Rate", "Customer Trust Ratio"], "answer": 1},
        {"q": "SEO stands for?", "options": ["Site Engine Output", "Search Engine Optimization", "Sales Email Outreach", "Server Endpoint Object"], "answer": 1},
        {"q": "Funnel top usually has?", "options": ["Loyal users", "Awareness traffic", "VIP customers", "Refunds"], "answer": 1},
        {"q": "A/B test is for?", "options": ["Backups", "Testing 2 variants", "API benchmarks", "Audit logs"], "answer": 1},
        {"q": "LTV means?", "options": ["Long Term Vacation", "Lifetime Value", "Last Track Variance", "Live TV"], "answer": 1},
    ],
    "HR": [
        {"q": "OKR stands for?", "options": ["Office Key Reports", "Objectives and Key Results", "Only Key Resources", "Optional KR"], "answer": 1},
        {"q": "What's onboarding?", "options": ["Hiring", "Process to integrate new joiners", "Layoffs", "Performance reviews"], "answer": 1},
        {"q": "1-on-1s are for?", "options": ["Firing people", "Manager-employee sync", "Sales calls", "Interviews"], "answer": 1},
        {"q": "What's psychological safety?", "options": ["Insurance", "Feeling safe to speak up", "Office security", "Mental health break"], "answer": 1},
        {"q": "PIP usually means?", "options": ["Performance Improvement Plan", "Pay In Pieces", "Picture In Picture", "Project Initiation Plan"], "answer": 0},
    ],
    "Product": [
        {"q": "What's a PRD?", "options": ["Production Release Date", "Product Requirements Document", "Public Release Demo", "Performance Review Doc"], "answer": 1},
        {"q": "MVP means?", "options": ["Most Valuable Player", "Minimum Viable Product", "Maximum Velocity Push", "Multi-Vendor Pipeline"], "answer": 1},
        {"q": "Jobs-to-be-Done focuses on?", "options": ["Tasks list", "Customer's underlying goal", "Team workflow", "Sprint planning"], "answer": 1},
        {"q": "RICE prioritization includes?", "options": ["Reach, Impact, Confidence, Effort", "Rate, Index, Cost, Energy", "Risk, Income, Cost, Equity", "Reach, Income, Cap, Earnings"], "answer": 0},
        {"q": "What's churn?", "options": ["Customers leaving", "New signups", "Revenue per user", "App version"], "answer": 0},
    ],
    "Management": [
        {"q": "What's a SWOT?", "options": ["Strengths, Weaknesses, Ops, Threats", "Strengths, Weaknesses, Opportunities, Threats", "Sales, Web, Ops, Tech", "Strategy, Wins, Outputs, Targets"], "answer": 1},
        {"q": "KPI means?", "options": ["Key Performance Indicator", "Known Public Info", "Kept Process Internal", "Key People Index"], "answer": 0},
        {"q": "Span of control is?", "options": ["Servers managed", "Direct reports a manager has", "Project deadlines", "Budget cap"], "answer": 1},
        {"q": "RACI matrix tracks?", "options": ["Responsibility roles", "Risk levels", "Revenue", "Recurring audits"], "answer": 0},
        {"q": "Servant leadership means?", "options": ["Boss-first", "Leader serves the team", "Hands-off", "Strict hierarchy"], "answer": 1},
    ],
    "General": [
        {"q": "Pomodoro is?", "options": ["Italian sauce", "25-min focus + 5-min break technique", "Calendar app", "Mood tracker"], "answer": 1},
        {"q": "20-20-20 rule is for?", "options": ["Salary", "Eye health", "Hydration", "Sleep"], "answer": 1},
        {"q": "Best for hydration tracking?", "options": ["Random sips", "Set water reminders", "Coffee only", "Soda"], "answer": 1},
        {"q": "Standing every X minutes?", "options": ["Never", "Every 30-60 min", "Every 5 hours", "Once a day"], "answer": 1},
        {"q": "Mindfulness helps with?", "options": ["Coding speed only", "Stress + focus", "Salary", "Promotions"], "answer": 1},
    ],
}

@api.get("/quizzes")
async def get_quiz(department: Optional[str] = None, user=Depends(get_current_user)):
    dept = department or user.get("department") or "General"
    # Check for custom quiz first
    custom = await db.custom_quizzes.find_one(org_q(user, department=dept), {"_id": 0})
    if custom and custom.get("questions"):
        return {
            "department": dept,
            "title": custom.get("title", f"{dept} Quiz"),
            "questions": [{"q": q["q"], "options": q["options"]} for q in custom["questions"]],
            "custom": True,
        }
    if dept not in QUIZZES:
        dept = "General"
    return {"department": dept, "questions": [{"q": q["q"], "options": q["options"]} for q in QUIZZES[dept]]}

class QuizSubmit(BaseModel):
    department: str
    answers: List[int]

@api.post("/quizzes/submit")
async def submit_quiz(body: QuizSubmit, user=Depends(get_current_user)):
    dept = body.department
    custom = await db.custom_quizzes.find_one(org_q(user, department=dept), {"_id": 0})
    if custom and custom.get("questions"):
        questions = custom["questions"]
    else:
        if dept not in QUIZZES:
            dept = "General"
        questions = QUIZZES[dept]
    correct = 0
    results = []
    for i, q in enumerate(questions):
        ans = body.answers[i] if i < len(body.answers) else -1
        ok = (ans == q["answer"])
        if ok:
            correct += 1
        results.append({"q": q["q"], "your": ans, "correct": q["answer"], "ok": ok})
    pc = await get_points_config(user.get("org_id"))
    pts = correct * pc.get("quiz_per_correct", 3) + (pc.get("quiz_perfect_bonus", 15) if correct == len(questions) else 0)
    rec = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "department": dept,
        "score": correct,
        "total": len(questions),
        "points_awarded": pts,
        "created_at": now_iso(),
    }
    await db.quiz_results.insert_one(rec)
    rec.pop("_id", None)
    if pts:
        await credit_points(user["id"], pts, user.get("org_id"))
    return {"correct": correct, "total": len(questions), "points": pts, "results": results}

# ---------- Buddy System ----------
@api.get("/buddy/me")
async def my_buddy(user=Depends(get_current_user)):
    pair = await db.buddies.find_one({"$or": [{"buddy_a": user["id"]}, {"buddy_b": user["id"]}]}, {"_id": 0})
    if not pair:
        return None
    other_id = pair["buddy_b"] if pair["buddy_a"] == user["id"] else pair["buddy_a"]
    other = await db.users.find_one(org_q(user, id=other_id), PUBLIC_USER_FIELDS)
    if not other:  # stale cross-org pairing from before tenant isolation — hide it
        return None
    return {"pairing": pair, "buddy": other}

@api.post("/buddy/pair")
async def pair_buddy(user=Depends(get_current_user)):
    # if already paired, return
    existing = await db.buddies.find_one({"$or": [{"buddy_a": user["id"]}, {"buddy_b": user["id"]}]}, {"_id": 0})
    if existing:
        other_id = existing["buddy_b"] if existing["buddy_a"] == user["id"] else existing["buddy_a"]
        other = await db.users.find_one(org_q(user, id=other_id), PUBLIC_USER_FIELDS)
        if other:
            return {"pairing": existing, "buddy": other}
        await db.buddies.delete_one({"id": existing["id"]})  # cross-org pairing: re-pair in-org
    # find someone same department or random — always within the caller's org
    dept = user.get("department")
    fields = {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1}
    candidates = await db.users.find(org_q(user, id={"$ne": user["id"]}, department=dept), fields).to_list(50)
    if not candidates:
        candidates = await db.users.find(org_q(user, id={"$ne": user["id"]}), fields).to_list(50)
    if not candidates:
        raise HTTPException(404, "No buddies available")
    other = random.choice(candidates)
    pairing = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "buddy_a": user["id"],
        "buddy_b": other["id"],
        "started_at": now_iso(),
        "checkins": [],
    }
    await db.buddies.insert_one(pairing)
    pairing.pop("_id", None)
    full_other = await db.users.find_one(org_q(user, id=other["id"]), PUBLIC_USER_FIELDS)
    return {"pairing": pairing, "buddy": full_other}

@api.post("/buddy/checkin")
async def buddy_checkin(user=Depends(get_current_user)):
    pair = await db.buddies.find_one({"$or": [{"buddy_a": user["id"]}, {"buddy_b": user["id"]}]}, {"_id": 0})
    if not pair:
        raise HTTPException(404, "No buddy")
    checkins = pair.get("checkins", []) + [{"user_id": user["id"], "at": now_iso()}]
    await db.buddies.update_one({"id": pair["id"]}, {"$set": {"checkins": checkins}})
    await credit_points(user["id"], 10, user.get("org_id"))
    return {"checkins": len(checkins)}

# ---------- Employee Spotlight (weekly rotation) ----------
@api.get("/spotlight/current")
async def spotlight_current(user=Depends(get_current_user)):
    users = await db.users.find(org_q(user, status={"$ne": "deactivated"}), {**PUBLIC_USER_FIELDS, "created_at": 1}).sort("created_at", 1).to_list(500)
    if not users:
        return None
    # week-of-year based rotation
    woy = datetime.now(timezone.utc).isocalendar()[1]
    pick = users[woy % len(users)]
    pick["fun_facts"] = [
        f"Has been crushing it since joining {pick.get('department', 'the team')}",
        f"Currently rocking a {pick.get('streak', 0)}-day streak ",
        f"Wellness score: {pick.get('wellness_score', 50)}/100",
    ]
    pick["quote"] = "The only bad workout is the one that didn't happen."
    return pick

# ---------- Learning Bites ----------
LEARNING_BITES = [
    {"id": "lb1", "department": "Engineering", "title": "Use --depth=1 in git clone for faster pulls", "body": "Shallow clone fetches only the latest commit — saves time on big repos.", "format": "text",
     "options": ["It rewrites the remote history.", "It fetches only the latest commit, so clones are much faster.", "It disables git hooks."], "correct_index": 1,
     "resource_url": "https://git-scm.com/docs/git-clone"},
    {"id": "lb2", "department": "Engineering", "title": "Optimize MongoDB with compound indexes", "body": "Order matters: most-equality-first then range. Match your $sort fields too.", "format": "text",
     "options": ["Range fields first, then equality.", "Order never matters in a compound index.", "Equality fields first, then sort, then range."], "correct_index": 2,
     "resource_url": "https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/"},
    {"id": "lb3", "department": "Design", "title": "Use 8pt grid for spacing", "body": "Multiples of 8 (8/16/24/32) keep everything visually consistent across breakpoints.", "format": "text",
     "options": ["It makes spacing consistent across breakpoints.", "It makes fonts render faster.", "It is required by CSS."], "correct_index": 0,
     "resource_url": "https://spec.fm/specifics/8-pt-grid"},
    {"id": "lb4", "department": "Design", "title": "Color contrast — aim for 4.5:1", "body": "Use Stark or Contrast Ratio plugin. Most a11y issues are color-related.", "format": "text",
     "options": ["3:1 for all body text.", "4.5:1 for normal body text.", "10:1 for everything."], "correct_index": 1,
     "resource_url": "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html"},
    {"id": "lb5", "department": "Marketing", "title": "Write CTAs that lead with benefit", "body": "‘Get my 7-day plan’ beats ‘Submit’ — every time.", "format": "text",
     "options": ["Describe the action mechanically.", "Lead with the benefit the reader gets.", "Always use a single word."], "correct_index": 1,
     "resource_url": "https://www.nngroup.com/articles/call-to-action-buttons/"},
    {"id": "lb6", "department": "HR", "title": "Run 1-on-1s as the report owns the agenda", "body": "Manager listens. Their cadence = relationship cadence.", "format": "text",
     "options": ["The manager owns the agenda.", "Nobody prepares an agenda.", "The report owns the agenda."], "correct_index": 2,
     "resource_url": "https://about.gitlab.com/handbook/leadership/1-1/"},
    {"id": "lb7", "department": "Product", "title": "Prioritize using RICE", "body": "Reach × Impact × Confidence ÷ Effort = score. Stack-rank ruthlessly.", "format": "text",
     "options": ["Reach × Impact × Confidence ÷ Effort", "Revenue × Impact ÷ Cost", "Risk × Impact × Cost × Effort"], "correct_index": 0,
     "resource_url": "https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/"},
    {"id": "lb8", "department": "General", "title": "The 2-minute rule", "body": "If a task takes <2 mins, do it now. Saves the mental tax of a todo list.", "format": "text",
     "options": ["Schedule it for next week.", "Do it immediately.", "Delegate it."], "correct_index": 1,
     "resource_url": "https://jamesclear.com/how-to-stop-procrastinating"},
    {"id": "lb9", "department": "General", "title": "Stand for every meeting under 15 min", "body": "Better posture, faster decisions. Try it tomorrow.", "format": "text",
     "options": ["Meetings run longer.", "Posture and decision speed both improve.", "It has no measurable effect."], "correct_index": 1,
     "resource_url": "https://hbr.org/2014/06/why-stand-up-meetings-work"},
    {"id": "lb10", "department": "QA", "title": "Boundary value testing", "body": "Test at min, max, just-below, just-above. Most bugs hide at edges.", "format": "text",
     "options": ["In the middle of the valid range.", "At and around the boundaries of the valid range.", "Only with random values."], "correct_index": 1,
     "resource_url": "https://en.wikipedia.org/wiki/Boundary-value_analysis"},
]

@api.get("/learning-bites")
async def get_bites(department: Optional[str] = None, user=Depends(get_current_user)):
    if department and department != "All":
        bites = [b for b in LEARNING_BITES if b["department"] == department]
    else:
        bites = LEARNING_BITES
    members = await org_member_ids(user.get("org_id"))
    mine = {t["bite_id"]: t for t in await db.bite_tried.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)}
    quiz_first = {a["bite_id"]: a for a in await db.bite_attempts.find({"user_id": user["id"], "first": True}, {"_id": 0}).to_list(500)}
    out = []
    for b in bites:
        cnt = await db.bite_tried.count_documents({"bite_id": b["id"], "user_id": {"$in": members}})
        public = {k: v for k, v in b.items() if k != "correct_index"}  # graded server-side only (QA #13)
        out.append({
            **public,
            "tried_count": cnt,
            "completed": b["id"] in mine,
            "completed_mode": (mine.get(b["id"]) or {}).get("mode"),
            "quiz_attempted": b["id"] in quiz_first,
        })
    return out

BITE_MODES = ("quiz", "reflect", "deepdive", "vouch")
REFLECTION_MIN_CHARS = 25
REFLECTION_MIN_WORDS = 5

class BiteTriedReq(BaseModel):
    mode: Optional[str] = None          # quiz | reflect | deepdive | vouch
    meta: Optional[str] = None          # reflection text or tagged colleague handle
    answer_index: Optional[int] = None  # quiz: the option the user picked

def reflection_problem(text: str, bite: dict) -> Optional[str]:
    """Why a reflection is too thin to earn points (QA #14), or None if it's acceptable.
    Aims to stop 'a', 'asdfgh', 'good good good' or a pasted title — not to judge quality."""
    t = " ".join((text or "").split())
    words = re.findall(r"[A-Za-z']+", t)
    if len(t) < REFLECTION_MIN_CHARS or len(words) < REFLECTION_MIN_WORDS:
        return f"Write at least {REFLECTION_MIN_WORDS} words ({REFLECTION_MIN_CHARS}+ characters) about how you'll apply this."
    lowered = [w.lower() for w in words]
    if len(set(lowered)) < max(4, len(lowered) // 3):
        return "Your reflection repeats the same words — say a little more in your own words."
    if re.search(r"(.)\1{4,}", t):
        return "That doesn't look like a real sentence — try describing how you'll use this."
    letters = sum(c.isalpha() for c in t)
    if letters < 0.6 * len(t.replace(" ", "")):
        return "Please write your reflection in words."
    real = [w for w in lowered if len(w) > 2]
    vowelless = [w for w in real if not re.search(r"[aeiouy]", w)]
    if real and len(vowelless) > len(real) / 3:
        return "That doesn't look like a real sentence — try describing how you'll use this."
    for source in (bite.get("title", ""), bite.get("body", "")):
        if source and t.lower() == " ".join(source.split()).lower():
            return "Put it in your own words rather than copying the tip."
    return None

@api.post("/learning-bites/{bite_id}/tried")
async def tried_bite(bite_id: str, body: BiteTriedReq = None, user=Depends(get_current_user)):
    bite = next((b for b in LEARNING_BITES if b["id"] == bite_id), None)
    if not bite:
        raise HTTPException(404, "Learning bite not found")
    body = body or BiteTriedReq()
    mode = (body.mode or "").strip().lower()
    if mode not in BITE_MODES:
        raise HTTPException(400, f"mode must be one of: {', '.join(BITE_MODES)}")
    meta = (body.meta or "").strip()

    existing = await db.bite_tried.find_one({"bite_id": bite_id, "user_id": user["id"]}, {"_id": 0})

    if mode == "quiz":
        # QA #13: grade on the server. Only the first answer can earn points; retries are
        # allowed so people can learn the answer, but they never credit anything.
        if not isinstance(body.answer_index, int) or not 0 <= body.answer_index < len(bite.get("options") or []):
            raise HTTPException(400, "Pick one of the answer options")
        correct = body.answer_index == bite["correct_index"]
        prior = await db.bite_attempts.find_one({"bite_id": bite_id, "user_id": user["id"], "first": True}, {"_id": 0})
        await db.bite_attempts.insert_one({
            "id": str(uuid.uuid4()), "org_id": user.get("org_id"), "bite_id": bite_id,
            "user_id": user["id"], "answer_index": body.answer_index, "correct": correct,
            "first": prior is None, "at": now_iso(),
        })
        if not correct:
            return {"correct": False, "awarded": 0, "already": bool(existing),
                    "message": "Not quite — no points for this one. Give it another look and try again."}
        if prior is not None or existing:
            return {"correct": True, "awarded": 0, "already": True,
                    "message": "Correct! Points are only awarded for a correct first answer."}
    elif mode == "reflect":
        problem = reflection_problem(meta, bite)
        if problem:
            raise HTTPException(400, problem)
    elif mode == "vouch":
        handle = meta.lstrip("@").strip().lower()
        if not handle:
            raise HTTPException(400, "Tag a teammate from your organization")
        teammates = await db.users.find(
            org_q(user, id={"$ne": user["id"]}, status={"$ne": "deactivated"}),
            {"_id": 0, "name": 1, "first_name": 1, "nickname": 1, "email": 1},
        ).to_list(1000)
        names = set()
        for t in teammates:
            names |= {(t.get("name") or "").lower(), (t.get("first_name") or "").lower(),
                      (t.get("nickname") or "").lower(), (t.get("email") or "").split("@")[0].lower()}
        if handle not in names - {""}:
            raise HTTPException(400, "Tag a teammate from your organization (by name or @handle)")

    if existing:
        return {"already": True, "awarded": 0, "mode": existing.get("mode"), "correct": True if mode == "quiz" else None}

    pc = await get_points_config(user.get("org_id"))
    pts = int(pc.get("bite_tried", 5))
    try:
        await db.bite_tried.insert_one({
            "id": str(uuid.uuid4()),
            "org_id": user.get("org_id"),
            "bite_id": bite_id,
            "user_id": user["id"],
            "mode": mode,
            "meta": meta[:1000],
            "points": pts,
            "at": now_iso(),
        })
    except DuplicateKeyError:  # a concurrent double-submit already claimed it
        return {"already": True, "awarded": 0, "mode": mode}
    await credit_points(user["id"], pts, user.get("org_id"))
    return {"awarded": pts, "already": False, "mode": mode, "correct": True if mode == "quiz" else None}

# ---------- Desk Plant Challenge ----------
@api.post("/plants/optin")
async def plant_optin(user=Depends(get_current_user)):
    existing = await db.plants.find_one({"user_id": user["id"]})
    if existing:
        existing.pop("_id", None)
        return existing
    p = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_avatar": user.get("avatar", ""),
        "checkins": [],
        "streak": 0,
        "started_at": now_iso(),
    }
    await db.plants.insert_one(p)
    p.pop("_id", None)
    return p

@api.get("/plants/me")
async def my_plant(user=Depends(get_current_user)):
    p = await db.plants.find_one({"user_id": user["id"]}, {"_id": 0})
    return p

@api.post("/plants/checkin")
async def plant_checkin(user=Depends(get_current_user)):
    p = await db.plants.find_one({"user_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Opt in first")
    today = datetime.now(timezone.utc).date().isoformat()
    if any(c.startswith(today) for c in p.get("checkins", [])):
        return {"already": True, "streak": p.get("streak", 0)}
    checkins = p.get("checkins", []) + [now_iso()]
    # Calc streak: consecutive distinct dates ending today
    dates = sorted({c[:10] for c in checkins})
    streak = 0
    cur = datetime.now(timezone.utc).date()
    for _ in range(len(dates) + 1):
        if cur.isoformat() in dates:
            streak += 1
            cur = cur - timedelta(days=1)
        else:
            break
    await db.plants.update_one({"user_id": user["id"]}, {"$set": {"checkins": checkins, "streak": streak}})
    await credit_points(user["id"], 3, user.get("org_id"))
    return {"streak": streak, "checkins": len(checkins)}

@api.get("/plants/leaderboard")
async def plant_leaderboard(user=Depends(get_current_user)):
    items = await db.plants.find(org_q(user), {"_id": 0}).sort("streak", -1).to_list(50)
    return items

# ---------- Wellness Recap (Monday auto-post) ----------
@api.post("/recap/post")
async def post_recap(admin=Depends(require_admin)):
    # Build a Monday recap post auto-posting to Fun Wall
    # top 3 by streak this week
    top = await db.users.find(org_q(admin), PUBLIC_USER_FIELDS).sort("streak", -1).to_list(3)
    teams = await db.users.aggregate([
        {"$match": org_q(admin)},
        {"$group": {"_id": "$department", "points": {"$sum": "$points"}}},
        {"$sort": {"points": -1}},
        {"$limit": 1},
    ]).to_list(1)
    top_team = teams[0]["_id"] if teams else "—"
    msg = " WEEKLY RECAP! Top streakers: " + ", ".join([f"{u['name']} ({u['streak']}d )" for u in top]) + f".  Team of the week: {top_team}!"
    post = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "user_id": admin["id"],
        "user_name": "Brutal Bot",
        "user_avatar": "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=BrutalBot&backgroundColor=000000",
        "content": msg,
        "image": "",
        "likes": [],
        "comments": [],
        "reactions": {},
        "created_at": now_iso(),
    }
    await db.posts.insert_one(post)
    post.pop("_id", None)
    return post

# ---------- Rewards (admin issues; users receive) ----------
REWARD_TYPES = ["coupon", "points", "shoutout"]

class RewardReq(BaseModel):
    user_id: str
    type: str
    points: Optional[int] = 0
    message: str
    code: Optional[str] = None  # for coupon

@api.post("/admin/rewards")
async def issue_reward(body: RewardReq, admin=Depends(require_admin)):
    if body.type not in REWARD_TYPES:
        raise HTTPException(400, "Invalid reward type")
    target = await db.users.find_one(org_q(admin, id=body.user_id), {"_id": 0, "name": 1, "id": 1})
    if not target:
        raise HTTPException(404, "User not found")
    rew = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "user_id": body.user_id,
        "user_name": target["name"],
        "issued_by": admin["name"],
        "issued_by_id": admin["id"],
        "type": body.type,
        "points": body.points or 0,
        "message": body.message,
        "code": body.code or "",
        "claimed": False,
        "created_at": now_iso(),
    }
    await db.rewards.insert_one(rew)
    rew.pop("_id", None)
    if body.type == "points" and body.points:
        await credit_points(body.user_id, body.points, admin.get("org_id"))
    await create_notification(
        user_id=body.user_id,
        kind="reward",
        title=f"🎁 You got a reward from {admin['name']}!",
        message=body.message[:160],
        icon="🎁",
        data={"reward_id": rew["id"], "type": body.type, "points": body.points or 0},
    )
    return rew

@api.get("/admin/rewards")
async def list_all_rewards(admin=Depends(require_admin)):
    items = await db.rewards.find(org_q(admin), {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.get("/rewards/me")
async def my_rewards(user=Depends(get_current_user)):
    items = await db.rewards.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/rewards/{rid}/claim")
async def claim_reward(rid: str, user=Depends(get_current_user)):
    rew = await db.rewards.find_one({"id": rid}, {"_id": 0})
    if not rew or rew["user_id"] != user["id"]:
        raise HTTPException(404, "Not found")
    await db.rewards.update_one({"id": rid}, {"$set": {"claimed": True, "claimed_at": now_iso()}})
    return {"claimed": True}

# ---------- Configurable Points & Gamification ----------
DEFAULT_POINTS_CONFIG = {
    "water": 10, "eye_care": 15, "stand": 10, "breathing": 20,
    "mood": 5, "post": 10, "quiz_per_correct": 3, "quiz_perfect_bonus": 15,
    "shoutout_sender": 5, "shoutout_receiver": 10, "poll_vote": 2,
    "buddy_checkin": 10, "plant_checkin": 3, "bite_tried": 5,
    "fact_react": 2, "game_score_per_10": 1, "game_score_max": 20,
    # Daily wellness goal bonuses, awarded at most once per module per day.
    "water_goal_xp": 50, "eye_break_goal_xp": 50,
    "move_reset_goal_xp": 50, "breathing_goal_xp": 50, "goal_coins": 5,
}

DEFAULT_GAME_CONFIG = {
    "level_threshold": 200,
    "streak_gap_hours": 36,
    "wellness_score_increment": 2,
}

async def get_points_config(org_id: Optional[str] = None):
    """Reward/point rules are organization-wide (doc section 3.3). Each org can override
    the shared defaults; orgs that haven't customized fall back to the legacy global doc."""
    if org_id:
        cfg = await db.config.find_one({"key": f"points_config:{org_id}"}, {"_id": 0})
        if cfg:
            return {**DEFAULT_POINTS_CONFIG, **{k: v for k, v in cfg.items() if k not in ("key", "org_id")}}
    cfg = await db.config.find_one({"key": "points_config"}, {"_id": 0})
    if not cfg:
        return DEFAULT_POINTS_CONFIG.copy()
    return {**DEFAULT_POINTS_CONFIG, **{k: v for k, v in cfg.items() if k != "key"}}

async def get_game_config(org_id: Optional[str] = None):
    """Level/streak rules are per organization, like the points config."""
    if org_id:
        cfg = await db.config.find_one({"key": f"game_config:{org_id}"}, {"_id": 0})
        if cfg:
            return {**DEFAULT_GAME_CONFIG, **{k: v for k, v in cfg.items() if k not in ("key", "org_id")}}
    cfg = await db.config.find_one({"key": "game_config"}, {"_id": 0})
    if not cfg:
        return DEFAULT_GAME_CONFIG.copy()
    return {**DEFAULT_GAME_CONFIG, **{k: v for k, v in cfg.items() if k != "key"}}

@api.get("/admin/points-config")
async def get_pc(admin=Depends(require_admin)):
    return await get_points_config(admin.get("org_id"))

@api.put("/admin/points-config")
async def set_pc(body: dict, admin=Depends(require_admin)):
    clean = {k: int(v) for k, v in body.items() if k in DEFAULT_POINTS_CONFIG and isinstance(v, (int, float))}
    org_id = admin.get("org_id")
    key = f"points_config:{org_id}" if org_id else "points_config"
    await db.config.update_one({"key": key}, {"$set": {"key": key, "org_id": org_id, **clean}}, upsert=True)
    return await get_points_config(org_id)

@api.get("/admin/game-config")
async def get_gc(admin=Depends(require_admin)):
    return await get_game_config(admin.get("org_id"))

@api.put("/admin/game-config")
async def set_gc(body: dict, admin=Depends(require_admin)):
    clean = {k: int(v) for k, v in body.items() if k in DEFAULT_GAME_CONFIG and isinstance(v, (int, float))}
    org_id = admin.get("org_id")
    key = f"game_config:{org_id}"
    await db.config.update_one({"key": key}, {"$set": {"key": key, "org_id": org_id, **clean}}, upsert=True)
    return await get_game_config(org_id)

# ---------- Manual Points Adjustment + Audit Log ----------
class PointAward(BaseModel):
    user_id: Optional[str] = None
    team_id: Optional[str] = None
    points: int
    reason: str

@api.post("/admin/points/award")
async def admin_award_points(body: PointAward, admin=Depends(require_admin)):
    if not body.user_id and not body.team_id:
        raise HTTPException(400, "Provide user_id or team_id")
    if body.user_id:
        await require_org_users(admin, [body.user_id])
    if body.team_id and not await db.game_teams.find_one(org_q(admin, id=body.team_id), {"_id": 1}):
        raise HTTPException(404, "Team not found")
    log = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "user_id": body.user_id,
        "team_id": body.team_id,
        "points": body.points,
        "reason": body.reason,
        "issued_by": admin["name"],
        "issued_by_id": admin["id"],
        "created_at": now_iso(),
    }
    if body.user_id:
        await credit_points(body.user_id, body.points, admin.get("org_id"))
    if body.team_id:
        await db.game_teams.update_one({"id": body.team_id}, {"$inc": {"team_points": body.points}})
    await db.points_log.insert_one(log)
    log.pop("_id", None)
    return log

@api.get("/admin/points/log")
async def points_log(admin=Depends(require_admin)):
    items = await db.points_log.find(org_q(admin), {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

# ---------- Quiz CRUD (admin) ----------
class QuizPayload(BaseModel):
    department: str
    title: Optional[str] = None
    questions: List[dict]  # [{q, options, answer}]

@api.get("/admin/quizzes")
async def admin_list_quizzes(admin=Depends(require_admin)):
    items = await db.custom_quizzes.find(org_q(admin), {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api.post("/admin/quizzes")
async def admin_create_quiz(body: QuizPayload, admin=Depends(require_admin)):
    for q in body.questions:
        if not isinstance(q.get("options"), list) or len(q["options"]) < 2:
            raise HTTPException(400, "Each question needs 2+ options")
        if not isinstance(q.get("answer"), int) or q["answer"] < 0 or q["answer"] >= len(q["options"]):
            raise HTTPException(400, "answer must be valid index")
    quiz = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "department": body.department,
        "title": body.title or f"{body.department} Quiz",
        "questions": body.questions,
        "created_at": now_iso(),
    }
    await db.custom_quizzes.insert_one(quiz)
    quiz.pop("_id", None)
    return quiz

@api.put("/admin/quizzes/{qid}")
async def admin_update_quiz(qid: str, body: QuizPayload, admin=Depends(require_admin)):
    for q in body.questions:
        if not isinstance(q.get("options"), list) or len(q["options"]) < 2:
            raise HTTPException(400, "Each question needs 2+ options")
        if not isinstance(q.get("answer"), int) or q["answer"] < 0 or q["answer"] >= len(q["options"]):
            raise HTTPException(400, "answer must be a valid index")
    res = await db.custom_quizzes.update_one(
        org_q(admin, id=qid),
        {"$set": {
            "department": body.department,
            "title": body.title or f"{body.department} Quiz",
            "questions": body.questions,
        }},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Quiz not found")
    updated = await db.custom_quizzes.find_one(org_q(admin, id=qid), {"_id": 0})
    return updated

@api.delete("/admin/quizzes/{qid}")
async def admin_delete_quiz(qid: str, admin=Depends(require_admin)):
    res = await db.custom_quizzes.delete_one(org_q(admin, id=qid))
    if res.deleted_count == 0:
        raise HTTPException(404, "Quiz not found")
    return {"deleted": True}

# ---------- Announcements (push notifications) ----------
class AnnouncementReq(BaseModel):
    title: str
    message: str
    target: str = "all"  # "all" or list as comma-separated user_ids
    target_user_ids: Optional[List[str]] = None
    kind: Optional[str] = "info"  # info, alert, party

@api.post("/admin/announcements")
async def create_announcement(body: AnnouncementReq, admin=Depends(require_admin)):
    if body.target == "all":
        recipient_ids = await org_member_ids(admin.get("org_id"))
    else:
        recipient_ids = [u["id"] for u in await require_org_users(admin, body.target_user_ids or [])]
    ann = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "title": body.title,
        "message": body.message,
        "kind": body.kind or "info",
        "from_id": admin["id"],
        "from_name": admin["name"],
        "recipients": recipient_ids,
        "read_by": [],
        "created_at": now_iso(),
    }
    await db.announcements.insert_one(ann)
    ann.pop("_id", None)
    # push a notification entry for each recipient so it shows in the bell
    kind_icon = {"info": "ℹ️", "alert": "⚠️", "party": "🎉"}.get(body.kind or "info", "📢")
    for uid in recipient_ids:
        await create_notification(
            user_id=uid,
            kind="announcement",
            title=body.title,
            message=body.message[:200],
            icon=kind_icon,
            data={"announcement_id": ann["id"], "from": admin["name"]},
        )
    return ann

@api.get("/admin/announcements")
async def admin_list_announcements(admin=Depends(require_admin)):
    items = await db.announcements.find(org_q(admin), {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api.get("/announcements/me")
async def my_announcements(user=Depends(get_current_user)):
    items = await db.announcements.find({"recipients": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in items:
        a["unread"] = user["id"] not in (a.get("read_by") or [])
    return items

@api.post("/announcements/{aid}/read")
async def mark_read(aid: str, user=Depends(get_current_user)):
    await db.announcements.update_one({"id": aid, "recipients": user["id"]}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}

# ---------- Game Teams ----------
GAME_TEAM_COLORS = ["yellow", "cyan", "pink", "green"]

class GameTeamReq(BaseModel):
    name: str
    color: Optional[str] = "yellow"

class GameTeamMembers(BaseModel):
    user_ids: List[str]

class ShuffleReq(BaseModel):
    num_teams: int = 4
    name_prefix: Optional[str] = "Squad"

@api.post("/admin/game-teams")
async def create_team(body: GameTeamReq, admin=Depends(require_admin)):
    t = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "name": body.name,
        "color": body.color or "yellow",
        "members": [],
        "team_points": 0,
        "created_at": now_iso(),
    }
    await db.game_teams.insert_one(t)
    t.pop("_id", None)
    return t

async def _teams_with_members(user: dict) -> List[dict]:
    items = await db.game_teams.find(org_q(user), {"_id": 0}).sort("team_points", -1).to_list(50)
    for t in items:
        t["member_details"] = await db.users.find(
            org_q(user, id={"$in": t.get("members", [])}),
            {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1},
        ).to_list(50)
    return items

@api.get("/admin/game-teams")
async def list_teams_admin(admin=Depends(require_admin)):
    return await _teams_with_members(admin)

@api.get("/game-teams")
async def list_teams_public(user=Depends(get_current_user)):
    return await _teams_with_members(user)

@api.patch("/admin/game-teams/{tid}")
async def update_team(tid: str, body: GameTeamReq, admin=Depends(require_admin)):
    res = await db.game_teams.update_one(org_q(admin, id=tid), {"$set": {"name": body.name, "color": body.color}})
    if res.matched_count == 0:
        raise HTTPException(404, "Team not found")
    return await db.game_teams.find_one(org_q(admin, id=tid), {"_id": 0})

@api.delete("/admin/game-teams/{tid}")
async def delete_team(tid: str, admin=Depends(require_admin)):
    res = await db.game_teams.delete_one(org_q(admin, id=tid))
    if res.deleted_count == 0:
        raise HTTPException(404, "Team not found")
    return {"deleted": True}

@api.put("/admin/game-teams/{tid}/members")
async def set_team_members(tid: str, body: GameTeamMembers, admin=Depends(require_admin)):
    if not await db.game_teams.find_one(org_q(admin, id=tid), {"_id": 1}):
        raise HTTPException(404, "Team not found")
    await require_org_users(admin, body.user_ids)
    # Remove these users from any other team in this org first (one team per user)
    for uid in body.user_ids:
        await db.game_teams.update_many(org_q(admin, id={"$ne": tid}), {"$pull": {"members": uid}})
    await db.game_teams.update_one(org_q(admin, id=tid), {"$set": {"members": body.user_ids}})
    return await db.game_teams.find_one(org_q(admin, id=tid), {"_id": 0})

@api.post("/admin/game-teams/shuffle")
async def shuffle_teams(body: ShuffleReq, admin=Depends(require_admin)):
    n = max(2, min(8, body.num_teams or 4))
    users = await db.users.find(org_q(admin, status={"$ne": "deactivated"}), {"_id": 0, "id": 1}).to_list(1000)
    random.shuffle(users)
    # delete this org's existing auto-shuffled teams to avoid pile-up
    await db.game_teams.delete_many(org_q(admin, auto_shuffled=True))
    teams = []
    for i in range(n):
        color = GAME_TEAM_COLORS[i % len(GAME_TEAM_COLORS)]
        t = {
            "id": str(uuid.uuid4()),
            "org_id": admin.get("org_id"),
            "name": f"{body.name_prefix or 'Squad'} {chr(65 + i)}",
            "color": color,
            "members": [],
            "team_points": 0,
            "auto_shuffled": True,
            "created_at": now_iso(),
        }
        teams.append(t)
    for idx, u in enumerate(users):
        teams[idx % n]["members"].append(u["id"])
    if teams:
        await db.game_teams.insert_many(teams)
    for t in teams:
        t.pop("_id", None)
    return teams

# ---------- Users lookup (for shoutout picker etc) ----------
@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    # Directory for pickers/mentions: same-org, active members, public profile fields only.
    users = await db.users.find(
        org_q(user, status={"$ne": "deactivated"}),
        {**PUBLIC_USER_FIELDS, "first_name": 1, "last_name": 1, "nickname": 1},
    ).sort("name", 1).to_list(500)
    return users

# ---------- Music object storage (Emergent) ----------
import requests as _req

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "wellness-garden"
_storage_key = None

def _init_storage(force=False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    r = _req.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    r.raise_for_status()
    _storage_key = r.json()["storage_key"]
    return _storage_key

def _put_object(path: str, data: bytes, content_type: str):
    k = _init_storage()
    r = _req.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": k, "Content-Type": content_type}, data=data, timeout=180)
    if r.status_code == 404:
        k = _init_storage(force=True)
        r = _req.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": k, "Content-Type": content_type}, data=data, timeout=180)
    r.raise_for_status()
    return r.json()

def _get_object(path: str):
    k = _init_storage()
    r = _req.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": k}, timeout=120)
    if r.status_code == 404:
        k = _init_storage(force=True)
        r = _req.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": k}, timeout=120)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "audio/mpeg")

from fastapi import UploadFile, File, Form, Query
from fastapi.responses import Response

# ---------- Profile picture upload (doc section 2) ----------
@api.post("/users/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Max 5MB")
    ct = file.content_type or ""
    if not ct.startswith("image/"):
        raise HTTPException(400, "Image files only")
    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png").lower()
    fname = f"{uuid.uuid4()}.{ext}"
    path = f"{APP_NAME}/avatars/{user['id']}/{fname}"
    try:
        _put_object(path, data, ct)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")
    avatar_url = f"/api/avatars/{user['id']}/{fname}"
    await db.users.update_one({"id": user["id"]}, {"$set": {"avatar": avatar_url}})
    return {"avatar": avatar_url}

@api.get("/avatars/{uid}/{fname}")
async def get_avatar(uid: str, fname: str):
    try:
        data, ct = _get_object(f"{APP_NAME}/avatars/{uid}/{fname}")
    except Exception:
        raise HTTPException(404, "Avatar not found")
    return Response(content=data, media_type=ct)

@api.post("/music/upload")
async def music_upload(file: UploadFile = File(...), title: str = Form(None), artist: str = Form("Unknown"), user=Depends(get_current_user)):
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(400, "Max 50MB")
    ct = file.content_type or "audio/mpeg"
    if not ct.startswith("audio/"):
        raise HTTPException(400, "Audio files only")
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "mp3").lower()
    path = f"{APP_NAME}/music/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = _put_object(path, data, ct)
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")
    song = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "title": title or file.filename.rsplit(".", 1)[0],
        "artist": artist or "Unknown",
        "album": None,
        "source": "upload",
        "storage_path": result["path"],
        "content_type": ct,
        "size": result.get("size", len(data)),
        "duration": None,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.songs.insert_one(song)
    song.pop("_id", None)
    return song

@api.get("/music/tracks")
async def list_tracks(user=Depends(get_current_user)):
    items = await db.songs.find(org_q(user, is_deleted=False), {"_id": 0}).sort("created_at", -1).to_list(500)
    liked = await db.song_likes.find({"user_id": user["id"]}, {"_id": 0, "song_id": 1}).to_list(500)
    liked_ids = {l["song_id"] for l in liked}
    for s in items:
        s["liked"] = s["id"] in liked_ids
    return items

@api.get("/music/stream/{song_id}")
async def stream(song_id: str, auth: str = Query(None), authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(401, "Auth required")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Bad token")
    listener = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "org_id": 1})
    if not listener:
        raise HTTPException(401, "Bad token")
    song = await db.songs.find_one(org_q(listener, id=song_id, is_deleted=False), {"_id": 0})
    if not song:
        raise HTTPException(404, "Not found")
    if song.get("source") != "upload" or not song.get("storage_path"):
        raise HTTPException(400, "This is an external track — not streamable via storage")
    try:
        data, ct = _get_object(song["storage_path"])
    except Exception as e:
        raise HTTPException(500, f"Fetch failed: {e}")
    return Response(content=data, media_type=song.get("content_type", ct))

@api.delete("/music/tracks/{song_id}")
async def delete_track(song_id: str, user=Depends(get_current_user)):
    song = await db.songs.find_one(org_q(user, id=song_id), {"_id": 0})
    if not song:
        raise HTTPException(404, "Not found")
    if song["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Not yours")
    await db.songs.update_one({"id": song_id}, {"$set": {"is_deleted": True}})
    return {"deleted": True}

@api.post("/music/like/{song_id}")
async def toggle_like(song_id: str, user=Depends(get_current_user)):
    if not await db.songs.find_one(org_q(user, id=song_id, is_deleted=False), {"_id": 1}):
        raise HTTPException(404, "Track not found")
    existing = await db.song_likes.find_one({"song_id": song_id, "user_id": user["id"]})
    if existing:
        await db.song_likes.delete_one({"song_id": song_id, "user_id": user["id"]})
        return {"liked": False}
    await db.song_likes.insert_one({"song_id": song_id, "user_id": user["id"], "at": now_iso()})
    return {"liked": True}

@api.get("/music/liked")
async def liked_songs(user=Depends(get_current_user)):
    likes = await db.song_likes.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    ids = [l["song_id"] for l in likes]
    items = await db.songs.find(org_q(user, id={"$in": ids}, is_deleted=False), {"_id": 0}).to_list(500)
    for s in items:
        s["liked"] = True
    return items

@api.post("/music/history/{song_id}")
async def log_play(song_id: str, user=Depends(get_current_user)):
    if not await db.songs.find_one(org_q(user, id=song_id), {"_id": 1}):
        raise HTTPException(404, "Track not found")
    await db.play_history.insert_one({
        "id": str(uuid.uuid4()), "org_id": user.get("org_id"),
        "user_id": user["id"], "song_id": song_id, "at": now_iso(),
    })
    return {"ok": True}

@api.get("/music/history/me")
async def my_history(user=Depends(get_current_user)):
    hist = await db.play_history.find({"user_id": user["id"]}, {"_id": 0}).sort("at", -1).to_list(50)
    ids_seen = set()
    unique_ids = []
    for h in hist:
        if h["song_id"] not in ids_seen:
            ids_seen.add(h["song_id"])
            unique_ids.append(h["song_id"])
    songs = await db.songs.find(org_q(user, id={"$in": unique_ids}, is_deleted=False), {"_id": 0}).to_list(50)
    smap = {s["id"]: s for s in songs}
    return [smap[i] for i in unique_ids if i in smap][:30]

# ---------- Music: external links (YouTube / Spotify) ----------
import re as _re
from urllib.parse import quote_plus

def _parse_yt_id(url: str):
    if not url: return None
    m = _re.search(r"(?:youtu\.be/|v=|/embed/|/shorts/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None

def _parse_spotify(url: str):
    if not url: return (None, None)
    m = _re.search(r"open\.spotify\.com/(?:embed/)?(track|album|playlist|episode)/([A-Za-z0-9]+)", url)
    if not m: return (None, None)
    return (m.group(1), m.group(2))

class LinkAddIn(BaseModel):
    url: str
    title: Optional[str] = None
    artist: Optional[str] = None

@api.post("/music/link")
async def add_link(body: LinkAddIn, user=Depends(get_current_user)):
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(400, "URL required")
    yt = _parse_yt_id(url)
    sp_type, sp_id = _parse_spotify(url)
    if not yt and not sp_id:
        raise HTTPException(400, "Only YouTube or Spotify links supported")
    title = body.title
    artist = body.artist or "External"
    thumbnail = None
    if yt:
        source = "youtube"
        external_id = yt
        link_url = f"https://www.youtube.com/watch?v={yt}"
        thumbnail = f"https://img.youtube.com/vi/{yt}/hqdefault.jpg"
        try:
            r = _req.get(f"https://www.youtube.com/oembed?url={quote_plus(link_url)}&format=json", timeout=8)
            if r.status_code == 200:
                j = r.json()
                title = title or j.get("title")
                artist = body.artist or j.get("author_name") or artist
                thumbnail = j.get("thumbnail_url") or thumbnail
        except Exception:
            pass
    else:
        source = "spotify"
        external_id = f"{sp_type}:{sp_id}"
        link_url = f"https://open.spotify.com/{sp_type}/{sp_id}"
        try:
            r = _req.get(f"https://open.spotify.com/oembed?url={quote_plus(link_url)}", timeout=8)
            if r.status_code == 200:
                j = r.json()
                title = title or j.get("title")
                thumbnail = j.get("thumbnail_url") or None
        except Exception:
            pass
    song = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "user_name": user["name"],
        "title": title or "Untitled",
        "artist": artist,
        "album": None,
        "source": source,
        "external_id": external_id,
        "link_url": link_url,
        "thumbnail_url": thumbnail,
        "storage_path": None,
        "content_type": None,
        "size": 0,
        "duration": None,
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.songs.insert_one(song)
    song.pop("_id", None)
    return song

# ---------- Music: trending (last N days across team) ----------
@api.get("/music/trending")
async def trending(days: int = 7, limit: int = 8, user=Depends(get_current_user)):
    since = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
    pipeline = [
        {"$match": org_q(user, at={"$gte": since})},
        {"$group": {"_id": "$song_id", "plays": {"$sum": 1}}},
        {"$sort": {"plays": -1}},
        {"$limit": max(1, min(limit, 50))},
    ]
    agg = await db.play_history.aggregate(pipeline).to_list(50)
    ids = [a["_id"] for a in agg]
    if not ids:
        return []
    songs = await db.songs.find(org_q(user, id={"$in": ids}, is_deleted=False), {"_id": 0}).to_list(50)
    smap = {s["id"]: s for s in songs}
    liked = await db.song_likes.find({"user_id": user["id"], "song_id": {"$in": ids}}, {"_id": 0, "song_id": 1}).to_list(200)
    liked_ids = {l["song_id"] for l in liked}
    out = []
    for a in agg:
        s = smap.get(a["_id"])
        if s:
            s["plays"] = a["plays"]
            s["liked"] = s["id"] in liked_ids
            out.append(s)
    return out

# ---------- Playlists ----------
class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    visibility: Optional[str] = "private"   # private | shared | public
    shared_with: Optional[List[str]] = []

class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[str] = None
    shared_with: Optional[List[str]] = None

class PlaylistReorder(BaseModel):
    track_ids: List[str]

class PlaylistTrackAdd(BaseModel):
    track_id: str

def _pl_access_filter(user: dict):
    # "public" means public within the org, not across tenants
    return org_q(user, **{"$or": [
        {"owner_id": user["id"]},
        {"visibility": "public"},
        {"visibility": "shared", "shared_with": user["id"]},
    ]})

async def _org_playlist(pid: str, user: dict) -> dict:
    pl = await db.playlists.find_one(org_q(user, id=pid), {"_id": 0})
    if not pl:
        raise HTTPException(404, "Not found")
    return pl

async def _clean_shared_with(user: dict, ids) -> List[str]:
    ids = list(dict.fromkeys(ids or []))
    return [u["id"] for u in await require_org_users(user, ids)] if ids else []

def _pl_can_view(pl, user):
    if pl["owner_id"] == user["id"]: return True
    if pl.get("visibility") == "public": return True
    if pl.get("visibility") == "shared" and user["id"] in (pl.get("shared_with") or []): return True
    return user.get("role") == "admin"

def _pl_can_edit(pl, user):
    return pl["owner_id"] == user["id"] or user.get("role") == "admin"

def _color_for(name: str):
    palette = ["#1DB954", "#E1306C", "#FF5A5F", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#14B8A6"]
    return palette[sum(ord(c) for c in (name or "P")) % len(palette)]

@api.post("/playlists")
async def create_playlist(body: PlaylistCreate, user=Depends(get_current_user)):
    vis = body.visibility if body.visibility in ("private", "shared", "public") else "private"
    pl = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "owner_id": user["id"],
        "owner_name": user["name"],
        "name": (body.name or "New Playlist").strip()[:80],
        "description": (body.description or "").strip()[:280],
        "visibility": vis,
        "shared_with": await _clean_shared_with(user, body.shared_with),
        "track_ids": [],
        "cover_color": _color_for(body.name or ""),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.playlists.insert_one(pl)
    pl.pop("_id", None)
    return pl

@api.get("/playlists")
async def list_playlists(user=Depends(get_current_user)):
    items = await db.playlists.find(_pl_access_filter(user), {"_id": 0}).sort("updated_at", -1).to_list(200)
    for p in items:
        p["track_count"] = len(p.get("track_ids") or [])
        p["can_edit"] = _pl_can_edit(p, user)
    return items

async def _hydrate_playlist(pl, user):
    ids = pl.get("track_ids") or []
    if not ids:
        pl["tracks"] = []
        return pl
    songs = await db.songs.find(org_q(user, id={"$in": ids}, is_deleted=False), {"_id": 0}).to_list(500)
    smap = {s["id"]: s for s in songs}
    liked = await db.song_likes.find({"user_id": user["id"], "song_id": {"$in": ids}}, {"_id": 0, "song_id": 1}).to_list(500)
    liked_ids = {l["song_id"] for l in liked}
    ordered = []
    for tid in ids:
        s = smap.get(tid)
        if s:
            s["liked"] = tid in liked_ids
            ordered.append(s)
    pl["tracks"] = ordered
    return pl

@api.get("/playlists/{pid}")
async def get_playlist(pid: str, user=Depends(get_current_user)):
    pl = await _org_playlist(pid, user)
    if not _pl_can_view(pl, user): raise HTTPException(403, "No access")
    pl["can_edit"] = _pl_can_edit(pl, user)
    return await _hydrate_playlist(pl, user)

@api.patch("/playlists/{pid}")
async def update_playlist(pid: str, body: PlaylistUpdate, user=Depends(get_current_user)):
    pl = await _org_playlist(pid, user)
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    upd = {}
    if body.name is not None: upd["name"] = body.name.strip()[:80]; upd["cover_color"] = _color_for(body.name)
    if body.description is not None: upd["description"] = body.description.strip()[:280]
    if body.visibility is not None and body.visibility in ("private","shared","public"): upd["visibility"] = body.visibility
    if body.shared_with is not None: upd["shared_with"] = await _clean_shared_with(user, body.shared_with)
    upd["updated_at"] = now_iso()
    await db.playlists.update_one({"id": pid}, {"$set": upd})
    pl.update(upd)
    return pl

@api.delete("/playlists/{pid}")
async def delete_playlist(pid: str, user=Depends(get_current_user)):
    pl = await _org_playlist(pid, user)
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    await db.playlists.delete_one({"id": pid})
    return {"deleted": True}

@api.post("/playlists/{pid}/tracks")
async def add_track_to_playlist(pid: str, body: PlaylistTrackAdd, user=Depends(get_current_user)):
    pl = await _org_playlist(pid, user)
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    song = await db.songs.find_one(org_q(user, id=body.track_id, is_deleted=False), {"_id": 0})
    if not song: raise HTTPException(404, "Track not found")
    ids = pl.get("track_ids") or []
    if body.track_id in ids:
        return {"ok": True, "already": True}
    ids.append(body.track_id)
    await db.playlists.update_one({"id": pid}, {"$set": {"track_ids": ids, "updated_at": now_iso()}})
    return {"ok": True}

@api.delete("/playlists/{pid}/tracks/{track_id}")
async def remove_track_from_playlist(pid: str, track_id: str, user=Depends(get_current_user)):
    pl = await _org_playlist(pid, user)
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    ids = [t for t in (pl.get("track_ids") or []) if t != track_id]
    await db.playlists.update_one({"id": pid}, {"$set": {"track_ids": ids, "updated_at": now_iso()}})
    return {"ok": True}

@api.put("/playlists/{pid}/reorder")
async def reorder_playlist(pid: str, body: PlaylistReorder, user=Depends(get_current_user)):
    pl = await _org_playlist(pid, user)
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    existing = set(pl.get("track_ids") or [])
    new_ids = [t for t in body.track_ids if t in existing]
    # Append any missing (to avoid loss)
    for t in (pl.get("track_ids") or []):
        if t not in new_ids: new_ids.append(t)
    await db.playlists.update_one({"id": pid}, {"$set": {"track_ids": new_ids, "updated_at": now_iso()}})
    return {"ok": True, "track_ids": new_ids}

# =========================================================================
# Wellness modules — shared foundation
# (doc sections 3-6 & 13: water / eye break / move & reset / breathing)
# =========================================================================

TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

# Parses an explicit YYYY-MM-DD (e.g. a history lookup). "Today" for anything that records
# progress or points comes from org_today() instead — the org's business timezone is the
# single authority for the daily boundary (BUG-01), not the browser's clock.
def parse_day(value: Optional[str] = None) -> str:
    if not value:
        return datetime.now(timezone.utc).date().isoformat()
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date().isoformat()
    except (ValueError, AttributeError):
        raise HTTPException(400, "date must be in YYYY-MM-DD format")

_ORG_TZ_CACHE: Dict[str, tuple] = {}

async def org_timezone(org_id: Optional[str]) -> ZoneInfo:
    name = None
    if org_id:
        cached = _ORG_TZ_CACHE.get(org_id)
        if cached and cached[1] > time.monotonic():
            name = cached[0]
        else:
            org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "timezone": 1})
            name = (org or {}).get("timezone")
            _ORG_TZ_CACHE[org_id] = (name, time.monotonic() + 60)
    try:
        return ZoneInfo(name or DEFAULT_TIMEZONE)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)

async def org_today(user: dict) -> str:
    return datetime.now(await org_timezone(user.get("org_id"))).date().isoformat()

async def read_day(user: dict, value: Optional[str]) -> str:
    return parse_day(value) if value else await org_today(user)

async def org_day_start_utc(user: dict, day: str) -> str:
    """UTC ISO timestamp of local midnight for `day` in the org's timezone, for
    filtering created_at (which is stored in UTC)."""
    tz = await org_timezone(user.get("org_id"))
    local_midnight = datetime.strptime(day, "%Y-%m-%d").replace(tzinfo=tz)
    return local_midnight.astimezone(timezone.utc).isoformat()

async def record_daily_points(user_id: str, pts: int, org_id: Optional[str] = None) -> None:
    """Per-user, per-business-day points ledger. The lifetime total on the user doc keeps
    growing; today's figure is read from here so it naturally starts at 0 each day while
    history is kept (BUG-01)."""
    if not pts:
        return
    if org_id is None:
        u = await db.users.find_one({"id": user_id}, {"_id": 0, "org_id": 1}) or {}
        org_id = u.get("org_id")
    day = datetime.now(await org_timezone(org_id)).date().isoformat()
    await db.daily_points.update_one(
        {"user_id": user_id, "date": day},
        {"$inc": {"points": int(pts)}, "$set": {"org_id": org_id, "updated_at": now_iso()}},
        upsert=True,
    )

async def credit_points(user_id: str, pts: int, org_id: Optional[str] = None) -> None:
    """The one path for simple point grants: lifetime total + today's ledger together."""
    if not pts:
        return
    await db.users.update_one({"id": user_id}, {"$inc": {"points": int(pts)}})
    await record_daily_points(user_id, pts, org_id)

async def points_today(user: dict) -> int:
    row = await db.daily_points.find_one({"user_id": user["id"], "date": await org_today(user)}, {"_id": 0, "points": 1})
    return int((row or {}).get("points", 0))

def clean_schedule(times: Any, max_len: int = 24) -> List[str]:
    """Validate a list of 24h HH:MM reminder times; de-duplicated and sorted."""
    if not isinstance(times, list):
        raise HTTPException(400, "schedule must be a list of HH:MM strings")
    if len(times) > max_len:
        raise HTTPException(400, f"schedule cannot hold more than {max_len} times")
    out: List[str] = []
    for t in times:
        if not isinstance(t, str) or not TIME_RE.match(t.strip()):
            raise HTTPException(400, f"Invalid schedule time '{t}'. Expected 24h HH:MM.")
        v = t.strip()
        if v not in out:
            out.append(v)
    return sorted(out)

def clean_slot(slot: Optional[str]) -> Optional[str]:
    if slot is None:
        return None
    if not isinstance(slot, str) or not TIME_RE.match(slot.strip()):
        raise HTTPException(400, f"Invalid slot '{slot}'. Expected 24h HH:MM.")
    return slot.strip()

async def get_daily_log(coll, user_id: str, date: str, defaults: dict) -> dict:
    """Fetch (or lazily create) the user's log document for one calendar day."""
    seed = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": date,
        "created_at": now_iso(),
        "updated_at": now_iso(),
        **defaults,
    }
    await coll.update_one(
        {"user_id": user_id, "date": date},
        {"$setOnInsert": seed},
        upsert=True,
    )
    return await coll.find_one({"user_id": user_id, "date": date}, {"_id": 0})

async def touch_daily_log(coll, user_id: str, date: str, changes: dict, push: dict = None):
    update = {"$set": {**changes, "updated_at": now_iso()}}
    if push:
        update["$push"] = push
    await coll.update_one({"user_id": user_id, "date": date}, update)
    return await coll.find_one({"user_id": user_id, "date": date}, {"_id": 0})

def history_range(days: int, start: Optional[str], end: Optional[str]) -> dict:
    """Build a Mongo `date` filter from either an explicit range or a trailing window."""
    if start or end:
        q = {}
        if start:
            q["$gte"] = parse_day(start)
        if end:
            q["$lte"] = parse_day(end)
        return q
    days = max(1, min(365, days or 30))
    first = (datetime.now(timezone.utc).date() - timedelta(days=days - 1)).isoformat()
    return {"$gte": first}


# =========================================================================
# User settings (doc section 13.2)
# =========================================================================

DEFAULT_USER_SETTINGS: Dict[str, Any] = {
    "notifications": {
        "notifications_enabled": True,
        "desktop_notifications": True,
        "in_app_popup": True,
        "sound": True,
        "water": True,
        "eye_care": True,
        "move_reset": True,
        "breathing": True,
    },
    "sound": {"enabled": True, "volume": 0.7},
    "theme": "light",
    # Doc section 8.5 — font, background, accent, layout and other visual preferences.
    "appearance": {
        "background": "garden", "solid_color": "#F5F5F5",
        "accent_mode": "default", "accent_color": "#7FAE62",
        "layout": "comfortable", "font_style": "default", "font_size": "default",
    },
    "water": {"goal": 2000, "reminder_times": ["10:00", "13:00", "16:00"]},
    "eye_break": {"goal": 3, "schedule": ["10:00", "13:00", "16:00", "18:00", "20:00", "21:00"]},
    "move_reset": {"goal": 3, "schedule": ["10:30", "14:00", "17:00", "19:00", "21:00"]},
    "breathing": {"goal": 3, "schedule": ["10:00", "14:00", "18:00", "20:00", "22:00"]},
}

def _merge_settings(base: dict, override: dict) -> dict:
    out = {}
    for k, v in base.items():
        if isinstance(v, dict):
            out[k] = _merge_settings(v, (override or {}).get(k) or {})
        else:
            out[k] = (override or {}).get(k, v)
    # keep any extra keys the client stored that we don't model yet
    for k, v in (override or {}).items():
        if k not in out and k not in ("user_id", "id", "created_at", "updated_at"):
            out[k] = v
    return out

async def get_user_settings(user_id: str) -> dict:
    stored = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    return _merge_settings(DEFAULT_USER_SETTINGS, stored)

async def save_user_settings(user_id: str, patch: dict) -> dict:
    current = await get_user_settings(user_id)
    merged = _merge_settings(current, patch or {})
    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {**merged, "user_id": user_id, "updated_at": now_iso()},
         "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_iso()}},
        upsert=True,
    )
    return merged

async def module_setting(user_id: str, module: str, key: str, fallback):
    settings = await get_user_settings(user_id)
    return (settings.get(module) or {}).get(key, fallback)


class SettingsPatch(BaseModel):
    notifications: Optional[dict] = None
    sound: Optional[dict] = None
    theme: Optional[str] = None
    appearance: Optional[dict] = None
    water: Optional[dict] = None
    eye_break: Optional[dict] = None
    move_reset: Optional[dict] = None
    breathing: Optional[dict] = None

@api.get("/settings")
async def read_settings(user=Depends(get_current_user)):
    return await get_user_settings(user["id"])

@api.put("/settings")
async def update_settings(body: SettingsPatch, user=Depends(get_current_user)):
    patch = body.model_dump(exclude_none=True)
    if patch.get("theme") and patch["theme"] not in ("light", "dark"):
        raise HTTPException(400, "theme must be 'light' or 'dark'")
    for module, key in (("water", "reminder_times"), ("eye_break", "schedule"),
                        ("move_reset", "schedule"), ("breathing", "schedule")):
        if module in patch and key in (patch[module] or {}):
            patch[module][key] = clean_schedule(patch[module][key])
    for module, lo, hi in (("water", 500, 10000), ("eye_break", 1, 24),
                           ("move_reset", 1, 24), ("breathing", 1, 24)):
        if module in patch and "goal" in (patch[module] or {}):
            patch[module]["goal"] = validate_goal(patch[module]["goal"], lo, hi)
    return await save_user_settings(user["id"], patch)


def validate_goal(value: Any, lo: int, hi: int) -> int:
    try:
        goal = int(value)
    except (TypeError, ValueError):
        raise HTTPException(400, "goal must be a number")
    if goal < lo or goal > hi:
        raise HTTPException(400, f"goal must be between {lo} and {hi}")
    return goal


# =========================================================================
# Rewards / XP service (doc section 7)
#
# XP is always computed here from validated server state — never trusted from
# the client. `dedupe_key` makes every once-per-day bonus idempotent.
# XP transactions live in `reward_transactions`; `rewards` stays reserved for
# admin-issued rewards (coupons etc) already surfaced by /rewards/me.
# =========================================================================

REWARD_RULES = {
    "water_goal": "water_goal_xp",
    "eye_break_goal": "eye_break_goal_xp",
    "move_reset_goal": "move_reset_goal_xp",
    "breathing_goal": "breathing_goal_xp",
}

async def award_reward(user_id: str, source: str, xp: int, coins: int = 0,
                       category: Optional[str] = None, meta: Optional[dict] = None,
                       dedupe_key: Optional[str] = None) -> dict:
    """Award XP/coins once, record the transaction and recompute level progression."""
    if dedupe_key:
        existing = await db.reward_transactions.find_one(
            {"user_id": user_id, "dedupe_key": dedupe_key}, {"_id": 0}
        )
        if existing:
            return {"awarded": False, "already_claimed": True, "transaction": existing}

    updated = await db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"points": int(xp), "coins": int(coins)}},
        projection={"_id": 0, "points": 1, "coins": 1, "level": 1, "org_id": 1},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(404, "User not found")
    await record_daily_points(user_id, int(xp), updated.get("org_id"))
    gc = await get_game_config(updated.get("org_id"))

    new_points = updated.get("points", 0)
    new_level = 1 + new_points // max(1, gc.get("level_threshold", 200))
    if new_level != updated.get("level"):
        await db.users.update_one({"id": user_id}, {"$set": {"level": new_level}})

    tx = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": source,
        "source_activity": category,
        "xp": int(xp),
        "coins": int(coins),
        "meta": meta or {},
        "dedupe_key": dedupe_key,
        "balance_after": new_points,
        "level_after": new_level,
        "created_at": now_iso(),
    }
    try:
        await db.reward_transactions.insert_one(dict(tx))
    except Exception:
        # unique index on (user_id, dedupe_key) lost a race — the other writer won
        existing = await db.reward_transactions.find_one(
            {"user_id": user_id, "dedupe_key": dedupe_key}, {"_id": 0}
        )
        return {"awarded": False, "already_claimed": True, "transaction": existing}

    level_up = new_level > (updated.get("level") or 1)
    if level_up:
        await create_notification(
            user_id=user_id,
            kind="reward",
            title=f"⬆️ Level {new_level} unlocked!",
            message=f"You reached level {new_level} with {new_points} XP.",
            icon="⬆️",
            data={"level": new_level, "xp": new_points},
        )
    return {
        "awarded": True,
        "xp": int(xp),
        "coins": int(coins),
        "total_xp": new_points,
        "level": new_level,
        "level_up": level_up,
        "transaction": tx,
    }

async def log_wellness_activity(user_id: str, atype: str, action: str,
                                value: Any = None, xp: int = 0) -> dict:
    """Write one row into the central activity log (doc section 8)."""
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": atype,
        "category": WELLNESS_CATEGORY.get(atype, "OTHER"),
        "action": action,
        "value": value,
        "points": int(xp),
        "xp_earned": int(xp),
        "created_at": now_iso(),
    }
    await db.activities.insert_one(dict(activity))
    return activity

async def record_wellness_event(user: dict, atype: str, action: str, value: Any = None,
                                xp: Optional[int] = None) -> dict:
    """Log an activity and apply the standard points/level/streak progression."""
    pc = await get_points_config(user.get("org_id"))
    pts = pc.get(atype, 5) if xp is None else int(xp)
    since = await org_day_start_utc(user, await org_today(user))
    awarded_today = await db.activities.count_documents(
        {"user_id": user["id"], "type": atype, "points": {"$gt": 0}, "created_at": {"$gte": since}}
    )
    if awarded_today >= DAILY_AWARD_CAP_PER_TYPE:
        pts = 0  # progress still counts; points for this ritual are capped for the day
    activity = await log_wellness_activity(user["id"], atype, action, value, pts)
    totals = await apply_activity_rewards(user, pts)
    return {"activity": activity, "xp_earned": pts, **totals}

async def maybe_award_goal_bonus(user: dict, source: str, atype: str, date: str,
                                 value: Any = None) -> Optional[dict]:
    """Award the once-per-day goal-completion bonus, if it hasn't been awarded yet."""
    pc = await get_points_config(user.get("org_id"))
    xp = int(pc.get(REWARD_RULES[source], 50))
    result = await award_reward(
        user_id=user["id"],
        source=source,
        xp=xp,
        coins=int(pc.get("goal_coins", 5)),
        category=WELLNESS_CATEGORY.get(atype, "OTHER"),
        meta={"date": date, "value": value},
        dedupe_key=f"{source}:{date}",
    )
    if not result.get("awarded"):
        return None
    await log_wellness_activity(user["id"], atype, "GOAL_COMPLETED", value, xp)
    return result


# =========================================================================
# 3. Water tracking
# =========================================================================

MAX_DRINK_ML = 5000

class WaterDrinkReq(BaseModel):
    amount: int = Field(..., description="Millilitres consumed in this event")
    date: Optional[str] = None

class GoalReq(BaseModel):
    goal: int
    date: Optional[str] = None

class ScheduleReq(BaseModel):
    schedule: List[str]
    date: Optional[str] = None

class DayReq(BaseModel):
    date: Optional[str] = None


def water_view(log: dict) -> dict:
    goal = max(1, int(log.get("goal") or 2000))
    consumed = int(log.get("consumed") or 0)
    return {
        "user_id": log.get("user_id"),
        "date": log.get("date"),
        "goal": goal,
        "consumed": consumed,
        "remaining": max(0, goal - consumed),
        "progress": round(min(100.0, (consumed / goal) * 100), 1),
        "completed": bool(log.get("completed")),
        "rewarded": bool(log.get("rewarded")),
        "entries": log.get("entries") or [],
    }

async def water_log_for(user_id: str, date: str) -> dict:
    goal = await module_setting(user_id, "water", "goal", 2000)
    return await get_daily_log(db.water_logs, user_id, date, {
        "goal": int(goal), "consumed": 0, "completed": False,
        "rewarded": False, "entries": [],
    })

@api.get("/water/today")
async def water_today(date: Optional[str] = None, user=Depends(get_current_user)):
    return water_view(await water_log_for(user["id"], await read_day(user, date)))

@api.post("/water/drink")
async def water_drink(body: WaterDrinkReq, user=Depends(get_current_user)):
    if body.amount <= 0 or body.amount > MAX_DRINK_ML:
        raise HTTPException(400, f"amount must be between 1 and {MAX_DRINK_ML} ml")
    date = await org_today(user)
    log = await water_log_for(user["id"], date)

    goal = max(1, int(log.get("goal") or 2000))
    consumed = int(log.get("consumed") or 0) + body.amount
    completed = consumed >= goal

    log = await touch_daily_log(
        db.water_logs, user["id"], date,
        {"consumed": consumed, "completed": completed},
        push={"entries": {"amount": body.amount, "at": now_iso()}},
    )

    event = await record_wellness_event(user, "water", "DRINK", body.amount)
    bonus = None
    if completed and not log.get("rewarded"):
        fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
        bonus = await maybe_award_goal_bonus(fresh or user, "water_goal", "water", date, consumed)
        if bonus:
            log = await touch_daily_log(db.water_logs, user["id"], date, {"rewarded": True})

    totals = await current_totals(user["id"])
    return {**water_view(log), "activity": event["activity"], "xp_earned": event["xp_earned"],
            "goal_bonus": bonus, **totals}

@api.put("/water/goal")
async def water_goal(body: GoalReq, user=Depends(get_current_user)):
    goal = validate_goal(body.goal, 500, 10000)
    date = await org_today(user)
    await water_log_for(user["id"], date)
    await save_user_settings(user["id"], {"water": {"goal": goal}})
    log = await db.water_logs.find_one({"user_id": user["id"], "date": date}, {"_id": 0})
    consumed = int(log.get("consumed") or 0)
    log = await touch_daily_log(db.water_logs, user["id"], date,
                                {"goal": goal, "completed": consumed >= goal})
    return water_view(log)

@api.get("/water/history")
async def water_history(days: int = 30, start: Optional[str] = None, end: Optional[str] = None,
                        user=Depends(get_current_user)):
    logs = await db.water_logs.find(
        {"user_id": user["id"], "date": history_range(days, start, end)}, {"_id": 0}
    ).sort("date", -1).to_list(400)
    items = [water_view(l) for l in logs]
    return {
        "items": items,
        "days_tracked": len(items),
        "goals_completed": sum(1 for i in items if i["completed"]),
        "total_consumed": sum(i["consumed"] for i in items),
        "average_consumed": round(sum(i["consumed"] for i in items) / len(items)) if items else 0,
    }

@api.post("/water/reset")
async def water_reset(body: DayReq = None, user=Depends(get_current_user)):
    date = await org_today(user)
    await water_log_for(user["id"], date)
    log = await touch_daily_log(db.water_logs, user["id"], date, {
        "consumed": 0, "completed": False, "rewarded": False, "entries": [],
    })
    return water_view(log)


# =========================================================================
# 4. Eye break
# =========================================================================

class EyeBreakCompleteReq(BaseModel):
    slot: Optional[str] = None          # scheduled HH:MM this break belongs to
    duration: Optional[int] = None      # seconds
    date: Optional[str] = None


def eye_break_view(log: dict) -> dict:
    goal = max(1, int(log.get("goal") or 3))
    completed = int(log.get("completed") or 0)
    return {
        "user_id": log.get("user_id"),
        "date": log.get("date"),
        "goal": goal,
        "completed": completed,
        "remaining": max(0, goal - completed),
        "progress": round(min(100.0, (completed / goal) * 100), 1),
        "schedule": log.get("schedule") or [],
        "completed_slots": log.get("completed_slots") or [],
        "sessions": log.get("sessions") or [],
        "rewarded": bool(log.get("rewarded")),
        "goal_reached": completed >= goal,
    }

async def eye_break_log_for(user_id: str, date: str) -> dict:
    settings = await get_user_settings(user_id)
    cfg = settings.get("eye_break") or {}
    return await get_daily_log(db.eye_break_logs, user_id, date, {
        "goal": int(cfg.get("goal", 3)),
        "completed": 0,
        "schedule": cfg.get("schedule") or [],
        "completed_slots": [],
        "sessions": [],
        "rewarded": False,
    })

@api.get("/eye-break/today")
async def eye_break_today(date: Optional[str] = None, user=Depends(get_current_user)):
    return eye_break_view(await eye_break_log_for(user["id"], await read_day(user, date)))

@api.post("/eye-break/complete")
async def eye_break_complete(body: EyeBreakCompleteReq, user=Depends(get_current_user)):
    date = await org_today(user)
    slot = clean_slot(body.slot)
    if body.duration is not None and (body.duration < 0 or body.duration > 3600):
        raise HTTPException(400, "duration must be between 0 and 3600 seconds")
    log = await eye_break_log_for(user["id"], date)

    # A scheduled slot may only be counted once per day.
    if slot and slot in (log.get("completed_slots") or []):
        return {**eye_break_view(log), "already_completed": True}

    completed = int(log.get("completed") or 0) + 1
    changes = {"completed": completed}
    push = {"sessions": {"slot": slot, "duration": body.duration or 0, "completed_at": now_iso()}}
    if slot:
        push["completed_slots"] = slot
    log = await touch_daily_log(db.eye_break_logs, user["id"], date, changes, push=push)

    event = await record_wellness_event(user, "eye_care", "BREAK_COMPLETED", body.duration or 1)
    bonus = None
    if completed >= int(log.get("goal") or 3) and not log.get("rewarded"):
        fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
        bonus = await maybe_award_goal_bonus(fresh or user, "eye_break_goal", "eye_care", date, completed)
        if bonus:
            log = await touch_daily_log(db.eye_break_logs, user["id"], date, {"rewarded": True})

    totals = await current_totals(user["id"])
    return {**eye_break_view(log), "already_completed": False, "activity": event["activity"],
            "xp_earned": event["xp_earned"], "goal_bonus": bonus, **totals}

@api.put("/eye-break/goal")
async def eye_break_goal(body: GoalReq, user=Depends(get_current_user)):
    goal = validate_goal(body.goal, 1, 24)
    date = await org_today(user)
    await eye_break_log_for(user["id"], date)
    await save_user_settings(user["id"], {"eye_break": {"goal": goal}})
    log = await touch_daily_log(db.eye_break_logs, user["id"], date, {"goal": goal})
    return eye_break_view(log)

@api.put("/eye-break/schedule")
async def eye_break_schedule(body: ScheduleReq, user=Depends(get_current_user)):
    schedule = clean_schedule(body.schedule)
    date = await org_today(user)
    await eye_break_log_for(user["id"], date)
    await save_user_settings(user["id"], {"eye_break": {"schedule": schedule}})
    log = await touch_daily_log(db.eye_break_logs, user["id"], date, {"schedule": schedule})
    return eye_break_view(log)

@api.get("/eye-break/history")
async def eye_break_history(days: int = 30, start: Optional[str] = None, end: Optional[str] = None,
                            user=Depends(get_current_user)):
    logs = await db.eye_break_logs.find(
        {"user_id": user["id"], "date": history_range(days, start, end)}, {"_id": 0}
    ).sort("date", -1).to_list(400)
    items = [eye_break_view(l) for l in logs]
    return {
        "items": items,
        "days_tracked": len(items),
        "goals_completed": sum(1 for i in items if i["goal_reached"]),
        "total_breaks": sum(i["completed"] for i in items),
    }


# =========================================================================
# 5. Move & Reset
# =========================================================================

# Frontend activity ids (MoveResetCard) plus the labels used in the spec.
MOVE_ACTIVITIES = {
    "hands": "Hand & Wrist",
    "finger": "Finger Stretch",
    "neck": "Neck Relax",
    "shoulder": "Shoulder Relax",
    "walking": "Walking",
    "stand": "Stand & Reset",
}

class MoveCompleteReq(BaseModel):
    activity: str
    slot: Optional[str] = None
    duration: Optional[int] = None      # seconds
    date: Optional[str] = None


def move_reset_view(log: dict) -> dict:
    goal = max(1, int(log.get("goal") or 3))
    completed = int(log.get("completed") or 0)
    return {
        "user_id": log.get("user_id"),
        "date": log.get("date"),
        "goal": goal,
        "completed": completed,
        "remaining": max(0, goal - completed),
        "progress": round(min(100.0, (completed / goal) * 100), 1),
        "schedule": log.get("schedule") or [],
        "completed_slots": log.get("completed_slots") or [],
        "completed_activities": log.get("completed_activities") or [],
        "rewarded": bool(log.get("rewarded")),
        "goal_reached": completed >= goal,
    }

async def move_reset_log_for(user_id: str, date: str) -> dict:
    settings = await get_user_settings(user_id)
    cfg = settings.get("move_reset") or {}
    return await get_daily_log(db.move_reset_logs, user_id, date, {
        "goal": int(cfg.get("goal", 3)),
        "completed": 0,
        "schedule": cfg.get("schedule") or [],
        "completed_slots": [],
        "completed_activities": [],
        "rewarded": False,
    })

@api.get("/move-reset/today")
async def move_reset_today(date: Optional[str] = None, user=Depends(get_current_user)):
    return move_reset_view(await move_reset_log_for(user["id"], await read_day(user, date)))

@api.get("/move-reset/activities")
async def move_reset_activities():
    return [{"id": k, "name": v} for k, v in MOVE_ACTIVITIES.items()]

@api.post("/move-reset/complete")
async def move_reset_complete(body: MoveCompleteReq, user=Depends(get_current_user)):
    # This endpoint used to trust a client-sent duration and award points per call, so a
    # break could be "completed" without doing it. Completion now only happens through a
    # server-owned session (see /move-reset/sessions below).
    raise HTTPException(410, "Use a guided Move Break session: POST /api/move-reset/sessions")


# ---------- Guided Move Break sessions (Move & Reset enhancement) ----------
# The server owns the session: it records when each exercise is actively running using
# server time, requires every interval to be completed (hidden-tab time is excluded
# because the client pauses on visibilitychange), requires the user to press "Start Next
# Stretch" at checkpoint transitions, and awards points exactly once on completion.
# This is reasonable participation validation, not proof of movement.

MOVE_LIBRARY = [
    {"id": "hand_stretch", "name": "Hand & Finger Stretch",
     "instruction": "Spread your fingers wide, hold, then relax into a soft fist."},
    {"id": "wrist_rotation", "name": "Wrist Rotation",
     "instruction": "Circle both wrists slowly, then switch direction."},
    {"id": "shoulder_roll", "name": "Shoulder Roll",
     "instruction": "Lift your shoulders toward your ears, then roll them back and down."},
    {"id": "neck_stretch", "name": "Neck Stretch",
     "instruction": "Tilt one ear gently toward your shoulder, hold, then switch sides."},
    {"id": "side_stretch", "name": "Standing Side Stretch",
     "instruction": "Stand tall, reach one arm overhead and lean gently to the side."},
    {"id": "upper_body_stretch", "name": "Upper-Body Stretch",
     "instruction": "Clasp your hands in front, round your upper back and press away gently."},
]
MOVE_SESSION_LENGTH = 5
MOVE_EXERCISE_SECONDS = int(os.environ.get("MOVE_EXERCISE_SECONDS", "20"))
MOVE_CHECKPOINT_BEFORE = {2, 4}      # "Start Next Stretch" before exercises 3 and 5
MOVE_SESSION_TTL = timedelta(minutes=30)
MOVE_TIME_TOLERANCE = 1.0            # seconds of slack for network/timer jitter
MOVE_OPEN_STATES = ("RUNNING", "PAUSED")

class MoveEventReq(BaseModel):
    type: str                        # pause | resume | advance | checkpoint | end
    index: Optional[int] = None      # the exercise the client believes is current

def _move_now() -> datetime:
    return datetime.now(timezone.utc)

def _accumulate(s: dict, now: datetime) -> dict:
    """Fold time since `running_since` into the current exercise (capped at its length)."""
    if s.get("status") == "RUNNING" and s.get("running_since"):
        since = datetime.fromisoformat(s["running_since"])
        i = s["current_index"]
        secs = list(s["active_seconds"])
        cap = s["exercises"][i]["seconds"]
        secs[i] = min(cap, secs[i] + max(0.0, (now - since).total_seconds()))
        s["active_seconds"] = secs
        s["running_since"] = now.isoformat()
    return s

def _move_view(s: dict, now: Optional[datetime] = None) -> dict:
    now = now or _move_now()
    s = _accumulate(dict(s), now) if s.get("status") == "RUNNING" else s
    i = s.get("current_index", 0)
    ex = s["exercises"][i]
    return {
        "id": s["id"],
        "status": s["status"],
        "exercises": s["exercises"],
        "current_index": i,
        "active_seconds": [round(x, 2) for x in s["active_seconds"]],
        "remaining_seconds": round(max(0.0, ex["seconds"] - s["active_seconds"][i]), 2),
        "checkpoints_done": s.get("checkpoints_done", []),
        "expires_at": s["expires_at"],
        "server_time": now.isoformat(),
        "result": s.get("result"),
    }

async def _load_move_session(sid: str, user: dict) -> dict:
    s = await db.move_reset_sessions.find_one({"id": sid, "user_id": user["id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Move break session not found")
    if s["status"] in MOVE_OPEN_STATES and _move_now() > datetime.fromisoformat(s["expires_at"]):
        await db.move_reset_sessions.update_one({"id": sid}, {"$set": {"status": "EXPIRED", "running_since": None}})
        s["status"] = "EXPIRED"
    return s

async def _save_move_session(s: dict, event: dict) -> None:
    await db.move_reset_sessions.update_one(
        {"id": s["id"], "status": {"$in": list(MOVE_OPEN_STATES)}},
        {"$set": {k: s[k] for k in ("status", "current_index", "active_seconds", "running_since", "checkpoints_done")}
                 | {"updated_at": now_iso()},
         "$push": {"events": event}},
    )

@api.post("/move-reset/sessions")
async def start_move_session(user=Depends(get_current_user)):
    """Start a guided Move Break. Any older open session is ended (only one at a time)."""
    now = _move_now()
    await db.move_reset_sessions.update_many(
        {"user_id": user["id"], "status": {"$in": list(MOVE_OPEN_STATES)}},
        {"$set": {"status": "ABANDONED", "running_since": None, "updated_at": now_iso()}},
    )
    date = await org_today(user)
    done_today = await db.move_reset_sessions.count_documents({"user_id": user["id"], "date": date, "status": "COMPLETED"})
    offset = done_today % len(MOVE_LIBRARY)  # vary the routine through the day
    exercises = []
    for n in range(MOVE_SESSION_LENGTH):
        base = MOVE_LIBRARY[(offset + n) % len(MOVE_LIBRARY)]
        exercises.append({**base, "seconds": MOVE_EXERCISE_SECONDS, "checkpoint_before": n in MOVE_CHECKPOINT_BEFORE})
    s = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "user_id": user["id"],
        "date": date,
        "status": "RUNNING",               # the first interval begins immediately
        "exercises": exercises,
        "current_index": 0,
        "active_seconds": [0.0] * len(exercises),
        "running_since": now.isoformat(),
        "checkpoints_done": [],
        "events": [{"type": "start", "at": now.isoformat(), "index": 0}],
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "expires_at": (now + MOVE_SESSION_TTL).isoformat(),
        "result": None,
    }
    await db.move_reset_sessions.insert_one(dict(s))
    return _move_view(s, now)

@api.get("/move-reset/sessions/active")
async def active_move_session(user=Depends(get_current_user)):
    """Recover after a refresh. A running session comes back paused so the user must
    press Resume — time while the page was reloading or closed never counts."""
    s = await db.move_reset_sessions.find_one(
        {"user_id": user["id"], "status": {"$in": list(MOVE_OPEN_STATES)}}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if not s:
        return None
    s = await _load_move_session(s["id"], user)
    if s["status"] == "RUNNING":
        now = _move_now()
        s = _accumulate(s, now)
        s["status"], s["running_since"] = "PAUSED", None
        await _save_move_session(s, {"type": "pause", "at": now.isoformat(), "index": s["current_index"], "reason": "recovered"})
    return _move_view(s) if s["status"] in MOVE_OPEN_STATES else None

@api.get("/move-reset/sessions/{sid}")
async def get_move_session(sid: str, user=Depends(get_current_user)):
    """Read-only view (unlike /active, it never pauses a running session)."""
    return _move_view(await _load_move_session(sid, user))

@api.post("/move-reset/sessions/{sid}/events")
async def move_session_event(sid: str, body: MoveEventReq, user=Depends(get_current_user)):
    s = await _load_move_session(sid, user)
    if s["status"] not in MOVE_OPEN_STATES:
        raise HTTPException(409, f"This move break is {s['status'].lower()}")
    kind = (body.type or "").strip().lower()
    now = _move_now()
    i = s["current_index"]
    if body.index is not None and body.index != i:
        raise HTTPException(409, "Out of step with the session — please reload")
    s = _accumulate(s, now)

    if kind == "pause":
        s["status"], s["running_since"] = "PAUSED", None
    elif kind == "resume":
        s["status"], s["running_since"] = "RUNNING", now.isoformat()
    elif kind in ("advance", "checkpoint"):
        if s["status"] != "RUNNING":
            raise HTTPException(409, "Resume the break before moving on")
        ex = s["exercises"][i]
        remaining = ex["seconds"] - s["active_seconds"][i]
        if remaining > MOVE_TIME_TOLERANCE:
            raise HTTPException(409, f"This stretch isn't finished yet ({int(remaining + 0.99)}s left)")
        if i + 1 >= len(s["exercises"]):
            raise HTTPException(400, "That was the last stretch — finish the break instead")
        if s["exercises"][i + 1]["checkpoint_before"]:
            if kind != "checkpoint":
                raise HTTPException(409, "Press 'Start Next Stretch' to continue")
            s["checkpoints_done"] = sorted(set(s["checkpoints_done"]) | {i + 1})
        s["current_index"] = i + 1
        s["running_since"] = now.isoformat()  # the transition pause itself is not counted
    elif kind == "end":
        s["status"], s["running_since"] = "ABANDONED", None
    else:
        raise HTTPException(400, "type must be one of: pause, resume, advance, checkpoint, end")

    await _save_move_session(s, {"type": kind, "at": now.isoformat(), "index": i})
    return _move_view(s, now)

@api.post("/move-reset/sessions/{sid}/complete")
async def complete_move_session(sid: str, user=Depends(get_current_user)):
    """Idempotent: the first valid call completes the session and awards points; replays
    return the same result without awarding again."""
    s = await _load_move_session(sid, user)
    if s["status"] == "COMPLETED":
        return {**(s.get("result") or {}), "session": _move_view(s), "already_completed": True, "xp_earned": 0}
    if s["status"] not in MOVE_OPEN_STATES:
        raise HTTPException(409, f"This move break is {s['status'].lower()} and can't be completed")

    now = _move_now()
    s = _accumulate(s, now)
    last = len(s["exercises"]) - 1
    short = [n + 1 for n, ex in enumerate(s["exercises"]) if ex["seconds"] - s["active_seconds"][n] > MOVE_TIME_TOLERANCE]
    missing_checkpoints = [n for n, ex in enumerate(s["exercises"]) if ex["checkpoint_before"] and n not in s["checkpoints_done"]]
    if s["current_index"] != last or short or missing_checkpoints:
        await _save_move_session(s, {"type": "complete_rejected", "at": now.isoformat(), "index": s["current_index"]})
        detail = f"Not all stretches are finished yet (exercise {', '.join(map(str, short))})" if short else \
                 "Not all stretches are finished yet"
        raise HTTPException(409, detail)

    # Atomic state change: only one concurrent/replayed request can win the award.
    won = await db.move_reset_sessions.find_one_and_update(
        {"id": sid, "status": {"$in": list(MOVE_OPEN_STATES)}},
        {"$set": {"status": "COMPLETED", "running_since": None, "active_seconds": s["active_seconds"],
                  "completed_at": now.isoformat(), "updated_at": now_iso()},
         "$push": {"events": {"type": "complete", "at": now.isoformat(), "index": last}}},
        return_document=ReturnDocument.AFTER, projection={"_id": 0},
    )
    if not won:
        fresh = await _load_move_session(sid, user)
        return {**(fresh.get("result") or {}), "session": _move_view(fresh), "already_completed": True, "xp_earned": 0}

    date = s["date"]
    await move_reset_log_for(user["id"], date)
    await db.move_reset_logs.update_one(
        {"user_id": user["id"], "date": date},
        {"$inc": {"completed": 1},
         "$push": {"completed_activities": {
             "activity": "guided_session", "name": "Guided Move Break", "session_id": sid,
             "duration": int(sum(s["active_seconds"])), "completed_at": now_iso()}},
         "$set": {"updated_at": now_iso()}},
    )
    log = await db.move_reset_logs.find_one({"user_id": user["id"], "date": date}, {"_id": 0})
    event = await record_wellness_event(user, "stand", "SESSION_COMPLETED", sid)
    bonus = None
    if int(log.get("completed") or 0) >= int(log.get("goal") or 3) and not log.get("rewarded"):
        fresh_user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
        bonus = await maybe_award_goal_bonus(fresh_user or user, "move_reset_goal", "stand", date, log.get("completed"))
        if bonus:
            log = await touch_daily_log(db.move_reset_logs, user["id"], date, {"rewarded": True})
    result = {**move_reset_view(log), "xp_earned": event["xp_earned"], "goal_bonus": bonus,
              "points_today": event.get("points_today")}
    await db.move_reset_sessions.update_one({"id": sid}, {"$set": {"result": result}})
    won["result"] = result
    return {**result, "session": _move_view(won, now), "already_completed": False}

@api.put("/move-reset/goal")
async def move_reset_goal(body: GoalReq, user=Depends(get_current_user)):
    goal = validate_goal(body.goal, 1, 24)
    date = await org_today(user)
    await move_reset_log_for(user["id"], date)
    await save_user_settings(user["id"], {"move_reset": {"goal": goal}})
    log = await touch_daily_log(db.move_reset_logs, user["id"], date, {"goal": goal})
    return move_reset_view(log)

@api.put("/move-reset/schedule")
async def move_reset_schedule(body: ScheduleReq, user=Depends(get_current_user)):
    schedule = clean_schedule(body.schedule)
    date = await org_today(user)
    await move_reset_log_for(user["id"], date)
    await save_user_settings(user["id"], {"move_reset": {"schedule": schedule}})
    log = await touch_daily_log(db.move_reset_logs, user["id"], date, {"schedule": schedule})
    return move_reset_view(log)

@api.get("/move-reset/history")
async def move_reset_history(days: int = 30, start: Optional[str] = None, end: Optional[str] = None,
                             user=Depends(get_current_user)):
    logs = await db.move_reset_logs.find(
        {"user_id": user["id"], "date": history_range(days, start, end)}, {"_id": 0}
    ).sort("date", -1).to_list(400)
    items = [move_reset_view(l) for l in logs]
    return {
        "items": items,
        "days_tracked": len(items),
        "goals_completed": sum(1 for i in items if i["goal_reached"]),
        "total_sessions": sum(i["completed"] for i in items),
    }


# =========================================================================
# 6. Breathing
# =========================================================================

class BreathingSessionReq(BaseModel):
    duration: Optional[int] = None      # seconds
    slot: Optional[str] = None
    date: Optional[str] = None


def breathing_view(log: dict) -> dict:
    goal = max(1, int(log.get("goal") or 3))
    completed = int(log.get("completed") or 0)
    sessions = log.get("sessions") or []
    return {
        "user_id": log.get("user_id"),
        "date": log.get("date"),
        "goal": goal,
        "completed": completed,
        "remaining": max(0, goal - completed),
        "progress": round(min(100.0, (completed / goal) * 100), 1),
        "schedule": log.get("schedule") or [],
        "completed_slots": log.get("completed_slots") or [],
        "sessions": sessions,
        "total_duration": sum(int(s.get("duration") or 0) for s in sessions),
        "rewarded": bool(log.get("rewarded")),
        "goal_reached": completed >= goal,
    }

async def breathing_log_for(user_id: str, date: str) -> dict:
    settings = await get_user_settings(user_id)
    cfg = settings.get("breathing") or {}
    return await get_daily_log(db.breathing_logs, user_id, date, {
        "goal": int(cfg.get("goal", 3)),
        "completed": 0,
        "schedule": cfg.get("schedule") or [],
        "completed_slots": [],
        "sessions": [],
        "rewarded": False,
    })

@api.get("/breathing/today")
async def breathing_today(date: Optional[str] = None, user=Depends(get_current_user)):
    return breathing_view(await breathing_log_for(user["id"], await read_day(user, date)))

@api.post("/breathing/session")
async def breathing_session(body: BreathingSessionReq, user=Depends(get_current_user)):
    duration = int(body.duration or 60)
    if duration < 1 or duration > 3600:
        raise HTTPException(400, "duration must be between 1 and 3600 seconds")
    date = await org_today(user)
    slot = clean_slot(body.slot)
    log = await breathing_log_for(user["id"], date)

    if slot and slot in (log.get("completed_slots") or []):
        return {**breathing_view(log), "already_completed": True}

    completed = int(log.get("completed") or 0) + 1
    push = {"sessions": {"duration": duration, "slot": slot, "completed_at": now_iso()}}
    if slot:
        push["completed_slots"] = slot
    log = await touch_daily_log(db.breathing_logs, user["id"], date, {"completed": completed}, push=push)

    event = await record_wellness_event(user, "breathing", "SESSION_COMPLETED", duration)
    bonus = None
    if completed >= int(log.get("goal") or 3) and not log.get("rewarded"):
        fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
        bonus = await maybe_award_goal_bonus(fresh or user, "breathing_goal", "breathing", date, completed)
        if bonus:
            log = await touch_daily_log(db.breathing_logs, user["id"], date, {"rewarded": True})

    totals = await current_totals(user["id"])
    return {**breathing_view(log), "already_completed": False, "activity": event["activity"],
            "xp_earned": event["xp_earned"], "goal_bonus": bonus, **totals}

@api.put("/breathing/goal")
async def breathing_goal(body: GoalReq, user=Depends(get_current_user)):
    goal = validate_goal(body.goal, 1, 24)
    date = await org_today(user)
    await breathing_log_for(user["id"], date)
    await save_user_settings(user["id"], {"breathing": {"goal": goal}})
    log = await touch_daily_log(db.breathing_logs, user["id"], date, {"goal": goal})
    return breathing_view(log)

@api.put("/breathing/schedule")
async def breathing_schedule(body: ScheduleReq, user=Depends(get_current_user)):
    schedule = clean_schedule(body.schedule)
    date = await org_today(user)
    await breathing_log_for(user["id"], date)
    await save_user_settings(user["id"], {"breathing": {"schedule": schedule}})
    log = await touch_daily_log(db.breathing_logs, user["id"], date, {"schedule": schedule})
    return breathing_view(log)

@api.get("/breathing/history")
async def breathing_history(days: int = 30, start: Optional[str] = None, end: Optional[str] = None,
                            user=Depends(get_current_user)):
    logs = await db.breathing_logs.find(
        {"user_id": user["id"], "date": history_range(days, start, end)}, {"_id": 0}
    ).sort("date", -1).to_list(400)
    items = [breathing_view(l) for l in logs]
    return {
        "items": items,
        "days_tracked": len(items),
        "goals_completed": sum(1 for i in items if i["goal_reached"]),
        "total_sessions": sum(i["completed"] for i in items),
        "total_duration": sum(i["total_duration"] for i in items),
    }


# =========================================================================
# 7. Rewards / XP endpoints
# =========================================================================

async def current_totals(user_id: str) -> dict:
    u = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "points": 1, "level": 1, "coins": 1, "streak": 1, "wellness_score": 1},
    ) or {}
    return {
        "xp": u.get("points", 0),
        "points": u.get("points", 0),
        "level": u.get("level", 1),
        "coins": u.get("coins", 0),
        "streak": u.get("streak", 0),
        "wellness_score": u.get("wellness_score", 50),
    }

@api.get("/rewards")
async def rewards_summary(user=Depends(get_current_user)):
    """Current XP / level / coins plus progress toward the next level (doc section 7)."""
    gc = await get_game_config(user.get("org_id"))
    totals = await current_totals(user["id"])
    threshold = max(1, gc.get("level_threshold", 200))
    into_level = totals["xp"] % threshold
    today = datetime.now(timezone.utc).date().isoformat()
    claimed_today = await db.reward_transactions.distinct(
        "type", {"user_id": user["id"], "dedupe_key": {"$regex": f":{today}$"}}
    )
    unclaimed = await db.rewards.count_documents({"user_id": user["id"], "claimed": False})
    return {
        **totals,
        "level_threshold": threshold,
        "xp_into_level": into_level,
        "xp_to_next_level": threshold - into_level,
        "claimed_today": claimed_today,
        "pending_rewards": unclaimed,
    }

@api.get("/rewards/history")
async def rewards_history(limit: int = 50, user=Depends(get_current_user)):
    limit = max(1, min(200, limit))
    items = await db.reward_transactions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    total = sum(i.get("xp", 0) for i in items)
    return {"items": items, "count": len(items), "xp_in_window": total}

class RewardClaimReq(BaseModel):
    source: str                          # water_goal | eye_break_goal | move_reset_goal | breathing_goal
    date: Optional[str] = None

@api.post("/rewards/claim")
async def rewards_claim(body: RewardClaimReq, user=Depends(get_current_user)):
    """Claim a wellness goal reward. The backend re-validates the goal from the
    stored logs, so a client cannot claim XP it has not earned."""
    source = (body.source or "").strip()
    if source not in REWARD_RULES:
        raise HTTPException(400, f"source must be one of: {', '.join(sorted(REWARD_RULES))}")
    date = await org_today(user)

    checks = {
        "water_goal": (db.water_logs, lambda l: int(l.get("consumed") or 0) >= max(1, int(l.get("goal") or 1)), "water"),
        "eye_break_goal": (db.eye_break_logs, lambda l: int(l.get("completed") or 0) >= max(1, int(l.get("goal") or 1)), "eye_care"),
        "move_reset_goal": (db.move_reset_logs, lambda l: int(l.get("completed") or 0) >= max(1, int(l.get("goal") or 1)), "stand"),
        "breathing_goal": (db.breathing_logs, lambda l: int(l.get("completed") or 0) >= max(1, int(l.get("goal") or 1)), "breathing"),
    }
    coll, is_done, atype = checks[source]
    log = await coll.find_one({"user_id": user["id"], "date": date}, {"_id": 0})
    if not log or not is_done(log):
        raise HTTPException(400, "Goal has not been completed yet")

    bonus = await maybe_award_goal_bonus(user, source, atype, date, log.get("completed") or log.get("consumed"))
    if not bonus:
        raise HTTPException(409, "Reward already claimed for this day")
    await coll.update_one({"user_id": user["id"], "date": date},
                          {"$set": {"rewarded": True, "updated_at": now_iso()}})
    return {**bonus, **(await current_totals(user["id"]))}


# =========================================================================
# 8. Daily activity tracking / live feed
# =========================================================================

@api.get("/activities/feed")
async def activity_feed(limit: int = 30, scope: str = "me", user=Depends(get_current_user)):
    """Live activity feed. scope=me (default) or scope=all for the whole team."""
    limit = max(1, min(100, limit))
    if scope == "all":
        q = {"user_id": {"$in": await org_member_ids(user.get("org_id"))}}
    else:
        q = {"user_id": user["id"]}
    items = await db.activities.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    if scope == "all":
        uids = list({i["user_id"] for i in items})
        users = await db.users.find(org_q(user, id={"$in": uids}),
                                    {"_id": 0, "id": 1, "name": 1, "avatar": 1}).to_list(len(uids) or 1)
        by_id = {u["id"]: u for u in users}
        for i in items:
            i["user"] = by_id.get(i["user_id"])
    return items

@api.get("/activities/history")
async def activity_history(days: int = 7, type: Optional[str] = None, category: Optional[str] = None,
                           limit: int = 200, user=Depends(get_current_user)):
    days = max(1, min(365, days))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"user_id": user["id"], "created_at": {"$gte": since}}
    if type:
        q["type"] = type
    if category:
        q["category"] = category.upper()
    items = await db.activities.find(q, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(500, limit)))
    by_category: Dict[str, int] = {}
    for i in items:
        key = i.get("category") or WELLNESS_CATEGORY.get(i.get("type"), "OTHER")
        by_category[key] = by_category.get(key, 0) + 1
    return {
        "items": items,
        "total": len(items),
        "by_category": by_category,
        "xp_earned": sum(i.get("xp_earned", i.get("points", 0)) or 0 for i in items),
    }


# =========================================================================
# 11. Streaks
# =========================================================================

async def compute_streaks(user_id: str) -> dict:
    """Derive the current/longest daily streak from dated activity records."""
    stamps = await db.activities.distinct("created_at", {"user_id": user_id})
    days = set()
    for s in stamps:
        try:
            days.add(datetime.fromisoformat(s).date())
        except (ValueError, TypeError):
            continue
    if not days:
        return {"current_streak": 0, "longest_streak": 0, "active_today": False,
                "last_active_date": None, "total_active_days": 0}

    ordered = sorted(days)
    longest = run = 1
    for prev, cur in zip(ordered, ordered[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        longest = max(longest, run)

    today = datetime.now(timezone.utc).date()
    active_today = today in days
    # A streak survives until the end of the following day (yesterday still counts).
    anchor = today if active_today else today - timedelta(days=1)
    current = 0
    if anchor in days:
        cursor = anchor
        while cursor in days:
            current += 1
            cursor -= timedelta(days=1)

    return {
        "current_streak": current,
        "longest_streak": longest,
        "active_today": active_today,
        "last_active_date": ordered[-1].isoformat(),
        "total_active_days": len(days),
    }

@api.get("/streaks")
async def streaks(user=Depends(get_current_user)):
    data = await compute_streaks(user["id"])
    # Keep the denormalised counter on the user document in sync with the log.
    if data["current_streak"] != user.get("streak"):
        await db.users.update_one({"id": user["id"]}, {"$set": {"streak": data["current_streak"]}})
    return data


# =========================================================================
# 9. Dashboard aggregate
# =========================================================================

@api.get("/dashboard")
async def dashboard(date: Optional[str] = None, user=Depends(get_current_user)):
    """Single combined summary so the dashboard needs one request, not six."""
    day = await read_day(user, date)
    uid = user["id"]

    water = water_view(await water_log_for(uid, day))
    eye = eye_break_view(await eye_break_log_for(uid, day))
    move = move_reset_view(await move_reset_log_for(uid, day))
    breath = breathing_view(await breathing_log_for(uid, day))
    totals = await current_totals(uid)
    streak_data = await compute_streaks(uid)

    since = await org_day_start_utc(user, day)
    todays = await db.activities.find(
        {"user_id": uid, "created_at": {"$gte": since}}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    modules = [water["completed"], eye["goal_reached"], move["goal_reached"], breath["goal_reached"]]
    return {
        "date": day,
        "water": {"consumed": water["consumed"], "goal": water["goal"], "progress": water["progress"],
                  "completed": water["completed"], "rewarded": water["rewarded"]},
        "eye_break": {"completed": eye["completed"], "goal": eye["goal"], "progress": eye["progress"],
                      "schedule": eye["schedule"], "completed_slots": eye["completed_slots"],
                      "rewarded": eye["rewarded"]},
        "move_reset": {"completed": move["completed"], "goal": move["goal"], "progress": move["progress"],
                       "schedule": move["schedule"], "completed_slots": move["completed_slots"],
                       "rewarded": move["rewarded"]},
        "breathing": {"completed": breath["completed"], "goal": breath["goal"], "progress": breath["progress"],
                      "schedule": breath["schedule"], "rewarded": breath["rewarded"]},
        "xp": totals["xp"],
        "points": totals["points"],
        "level": totals["level"],
        "coins": totals["coins"],
        "wellness_score": totals["wellness_score"],
        "streak": streak_data["current_streak"],
        "longest_streak": streak_data["longest_streak"],
        "modules_completed": sum(1 for m in modules if m),
        "modules_total": len(modules),
        "activities_today": len(todays),
        "points_today": int((await db.daily_points.find_one({"user_id": uid, "date": day}, {"_id": 0, "points": 1}) or {}).get("points", 0)),
        "recent_activity": todays[:10],
    }


# =========================================================================
# 12. Notification preferences, devices and scheduled reminders
# =========================================================================

NOTIFICATION_MODULES = {
    "water": ("water", "reminder_times", "💧 Time to drink water!", "Hydrate or deteriorate, legend.", "🚰"),
    "eye_care": ("eye_break", "schedule", "👀 Eye break time!", "20-20-20. Look away for 20 seconds.", "👀"),
    "move_reset": ("move_reset", "schedule", "🧍 Move & reset!", "Stand up, stretch, shake it out.", "🧍"),
    "breathing": ("breathing", "schedule", "🌬️ Breathing break!", "Slow it down. In... hold... out.", "🌬️"),
}

class NotificationSettingsReq(BaseModel):
    notifications_enabled: Optional[bool] = None
    desktop_notifications: Optional[bool] = None
    in_app_popup: Optional[bool] = None
    sound: Optional[bool] = None
    water: Optional[bool] = None
    eye_care: Optional[bool] = None
    move_reset: Optional[bool] = None
    breathing: Optional[bool] = None

class DeviceReq(BaseModel):
    token: Optional[str] = None  # falls back to subscription.endpoint when omitted
    platform: Optional[str] = "web"      # web | ios | android
    provider: Optional[str] = "webpush"  # webpush | fcm | apns
    label: Optional[str] = None
    subscription: Optional[Dict[str, Any]] = None  # raw PushSubscriptionJSON for webpush


def notifications_enabled_for(settings: dict, module: str) -> bool:
    prefs = settings.get("notifications") or {}
    if not prefs.get("notifications_enabled", True):
        return False
    return bool(prefs.get(module, True))

@api.get("/notifications")
async def notifications_list(limit: int = 50, unread_only: bool = False,
                             user=Depends(get_current_user)):
    """Notification history/status for the signed-in user (doc section 12)."""
    limit = max(1, min(200, limit))
    q = {"user_id": user["id"]}
    if unread_only:
        q["read"] = False
    items = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": items, "count": len(items), "unread": unread}

@api.get("/notifications/history")
async def notifications_history(days: int = 30, kind: Optional[str] = None,
                                user=Depends(get_current_user)):
    days = max(1, min(365, days))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"user_id": user["id"], "created_at": {"$gte": since}}
    if kind:
        q["kind"] = kind
    items = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    by_status: Dict[str, int] = {}
    for i in items:
        by_status[i.get("status", "sent")] = by_status.get(i.get("status", "sent"), 0) + 1
    return {"items": items, "total": len(items), "by_status": by_status}

@api.get("/notifications/settings")
async def get_notification_settings(user=Depends(get_current_user)):
    return (await get_user_settings(user["id"]))["notifications"]

@api.put("/notifications/settings")
async def put_notification_settings(body: NotificationSettingsReq, user=Depends(get_current_user)):
    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(400, "No notification settings supplied")
    saved = await save_user_settings(user["id"], {"notifications": patch})
    return saved["notifications"]

@api.get("/notifications/vapid-public-key")
async def vapid_public_key():
    """Doc section 8.4 — the browser needs this to call pushManager.subscribe()."""
    key = os.environ.get("VAPID_PUBLIC_KEY")
    if not key:
        raise HTTPException(503, "Push notifications are not configured on this server")
    return {"key": key}

@api.post("/notifications/register-device")
async def register_device(body: DeviceReq, user=Depends(get_current_user)):
    token = (body.token or (body.subscription or {}).get("endpoint") or "").strip()
    if not token or len(token) > 4096:
        raise HTTPException(400, "token is required and must be under 4096 characters")
    if body.platform not in ("web", "ios", "android"):
        raise HTTPException(400, "platform must be web, ios or android")
    if body.provider not in ("webpush", "fcm", "apns"):
        raise HTTPException(400, "provider must be webpush, fcm or apns")
    if body.provider == "webpush" and body.subscription:
        if not body.subscription.get("endpoint") or not (body.subscription.get("keys") or {}).get("p256dh"):
            raise HTTPException(400, "subscription must include endpoint and keys.p256dh")
    device = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "token": token,
        "platform": body.platform,
        "provider": body.provider,
        "label": (body.label or "")[:120],
        "subscription": body.subscription,
        "active": True,
        "created_at": now_iso(),
    }
    # One row per token: re-registering refreshes ownership instead of duplicating.
    await db.devices.update_one(
        {"token": token},
        {"$set": {k: v for k, v in device.items() if k not in ("id", "created_at")},
         "$setOnInsert": {"id": device["id"], "created_at": device["created_at"]}},
        upsert=True,
    )
    return await db.devices.find_one({"token": token}, {"_id": 0})

@api.get("/notifications/devices")
async def list_devices(user=Depends(get_current_user)):
    return await db.devices.find({"user_id": user["id"], "active": True}, {"_id": 0}).to_list(50)

@api.delete("/notifications/devices/{device_id}")
async def delete_device(device_id: str, user=Depends(get_current_user)):
    result = await db.devices.update_one(
        {"id": device_id, "user_id": user["id"]}, {"$set": {"active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Device not found")
    return {"ok": True}

@api.get("/notifications/schedule")
async def notification_schedule(user=Depends(get_current_user)):
    """The user's reminder timetable for today, with the next upcoming event."""
    settings = await get_user_settings(user["id"])
    now = datetime.now(timezone.utc)
    current_minutes = now.hour * 60 + now.minute
    events = []
    for module, (section, key, title, message, icon) in NOTIFICATION_MODULES.items():
        if not notifications_enabled_for(settings, module):
            continue
        for t in (settings.get(section) or {}).get(key) or []:
            hh, mm = (int(x) for x in t.split(":"))
            events.append({
                "type": module,
                "time": t,
                "title": title,
                "message": message,
                "icon": icon,
                "upcoming": (hh * 60 + mm) >= current_minutes,
            })
    events.sort(key=lambda e: e["time"])
    upcoming = [e for e in events if e["upcoming"]]
    return {
        "enabled": (settings.get("notifications") or {}).get("notifications_enabled", True),
        "events": events,
        "next": upcoming[0] if upcoming else None,
    }


async def deliver_push(device: dict, title: str, message: str, data: dict = None) -> str:
    """Hand a reminder to the configured push provider (doc section 8.4).

    Real delivery is wired for `webpush` devices carrying a browser subscription,
    using the VAPID keypair in .env. FCM/APNs (native app) devices have no
    provider configured in this environment, so they're recorded as `queued`.
    """
    if device.get("provider") == "webpush" and device.get("subscription"):
        vapid_private = os.environ.get("VAPID_PRIVATE_KEY")
        if not vapid_private:
            logger.info("Push queued (VAPID not configured) for device %s: %s", device.get("id"), title)
            return "queued"
        try:
            import json as _json
            from pywebpush import webpush, WebPushException
            await asyncio.to_thread(
                webpush,
                subscription_info=device["subscription"],
                data=_json.dumps({"title": title, "message": message, "data": data or {}}),
                vapid_private_key=vapid_private,
                vapid_claims={"sub": os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@example.com")},
            )
            return "sent"
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                # Subscription is gone (user revoked permission / browser data cleared).
                await db.devices.update_one({"id": device.get("id")}, {"$set": {"active": False}})
            logger.warning("Push delivery failed for device %s: %s", device.get("id"), exc)
            return "failed"
        except Exception as exc:
            logger.warning("Push delivery failed for device %s: %s", device.get("id"), exc)
            return "failed"

    provider_key = os.environ.get("PUSH_PROVIDER_KEY")
    if not provider_key:
        logger.info("Push queued (no provider configured) for device %s: %s", device.get("id"), title)
        return "queued"
    try:
        # Provider-specific delivery goes here.
        return "sent"
    except Exception as exc:  # pragma: no cover - depends on provider
        logger.warning("Push delivery failed for device %s: %s", device.get("id"), exc)
        return "failed"

async def dispatch_due_reminders(window_minutes: int = 5, org_id: Optional[str] = None) -> dict:
    """Find reminders due in the current window and record/send them once each.

    Idempotent per (user, type, time, day) via the `notification_dispatch` guard
    collection, so it is safe to call from a cron/worker every minute. `org_id`
    limits the run to one tenant (the admin HTTP trigger); None = all tenants (cron).
    """
    now = datetime.now(timezone.utc)
    day = now.date().isoformat()
    current_minutes = now.hour * 60 + now.minute
    window = max(1, min(60, window_minutes))

    sent, skipped = 0, 0
    # Only users who have saved settings are in scope: storing settings is the
    # opt-in signal, so nobody gets reminders they never configured.
    q = {"user_id": {"$in": await org_member_ids(org_id)}} if org_id else {}
    settings_docs = await db.user_settings.find(q, {"_id": 0}).to_list(2000)
    user_ids = [s["user_id"] for s in settings_docs if s.get("user_id")]
    for uid in user_ids:
        settings = await get_user_settings(uid)
        for module, (section, key, title, message, icon) in NOTIFICATION_MODULES.items():
            if not notifications_enabled_for(settings, module):
                skipped += 1
                continue
            for t in (settings.get(section) or {}).get(key) or []:
                hh, mm = (int(x) for x in t.split(":"))
                delta = current_minutes - (hh * 60 + mm)
                if delta < 0 or delta >= window:
                    continue
                guard = {"user_id": uid, "type": module, "time": t, "date": day}
                existing = await db.notification_dispatch.find_one(guard)
                if existing:
                    continue
                await db.notification_dispatch.insert_one({**guard, "created_at": now_iso()})

                devices = await db.devices.find({"user_id": uid, "active": True}, {"_id": 0}).to_list(20)
                statuses = [await deliver_push(d, title, message, {"type": module}) for d in devices]
                status = "sent" if "sent" in statuses else ("queued" if statuses else "in_app_only")

                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": uid,
                    "kind": "wellness",
                    "type": module,
                    "title": title,
                    "message": message,
                    "icon": icon,
                    "data": {"type": module, "slot": t},
                    "scheduled_at": f"{day}T{t}:00+00:00",
                    "sent_at": now_iso(),
                    "status": status,
                    "read": False,
                    "created_at": now_iso(),
                })
                sent += 1
    return {"dispatched": sent, "skipped": skipped, "at": now_iso()}

@api.post("/notifications/dispatch")
async def run_dispatch(window_minutes: int = 5, admin=Depends(require_admin)):
    """Fire the reminders that are due now for the caller's organization."""
    return await dispatch_due_reminders(window_minutes, org_id=admin.get("org_id"))


# =========================================================================
# Game Teams — bounties, wager challenges and occasion shuffle
# (consumed by frontend/src/pages/GameTeams.jsx)
# =========================================================================

DEFAULT_BOUNTIES = [
    {"title": "Coffee Machine Defense", "reward": 100},
    {"title": "Ping Pong Championship Upset", "reward": 250},
    {"title": "Desk Tidy Blitz", "reward": 75},
    {"title": "Meeting Room Rescue", "reward": 120},
]

class BountyCreate(BaseModel):
    title: str
    reward: int = 100

class BountyClaim(BaseModel):
    team_id: str

class TeamChallengeReq(BaseModel):
    challenger_team_id: str
    target_team_id: str
    wager: int = 50

class OccasionShuffleReq(BaseModel):
    theme: Optional[str] = None
    num_teams: int = 4
    name_prefix: Optional[str] = None


async def ensure_default_bounties(org_id: Optional[str]):
    if await db.game_bounties.count_documents({"org_id": org_id}) == 0:
        await db.game_bounties.insert_many([{
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "title": b["title"],
            "reward": b["reward"],
            "status": "OPEN",
            "claimed_by": None,
            "claimed_by_name": None,
            "claimed_at": None,
            "created_at": now_iso(),
        } for b in DEFAULT_BOUNTIES])

async def team_of(user_id: str) -> Optional[dict]:
    return await db.game_teams.find_one({"members": user_id}, {"_id": 0})

@api.get("/game-teams/bounties")
async def list_bounties(user=Depends(get_current_user)):
    await ensure_default_bounties(user.get("org_id"))
    return await db.game_bounties.find(org_q(user), {"_id": 0}).sort("created_at", 1).to_list(100)

@api.post("/admin/game-teams/bounties")
async def create_bounty(body: BountyCreate, admin=Depends(require_admin)):
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(400, "title is required")
    if body.reward < 1 or body.reward > 1000:
        raise HTTPException(400, "reward must be between 1 and 1000")
    bounty = {
        "id": str(uuid.uuid4()),
        "org_id": admin.get("org_id"),
        "title": title[:120],
        "reward": body.reward,
        "status": "OPEN",
        "claimed_by": None,
        "claimed_by_name": None,
        "claimed_at": None,
        "created_at": now_iso(),
    }
    await db.game_bounties.insert_one(dict(bounty))
    return bounty

@api.post("/game-teams/bounties/{bounty_id}/claim")
async def claim_bounty(bounty_id: str, body: BountyClaim, user=Depends(get_current_user)):
    bounty = await db.game_bounties.find_one(org_q(user, id=bounty_id), {"_id": 0})
    if not bounty:
        raise HTTPException(404, "Bounty not found")
    if bounty.get("status") == "CLAIMED":
        raise HTTPException(409, "Bounty has already been claimed")

    team = await db.game_teams.find_one(org_q(user, id=body.team_id), {"_id": 0})
    if not team:
        raise HTTPException(404, "Team not found")
    if user["id"] not in (team.get("members") or []):
        raise HTTPException(403, "You can only claim bounties for your own team")

    # Only the first writer flips OPEN -> CLAIMED.
    result = await db.game_bounties.update_one(
        {"id": bounty_id, "status": "OPEN"},
        {"$set": {"status": "CLAIMED", "claimed_by": team["id"],
                  "claimed_by_name": team["name"], "claimed_by_user": user["id"],
                  "claimed_at": now_iso()}},
    )
    if result.modified_count == 0:
        raise HTTPException(409, "Bounty has already been claimed")

    await db.game_teams.update_one({"id": team["id"]}, {"$inc": {"team_points": bounty["reward"]}})
    for uid in team.get("members") or []:
        await create_notification(
            user_id=uid,
            kind="reward",
            title=f"🎯 Bounty claimed: {bounty['title']}",
            message=f"{user['name']} claimed +{bounty['reward']} team points for {team['name']}.",
            icon="🎯",
            data={"bounty_id": bounty_id, "team_id": team["id"], "reward": bounty["reward"]},
        )
    return await db.game_bounties.find_one({"id": bounty_id}, {"_id": 0})

@api.get("/game-teams/challenges")
async def list_challenges_teams(user=Depends(get_current_user)):
    return await db.game_challenges.find(org_q(user), {"_id": 0}).sort("created_at", -1).to_list(100)

@api.post("/game-teams/challenge")
async def challenge_team(body: TeamChallengeReq, user=Depends(get_current_user)):
    if body.challenger_team_id == body.target_team_id:
        raise HTTPException(400, "A team cannot challenge itself")
    if body.wager < 10 or body.wager > 500:
        raise HTTPException(400, "wager must be between 10 and 500 points")

    challenger = await db.game_teams.find_one(org_q(user, id=body.challenger_team_id), {"_id": 0})
    target = await db.game_teams.find_one(org_q(user, id=body.target_team_id), {"_id": 0})
    if not challenger or not target:
        raise HTTPException(404, "Team not found")
    if user["id"] not in (challenger.get("members") or []):
        raise HTTPException(403, "You can only challenge on behalf of your own team")

    duplicate = await db.game_challenges.find_one({
        "status": "PENDING",
        "challenger_team_id": challenger["id"],
        "target_team_id": target["id"],
    })
    if duplicate:
        raise HTTPException(409, "A pending challenge between these teams already exists")

    challenge = {
        "id": str(uuid.uuid4()),
        "org_id": user.get("org_id"),
        "challenger_team_id": challenger["id"],
        "challenger_team_name": challenger["name"],
        "target_team_id": target["id"],
        "target_team_name": target["name"],
        "wager": body.wager,
        "status": "PENDING",
        "winner_team_id": None,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.game_challenges.insert_one(dict(challenge))
    for uid in target.get("members") or []:
        await create_notification(
            user_id=uid,
            kind="announcement",
            title=f"⚔️ {challenger['name']} challenged {target['name']}!",
            message=f"{body.wager} team points are on the line.",
            icon="⚔️",
            data={"challenge_id": challenge["id"], "wager": body.wager},
        )
    return challenge

class ChallengeResolve(BaseModel):
    winner_team_id: str

@api.post("/admin/game-teams/challenges/{challenge_id}/resolve")
async def resolve_challenge(challenge_id: str, body: ChallengeResolve, admin=Depends(require_admin)):
    ch = await db.game_challenges.find_one(org_q(admin, id=challenge_id), {"_id": 0})
    if not ch:
        raise HTTPException(404, "Challenge not found")
    if ch["status"] != "PENDING":
        raise HTTPException(409, "Challenge has already been resolved")
    if body.winner_team_id not in (ch["challenger_team_id"], ch["target_team_id"]):
        raise HTTPException(400, "winner_team_id must be one of the two teams")

    loser_id = (ch["target_team_id"] if body.winner_team_id == ch["challenger_team_id"]
                else ch["challenger_team_id"])
    await db.game_teams.update_one({"id": body.winner_team_id}, {"$inc": {"team_points": ch["wager"]}})
    await db.game_teams.update_one({"id": loser_id}, {"$inc": {"team_points": -ch["wager"]}})
    await db.game_challenges.update_one(
        {"id": challenge_id},
        {"$set": {"status": "RESOLVED", "winner_team_id": body.winner_team_id,
                  "resolved_at": now_iso(), "resolved_by": admin["id"]}},
    )
    return await db.game_challenges.find_one({"id": challenge_id}, {"_id": 0})

@api.post("/game-teams/shuffle")
async def occasion_shuffle(body: OccasionShuffleReq, admin=Depends(require_admin)):
    """Admin-only re-allocation of everyone into fresh battalions for an occasion."""
    theme = (body.theme or "").strip()
    prefix = (body.name_prefix or theme or "Squad").strip()[:40] or "Squad"
    teams = await shuffle_teams(ShuffleReq(num_teams=body.num_teams, name_prefix=prefix), admin)
    if theme:
        await db.game_teams.update_many(org_q(admin, auto_shuffled=True), {"$set": {"theme": theme}})
        for t in teams:
            t["theme"] = theme
        for uid in await org_member_ids(admin.get("org_id")):
            await create_notification(
                user_id=uid,
                kind="announcement",
                title=f"🎲 Teams reshuffled: {theme}",
                message="Head to Game Teams to meet your new battalion.",
                icon="🎲",
                data={"theme": theme},
            )
    return {"theme": theme, "teams": teams}


@api.get("/")
async def root():
    return {"message": "Brutal Wellness API", "status": "alive"}

app.include_router(api)

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    """Keep FastAPI's `detail` key and mirror it as `message` for the frontend."""
    detail = exc.detail
    body = detail if isinstance(detail, dict) else {"detail": detail}
    body.setdefault("message", detail if isinstance(detail, str) else body.get("detail"))
    return JSONResponse(status_code=exc.status_code, content=body, headers=getattr(exc, "headers", None))

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:]) or "request"
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(errors),
                 "message": f"{field}: {first.get('msg', 'Invalid request')}"},
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

async def ensure_indexes():
    """Indexes for the wellness collections (doc section 13)."""
    for coll in (db.water_logs, db.eye_break_logs, db.move_reset_logs, db.breathing_logs):
        await coll.create_index([("user_id", 1), ("date", -1)], unique=True)
    await db.user_settings.create_index("user_id", unique=True)
    await db.reward_transactions.create_index(
        [("user_id", 1), ("dedupe_key", 1)], unique=True,
        partialFilterExpression={"dedupe_key": {"$type": "string"}},
    )
    await db.reward_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.activities.create_index([("user_id", 1), ("created_at", -1)])
    await db.activities.create_index([("user_id", 1), ("type", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.devices.create_index("token", unique=True)
    await db.devices.create_index([("user_id", 1), ("active", 1)])
    await db.notification_dispatch.create_index(
        [("user_id", 1), ("type", 1), ("time", 1), ("date", 1)], unique=True
    )
    await db.game_bounties.create_index("status")
    await db.game_challenges.create_index([("status", 1), ("created_at", -1)])
    await db.daily_points.create_index([("user_id", 1), ("date", -1)], unique=True)
    await db.bite_attempts.create_index([("user_id", 1), ("bite_id", 1), ("first", 1)])
    await db.move_reset_sessions.create_index("id", unique=True)
    await db.move_reset_sessions.create_index([("user_id", 1), ("status", 1), ("created_at", -1)])
    try:
        await db.bite_tried.create_index([("user_id", 1), ("bite_id", 1)], unique=True)
    except Exception as e:  # legacy duplicate claims; the handler still dedupes by lookup
        logger.warning("bite_tried unique index skipped: %s", e)
    await db.organizations.create_index("name")
    await db.organizations.create_index("name_normalized", unique=True)
    await db.invitations.create_index("token", unique=True)
    await db.invitations.create_index([("org_id", 1), ("email", 1)])
    for coll in TENANT_COLLECTIONS:
        await coll.create_index([("org_id", 1), ("created_at", -1)])

# Every collection whose rows belong to one organization (BUG-03). Rows that predate
# tenant isolation are backfilled into the Demo Organization on startup.
TENANT_COLLECTIONS = [
    db.posts, db.shoutouts, db.help_posts, db.polls, db.feedback, db.challenges_custom,
    db.custom_quizzes, db.quiz_results, db.announcements, db.game_teams, db.game_bounties,
    db.game_challenges, db.songs, db.playlists, db.play_history, db.moods, db.buddies,
    db.plants, db.game_scores, db.rewards, db.points_log, db.fact_reactions,
]

async def backfill_org_names():
    """Give every org a normalized name for the uniqueness index. Orgs that were already
    duplicated before BUG-02 was fixed keep their data and display name; only the oldest
    keeps the plain key, the rest get a suffixed key (and a warning in the log)."""
    orgs = await db.organizations.find(
        {"name_normalized": {"$exists": False}}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(10000)
    for o in orgs:
        await db.organizations.update_one({"id": o["id"]}, {"$set": {"name_normalized": normalize_org_name(o["name"])}})
    dupes = await db.organizations.aggregate([
        {"$group": {"_id": "$name_normalized", "ids": {"$push": {"id": "$id", "at": "$created_at", "demo": "$is_demo"}}, "n": {"$sum": 1}}},
        {"$match": {"n": {"$gt": 1}}},
    ]).to_list(1000)
    for d in dupes:
        keep = sorted(d["ids"], key=lambda x: (not x.get("demo"), x.get("at") or ""))[0]["id"]
        for o in d["ids"]:
            if o["id"] != keep:
                await db.organizations.update_one({"id": o["id"]}, {"$set": {"name_normalized": f"{d['_id']}#{o['id']}"}})
                logger.warning("Organization %s duplicates the name of %s (pre-existing); kept, but renamed key", o["id"], keep)

@app.on_event("startup")
async def on_startup():
    # Migrate: ensure all users have role & dnd fields
    try:
        await db.users.update_many({"role": {"$exists": False}}, {"$set": {"role": "employee", "dnd": False}})
        await db.users.update_many({"coins": {"$exists": False}}, {"$set": {"coins": 0}})
        await db.users.update_many({"status": {"$exists": False}}, {"$set": {"status": "active"}})
        # Backfill org_id on anything that predates tenant isolation into the Demo Organization
        default_org_id = await get_or_create_default_org()
        for coll in [db.users, db.events, *TENANT_COLLECTIONS]:
            res = await coll.update_many({"org_id": {"$exists": False}}, {"$set": {"org_id": default_org_id}})
            if res.modified_count:
                logger.info("Backfilled org_id on %d %s rows into the Demo Organization", res.modified_count, coll.name)
        # Reactions stored under the emoji-stripped "" key can't be attributed to a reaction type
        for coll in (db.posts, db.shoutouts):
            async for doc in coll.find({"reactions": {"$exists": True}}, {"_id": 0, "id": 1, "reactions": 1}):
                clean = _clean_reactions(doc.get("reactions"))
                if clean != doc.get("reactions"):
                    await coll.update_one({"id": doc["id"]}, {"$set": {"reactions": clean}})
        await db.organizations.update_many({"timezone": {"$exists": False}}, {"$set": {"timezone": DEFAULT_TIMEZONE}})
        await backfill_org_names()
        # Backfill work_anniversary from created_at, and split name into first/last, where unset
        async for u in db.users.find(
            {"$or": [{"work_anniversary": {"$exists": False}}, {"first_name": {"$exists": False}}]},
            {"_id": 0, "id": 1, "name": 1, "created_at": 1},
        ):
            first, last = _split_name(u.get("name", ""))
            anniversary = (u.get("created_at") or now_iso())[:10]
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {"first_name": first, "last_name": last, "work_anniversary": anniversary}},
            )
        try:
            await ensure_indexes()
        except Exception as e:
            logger.warning(f"Index creation skipped: {e}")
        # Ensure demo users (including admin) exist — idempotent
        count = await db.users.count_documents({})
        await seed_data()
        if count == 0:
            logger.info("Auto-seeded demo data from empty DB")
        else:
            logger.info("Ensured demo users present")
        # Events are profile-driven now (doc section 7) — give a few demo users a sample
        # birthday so the Events page has something to show out of the box.
        today = datetime.now(timezone.utc).date()
        demo_birthday_users = await db.users.find(
            {"email": {"$regex": "@demo.com$"}, "birthday": {"$in": [None, ""]}}, {"_id": 0, "id": 1}
        ).to_list(20)
        for i, u in enumerate(demo_birthday_users[:4]):
            d = today + timedelta(days=(i * 2) % 7)
            await db.users.update_one({"id": u["id"]}, {"$set": {"birthday": d.isoformat()}})
    except Exception as e:
        logger.exception(f"Startup migration failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
