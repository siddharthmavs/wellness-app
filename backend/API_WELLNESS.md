# MyWellness backend — new API surface

Implements sections 3–13 of *MyWellness Backend Requirements* plus the endpoints
the current branch's frontend already calls. Everything lives in
[server.py](server.py) alongside the existing routes and follows the same
conventions: `/api` prefix, `Authorization: Bearer <jwt>`, `snake_case` JSON,
UUID `id` fields, `user_id` foreign keys.

## Conventions

- **Auth** — every endpoint below requires a bearer token unless marked *admin*.
- **Naming** — the requirements doc uses camelCase in its examples; the API uses
  `snake_case` to stay consistent with the rest of this backend
  (`completedSlots` → `completed_slots`, `xpEarned` → `xp_earned`).
- **Days** — every "today" is the **organization's business day**, in the org's
  IANA timezone (`organizations.timezone`, default `Asia/Kolkata`, admin-editable
  via `PUT /admin/organization`). Writes always use the server's business day —
  a client-sent `date` is ignored. Reads accept an optional `?date=YYYY-MM-DD`
  to look at a past day.
- **Tenancy** — every tenant-owned row carries `org_id`, and every query is pinned
  to the caller's org (taken from the token's user, never from input). Ids from
  another org answer 404, exactly like ids that don't exist.
- **Errors** — `{"detail": "...", "message": "..."}`. `detail` is FastAPI's
  existing key; `message` mirrors it for the frontend code that reads
  `err.response?.data?.message`. Validation errors return 422 with the same shape.
- **XP is never trusted from the client.** Goal bonuses are re-validated against
  the stored logs and de-duplicated per `(source, date)`.

## 3. Water — `/api/water`

| Method | Path | Body / query | Notes |
| --- | --- | --- | --- |
| GET | `/water/today` | `?date=` | goal, consumed, `progress` %, completed, rewarded, entries |
| POST | `/water/drink` | `{amount, date?}` | 1–5000 ml; awards the daily bonus the first time the goal is crossed |
| PUT | `/water/goal` | `{goal, date?}` | 500–10000 ml; also persisted to user settings |
| GET | `/water/history` | `?days=30` or `?start=&end=` | items + `goals_completed`, `total_consumed`, `average_consumed` |
| POST | `/water/reset` | `{date?}` (optional) | clears consumed/entries/rewarded for the day |

## 4. Eye break — `/api/eye-break`

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/eye-break/today` | `?date=` | goal, completed, schedule, `completed_slots`, sessions |
| POST | `/eye-break/complete` | `{slot?, duration?, date?}` | a scheduled `slot` counts at most once per day → `already_completed: true` |
| PUT | `/eye-break/goal` | `{goal, date?}` | 1–24 |
| PUT | `/eye-break/schedule` | `{schedule: ["10:00", …], date?}` | 24h `HH:MM`, de-duplicated and sorted |
| GET | `/eye-break/history` | `?days=30` | + `goals_completed`, `total_breaks` |

## 5. Move & Reset — `/api/move-reset`

A move break is a **server-owned guided session** of 5 exercises
(`MOVE_EXERCISE_SECONDS`, default 20 s each, checkpoints before exercises 3 and 5).
The server keeps the clock: an interval only counts while the session is
`RUNNING`, and points are awarded once, on a validated `complete`.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/move-reset/today` | `?date=` | goal, completed, schedule, `completed_activities` |
| GET | `/move-reset/activities` | — | exercise library |
| POST | `/move-reset/sessions` | — | starts a `RUNNING` session (older open ones are abandoned) |
| GET | `/move-reset/sessions/active` | — | recovery after reload; a `RUNNING` session comes back `PAUSED` |
| GET | `/move-reset/sessions/{id}` | — | read-only view (status, `current_index`, `active_seconds`, `remaining_seconds`) |
| POST | `/move-reset/sessions/{id}/events` | `{type, index}` | `pause`, `resume`, `advance`, `checkpoint`, `end`; 409 if the interval isn't done, a checkpoint is required, or the session is paused |
| POST | `/move-reset/sessions/{id}/complete` | — | idempotent; replays return the stored result with `already_completed: true` |
| PUT | `/move-reset/goal` | `{goal}` | |
| PUT | `/move-reset/schedule` | `{schedule}` | |
| GET | `/move-reset/history` | `?days=30` | |

Expired (30 min), ended, completed or foreign sessions are rejected.
The old one-shot `POST /move-reset/complete` now returns **410 Gone**.

## Daily points — BUG-01

`users.points` stays the lifetime total. Each award also increments a
`daily_points` row keyed by `(user_id, date)` for the org's business day, so
"points today" starts at 0 every day and history is kept.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/points/today` | `{date, timezone, points_today, total_points}` |
| GET | `/points/history` | `?days=30` — one row per day |

`GET /auth/me` and `GET /dashboard` also include `points_today`.
`POST /activities` ignores client-sent points and caps each type at 12 awards a
day; `stand` is no longer loggable there (it comes from move-break sessions).

## 6. Breathing — `/api/breathing`

| Method | Path | Body |
| --- | --- | --- |
| GET | `/breathing/today` | `?date=` |
| POST | `/breathing/session` | `{duration, slot?, date?}` — 1–3600 s |
| PUT | `/breathing/goal` | `{goal, date?}` |
| PUT | `/breathing/schedule` | `{schedule, date?}` |
| GET | `/breathing/history` | `?days=30` — + `total_duration` |

## 7. Rewards / XP — `/api/rewards`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/rewards` | `xp`, `level`, `coins`, `level_threshold`, `xp_into_level`, `xp_to_next_level`, `claimed_today` |
| GET | `/rewards/history` | XP ledger from `reward_transactions` |
| POST | `/rewards/claim` | `{source, date?}` where source ∈ `water_goal`, `eye_break_goal`, `move_reset_goal`, `breathing_goal`. 400 if the goal is not actually met, 409 if already claimed. |

Goal bonuses (default 50 XP + 5 coins) are tunable through the existing
`PUT /api/admin/points-config` under the keys `water_goal_xp`,
`eye_break_goal_xp`, `move_reset_goal_xp`, `breathing_goal_xp`, `goal_coins`.

The pre-existing `GET /rewards/me` and `POST /rewards/{id}/claim` (admin-issued
coupons) are untouched — XP transactions are stored in a separate collection so
they do not appear in that inbox.

## 8. Activity log — `/api/activities`

Every wellness completion writes one row to `activities` with
`type` (legacy lowercase vocabulary), `category` (`WATER`, `EYE_BREAK`,
`MOVE_RESET`, `BREATHING`, `POMODORO`), `action`, `value`, `xp_earned`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/activities/feed` | `?limit=30&scope=me\|all` — live feed; `scope=all` hydrates `user` |
| GET | `/activities/history` | `?days=7&type=&category=` — + `by_category`, `xp_earned` |

`POST /activities` and `GET /activities/me` keep their existing behaviour and
response keys.

## 9. Dashboard — `GET /api/dashboard`

One request returning today's `water`, `eye_break`, `move_reset` and `breathing`
summaries plus `xp`, `level`, `coins`, `streak`, `longest_streak`,
`wellness_score`, `modules_completed`/`modules_total`, `activities_today` and
`recent_activity`.

## 10. Weekly insights — `GET /api/insights/weekly`

Existing keys are unchanged (`water.change_pct`, `points_earned`, `top_mood`,
`message`, …) so `WeeklyInsightsCard` keeps working. Added:
`week` (ISO `2026-W34`), `water_goals_completed`, `eye_breaks_completed`,
`move_reset_completed`, `breathing_sessions`, `total_activities`, `xp_earned`,
`activities_per_day`, `best_day`, `current_streak`, `longest_streak`.

## 11. Streaks — `GET /api/streaks`

Derived from dated activity records: `current_streak`, `longest_streak`,
`active_today`, `last_active_date`, `total_active_days`. A streak survives until
the end of the following day. Also re-syncs the denormalised `users.streak`.

## 12. Notifications — `/api/notifications`

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications` | `?limit=50&unread_only=` — items + `unread` count |
| GET | `/notifications/history` | `?days=30&kind=` — + `by_status` |
| GET / PUT | `/notifications/settings` | the eight flags the frontend keeps in `notificationSettings` |
| POST | `/notifications/register-device` | `{token, platform, provider?, label?}` — upsert by token |
| GET | `/notifications/devices` | active devices |
| DELETE | `/notifications/devices/{id}` | deactivate |
| GET | `/notifications/schedule` | today's reminder timetable + `next` upcoming event |
| POST | `/notifications/dispatch` | *admin* — `?window_minutes=5`; cron entry point |

`dispatch_due_reminders` is idempotent per `(user, type, time, day)` via the
`notification_dispatch` guard collection, skips modules the user disabled, and
records each reminder in `notifications` with a `status`. **No push provider is
configured in this environment**, so delivery is recorded as `queued`; set
`PUSH_PROVIDER_KEY` and fill in `deliver_push()` to send real pushes.

Only users who have saved settings are dispatched to — saving settings is the
opt-in signal.

## User settings — `/api/settings`

`GET` returns the fully-defaulted document; `PUT` deep-merges a partial patch.
Sections: `notifications`, `sound`, `theme`, `appearance`, `water`, `eye_break`,
`move_reset`, `breathing`. Schedules and goals are validated on write;
`appearance` (background, solid/accent color, layout, font style/size) is
unvalidated free-form key/value.

## Organizations & invitations — Wellness Garden requirements §1, 2, 3, 5, 6, 7

`POST /api/auth/register` now creates a new **organization** plus its first
Admin (`{org_name, name, email, password}`) instead of an open self-signup —
employees join only via invitation. Every user has an `org_id`; pre-existing
data lives in an idempotently-seeded "Demo Organization".

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/register` | admin org signup — `{org_name, name, email, password}` |
| GET | `/invitations/{token}` | public preview (email, org name, role) for the accept-invite page |
| POST | `/auth/accept-invite` | `{token, password, name?}` — creates the employee account in that org |
| GET/PUT | `/admin/organization` | *admin* — `{name, support_email, work_email_domain, timezone}`; renames are checked for duplicates |
| GET | `/admin/invitations` | *admin*, org-scoped; pending/expired rows include `accept_link` |
| POST | `/admin/invitations` | *admin* — `{email, name?, role?, department?}`; 7-day expiry |
| POST | `/admin/invitations/{id}/resend` | *admin* — rotates the token/expiry, returns a fresh `accept_link` |
| DELETE | `/admin/invitations/{id}` | *admin* — marks cancelled |

`GET /admin/users`, `GET/PUT /admin/points-config` and `GET /leaderboard[/teams]`
are all scoped to the caller's `org_id`; `GET /leaderboard` now requires auth
(it used to be public). `PATCH /admin/users/{uid}` also accepts
`status: "active" | "deactivated"` (login is blocked for deactivated users).

`PATCH /users/me` gained `first_name`, `last_name`, `job_title`, `department`,
`birthday` and `work_anniversary` (both `YYYY-MM-DD`); `POST /users/me/avatar`
(multipart, image/\*, ≤5MB) uploads a profile picture via the same
object-storage helpers as music uploads and returns `{avatar}`, a
backend-relative path served by `GET /avatars/{uid}/{file}`.

`GET /events`/`GET /events/today` are now org-scoped and auth-required, and
merge admin-created rows with **synthesized** birthday/work-anniversary
events computed live from every org member's profile fields (dedup'd by
`(user_id, type)`, manual rows win); anniversary entries include
`years_completed`.

Organization names are unique after normalization (NFKC, collapsed whitespace,
case-folded — `name_normalized`, unique index). A duplicate answers **409**
`"An organization with this name already exists."`

## Account & profile settings — BUG-04, QA #2–4

Password policy everywhere (register, accept-invite, change, reset): 8–128
characters with at least one letter and one number.

| Method | Path | Notes |
| --- | --- | --- |
| PATCH | `/users/me` | `first_name` (required, ≤50), `last_name`, `nickname` (≤30), `job_title`, `department`, `bio` (≤280), `birthday`/`work_anniversary` (`""` clears), `language` (`en`), `timezone` (IANA). `email`, `role`, `org_id`, `points`, `status` are not accepted. |
| POST | `/users/me/password` | `{current_password, new_password, confirm_password}` → `{token}`. Wrong current password is **400** (not 401); 5 wrong tries in 15 min → 429. Revokes every other session. |
| POST | `/users/me/avatar` | multipart `file`; PNG/JPG/WebP/GIF sniffed from the bytes (SVG/HTML rejected), ≤5 MB. Object storage, falling back to `backend/uploads/avatars/`. |
| PUT | `/users/me/avatar/preset` | `{style, seed, background?}` — Dicebear preset from an allow-list |
| DELETE | `/users/me/avatar` | back to the generated default |
| GET | `/avatar-presets` | `{styles, backgrounds}` |
| POST | `/auth/forgot-password` | `{email}` — always the same generic answer; at most one email per minute per account |
| GET | `/auth/reset-password/{token}` | validates a link → `{valid, email, expires_at}` |
| POST | `/auth/reset-password` | `{token, new_password, confirm_password}` — single use, 60 min (`PASSWORD_RESET_MINUTES`) |
| POST | `/admin/users/{uid}/password-reset-link` | *admin*, org-scoped → `{reset_link, expires_at}` for handing out when email isn't configured |

Reset tokens are stored only as SHA-256 hashes; issuing a new link retires the
previous one. Changing or resetting a password sets `password_changed_at`, and
tokens issued before it are rejected. Email goes through SMTP when `SMTP_HOST`
is set (`SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_STARTTLS`,
`SMTP_SSL`); otherwise the message, including the link, is written to the
server log. Account changes are appended to `audit_log`.

## Saved facts & tips — QA #8

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/saved-items` | the caller's saved items with current content |
| PUT | `/saved-items` | `{kind: "fact" \| "tip", item_id}` — idempotent |
| DELETE | `/saved-items/{kind}/{item_id}` | |

`GET /facts/today` and `GET /words/today` include `saved`; tips now have stable
ids derived from the word (`word-flaky-test`).

## Web Push — Wellness Garden requirements §8.4

`GET /api/notifications/vapid-public-key` returns the VAPID public key.
`POST /notifications/register-device` now also accepts a raw
`subscription: PushSubscriptionJSON` (falls back to `subscription.endpoint`
when no separate `token` is given). `deliver_push()` sends real pushes via
`pywebpush` for `webpush` devices with a subscription (auto-deactivating the
device on a 404/410 "gone" response); FCM/APNs devices are unchanged
(`"queued"`, no provider configured). Requires `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_EMAIL` in `.env`.

## Game teams (current branch)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/game-teams/bounties` | seeded on first read |
| POST | `/game-teams/bounties/{id}/claim` | `{team_id}` — caller must be on that team; 409 once claimed |
| GET | `/game-teams/challenges` | |
| POST | `/game-teams/challenge` | `{challenger_team_id, target_team_id, wager}` — wager 10–500 |
| POST | `/game-teams/shuffle` | *admin* — `{theme, num_teams?, name_prefix?}` |
| POST | `/admin/game-teams/bounties` | *admin* — `{title, reward}` |
| POST | `/admin/game-teams/challenges/{id}/resolve` | *admin* — `{winner_team_id}`; moves the wager |

`POST /admin/game-teams/shuffle` still exists and is reused internally.

## Learning bites

`GET /learning-bites` returns `options` and `resource_url` but **not**
`correct_index`, plus the caller's `completed`, `completed_mode` and
`quiz_attempted`. `POST /learning-bites/{id}/tried` takes `{mode, meta?,
answer_index?}`:

- `quiz` is graded on the server; only a correct **first** attempt earns points
  (every attempt is stored in `bite_attempts`).
- `reflect` needs a real reflection (≥5 words, ≥25 characters, not repeated
  text, gibberish or a copy of the bite).
- `vouch` must name a teammate in the caller's org.

Unknown bite ids return 404.

## Collections

`water_logs`, `eye_break_logs`, `move_reset_logs`, `breathing_logs`,
`user_settings`, `reward_transactions`, `devices`, `notification_dispatch`,
`game_bounties`, `game_challenges`, `organizations`, `invitations`,
`daily_points`, `bite_attempts`, `move_reset_sessions`, `password_resets`,
`audit_log`, `saved_items` — created with indexes on startup by
`ensure_indexes()`. Existing collections (`users`,
`activities`, `notifications`, `rewards`, `game_teams`, …) are reused, not
duplicated.

## Tests

Integration tests against a running server (`backend/tests/`), including
`test_tenant_isolation.py` (two orgs, read leaks and id-swapped writes),
`test_daily_points.py`, `test_move_reset_sessions.py`, `test_account.py` and
`test_saved_items.py`. Some tests use pymongo (`MONGO_URL`/`DB_NAME` from
`backend/.env`) to move time or inspect stored rows.

```bash
REACT_APP_BACKEND_URL=http://127.0.0.1:8001 python -m pytest backend/tests -q
```

The 8 `test_music.py` errors are environmental: uploads need the Emergent
object store, which rejects this environment's key.
