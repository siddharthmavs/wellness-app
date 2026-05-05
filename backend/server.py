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
    pts = body.points or POINTS_MAP.get(body.type, 5)
    activity = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": body.type,
        "points": pts,
        "created_at": now_iso(),
    }
    await db.activities.insert_one(activity)
    activity.pop("_id", None)

    # Update user points / streak / level / wellness_score
    new_points = user.get("points", 0) + pts
    new_level = 1 + new_points // 200
    new_score = min(100, user.get("wellness_score", 50) + 2)

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

# ---------- Notifications (wellness reminders) ----------
WELLNESS_NOTIFS = [
    {"type": "water", "title": "🚰 Hey legend, drink water", "message": "It's been a while. Hydrate or deteriorate.", "color": "#00E5FF"},
    {"type": "eye_care", "title": "👀 Your eyes are tired bro", "message": "20-20-20. Look away for 20 seconds at something 20ft away.", "color": "#FFE600"},
    {"type": "stand", "title": "🧍 You are becoming a chair", "message": "Stand up. Stretch. Be a human.", "color": "#FF4D6D"},
    {"type": "breathing", "title": "🌬️ Breathe, champion", "message": "Quick 4-7-8 breathing. Reset your brain.", "color": "#00C853"},
]

@api.get("/notifications/random")
async def random_notif(user=Depends(get_current_user)):
    n = random.choice(WELLNESS_NOTIFS)
    return {"id": str(uuid.uuid4()), **n}

# ---------- Badges ----------
BADGES = [
    {"id": "first_drop", "name": "First Drop", "emoji": "💧", "desc": "Logged first water break", "color": "#00E5FF"},
    {"id": "eye_master", "name": "Eye Master", "emoji": "👁️", "desc": "10 eye breaks", "color": "#FFE600"},
    {"id": "streak_5", "name": "Fire Starter", "emoji": "🔥", "desc": "5 day streak", "color": "#FF4D6D"},
    {"id": "mood_mood", "name": "Feels Expert", "emoji": "🎭", "desc": "Logged 7 moods", "color": "#00C853"},
    {"id": "social", "name": "Meme Lord", "emoji": "😎", "desc": "Posted on Fun Wall", "color": "#FFE600"},
]

@api.get("/badges")
async def all_badges():
    return BADGES

# ---------- Challenges ----------
CHALLENGES = [
    {"id": "water_5", "title": "💦 Drink water 5 times", "reward": 50, "target": 5, "type": "water"},
    {"id": "eye_3", "title": "👀 3 eye breaks today", "reward": 30, "target": 3, "type": "eye_care"},
    {"id": "stand_3", "title": "🧍 Stand 3 times", "reward": 30, "target": 3, "type": "stand"},
    {"id": "mood_1", "title": "🎭 Log your mood", "reward": 20, "target": 1, "type": "mood"},
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
        return {"insight": "No mood data yet. Log your vibes and I'll cook up some wisdom. 🎭"}

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
        return {"insight": f"Your vibe has been a mix of {', '.join(moods[:3])}. Keep logging — self-awareness is the cheat code. 💪"}

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
        if await db.users.find_one({"email": du["email"]}):
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
        {"user_name": "Alex Chaos", "content": "When Monday hits and the coffee hasn't ☕", "image": ""},
        {"user_name": "Jamie Vibe", "content": "Legit feel like I merged with my chair 🧍‍♂️ stand up y'all", "image": ""},
        {"user_name": "Sam Hustle", "content": "Day 7 streak of NOT looking at screen during lunch 🏆", "image": ""},
        {"user_name": "Casey Boss", "content": "Just learned the 20-20-20 rule. My eyes: 😌", "image": ""},
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
    emoji: str  # one of 😂 ❤️ 👏 🔥

ALLOWED_REACTIONS = ["😂", "❤️", "👏", "🔥"]

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
    # points
    await db.users.update_one({"id": user["id"]}, {"$inc": {"points": 5}})
    for rid in body.recipient_ids:
        await db.users.update_one({"id": rid}, {"$inc": {"points": 10}})
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
        "Fantastic week! Keep it going, champ. 🔥",
        "Solid grind this week. Brain thanks you. 🧠",
        "Vibes were immaculate. Don't stop now. 💪",
        "Okay-ish week. Let's crush it next one. 🚀",
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

# ---------- Users lookup (for shoutout picker etc) ----------
@api.get("/users")
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("name", 1).to_list(500)
    return users

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
    except Exception as e:
        logger.exception(f"Startup migration failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
