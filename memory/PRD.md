# Brutal Wellness Platform — PRD & Progress Tracker

## Original Problem Statement
Build a full-stack Employee Wellness & Engagement Web Platform in Neo-Brutalist style (thick black borders, hard shadows, bold flat colors: #FFE600 yellow, #00E5FF cyan, #FF4D6D pink, #00C853 green, NO gradients, boxy UI, pressable buttons, sticker cards, Space Grotesk + Inter fonts, Framer Motion snappy animations, controlled chaos asymmetric layouts, fun playful microcopy). PRD provided by user covered 30+ features across 5 phases.

## Architecture
- Backend: FastAPI + Motor (async Mongo) + JWT auth (bcrypt) + Emergent LLM (Claude Sonnet 4.5) for AI mood insights
- Frontend: React + Tailwind + Framer Motion + Zustand (persist) + Sonner (toasts) + Recharts
- DB: MongoDB collections — users, activities, moods, posts, shoutouts, help_posts, feedback, challenges_custom, config

## User Personas
- Employee — uses wellness reminders, mood, fun wall, leaderboard, shoutouts, help board, feedback
- Team Lead — same as employee + future team-only analytics
- Admin — full control over users, challenges, reminders, analytics, feedback inbox

## Demo Accounts (seeded on startup, idempotent)
| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | demo1234 | admin |
| alex@demo.com | demo1234 | employee |
| jamie@demo.com | demo1234 | employee |
| sam@demo.com | demo1234 | team_lead |
| riley@demo.com | demo1234 | employee |
| casey@demo.com | demo1234 | team_lead |

## ✅ Implemented (as of Feb 2026)

### Chunk 1 (v1)
- JWT auth, Wellness popup, Eye Care 20-20-20, Quick actions, Mood, Fun Wall, AI insight, Profile, Badges, Challenges, Auto-seed

### Chunk 2 (Engagement + Recognition)
- Roles + admin guard, Admin Dashboard (Users, Challenges, Reminders, Analytics, Feedback), Shoutout Wall, Help Board, Team Leaderboard with podium, Weekly Insights, DND, Fun Wall emoji reactions, Categorized Feedback

### Chunk 3 (PRD complete — "add all")
- Music Player (3 playlists, persistent bottom widget)
- Polls & Voting (admin/team_lead create, employees vote +2 pts)
- Mini Games hub: Bubble Pop, Memory Match, Word Scramble, Zen Doodle (with score leaderboard, capped points)
- Department Quizzes (7 departments, 5 Qs each, +3/correct +15 bonus for 100%)
- Learning Bites (60-sec micro-lessons w/ "Tried it" +5)
- Birthdays/Anniversaries (Today + Upcoming pages, auto-seeded for demo users)
- Daily Tech Fact (Did You Know?) + Word of the Day cards on dashboard
- Employee Spotlight (weekly auto-rotation)
- Buddy System (auto-pair + weekly check-in +10) on profile
- Desk Plant Challenge (opt-in + daily check-in +3 + plant leaderboard) on profile
- Wellness Recap autopost (admin endpoint posts top streakers + team-of-week to Fun Wall)
- Navbar with primary links + MORE dropdown for full feature access

### Chunk 4 (Polish)
- 🌙 Dark mode toggle (Zustand persist, full Neo-Brutal dark inversion: dark zinc surfaces, white borders/shadows, accent cards keep their pop)
- 📱 Mobile bottom-nav (5 primary routes, visible <md breakpoint)
- 💀 Skeleton loaders + 🌫️ illustrated empty states (deployed across Fun Wall, Mood, Leaderboard, Shoutouts, Help Board)
- @ mention autocomplete on Fun Wall posts + comments (with arrow/enter keyboard nav, styled mention-pill rendering)
- 🚀 Productivity rating in Mood tracker (High/Med/Low, persisted + shown on history)
- 🎁 Surprise Reward issuance from admin (coupon w/ code, bonus points, shoutout) + claim flow on profile

### Chunk 5 (Admin Platform Control)
- 📚 Quiz CRUD — admin creates custom quizzes per department; live quiz reads custom-first with fallback to hardcoded
- ⚡ Configurable Points Allocation — full points map editable from admin (water/eye/stand/quiz/etc.); activities + quizzes read from live config
- 🎮 Gamification Settings — level threshold, streak gap hours, wellness score increment all admin-tunable
- 📣 Push Notifications / Announcements — admin sends to ALL or specific users, kind (info/alert/party); navbar bell with unread badge, 30s polling, click-to-read
- ⚔️ Game Teams — manual create (name + color) OR auto-shuffle (round-robin into N teams, fair distribution), one-team-per-user invariant, member CRUD via modal, team-level points + quick +50/-10 buttons
- 🏆 Manual Point Adjustment — admin can award/dock points for users OR teams with reason; full audit log endpoint
- 🔔 Notification Bell in navbar (badge + dropdown)
- ⚔️ /teams page for users to see their game team + global standings

### Chunk 6 (Cozy Wellness Redesign)
- Full visual pivot from Neo-Brutalism → Cozy Wellness per PRD spec v2
- New palette (light + dark): sage/cream/peach/coral warm tones; deep olive text
- New fonts: Fredoka (display), Nunito (body), Kalam (accent handwritten)
- Rounded 20-24px cards, soft box-shadows (no hard brutal), pill buttons/badges/nav
- Hand-drawn SVG cat mascot (CompanionMascot) with 3 states (idle/happy/sad) tied to wellness_score
- Paper grain SVG noise overlay, floating decorative emojis (🌿☁️🍃🌱🌸)
- Section renames per spec §12: Wellness Score→Wellness Garden, Did You Know→Daily Wellness Fact, Word of Day→Wellness Tip, Employee Spotlight→Community Highlight, Feeling Brutal→time-of-day greeting
- Approach: global CSS overrides in index.css remap every legacy `bg-brutal-*`, `border-black`, `shadow-brutal*`, `border-[3-6px]`, `rounded-[2-4px]` utility to cozy tokens — so every existing page inherits new look automatically without per-file edits
- Dark mode: separate cozy dark palette (#1E241B bg, #262E22 surface, #8FBF72 primary) preserving warm character
- Cozy floating mobile bottom-nav (rounded pill, not edge-to-edge)

### Chunk 7 (Hand-drawn Illustration Pass)
- New `HandDrawn.jsx` library — 27+ SVG icons in unified 2-3px organic wobbly ink line style with paper-grain filter and personality (asymmetric, wobbly, muted flat fills from cozy palette)
- Mood picker: 8 hand-drawn mood characters (Lit flame w/face, Zen sitting cat + steam curl, Meh tilted eyes, Stressed tangled scribble cloud, Tired droopy eyes + Zzz, Hyped star burst, Overload spiral eyes, Cold snowflakes)
- Fact card reactions: Mind Blown / Knew It / Hmm hand-drawn faces (no emoji)
- Fun Wall reactions: hand-drawn laugh / heart / clap / fire illustrations (no emoji)
- Navbar streak/points pill: IconSeedling + IconBolt SVG (no 🌱 ⚡ emoji)
- Dashboard cards: corner doodles (Lightbulb / Book / Sparkle) bleed slightly outside container
- Kalam handwritten font for quotes, notes, marginal captions
- New CSS utilities: `.washi-tag` (torn tape sticker w/ striped edges), `.hand-frame` (SVG wobble border), `.doodle-corner` (flourish), `.ink-underline` (wobbly hand-drawn underline), `.journal-page` (torn-paper card feel)
- Removed duplicate emoji from Dashboard ritual card labels and Admin Zone header

## Test iterations
- iteration_1: backend 96%, frontend 85%
- iteration_2: 100%/100%
- iteration_3: 96%/100%
- iteration_4: 100%/100%
- iteration_5: 100%/100%
- iteration_6: frontend 100% (Cozy redesign)
- iteration_7: frontend 100% on user-flagged illustration requirements

## Tech Notes
- Backend pytest: /app/backend/tests/backend_test.py + test_chunk2.py
- Frontend uses REACT_APP_BACKEND_URL; backend on /api prefix
- EMERGENT_LLM_KEY in /app/backend/.env for Claude AI insights
- All user/post documents exclude _id via projection {"_id": 0}
- Streak logic: calendar-day comparison with 36h gap reset
