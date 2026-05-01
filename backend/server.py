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

    # streak: if last_activity was yesterday-ish, increment
    streak = user.get("streak", 0)
    last = user.get("last_activity")
    if last:
        try:
            last_dt = datetime.fromisoformat(last)
            delta = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if delta < 3600 * 30 and delta > 60:  # < 30h and > 1min
                streak = max(streak, 1)
            if delta > 3600 * 36:
                streak = 1
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
    # Only seed if no users except maybe existing
    count = await db.users.count_documents({})
    if count >= 5:
        return {"seeded": False, "reason": "already seeded"}

    demo_users = [
        {"name": "Alex Chaos", "email": "alex@demo.com", "password": "demo1234", "department": "Engineering", "points": 1250, "color": "FFE600"},
        {"name": "Jamie Vibe", "email": "jamie@demo.com", "password": "demo1234", "department": "Design", "points": 980, "color": "00E5FF"},
        {"name": "Sam Hustle", "email": "sam@demo.com", "password": "demo1234", "department": "Marketing", "points": 1420, "color": "FF4D6D"},
        {"name": "Riley Zen", "email": "riley@demo.com", "password": "demo1234", "department": "HR", "points": 750, "color": "00C853"},
        {"name": "Casey Boss", "email": "casey@demo.com", "password": "demo1234", "department": "Product", "points": 1680, "color": "FFE600"},
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
            "created_at": now_iso(),
            "last_activity": now_iso(),
        })

    # Seed posts
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
    # auto-seed if empty
    try:
        count = await db.users.count_documents({})
        if count == 0:
            await seed_data()
            logger.info("Auto-seeded demo data")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
