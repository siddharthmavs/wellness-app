from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt
import random

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
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
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
    return user

async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user

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
class RegisterReq(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: Optional[str] = "General"

class LoginReq(BaseModel):
    email: EmailStr
    password: str

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
@api.post("/auth/register")
async def register(body: RegisterReq):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    avatar_colors = ["FFE600", "00E5FF", "FF4D6D", "00C853"]
    user = {
        "id": uid,
        "name": body.name,
        "email": body.email.lower(),
        "password": hash_password(body.password),
        "department": body.department or "General",
        "points": 0,
        "streak": 0,
        "level": 1,
        "wellness_score": 50,
        "badges": [],
        "avatar": f"https://api.dicebear.com/7.x/bottts-neutral/svg?seed={body.name}&backgroundColor={random.choice(avatar_colors)}",
        "role": "employee",
        "dnd": False,
        "created_at": now_iso(),
        "last_activity": now_iso(),
    }
    await db.users.insert_one(user)
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": create_token(uid), "user": user}

@api.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password", "")):
        raise HTTPException(401, "Invalid credentials")
    user.pop("password", None)
    user.pop("_id", None)
    return {"token": create_token(user["id"]), "user": user}

@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

# ---------- Activities / Points ----------
POINTS_MAP = {"water": 10, "eye_care": 15, "stand": 10, "breathing": 20, "mood": 5, "post": 10}

@api.post("/activities")
async def log_activity(body: ActivityReq, user=Depends(get_current_user)):
    pc = await get_points_config()
    pts = body.points or pc.get(body.type, 5)
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": body.type,
        "points": pts,
        "created_at": now_iso(),
    }
    await db.activities.insert_one(activity)
    activity.pop("_id", None)

    gc = await get_game_config()
    new_points = user.get("points", 0) + pts
    new_level = 1 + new_points // max(1, gc.get("level_threshold", 200))
    new_score = min(100, user.get("wellness_score", 50) + gc.get("wellness_score_increment", 2))

    # streak: increment on first activity of a new calendar day; reset if > 36h gap
    streak = user.get("streak", 0)
    last = user.get("last_activity")
    today = datetime.now(timezone.utc).date()
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            delta_hours = (datetime.now(timezone.utc) - last_dt).total_seconds() / 3600
            last_date = last_dt.date()
            if delta_hours > 36:
                streak = 1
            elif last_date < today:
                # new day, continue streak
                streak = max(streak, 0) + 1
            else:
                # same day, keep
                streak = max(streak, 1)
        except Exception:
            streak = max(streak, 1)
    else:
        streak = 1

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "points": new_points,
            "level": new_level,
            "wellness_score": new_score,
            "streak": streak,
            "last_activity": now_iso(),
        }},
    )
    return {"activity": activity, "points": new_points, "level": new_level, "wellness_score": new_score, "streak": streak}

@api.get("/activities/me")
async def my_activities(user=Depends(get_current_user)):
    items = await db.activities.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

# ---------- Leaderboard ----------
@api.get("/leaderboard")
async def leaderboard(period: str = "all"):
    # period: daily, weekly, monthly, all
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("points", -1).to_list(50)
    if period == "all":
        return users
    # recalc based on activities window
    now = datetime.now(timezone.utc)
    windows = {"daily": 1, "weekly": 7, "monthly": 30}
    days = windows.get(period, 7)
    since = (now - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$user_id", "points": {"$sum": "$points"}}},
        {"$sort": {"points": -1}},
        {"$limit": 50},
    ]
    agg = await db.activities.aggregate(pipeline).to_list(50)
    result = []
    for row in agg:
        u = await db.users.find_one({"id": row["_id"]}, {"_id": 0, "password": 0})
        if u:
            u["points"] = row["points"]
            result.append(u)
    return result

# ---------- Mood ----------
@api.post("/mood")
async def log_mood(body: MoodReq, user=Depends(get_current_user)):
    entry = {
        "id": str(uuid.uuid4()),
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
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": POINTS_MAP["post"]}})
    return post

@api.get("/posts")
async def list_posts():
    items = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/posts/{post_id}/like")
async def like_post(post_id: str, user=Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
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
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
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
    today_events = await db.events.find({}, {"_id": 0}).to_list(100)
    today_md = datetime.now(timezone.utc).date().strftime("%m-%d")
    out = []
    for e in today_events:
        if e.get("date", "")[5:10] == today_md and e.get("user_id") != user["id"]:
            u = await db.users.find_one({"id": e["user_id"]}, {"_id": 0, "name": 1})
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
        await db.announcements.update_one({"id": nid}, {"$addToSet": {"read_by": user["id"]}})
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
@api.post("/seed")
async def seed_data():
    # idempotent — only inserts missing demo users/posts
    existing_count = await db.users.count_documents({})

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
        await db.users.insert_one({
            "id": uid,
            "name": du["name"],
            "email": du["email"],
            "password": hash_password(du["password"]),
            "department": du["department"],
            "points": du["points"],
            "streak": random.randint(2, 14),
            "level": 1 + du["points"] // 200,
            "wellness_score": random.randint(60, 95),
            "badges": random.sample([b["id"] for b in BADGES], k=random.randint(1, 3)),
            "avatar": f"https://api.dicebear.com/7.x/bottts-neutral/svg?seed={du['name']}&backgroundColor={du['color']}",
            "role": du.get("role", "employee"),
            "dnd": False,
            "created_at": now_iso(),
            "last_activity": now_iso(),
        })

    # Seed posts only if no posts yet
    existing_posts = await db.posts.count_documents({})
    if existing_posts > 0:
        return {"seeded": True, "users_inserted": "idempotent", "posts": 0}

    demo_posts = [
        {"user_name": "Alex Chaos", "content": "When Monday hits and the coffee hasn't ", "image": ""},
        {"user_name": "Jamie Vibe", "content": "Legit feel like I merged with my chair  stand up y'all", "image": ""},
        {"user_name": "Sam Hustle", "content": "Day 7 streak of NOT looking at screen during lunch ", "image": ""},
        {"user_name": "Casey Boss", "content": "Just learned the 20-20-20 rule. My eyes: ", "image": ""},
    ]
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(10)
    user_map = {u["name"]: u for u in users}
    for p in demo_posts:
        u = user_map.get(p["user_name"])
        if not u:
            continue
        await db.posts.insert_one({
            "id": str(uuid.uuid4()),
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

# ---------- Fun Wall emoji reactions ----------
class ReactReq(BaseModel):
    emoji: str  # one of    

ALLOWED_REACTIONS = ["", "", "", ""]

@api.post("/posts/{post_id}/react")
async def react_post(post_id: str, body: ReactReq, user=Depends(get_current_user)):
    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(400, "Invalid emoji")
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    reactions = post.get("reactions", {})
    # toggle
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

# ---------- User profile updates (DND, bio) ----------
class UserPatch(BaseModel):
    dnd: Optional[bool] = None
    bio: Optional[str] = None

@api.patch("/users/me")
async def update_me(body: UserPatch, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
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
    # fetch recipient names
    recipients = await db.users.find({"id": {"$in": body.recipient_ids}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1}).to_list(50)
    shout = {
        "id": str(uuid.uuid4()),
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
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": 5}})
    for rid in body.recipient_ids:
        await db.users.update_one({"id": rid}, {"$inc": {"points": 10}})
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
async def list_shoutouts():
    items = await db.shoutouts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.get("/shoutouts/digest")
async def shoutouts_digest():
    # top 3 receivers this week
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    items = await db.shoutouts.find({"created_at": {"$gte": since}}, {"_id": 0}).to_list(500)
    counts = {}
    for s in items:
        for r in s.get("recipients", []):
            counts[r["id"]] = counts.get(r["id"], 0) + 1
    top_ids = sorted(counts.keys(), key=lambda k: -counts[k])[:3]
    top = []
    for uid in top_ids:
        u = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
        if u:
            u["shoutouts_received"] = counts[uid]
            top.append(u)
    return top

@api.post("/shoutouts/{sid}/react")
async def react_shout(sid: str, body: ReactReq, user=Depends(get_current_user)):
    if body.emoji not in ALLOWED_REACTIONS:
        raise HTTPException(400, "Invalid emoji")
    s = await db.shoutouts.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    reactions = s.get("reactions", {})
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
async def list_help(category: Optional[str] = None):
    q = {}
    if category and category != "All":
        q["category"] = category
    items = await db.help_posts.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api.post("/help/{pid}/like")
async def like_help(pid: str, user=Depends(get_current_user)):
    p = await db.help_posts.find_one({"id": pid}, {"_id": 0})
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
    p = await db.help_posts.find_one({"id": pid}, {"_id": 0})
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
    items = await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

# ---------- Team leaderboard ----------
@api.get("/leaderboard/teams")
async def team_leaderboard():
    pipeline = [
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
    }

# ---------- Admin routes ----------
@api.get("/admin/users")
async def admin_users(admin=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(500)
    return users

class AdminUserPatch(BaseModel):
    role: Optional[str] = None
    department: Optional[str] = None
    points: Optional[int] = None

@api.patch("/admin/users/{uid}")
async def admin_update_user(uid: str, body: AdminUserPatch, admin=Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": uid}, {"$set": updates})
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password": 0})
    return u

@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin=Depends(require_admin)):
    if uid == admin["id"]:
        raise HTTPException(400, "Cannot delete self")
    await db.users.delete_one({"id": uid})
    return {"deleted": True}

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
    items = await db.challenges_custom.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.delete("/admin/challenges/{cid}")
async def admin_del_challenge(cid: str, admin=Depends(require_admin)):
    await db.challenges_custom.delete_one({"id": cid})
    return {"deleted": True}

class ReminderConfig(BaseModel):
    water_interval_min: int = 60
    eye_care_interval_min: int = 20
    stand_interval_min: int = 90
    enabled: bool = True

@api.get("/admin/reminders")
async def get_reminder_config(admin=Depends(require_admin)):
    cfg = await db.config.find_one({"key": "reminders"}, {"_id": 0})
    if not cfg:
        cfg = {"key": "reminders", **ReminderConfig().model_dump()}
        await db.config.insert_one(cfg)
        cfg.pop("_id", None)
    return cfg

@api.put("/admin/reminders")
async def set_reminder_config(body: ReminderConfig, admin=Depends(require_admin)):
    await db.config.update_one(
        {"key": "reminders"},
        {"$set": {"key": "reminders", **body.model_dump()}},
        upsert=True,
    )
    return body.model_dump()

@api.get("/admin/analytics")
async def admin_analytics(admin=Depends(require_admin)):
    now = datetime.now(timezone.utc)
    today_iso = now.date().isoformat()
    week_iso = (now - timedelta(days=7)).isoformat()
    month_iso = (now - timedelta(days=30)).isoformat()

    total_users = await db.users.count_documents({})
    dau = len(await db.activities.distinct("user_id", {"created_at": {"$gte": today_iso}}))
    wau = len(await db.activities.distinct("user_id", {"created_at": {"$gte": week_iso}}))
    mau = len(await db.activities.distinct("user_id", {"created_at": {"$gte": month_iso}}))

    # mood heatmap this week
    moods = await db.moods.find({"created_at": {"$gte": week_iso}}, {"_id": 0}).to_list(1000)
    mood_counts = {}
    for m in moods:
        mood_counts[m["label"]] = mood_counts.get(m["label"], 0) + 1
    mood_chart = [{"label": k, "count": v} for k, v in mood_counts.items()]

    # activities per type this week
    act_pipeline = [
        {"$match": {"created_at": {"$gte": week_iso}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
    ]
    acts = await db.activities.aggregate(act_pipeline).to_list(50)
    act_chart = [{"type": a["_id"], "count": a["count"]} for a in acts]

    # posts, shoutouts, feedback counts
    posts = await db.posts.count_documents({})
    shouts = await db.shoutouts.count_documents({})
    fb = await db.feedback.count_documents({})
    help_p = await db.help_posts.count_documents({})

    # 7-day activity trend
    trend = []
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).date().isoformat()
        d_next = (now - timedelta(days=i - 1)).date().isoformat()
        cnt = await db.activities.count_documents({"created_at": {"$gte": d, "$lt": d_next}})
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
async def list_polls():
    items = await db.polls.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/polls/{pid}/vote")
async def vote_poll(pid: str, body: dict, user=Depends(get_current_user)):
    option_idx = body.get("option_idx")
    if option_idx is None:
        raise HTTPException(400, "option_idx required")
    poll = await db.polls.find_one({"id": pid}, {"_id": 0})
    if not poll:
        raise HTTPException(404, "Not found")
    options = poll.get("options", [])
    # remove user's prior vote
    for o in options:
        if user["id"] in o.get("votes", []):
            o["votes"].remove(user["id"])
    if 0 <= option_idx < len(options):
        options[option_idx].setdefault("votes", []).append(user["id"])
    await db.polls.update_one({"id": pid}, {"$set": {"options": options}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": 2}})
    return {"options": options}

# ---------- Events (birthdays/anniversaries) ----------
class EventCreate(BaseModel):
    type: str  # birthday | anniversary
    user_id: str
    date: str  # YYYY-MM-DD (recurs annually)
    note: Optional[str] = ""

@api.post("/events")
async def create_event(body: EventCreate, admin=Depends(require_admin)):
    ev = {"id": str(uuid.uuid4()), **body.model_dump(), "created_at": now_iso()}
    await db.events.insert_one(ev)
    ev.pop("_id", None)
    return ev

@api.get("/events")
async def list_events():
    items = await db.events.find({}, {"_id": 0}).to_list(500)
    # Resolve user names
    for e in items:
        u = await db.users.find_one({"id": e["user_id"]}, {"_id": 0, "name": 1, "avatar": 1, "department": 1})
        if u:
            e["user_name"] = u.get("name")
            e["user_avatar"] = u.get("avatar")
            e["department"] = u.get("department")
    return items

@api.get("/events/today")
async def events_today():
    today = datetime.now(timezone.utc).date()
    md = today.strftime("%m-%d")
    items = await db.events.find({}, {"_id": 0}).to_list(500)
    out = []
    for e in items:
        if e.get("date", "")[5:10] == md:
            u = await db.users.find_one({"id": e["user_id"]}, {"_id": 0, "name": 1, "avatar": 1, "department": 1})
            if u:
                out.append({**e, "user_name": u["name"], "user_avatar": u["avatar"], "department": u.get("department")})
    return out

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
async def fact_today():
    idx = datetime.now(timezone.utc).timetuple().tm_yday % len(FACTS_BANK)
    f = FACTS_BANK[idx]
    reactions = await db.fact_reactions.find_one({"fact_id": f["id"]}, {"_id": 0}) or {"fact_id": f["id"], "reactions": {}}
    return {**f, "reactions": reactions.get("reactions", {})}

class FactReact(BaseModel):
    fact_id: str
    reaction: str  # mind_blown | knew_it | hmm

ALLOWED_FACT_REACTS = ["mind_blown", "knew_it", "hmm"]

@api.post("/facts/react")
async def react_fact(body: FactReact, user=Depends(get_current_user)):
    if body.reaction not in ALLOWED_FACT_REACTS:
        raise HTTPException(400, "Invalid reaction")
    doc = await db.fact_reactions.find_one({"fact_id": body.fact_id}, {"_id": 0}) or {"fact_id": body.fact_id, "reactions": {}}
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
    await db.fact_reactions.update_one({"fact_id": body.fact_id}, {"$set": {"fact_id": body.fact_id, "reactions": reactions}}, upsert=True)
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
        await db.users.update_one({"id": user["id"]}, {"$inc": {"points": pts}})
    return {"score": sc, "points_awarded": pts}

@api.get("/games/leaderboard")
async def game_leaderboard(game: Optional[str] = None):
    q = {}
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
    custom = await db.custom_quizzes.find_one({"department": dept}, {"_id": 0})
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
    custom = await db.custom_quizzes.find_one({"department": dept}, {"_id": 0})
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
    pc = await get_points_config()
    pts = correct * pc.get("quiz_per_correct", 3) + (pc.get("quiz_perfect_bonus", 15) if correct == len(questions) else 0)
    rec = {
        "id": str(uuid.uuid4()),
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
        await db.users.update_one({"id": user["id"]}, {"$inc": {"points": pts}})
    return {"correct": correct, "total": len(questions), "points": pts, "results": results}

# ---------- Buddy System ----------
@api.get("/buddy/me")
async def my_buddy(user=Depends(get_current_user)):
    pair = await db.buddies.find_one({"$or": [{"buddy_a": user["id"]}, {"buddy_b": user["id"]}]}, {"_id": 0})
    if not pair:
        return None
    other_id = pair["buddy_b"] if pair["buddy_a"] == user["id"] else pair["buddy_a"]
    other = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
    return {"pairing": pair, "buddy": other}

@api.post("/buddy/pair")
async def pair_buddy(user=Depends(get_current_user)):
    # if already paired, return
    existing = await db.buddies.find_one({"$or": [{"buddy_a": user["id"]}, {"buddy_b": user["id"]}]}, {"_id": 0})
    if existing:
        other_id = existing["buddy_b"] if existing["buddy_a"] == user["id"] else existing["buddy_a"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "password": 0})
        return {"pairing": existing, "buddy": other}
    # find someone same department or random
    dept = user.get("department")
    candidates = await db.users.find({"id": {"$ne": user["id"]}, "department": dept}, {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1}).to_list(50)
    if not candidates:
        candidates = await db.users.find({"id": {"$ne": user["id"]}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1}).to_list(50)
    if not candidates:
        raise HTTPException(404, "No buddies available")
    other = random.choice(candidates)
    pairing = {
        "id": str(uuid.uuid4()),
        "buddy_a": user["id"],
        "buddy_b": other["id"],
        "started_at": now_iso(),
        "checkins": [],
    }
    await db.buddies.insert_one(pairing)
    pairing.pop("_id", None)
    full_other = await db.users.find_one({"id": other["id"]}, {"_id": 0, "password": 0})
    return {"pairing": pairing, "buddy": full_other}

@api.post("/buddy/checkin")
async def buddy_checkin(user=Depends(get_current_user)):
    pair = await db.buddies.find_one({"$or": [{"buddy_a": user["id"]}, {"buddy_b": user["id"]}]}, {"_id": 0})
    if not pair:
        raise HTTPException(404, "No buddy")
    checkins = pair.get("checkins", []) + [{"user_id": user["id"], "at": now_iso()}]
    await db.buddies.update_one({"id": pair["id"]}, {"$set": {"checkins": checkins}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": 10}})
    return {"checkins": len(checkins)}

# ---------- Employee Spotlight (weekly rotation) ----------
@api.get("/spotlight/current")
async def spotlight_current():
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", 1).to_list(500)
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
    {"id": "lb1", "department": "Engineering", "title": "Use --depth=1 in git clone for faster pulls", "body": "Shallow clone fetches only the latest commit — saves time on big repos.", "format": "text"},
    {"id": "lb2", "department": "Engineering", "title": "Optimize MongoDB with compound indexes", "body": "Order matters: most-equality-first then range. Match your $sort fields too.", "format": "text"},
    {"id": "lb3", "department": "Design", "title": "Use 8pt grid for spacing", "body": "Multiples of 8 (8/16/24/32) keep everything visually consistent across breakpoints.", "format": "text"},
    {"id": "lb4", "department": "Design", "title": "Color contrast — aim for 4.5:1", "body": "Use Stark or Contrast Ratio plugin. Most a11y issues are color-related.", "format": "text"},
    {"id": "lb5", "department": "Marketing", "title": "Write CTAs that lead with benefit", "body": "‘Get my 7-day plan’ beats ‘Submit’ — every time.", "format": "text"},
    {"id": "lb6", "department": "HR", "title": "Run 1-on-1s as the report owns the agenda", "body": "Manager listens. Their cadence = relationship cadence.", "format": "text"},
    {"id": "lb7", "department": "Product", "title": "Prioritize using RICE", "body": "Reach × Impact × Confidence ÷ Effort = score. Stack-rank ruthlessly.", "format": "text"},
    {"id": "lb8", "department": "General", "title": "The 2-minute rule", "body": "If a task takes <2 mins, do it now. Saves the mental tax of a todo list.", "format": "text"},
    {"id": "lb9", "department": "General", "title": "Stand for every meeting under 15 min", "body": "Better posture, faster decisions. Try it tomorrow.", "format": "text"},
    {"id": "lb10", "department": "QA", "title": "Boundary value testing", "body": "Test at min, max, just-below, just-above. Most bugs hide at edges.", "format": "text"},
]

@api.get("/learning-bites")
async def get_bites(department: Optional[str] = None):
    if department and department != "All":
        bites = [b for b in LEARNING_BITES if b["department"] == department]
    else:
        bites = LEARNING_BITES
    # attach tried counts
    out = []
    for b in bites:
        cnt = await db.bite_tried.count_documents({"bite_id": b["id"]})
        out.append({**b, "tried_count": cnt})
    return out

@api.post("/learning-bites/{bite_id}/tried")
async def tried_bite(bite_id: str, user=Depends(get_current_user)):
    existing = await db.bite_tried.find_one({"bite_id": bite_id, "user_id": user["id"]})
    if existing:
        return {"already": True}
    await db.bite_tried.insert_one({"bite_id": bite_id, "user_id": user["id"], "at": now_iso()})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": 5}})
    return {"awarded": 5}

# ---------- Desk Plant Challenge ----------
@api.post("/plants/optin")
async def plant_optin(user=Depends(get_current_user)):
    existing = await db.plants.find_one({"user_id": user["id"]})
    if existing:
        existing.pop("_id", None)
        return existing
    p = {
        "id": str(uuid.uuid4()),
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
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": 3}})
    return {"streak": streak, "checkins": len(checkins)}

@api.get("/plants/leaderboard")
async def plant_leaderboard():
    items = await db.plants.find({}, {"_id": 0}).sort("streak", -1).to_list(50)
    return items

# ---------- Wellness Recap (Monday auto-post) ----------
@api.post("/recap/post")
async def post_recap(admin=Depends(require_admin)):
    # Build a Monday recap post auto-posting to Fun Wall
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    # top 3 by streak this week
    top = await db.users.find({}, {"_id": 0, "password": 0}).sort("streak", -1).to_list(3)
    teams = await db.users.aggregate([
        {"$group": {"_id": "$department", "points": {"$sum": "$points"}}},
        {"$sort": {"points": -1}},
        {"$limit": 1},
    ]).to_list(1)
    top_team = teams[0]["_id"] if teams else "—"
    msg = " WEEKLY RECAP! Top streakers: " + ", ".join([f"{u['name']} ({u['streak']}d )" for u in top]) + f".  Team of the week: {top_team}!"
    post = {
        "id": str(uuid.uuid4()),
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
    target = await db.users.find_one({"id": body.user_id}, {"_id": 0, "name": 1, "id": 1})
    if not target:
        raise HTTPException(404, "User not found")
    rew = {
        "id": str(uuid.uuid4()),
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
        await db.users.update_one({"id": body.user_id}, {"$inc": {"points": body.points}})
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
    items = await db.rewards.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
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
}

DEFAULT_GAME_CONFIG = {
    "level_threshold": 200,
    "streak_gap_hours": 36,
    "wellness_score_increment": 2,
}

async def get_points_config():
    cfg = await db.config.find_one({"key": "points_config"}, {"_id": 0})
    if not cfg:
        return DEFAULT_POINTS_CONFIG.copy()
    return {**DEFAULT_POINTS_CONFIG, **{k: v for k, v in cfg.items() if k != "key"}}

async def get_game_config():
    cfg = await db.config.find_one({"key": "game_config"}, {"_id": 0})
    if not cfg:
        return DEFAULT_GAME_CONFIG.copy()
    return {**DEFAULT_GAME_CONFIG, **{k: v for k, v in cfg.items() if k != "key"}}

@api.get("/admin/points-config")
async def get_pc(admin=Depends(require_admin)):
    return await get_points_config()

@api.put("/admin/points-config")
async def set_pc(body: dict, admin=Depends(require_admin)):
    clean = {k: int(v) for k, v in body.items() if k in DEFAULT_POINTS_CONFIG and isinstance(v, (int, float))}
    await db.config.update_one({"key": "points_config"}, {"$set": {"key": "points_config", **clean}}, upsert=True)
    return await get_points_config()

@api.get("/admin/game-config")
async def get_gc(admin=Depends(require_admin)):
    return await get_game_config()

@api.put("/admin/game-config")
async def set_gc(body: dict, admin=Depends(require_admin)):
    clean = {k: int(v) for k, v in body.items() if k in DEFAULT_GAME_CONFIG and isinstance(v, (int, float))}
    await db.config.update_one({"key": "game_config"}, {"$set": {"key": "game_config", **clean}}, upsert=True)
    return await get_game_config()

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
    log = {
        "id": str(uuid.uuid4()),
        "user_id": body.user_id,
        "team_id": body.team_id,
        "points": body.points,
        "reason": body.reason,
        "issued_by": admin["name"],
        "issued_by_id": admin["id"],
        "created_at": now_iso(),
    }
    if body.user_id:
        await db.users.update_one({"id": body.user_id}, {"$inc": {"points": body.points}})
    if body.team_id:
        await db.game_teams.update_one({"id": body.team_id}, {"$inc": {"team_points": body.points}})
    await db.points_log.insert_one(log)
    log.pop("_id", None)
    return log

@api.get("/admin/points/log")
async def points_log(admin=Depends(require_admin)):
    items = await db.points_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

# ---------- Quiz CRUD (admin) ----------
class QuizPayload(BaseModel):
    department: str
    title: Optional[str] = None
    questions: List[dict]  # [{q, options, answer}]

@api.get("/admin/quizzes")
async def admin_list_quizzes(admin=Depends(require_admin)):
    items = await db.custom_quizzes.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
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
    await db.custom_quizzes.update_one(
        {"id": qid},
        {"$set": {
            "department": body.department,
            "title": body.title or f"{body.department} Quiz",
            "questions": body.questions,
        }},
    )
    updated = await db.custom_quizzes.find_one({"id": qid}, {"_id": 0})
    return updated

@api.delete("/admin/quizzes/{qid}")
async def admin_delete_quiz(qid: str, admin=Depends(require_admin)):
    await db.custom_quizzes.delete_one({"id": qid})
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
        users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(1000)
        recipient_ids = [u["id"] for u in users]
    else:
        recipient_ids = body.target_user_ids or []
    ann = {
        "id": str(uuid.uuid4()),
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
    items = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items

@api.get("/announcements/me")
async def my_announcements(user=Depends(get_current_user)):
    items = await db.announcements.find({"recipients": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in items:
        a["unread"] = user["id"] not in (a.get("read_by") or [])
    return items

@api.post("/announcements/{aid}/read")
async def mark_read(aid: str, user=Depends(get_current_user)):
    await db.announcements.update_one({"id": aid}, {"$addToSet": {"read_by": user["id"]}})
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
        "name": body.name,
        "color": body.color or "yellow",
        "members": [],
        "team_points": 0,
        "created_at": now_iso(),
    }
    await db.game_teams.insert_one(t)
    t.pop("_id", None)
    return t

@api.get("/admin/game-teams")
async def list_teams_admin(admin=Depends(require_admin)):
    items = await db.game_teams.find({}, {"_id": 0}).sort("team_points", -1).to_list(50)
    # resolve member info
    for t in items:
        members = await db.users.find({"id": {"$in": t.get("members", [])}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1}).to_list(50)
        t["member_details"] = members
    return items

@api.get("/game-teams")
async def list_teams_public():
    items = await db.game_teams.find({}, {"_id": 0}).sort("team_points", -1).to_list(50)
    for t in items:
        members = await db.users.find({"id": {"$in": t.get("members", [])}}, {"_id": 0, "id": 1, "name": 1, "avatar": 1, "department": 1}).to_list(50)
        t["member_details"] = members
    return items

@api.patch("/admin/game-teams/{tid}")
async def update_team(tid: str, body: GameTeamReq, admin=Depends(require_admin)):
    await db.game_teams.update_one({"id": tid}, {"$set": {"name": body.name, "color": body.color}})
    t = await db.game_teams.find_one({"id": tid}, {"_id": 0})
    return t

@api.delete("/admin/game-teams/{tid}")
async def delete_team(tid: str, admin=Depends(require_admin)):
    await db.game_teams.delete_one({"id": tid})
    return {"deleted": True}

@api.put("/admin/game-teams/{tid}/members")
async def set_team_members(tid: str, body: GameTeamMembers, admin=Depends(require_admin)):
    # Remove these users from any other team first (one team per user)
    for uid in body.user_ids:
        await db.game_teams.update_many({"id": {"$ne": tid}}, {"$pull": {"members": uid}})
    await db.game_teams.update_one({"id": tid}, {"$set": {"members": body.user_ids}})
    t = await db.game_teams.find_one({"id": tid}, {"_id": 0})
    return t

@api.post("/admin/game-teams/shuffle")
async def shuffle_teams(body: ShuffleReq, admin=Depends(require_admin)):
    n = max(2, min(8, body.num_teams or 4))
    users = await db.users.find({}, {"_id": 0, "id": 1}).to_list(1000)
    random.shuffle(users)
    # delete existing auto-shuffled teams to avoid pile-up
    await db.game_teams.delete_many({"auto_shuffled": True})
    teams = []
    for i in range(n):
        color = GAME_TEAM_COLORS[i % len(GAME_TEAM_COLORS)]
        t = {
            "id": str(uuid.uuid4()),
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
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("name", 1).to_list(500)
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
    items = await db.songs.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)
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
        pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Bad token")
    song = await db.songs.find_one({"id": song_id, "is_deleted": False}, {"_id": 0})
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
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(404, "Not found")
    if song["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(403, "Not yours")
    await db.songs.update_one({"id": song_id}, {"$set": {"is_deleted": True}})
    return {"deleted": True}

@api.post("/music/like/{song_id}")
async def toggle_like(song_id: str, user=Depends(get_current_user)):
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
    items = await db.songs.find({"id": {"$in": ids}, "is_deleted": False}, {"_id": 0}).to_list(500)
    for s in items:
        s["liked"] = True
    return items

@api.post("/music/history/{song_id}")
async def log_play(song_id: str, user=Depends(get_current_user)):
    await db.play_history.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"], "song_id": song_id, "at": now_iso()})
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
    songs = await db.songs.find({"id": {"$in": unique_ids}, "is_deleted": False}, {"_id": 0}).to_list(50)
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
        {"$match": {"at": {"$gte": since}}},
        {"$group": {"_id": "$song_id", "plays": {"$sum": 1}}},
        {"$sort": {"plays": -1}},
        {"$limit": max(1, min(limit, 50))},
    ]
    agg = await db.play_history.aggregate(pipeline).to_list(50)
    ids = [a["_id"] for a in agg]
    if not ids:
        return []
    songs = await db.songs.find({"id": {"$in": ids}, "is_deleted": False}, {"_id": 0}).to_list(50)
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

def _pl_access_filter(user_id: str):
    return {"$or": [
        {"owner_id": user_id},
        {"visibility": "public"},
        {"visibility": "shared", "shared_with": user_id},
    ]}

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
        "owner_id": user["id"],
        "owner_name": user["name"],
        "name": (body.name or "New Playlist").strip()[:80],
        "description": (body.description or "").strip()[:280],
        "visibility": vis,
        "shared_with": list(dict.fromkeys(body.shared_with or [])),
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
    items = await db.playlists.find(_pl_access_filter(user["id"]), {"_id": 0}).sort("updated_at", -1).to_list(200)
    for p in items:
        p["track_count"] = len(p.get("track_ids") or [])
        p["can_edit"] = _pl_can_edit(p, user)
    return items

async def _hydrate_playlist(pl, user):
    ids = pl.get("track_ids") or []
    if not ids:
        pl["tracks"] = []
        return pl
    songs = await db.songs.find({"id": {"$in": ids}, "is_deleted": False}, {"_id": 0}).to_list(500)
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
    pl = await db.playlists.find_one({"id": pid}, {"_id": 0})
    if not pl: raise HTTPException(404, "Not found")
    if not _pl_can_view(pl, user): raise HTTPException(403, "No access")
    pl["can_edit"] = _pl_can_edit(pl, user)
    return await _hydrate_playlist(pl, user)

@api.patch("/playlists/{pid}")
async def update_playlist(pid: str, body: PlaylistUpdate, user=Depends(get_current_user)):
    pl = await db.playlists.find_one({"id": pid}, {"_id": 0})
    if not pl: raise HTTPException(404, "Not found")
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    upd = {}
    if body.name is not None: upd["name"] = body.name.strip()[:80]; upd["cover_color"] = _color_for(body.name)
    if body.description is not None: upd["description"] = body.description.strip()[:280]
    if body.visibility is not None and body.visibility in ("private","shared","public"): upd["visibility"] = body.visibility
    if body.shared_with is not None: upd["shared_with"] = list(dict.fromkeys(body.shared_with))
    upd["updated_at"] = now_iso()
    await db.playlists.update_one({"id": pid}, {"$set": upd})
    pl.update(upd)
    return pl

@api.delete("/playlists/{pid}")
async def delete_playlist(pid: str, user=Depends(get_current_user)):
    pl = await db.playlists.find_one({"id": pid})
    if not pl: raise HTTPException(404, "Not found")
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    await db.playlists.delete_one({"id": pid})
    return {"deleted": True}

@api.post("/playlists/{pid}/tracks")
async def add_track_to_playlist(pid: str, body: PlaylistTrackAdd, user=Depends(get_current_user)):
    pl = await db.playlists.find_one({"id": pid}, {"_id": 0})
    if not pl: raise HTTPException(404, "Not found")
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    song = await db.songs.find_one({"id": body.track_id, "is_deleted": False}, {"_id": 0})
    if not song: raise HTTPException(404, "Track not found")
    ids = pl.get("track_ids") or []
    if body.track_id in ids:
        return {"ok": True, "already": True}
    ids.append(body.track_id)
    await db.playlists.update_one({"id": pid}, {"$set": {"track_ids": ids, "updated_at": now_iso()}})
    return {"ok": True}

@api.delete("/playlists/{pid}/tracks/{track_id}")
async def remove_track_from_playlist(pid: str, track_id: str, user=Depends(get_current_user)):
    pl = await db.playlists.find_one({"id": pid}, {"_id": 0})
    if not pl: raise HTTPException(404, "Not found")
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    ids = [t for t in (pl.get("track_ids") or []) if t != track_id]
    await db.playlists.update_one({"id": pid}, {"$set": {"track_ids": ids, "updated_at": now_iso()}})
    return {"ok": True}

@api.put("/playlists/{pid}/reorder")
async def reorder_playlist(pid: str, body: PlaylistReorder, user=Depends(get_current_user)):
    pl = await db.playlists.find_one({"id": pid}, {"_id": 0})
    if not pl: raise HTTPException(404, "Not found")
    if not _pl_can_edit(pl, user): raise HTTPException(403, "Not yours")
    existing = set(pl.get("track_ids") or [])
    new_ids = [t for t in body.track_ids if t in existing]
    # Append any missing (to avoid loss)
    for t in (pl.get("track_ids") or []):
        if t not in new_ids: new_ids.append(t)
    await db.playlists.update_one({"id": pid}, {"$set": {"track_ids": new_ids, "updated_at": now_iso()}})
    return {"ok": True, "track_ids": new_ids}

@api.get("/")
async def root():
    return {"message": "Brutal Wellness API", "status": "alive"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    # Migrate: ensure all users have role & dnd fields
    try:
        await db.users.update_many({"role": {"$exists": False}}, {"$set": {"role": "employee", "dnd": False}})
        # Ensure demo users (including admin) exist — idempotent
        count = await db.users.count_documents({})
        await seed_data()
        if count == 0:
            logger.info("Auto-seeded demo data from empty DB")
        else:
            logger.info("Ensured demo users present")
        # Seed sample events (birthdays/anniversaries) for demo users
        if await db.events.count_documents({}) == 0:
            today = datetime.now(timezone.utc).date()
            users = await db.users.find({"email": {"$regex": "@demo.com$"}}, {"_id": 0, "id": 1}).to_list(20)
            for i, u in enumerate(users):
                ev_type = "birthday" if i % 2 == 0 else "anniversary"
                d = today + timedelta(days=i % 7)
                await db.events.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": ev_type,
                    "user_id": u["id"],
                    "date": d.isoformat(),
                    "note": "",
                    "created_at": now_iso(),
                })
            logger.info("Seeded sample birthday/anniversary events")
    except Exception as e:
        logger.exception(f"Startup migration failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
