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

### Chunk 8 (Complete Emoji Purge)
- Python cleanup script stripped every emoji character (U+1F300-1FAFF, U+2600-27BF, U+1F900-1F9FF, ZWJ, variation selectors) from all 81 frontend files + backend server.py
- Only trivial whitespace normalization applied (double space → single) — newlines preserved
- Login/Signup floating decorations: swapped from emoji chars to hand-drawn SVG (`IconCloud`, `IconLeaf`, `IconSparkle`) illustrations
- CSS `leaf-bg` pseudo-elements: swapped emoji `content:"..."` to SVG data-URI backgrounds
- Backend WELLNESS_NOTIFS + fact bank + badge emoji fields cleaned
- All page titles/toasts/labels now emoji-free; interactive elements (mood buttons, fact reactions, Fun Wall reactions, navbar streak/points) use hand-drawn SVG from `HandDrawn.jsx`

## Test iterations
- iteration_1-7: all passed
- iteration_8: full emoji purge — app now uses zero emoji characters anywhere; all illustrations are hand-drawn SVG
- iteration_9: Music Zone v2 — 26/26 backend tests pass, full frontend E2E pass (external links, playlists, trending). Two low-priority polish items applied.

### Chunk 10 (Music Zone v2 — External links, Playlists, Trending — Feb 2026)
- Backend
  - `POST /api/music/link` — accepts YouTube / Spotify URLs, parses `external_id` via regex, calls oEmbed (`youtube.com/oembed`, `open.spotify.com/oembed`) to enrich title/thumbnail. Rejects unsupported URLs (400)
  - `GET /api/music/stream/{id}` now rejects external tracks (400) — only uploaded storage-backed tracks streamed
  - `GET /api/music/trending?days=7&limit=8` — Mongo aggregation on `play_history` grouped by song_id, joins song + liked flags per current user
  - Playlists CRUD: `playlists` collection with owner_id, visibility ∈ {private, shared, public}, shared_with[], track_ids[], cover_color (deterministic palette hash)
  - Endpoints: `POST /api/playlists`, `GET /api/playlists` (filtered by ACL), `GET /api/playlists/{id}` (hydrates ordered track objects + `can_edit`), `PATCH /api/playlists/{id}`, `DELETE /api/playlists/{id}`, `POST /api/playlists/{id}/tracks`, `DELETE /api/playlists/{id}/tracks/{track_id}`, `PUT /api/playlists/{id}/reorder`
  - Access helpers `_pl_can_view` / `_pl_can_edit`; admin override supported
- Frontend
  - `MusicPlayer.jsx` — source-aware: `upload` (HTML5 audio), `youtube` (dynamic YouTube IFrame API in hidden iframe, full seek/volume/next-on-end control), `spotify` (Spotify Iframe API embed strip). Thumbnail + Youtube/Spotify badge shown per track. Global `unhandledrejection`/`error` handler filters Spotify SDK noise
  - `Music.jsx` complete rebuild
    - Sidebar: main nav + Playlists section with create (+) button
    - Home shows Trending row (per-item play-count badge + real oEmbed cover) + Featured row + All-Tracks table
    - Add-track modal — two tabs (File / Link)
    - Add-to-playlist modal reachable from every track row (+ icon)
    - PlaylistDetail — cover, name, visibility icon, play-all, settings & delete; TrackTable supports draggable rows with reorder persisted via PUT /reorder
    - PlaylistSettingsModal — edit name/description/visibility; shared visibility surfaces a user checklist; ESC to dismiss
    - CreatePlaylistModal — visibility toggle grid (Only me / Shared / Whole team)
- Testing
  - `/app/test_reports/iteration_9.json` — 26/26 backend tests + full frontend E2E flow verified across two user roles + admin

- iteration_8: Music Zone v1 — 11/11 backend tests pass, full frontend E2E pass (upload, play, persist across routes, like, delete, search)

### Chunk 9 (Spotify-inspired Music Zone v1 — Feb 2026)
- Backend: object-storage-backed audio uploads via Emergent Integrations proxy
  - Endpoints: POST /api/music/upload (multipart, ≤50MB, audio/* only), GET /api/music/tracks, GET /api/music/stream/{id} (Bearer or ?auth= query for <audio> tag), POST/DELETE like, GET liked, POST/GET history, DELETE tracks (owner or admin)
  - Storage helpers: _init_storage / _put_object / _get_object with force-refresh on 404, path prefix `wellness-garden/music/{user_id}/{uuid}.{ext}`
  - Mongo collections: songs, song_likes, play_history — all soft-deleted via is_deleted
- Frontend: Spotify-authentic dark island rendered at /music (user explicitly chose over cozy theme)
  - Left sidebar (Home / Liked / Recently Played / Your Uploads), green upload CTA
  - Green hero "All Team Tracks" + Play-all
  - Featured grid (procedurally-tinted covers from title chars) + full track table with hover-play, animated equalizer on current row, per-row like + delete-when-owner
  - Drag & drop upload modal with progress, metadata (title/artist), 50MB guard
  - Search across title/artist/uploader
  - Instant Cozy input-style overrides scoped to the dark island so it stays authentic Spotify
- Global sticky bottom `MusicPlayer` (Zustand-persisted queue) — survives route changes across the entire app; controls: play/pause/prev/next/mute/volume/seek/close; logs /music/history on track change
- No emojis introduced — all icons via lucide-react


### Chunk 11 (Wellness Garden Backend Integration Requirements — Sep 2026)
Implements the "Wellness Garden Backend Integration Requirements" doc: multi-org
support, invite-only signup, richer profiles, org-scoped Journey/Events, a
dedicated Me page, Settings pages wired to the backend, and real Web Push.
- **Organizations & invitations** — new `organizations`/`invitations`
  collections; `POST /auth/register` now creates an org + its first Admin
  instead of open self-signup; employees join via `POST /auth/accept-invite`
  (token + password). Admin "People & Access" tab in `AdminDashboard.jsx`
  (Organization settings, Invite Employees, Recent Invitations) rewired from
  localStorage mocks to the real endpoints, with copyable accept links and
  pending/accepted/expired/cancelled status. `Signup.jsx` → org creation form;
  new `AcceptInvite.jsx` at `/accept-invite/:token`. All pre-existing/demo
  users live in an idempotently-seeded "Demo Organization".
- **Org scoping** — `/admin/users`, `/admin/points-config`, `/leaderboard`,
  `/leaderboard/teams` (now auth-required) and `/events[/today]` are scoped to
  the caller's `org_id`. Admin can deactivate/reactivate a member (`status`
  field) in addition to hard delete.
- **Profile** — `first_name`, `last_name`, `job_title`, `birthday`,
  `work_anniversary`, avatar upload (`POST /users/me/avatar`, reuses the
  music-upload object-storage helpers). `Profile.jsx` gained an edit form +
  avatar picker; `resolveAvatar()` in `lib/api.js` resolves the uploaded
  backend-relative avatar path everywhere an avatar renders.
- **Events** — profile-driven: birthdays/work-anniversaries synthesize live
  from org members' profile fields (merged with any manual admin-created
  rows), including `years_completed` for anniversaries.
- **Journey & Me** — `/leaderboard` route renamed to `/journey` (old path
  redirects); new dedicated `/me` page (today's progress, XP/level, personal
  reward history via `GET /dashboard` + `/rewards` + `/rewards/history`,
  previously unused by the frontend); `/profile` is now the profile-edit page,
  linked from Me.
- **Settings backend wiring** — Water/EyeCare/MoveReset/Breathing,
  Notifications and Appearance settings pages previously persisted to
  localStorage only despite matching backend endpoints existing; all six now
  load from and save to `GET/PUT /settings` (or `/notifications/settings`),
  keeping localStorage only as an offline fallback. Backend gained an
  `appearance` settings section (background/accent/layout/font) that didn't
  exist before (only a bare `theme` string did).
- **Web Push** — VAPID keypair + `pywebpush`; `GET /notifications/vapid-public-key`,
  `register-device` accepts a raw `PushSubscriptionJSON`, `deliver_push()`
  sends real pushes (auto-deactivates dead subscriptions on 404/410). New
  `public/service-worker.js` + `notifications/pushService.js` +  a "Browser
  Push" toggle in Notification Settings, independent of the existing in-tab
  desktop `Notification` popups.

### Chunk 12 (Bug Fix Requirements, QA Bug Report, Move & Reset Enhancement — Sep 2026)
- **Tenant isolation (BUG-03)** — every tenant-owned collection carries `org_id`;
  all reads/writes are pinned to the caller's org (`org_q`), foreign ids answer
  404; legacy rows were backfilled into the Demo Organization. `/seed` is admin-only.
  Per-user browser state (ritual cards, timer, music) is namespaced by user id
  (`lib/userStorage.js`), so rituals no longer carry over between accounts (QA #9).
- **Duplicate orgs (BUG-02)** — normalized-name unique index, 409 with
  "An organization with this name already exists."
- **Daily points (BUG-01, QA #6)** — `daily_points` ledger per org business day
  (per-org timezone, default Asia/Kolkata); navbar/dashboard show points today;
  new accounts start at 0; client-sent dates/points ignored.
- **Profile Settings (BUG-04, QA #2–4)** — `/settings/profile`, password
  change/forgot/reset (SMTP or logged link + admin reset link), navbar account chip.
- **Engagement fixes** — quiz graded server-side (QA #13), reflections validated
  (QA #14), one reaction per click (QA #10), double-submit guards (QA #11),
  labeled Kudos counters (QA #12), Stay-on-track prompt fixed + close button
  (QA #1, #7), 20-20-20 chime with mute (QA #5), saved facts/tips on Me (QA #8).
- **Guided Move Break** — server-owned sessions (start/pause/resume/advance/
  checkpoint/end/complete), SVG/CSS looping demonstrations, pause on hidden tab
  with explicit Resume, reduced-motion fallback, keyboard accessible, single
  idempotent award.

## Tech Notes
- Backend pytest: /app/backend/tests/backend_test.py + test_chunk2.py
- Frontend uses REACT_APP_BACKEND_URL; backend on /api prefix
- EMERGENT_LLM_KEY in /app/backend/.env for Claude AI insights
- All user/post documents exclude _id via projection {"_id": 0}
- Streak logic: calendar-day comparison with 36h gap reset
