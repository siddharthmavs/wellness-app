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
- **Days** — a day boundary defaults to UTC. Every daily endpoint accepts an
  optional `date` (`YYYY-MM-DD`) so the browser can send its own local day:
  `GET /api/water/today?date=2026-08-19`, or `{"date": "..."}` in a body.
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

Same shape as eye break, plus `completed_activities`.

| Method | Path | Body |
| --- | --- | --- |
| GET | `/move-reset/today` | `?date=` |
| GET | `/move-reset/activities` | — (catalogue: `hands`, `finger`, `neck`, `shoulder`, `walking`, `stand`) |
| POST | `/move-reset/complete` | `{activity, slot?, duration?, date?}` |
| PUT | `/move-reset/goal` | `{goal, date?}` |
| PUT | `/move-reset/schedule` | `{schedule, date?}` |
| GET | `/move-reset/history` | `?days=30` |

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
Sections: `notifications`, `sound`, `theme`, `water`, `eye_break`, `move_reset`,
`breathing`. Schedules and goals are validated on write.

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

## Learning bites (current branch)

`GET /learning-bites` now also returns `options`, `correct_index` and
`resource_url` for each bite, matching the quiz / deep-dive modes on the Learn
page. `POST /learning-bites/{id}/tried` accepts `{mode, meta}` where mode ∈
`quiz`, `reflect`, `deepdive`, `vouch`; `reflect` and `vouch` require `meta`.
Unknown bite ids now return 404 instead of silently awarding points.

## Collections

`water_logs`, `eye_break_logs`, `move_reset_logs`, `breathing_logs`,
`user_settings`, `reward_transactions`, `devices`, `notification_dispatch`,
`game_bounties`, `game_challenges` — created with indexes on startup by
`ensure_indexes()`. Existing collections (`users`, `activities`,
`notifications`, `rewards`, `game_teams`, …) are reused, not duplicated.

## Tests

`backend/tests/test_wellness.py` — 35 integration tests. Run with a server up:

```bash
REACT_APP_BACKEND_URL=http://127.0.0.1:8000 python -m pytest backend/tests -q
```
