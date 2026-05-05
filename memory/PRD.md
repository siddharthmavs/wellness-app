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
- JWT auth (register, login, me) with bcrypt
- Wellness Notification full-screen popup with YES/IGNORE
- Quick action wellness logs (water/eye_care/stand/breathing) with point rewards
- Eye Care 20-20-20 timer
- Daily Challenges
- Leaderboard (daily/weekly/monthly/all)
- Mood tracker with emoji + history
- Fun Wall posts with base64 image upload, like, comment
- AI mood insight via Claude
- Profile with badges grid + activity feed
- Auto-seeded demo data

### Chunk 2 (Engagement + Recognition)
- Roles (employee/team_lead/admin) + admin guard
- Admin Dashboard: Users mgmt, Challenges CRUD, Reminders config, Analytics (DAU/WAU/MAU + recharts), Feedback inbox
- Shoutout Wall: peer recognition with category, @mentions multi-select, weekly digest of top 3, emoji reactions
- Help Board: 5 categories (Housing/Travel/Buy-Sell/Recommendations/General) with image, like, comment
- Team Leaderboard with podium 🥇🥈🥉 for top 3
- Weekly Wellness Insights card on dashboard (week-over-week % change)
- DND toggle on profile
- Fun Wall emoji reactions (😂❤️👏🔥)
- Categorized Feedback (with anonymous toggle)
- Conditional Admin nav link

## 📋 Backlog (from PRD, P0/P1 priorities)

### P0 (next chunk candidates)
- Music Player widget (Focus/Relax/Energy playlists, persistent bottom)
- Polls & Voting
- Birthday/Anniversary celebration auto-banner
- Did You Know? daily tech fact card
- Word of the Day card

### P1
- Buddy System (new joiner pairing)
- Employee Spotlight (weekly auto-rotation)
- Learning Bites (60-sec micro-lessons)
- Mini Games (Bubble Pop, Zen Doodle, Word Scramble, Memory Match)
- Weekly Department Quizzes
- Dark mode toggle
- Productivity rating in mood tracker
- Notification snooze (5 min follow-up)
- Anonymous mode for leaderboard

### P2
- Desk Plant Challenge
- Surprise Reward issuance
- Fact archive page
- Word bookmarks
- Buddy 30-day check-in tracker
- Productivity heatmap for admin
- Skeleton loaders / illustrated empty states
- Mobile bottom-nav optimization

## Test Status
- iteration_1: backend 96%, frontend 85% (Chunk 1)
- iteration_2: backend 100%, frontend 100% (Chunk 2)

## Tech Notes
- Backend pytest: /app/backend/tests/backend_test.py + test_chunk2.py
- Frontend uses REACT_APP_BACKEND_URL; backend on /api prefix
- EMERGENT_LLM_KEY in /app/backend/.env for Claude AI insights
- All user/post documents exclude _id via projection {"_id": 0}
- Streak logic: calendar-day comparison with 36h gap reset
