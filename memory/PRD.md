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

## Test iterations
- iteration_1: backend 96%, frontend 85% (Chunk 1, fixed streak bug)
- iteration_2: backend 100%, frontend 100% (Chunk 2)
- iteration_3: backend 96%, frontend 100% (Chunk 3, fixed seed role-update bug)
- iteration_4: backend 100%, frontend 100% (Chunk 4 polish)

## Tech Notes
- Backend pytest: /app/backend/tests/backend_test.py + test_chunk2.py
- Frontend uses REACT_APP_BACKEND_URL; backend on /api prefix
- EMERGENT_LLM_KEY in /app/backend/.env for Claude AI insights
- All user/post documents exclude _id via projection {"_id": 0}
- Streak logic: calendar-day comparison with 36h gap reset
