# Brutal Wellness — Copilot Instructions

## Project Overview

Full-stack **Employee Wellness & Engagement Platform** with a Neo-Brutalist design aesthetic.
Audience: corporate employees, team leads, and admins.

- **Frontend**: React 19 + Tailwind CSS + Zustand + Framer Motion — in `frontend/`
- **Backend**: FastAPI (single-file monolith) + Motor (async MongoDB) — in `backend/`
- **AI**: Claude Sonnet via `emergentintegrations` (mood insights, graceful fallback)
- **Auth**: JWT (HS256, 7-day) + bcrypt

## Architecture

### Backend (`backend/server.py`)
- **Single-file monolith** — all Pydantic models, route handlers, JWT helpers, seed logic in one file.
- All routes live under `APIRouter(prefix="/api")` → mounted at root with `app.include_router(api)`.
- Role guards: `get_current_user` (JWT decode) and `require_admin` composable as FastAPI dependencies.
- MongoDB via **Motor** (async). IDs are `uuid.uuid4()` strings — never MongoDB ObjectIds.
- **Always use `{"_id": 0}` projection** on every MongoDB query to avoid ObjectId serialization errors.
- Points logic centralised in `POINTS_MAP` dict; streak resets after a 36-hour gap.
- `/api/seed` is idempotent — safe to call on startup.

### Frontend (`frontend/src/`)
- **`lib/api.js`** — Axios instance, `baseURL = ${REACT_APP_BACKEND_URL}/api`. Request interceptor injects `Authorization: Bearer <token>`. Response interceptor auto-calls `logout()` on 401.
- **`store.js`** — Two Zustand stores (`persist` to localStorage):
  - `useAuthStore` (`brutal-auth`): `token`, `user`, `setAuth()`, `setUser()`, `logout()`
  - `useThemeStore` (`brutal-theme`): `theme` (`"light"`/`"dark"`), `toggle()`, `apply()`
- **`App.js`** — React Router v7 setup, `PrivateLayout` guard, theme apply on mount, `/auth/me` refresh on load.
- Page-level state: plain `useState` — no Redux, no React Context.

## Design System (Neo-Brutalist)

> The design system is the single most important convention in this codebase. Always follow it.

### Core Rules
- **Borders**: `border-[3px] border-black` or `border-[4px] border-black` — always hard, always black.
- **Shadows**: Hard offset box-shadows only — `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`. No soft/blur shadows.
- **Border radius**: `rounded-none` or at most `rounded-sm`. Never `rounded-lg` or higher.
- **Colors**: Flat bold palette — `brutal-yellow`, `brutal-cyan`, `brutal-pink`, `brutal-green` (defined in `tailwind.config.js`). No gradients.
- **Typography**: Heavy weights (`font-black`, `font-extrabold`). All-caps headers common.
- **Slight tilts**: Cards often use `rotate: ±1°` for a sticker aesthetic — apply via `className="rotate-[-1deg]"` or Framer Motion `rotate`.

### Bespoke Components (`frontend/src/components/brutal.jsx`)
Always use these instead of raw HTML for interactive elements:
- `BrutalButton` — `motion.button` with `whileHover`/`whileTap`, hard shadow, border.
- `BrutalCard` — `motion.div` wrapping card content.
- `BrutalInput` — `motion.input` with brutalist styling.
- `BrutalBadge` / `BrutalTag` — inline label components.

### Animation
- Use **Framer Motion** (`motion.*`) for all interactive components.
- Spring physics: `stiffness: 400, damping: 17`.
- Standard pattern: `initial={{ opacity: 0, y: 20 }}` → `animate={{ opacity: 1, y: 0 }}`.

### Dark Mode
- Full Neo-Brutal dark inversion — controlled by `useThemeStore`.
- Dark classes go on the same element as their light counterparts: `bg-white dark:bg-black`.

## Voice & Copy
- Casual, slightly sarcastic micro-copy: *"You are becoming a chair"*, *"Get in loser, we're lifting"*, *"AI took a nap."*
- Match this tone for all new user-facing strings.

## MongoDB Collections
| Collection | Purpose |
|---|---|
| `users` | Profiles, points, streaks, levels, badges, roles |
| `activities` | Point-earning events |
| `moods` | Mood log entries |
| `posts` | Fun Wall posts (nested likes/comments) |
| `shoutouts` | Peer recognition |
| `help_posts` | Help Board Q&A |
| `feedback` | Categorised user feedback |
| `challenges_custom` | Admin-created challenges |
| `config` | Points multipliers, level thresholds, game caps |

## Build & Run

### Backend
```bash
cd backend
# .env needs: MONGO_URL, DB_NAME, JWT_SECRET, EMERGENT_LLM_KEY
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
# .env needs: REACT_APP_BACKEND_URL=http://localhost:8001
npm start       # craco start (dev)
npm run build   # craco build (production)
npm test        # craco test (Jest)
```

### Seed demo data (once after backend starts)
```
POST /api/seed
```
Demo accounts: `alice@company.com`, `bob@company.com`, `carol@company.com`, `dave@company.com`, `eve@company.com`, `admin@company.com` — all password `password123`.

## Testing
- **Backend**: `pytest` + `requests` against a live server URL. Tests in `backend/tests/`.
- **Frontend**: Jest via `craco test`. Tests in `tests/`.
- UI elements must have `data-testid` attributes for test targeting.
- Reference [memory/PRD.md](../memory/PRD.md) for full feature checklist and test iteration history.

## Key Conventions
- Never use MongoDB ObjectIds — use `uuid.uuid4()` strings as IDs.
- Always add `{"_id": 0}` to MongoDB projections.
- New API endpoints go in `backend/server.py` under the existing `api` router.
- New pages go in `frontend/src/pages/`. Register the route in `App.js`.
- New shared components go in `frontend/src/components/`. Pure UI atoms go in `frontend/src/components/ui/` (Radix-based shadcn components).
- Import the Axios instance from `lib/api.js` — never create raw `axios` calls in components.
- Do not add gradients, rounded corners beyond `rounded-sm`, or soft shadows — this breaks the design system.
