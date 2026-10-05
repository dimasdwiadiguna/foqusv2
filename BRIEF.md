# FOQUS — Build Brief for Claude Code

This file is the complete specification and build plan for FOQUS, a personal productivity web app. It replaces all earlier FOQUS documents. It is written for Claude Code to read and build from, one step at a time.

**For the owner — how to use this file**

1. Create an empty project folder, put this file in its root as `FOQUS-BUILD-BRIEF.md`, and start Claude Code there.
2. First session, say: *"Read FOQUS-BUILD-BRIEF.md: Part 1 and Part 7 in full, then build Step 1.1. Read the other parts as the step points to them."*
3. Every later session, say: *"Read PROGRESS.md and continue with the next step of FOQUS-BUILD-BRIEF.md."*
4. After each step, try the result on your iPhone before asking for the next one.

**Contents**

| Part | What it holds |
|---|---|
| 1 | Working agreement: how to build from this brief |
| 2 | The product: concept, loop, glossary, settled decisions |
| 3 | Architecture across the four stages |
| 4 | Data model |
| 5 | Rules: every behavior and formula |
| 6 | UI: visual language, screens, gestures |
| 7 | Build plan: stages and steps, each with a definition of done |
| 8 | Not in scope |

**The four stages at a glance**

| Stage | Result | Backend |
|---|---|---|
| 1 · Local MVP | Plan a day and run focus sessions; all data in the browser | None |
| 2 · Complete the loop | Check-in, draft scheduler, reviews, plan strength, coach, Compass; still all in the browser | None |
| 3 · Database | Login, data stored in Supabase, synced across devices | Supabase |
| 4 · Google Calendar | External events on the timeline; FOQUS blocks written to Google | Supabase + Vercel routes + Google |

---

# Part 1 · Working agreement

You are building an app that one person will open many times a day on an iPhone to decide what to work on and to run focus sessions. He is technically capable and will test each step himself. The product decisions in this brief were made with him over several rounds of questions, so treat Part 5 (rules) and the decisions in §2.5 as agreed requirements, not suggestions.

## 1.1 How to work

- **Build in the order of Part 7, one step per session.** Each step ends in something the owner can use. Stop at the end of the step and wait for him.
- **For each step:** read the step and the sections it points to, build it, add or extend unit tests for the pure logic you touched, then run typecheck, lint, tests, and a production build. All four must pass before you call the step done.
- **End each step with a short report:** what now works, how to try it, any deviation from this brief and why, and what the owner must do before the next step (accounts, keys, device checks).
- **Keep `PROGRESS.md` current.** It lists each step with its status, a "Decisions" section for choices you made where the brief was silent, and a "Deviations" section for anything you did differently from the brief.
- **Commit at the end of each step** with a message that names the step, if the folder is a git repository. If it is not, initialise one in Step 1.1.
- **Don't build ahead.** A screen must not show controls for a feature that arrives in a later step: no dead buttons, no "coming soon". The exception is the seams in §3.2, which exist so later stages are additive.

## 1.2 When the brief is silent or wrong

- If a detail is missing, choose the simplest behavior consistent with the principles in §2.4, and record it under "Decisions" in `PROGRESS.md`.
- Ask before building only when the choice would be expensive to reverse (data shape, sync behavior, anything that deletes data).
- If something here contradicts how a library or service currently works, say so and propose the fix. Vendor details in this brief were checked in October 2026; confirm them against current documentation when you reach them.
- Library names in this brief are suggestions. Use the current stable release of whatever you choose, and prefer what is actively maintained.

## 1.3 Project memory

In Step 1.1, create a short `CLAUDE.md` (aim for under 100 lines). Claude Code loads `CLAUDE.md` in full at the start of every session, so it must stay small. It should hold: a one-paragraph description of FOQUS, the commands (dev, test, lint, typecheck, build), the conventions from §3.2 and §3.3, and a line telling future sessions to read `PROGRESS.md` and the relevant parts of `FOQUS-BUILD-BRIEF.md`. Mention this brief by its file name in backticks; do not import it, because imported files are loaded every session too and this file is long.

## 1.4 Quality bar

| Area | Requirement |
|---|---|
| Speed | On a repeat visit, Today is usable within 2 seconds on a 4G connection |
| Touch | Dragging blocks runs smoothly on a recent iPhone; taps respond within 100 ms |
| Timer | Within 1 second of wall-clock time after any backgrounding, lock, or reload |
| Data safety | No write is ever lost silently: it is in the local store, and from Stage 3 either confirmed by the server or waiting in the sync queue |
| Testing | Everything in `lib/` is a pure function with unit tests |
| Accessibility | Text contrast at least 4.5:1; touch targets at least 44 × 44 pt; reduce-motion respected; no meaning carried by color alone |
| Privacy | No analytics, no third-party scripts, no fonts loaded from other domains at runtime |
| Secrets | Never committed. Use `.env.local`, and keep `.env.example` current |

## 1.5 What you cannot do

You cannot test on the iPhone, create accounts, or set keys in dashboards. Each stage in Part 7 lists the owner's tasks and device checks. When a step depends on one, stop and list exactly what he needs to do.

---

# Part 2 · The product

## 2.1 Summary

FOQUS is a goal-to-action system for one person. It connects quarterly goals to a weekly plan, the weekly plan to time blocks on a calendar, and each time block to a pomodoro focus session. Daily check-ins and weekly reviews feed a rule-based coach and a plan-strength score, which shape the next plan.

It is not a to-do list and not a calendar. A to-do list holds tasks and a calendar holds time; FOQUS decides which tasks deserve time this week because they move a goal, then protects that time.

The concept is modelled on Superfocus (Ali Abdaal's app) and his GPS Method: Goal, Plan, System. FOQUS uses its own name, wording, and visual design. Do not copy Superfocus's text, assets, or branding.

## 2.2 The core loop

```
            ┌──────────── quarterly review ─────────────┐
            ▼                                            │
  COMPASS → GOAL → SEASON PLAN → WEEK → DAY → FOCUS → REFLECT
  vision    why     outcome       pick    time   pomodoro  check-in
            anti-   major moves   actions blocks session   weekly review
            goals   actions                                │
                         ▲                                 │
                         └──── coach + plan strength ──────┘
```

| GPS part | Question | FOQUS objects |
|---|---|---|
| Goal | What do I want, and why? | Goal (title, why, anti-goals); season plan (measurable outcome, dates) |
| Plan | How will I get there this quarter? | 3–5 major moves, reality-check confidence, obstacles and mitigations, sized actions |
| System | What makes me follow through? | Week list, time blocks, focus sessions, check-in, reviews, coach, plan strength |

## 2.3 Glossary

| Term | Meaning |
|---|---|
| Area | An ongoing sphere of responsibility with a name and color (Work, Teaching, Personal, Other). Never finished |
| Goal | A specific ambition with a why and anti-goals. May sit under an area |
| Season | A calendar quarter |
| Season plan | One goal's plan for one season: outcome, dates, confidence, obstacles, major moves |
| Major move | One of the 3–5 big steps that deliver the season outcome |
| Action | A concrete piece of work estimated in pomodoros. Belongs to a goal, or directly to an area ("area task") |
| Recurring action | A rule that generates an action on set weekdays |
| Week list | The actions chosen for a given week |
| Tray | The week list's actions that still need time scheduled |
| Block | A scheduled span of time for one action, sized in pomodoros |
| External event | A Google Calendar event read into FOQUS. Blocking or not, set per calendar |
| Personal block | A recurring time FOQUS never schedules over (meals, routines, rest) |
| Peak window | The hours when goal work is scheduled first |
| Draft | A proposed schedule generated by rules, reviewed before commit |
| Plan strength | A 0–100 score per active goal |
| Compass | A one-page long-term vision |
| Coach | The screen holding insights, plan strength, reviews, and Compass |

## 2.4 Principles

1. **Goals get time first.** The scheduler, capacity meter, and coach all favor goal work over area tasks.
2. **Plan against the real week.** Google events, personal blocks, and available hours are visible while planning.
3. **Warn, don't forbid.** Limits are soft warnings the owner can override. The only hard rule is that two FOQUS blocks cannot overlap.
4. **Nothing disappears silently.** Every block whose time passes must be resolved: done, rescheduled, or dropped.
5. **Two sources of truth, never mixed.** Google owns external events. FOQUS owns its blocks. Neither edits the other's items.
6. **Fast on a phone.** Every daily action is reachable with one thumb in two taps or fewer.
7. **Celebrate progress.** Completion gets visible, celebratory feedback.
8. **Rules now, AI later.** All coaching is deterministic and explainable.

## 2.5 Settled decisions

| Topic | Decision |
|---|---|
| Users | One owner. Password protected from Stage 3 (email + password, sign-ups disabled) |
| Platform | Mobile-first PWA installed on an iPhone home screen; laptop browser second. Deployed on Vercel, data in Supabase |
| Language, theme | English. Dark only. Time zone Asia/Jakarta by default; 24-hour times; week starts Monday |
| Seasons | Calendar quarters. Each goal has its own start and end date inside a season |
| Goal limit | Soft warning when more than 4 goals are active at the same time |
| Areas | Lightweight: name and color. Goals may sit under an area; goal-less tasks must pick one; "Other" exists by default |
| Estimates | In pomodoros. 25 minutes focus, 5 minutes break |
| Sound | None. No vibration. No notifications from FOQUS. Google Calendar reminders cover block starts |
| Pomodoro end | Visual only, with the screen kept awake during a session |
| Focus mode | "Soft": timer, notes, capture. No app or site blocking, no music |
| Availability | A daily window per weekday, plus recurring personal blocks |
| Buffer | 10 minutes after each block by default, editable per block |
| Daily cap | A pomodoro cap per day set by the owner, enforced as a soft warning |
| Missed blocks | Prompt on next app open: done, reschedule, or drop |
| Weekly planning | Manual placement, plus an optional rule-based draft he reviews before commit |
| Draft ranking | By goal priority, then deadline |
| Draft placement | Goal work goes into the peak window; area tasks fill the rest |
| Check-in | Done/not done, energy and focus ratings, a short note |
| Weekly review | Guided, four steps, preceded by Compass |
| Quarter end | Review each unfinished goal: carry over, close, or drop |
| Plan strength | Four inputs: goal completeness, major moves, scheduled vs needed, follow-through |
| Coaching | Rule-based in this build. Data model leaves room for AI later |
| Feedback | Celebratory: confetti, streaks, progress bars |
| Google Calendar | Read events as external events that may or may not block, set per calendar. Write FOQUS blocks to a dedicated calendar. One-way each direction |
| Offline (signed in) | View, check off, and run the focus timer. Other edits wait for a connection |

---

# Part 3 · Architecture across the stages

## 3.1 Local-first, then sync

The app is built local-first. The browser's IndexedDB holds the working copy of all data, and the UI always reads and writes that local copy. Later stages add things around it without rewriting the UI:

```
Stages 1–2       UI ⇄ repo ⇄ IndexedDB

Stage 3          UI ⇄ repo ⇄ IndexedDB ⇄ sync engine ⇄ Supabase (Auth + Postgres, RLS)

Stage 4          UI ⇄ repo ⇄ IndexedDB ⇄ sync engine ⇄ Supabase ⇄ Vercel routes ⇄ Google Calendar
                                                         blocks ──trigger──► outbox ──► FOQUS calendar
                                                         external_events ◄── pull ◄──── user's calendars
```

Why this shape: the owner asked for the whole app to work with no database first, then the database, then Google. With a local-first design, Stages 1 and 2 are the complete app minus a server, Stage 3 is a sync layer that uploads what is already there, and the offline behavior he wants falls out of the design instead of being bolted on.

IndexedDB is used instead of `localStorage` because the data is relational (about twenty tables), `localStorage` is synchronous and limited to a few megabytes, and IndexedDB is what Stage 3 needs as the offline copy anyway.

## 3.2 Seams to respect from Step 1.1

These conventions cost almost nothing while the app is local-only and make Stages 3 and 4 additive. Follow them from the first line of data code.

1. **One write path.** Components never touch the database directly. All writes go through functions in `repo/`. All reads go through hooks in `data/`.
2. **Client-generated ids.** Every row's `id` is created on the client. Most are random UUIDs (`crypto.randomUUID()`). Rows that must be unique per user use a deterministic id (§4.1), so two devices can never create duplicates.
3. **Sync metadata on every row from day one:** `created_at`, `updated_at` (set by `repo/` on every write), `deleted_at` (soft delete; reads filter it out), and a local-only `_dirty` flag set to 1 on every write. Stages 1 and 2 never clear `_dirty`; Stage 3's first sync uploads everything by simply running.
4. **No hard deletes.** Deleting sets `deleted_at`. This is what lets other devices, and later Google, learn that something was removed.
5. **Pure logic in `lib/`.** Scheduling, placement, timer, availability, scoring, and stats are pure functions that take data and "now" as arguments. They never read the database or the clock themselves.
6. **External events are a parameter.** `lib/availability` accepts a list of external events. It is an empty list until Stage 4.
7. **Types for the whole data model exist from Step 1.1** (Part 4), even for tables used only in Stage 2.
8. **Time zone discipline.** Instants are stored as UTC ISO strings. All day, week, and quarter math goes through `lib/time` using the time zone in settings, never the device's.

## 3.3 Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) with TypeScript, strict mode | Screens are client components, since data lives in the browser. Route handlers are used only from Stage 4 |
| Hosting | Vercel | Stages 1 and 2 deploy with zero environment variables |
| Styling | Tailwind CSS with the tokens in §6.2 | Dark only |
| Local store | IndexedDB, for example via Dexie with its React live-query hooks | Reactive reads keep screens current |
| Drag and drop | A pointer-event library with touch and long-press support, for example dnd-kit | |
| Motion | A small animation approach and a confetti library | Respect reduce-motion |
| PWA | Web app manifest and a service worker that precaches the app shell | Step 1.5 |
| Tests | Vitest for `lib/`; a few end-to-end tests for the core loop are welcome | |
| Database (Stage 3) | Supabase Postgres + Supabase Auth | Region nearest the owner (Singapore) |
| Google (Stage 4) | Google Calendar REST API, called only from server routes | Tokens never reach the browser |

## 3.4 Suggested layout

```
app/
  (app)/today/  plan/  goals/  coach/  settings/  focus/
  (flows)/checkin/  weekly-review/  quarterly-review/  setup/
  login/                                  (Stage 3)
  api/google/…   api/cron/sync/           (Stage 4)
components/
  timeline/  blocks/  sheets/  wizard/  charts/  celebration/
data/        read hooks
repo/        the only code that writes
db/          local database definition and seeding
lib/         pure logic: time availability placement scheduler timer
             capacity plan-strength coach streaks stats merge
sync/        sync engine                   (Stage 3)
types/       the data model
supabase/migrations/                      (Stage 3)
public/      manifest, icons
```

## 3.5 Stage 3 design: login and sync

**Login.** Supabase Auth with email and password. The owner creates his one user in the Supabase dashboard and switches public sign-ups off. From Stage 3 on, the app shows only the login screen when there is no session. The session is kept on the device and refreshed automatically, so the installed app rarely asks for the password, and it still opens offline when a session is stored. Password reset is done in the dashboard; there is no reset flow in the app.

The gate is in the client, because the app shell is static code that the service worker serves offline. The real protection is row-level security: without a valid session the server returns no data. Say this in a comment near the gate so nobody mistakes the gate for the security boundary.

**Server tables.** One Postgres table per synced table in Part 4, with these additions:

- `user_id uuid not null default auth.uid()`; primary key `(user_id, id)`, with `id text`.
- `synced_at timestamptz`, set to the current time by a trigger on every insert and update. It is the pull cursor.
- Row-level security on every table: `user_id = auth.uid()` for select, insert, update, and delete.
- A guard trigger that ignores an update whose `updated_at` is older than the stored row's, so a stale device can never overwrite newer data.
- Keep the schema permissive otherwise: no foreign keys, unique constraints, or exclusion constraints on synced tables. The client is the only writer and enforces integrity in `repo/`; a constraint that rejects a pushed row would stall sync for the whole device.

**Sync cycle** (`sync/`): pull, merge, push.

1. **Pull.** For each table, fetch rows with `synced_at` after the stored cursor (with a small overlap, since merging is idempotent), then advance the cursor.
2. **Merge** (`lib/merge`, pure and tested). For each pulled row: if there is no local row, insert it. If the local row is not dirty, overwrite it. If the local row is dirty, keep whichever has the later `updated_at`; if the server row wins, clear the dirty flag.
3. **Push.** Upsert dirty rows in batches. Clear a row's dirty flag only if it has not changed again since it was read.

Run a cycle on app open, on return to the foreground, on reconnect, a couple of seconds after local writes settle, and on manual retry. Only one cycle runs at a time.

**First sign-in on a device that already has local data** (everything entered during Stages 1 and 2): ask once, "Upload this device's data to your account" (default; it is a normal sync, since every row is dirty) or "Discard it and use the account's data".

**Logout** clears the local database. If unsynced changes exist, warn first.

**Keys.** Use Supabase's current key types: the publishable key (`sb_publishable_…`) in the browser and the secret key (`sb_secret_…`) only on the server from Stage 4. The legacy `anon` and `service_role` keys are being retired.

## 3.6 Stage 4 design: Google Calendar

**Authorising server routes.** The browser holds the Supabase session, so client calls to `/api/google/*` send the access token as a bearer header and each route verifies it with Supabase before doing anything. The OAuth redirect cannot carry a header, so "connect" is a two-step: an authenticated POST returns Google's consent URL containing a short-lived signed `state` (user id and nonce); the callback validates that state.

**Scopes (least privilege).** Request exactly three:

| Scope | Why |
|---|---|
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List the owner's calendars |
| `https://www.googleapis.com/auth/calendar.events.readonly` | Read events from them |
| `https://www.googleapis.com/auth/calendar.app.created` | Create the "FOQUS" calendar and manage events on it only |

With these, FOQUS is technically unable to modify the owner's other calendars, which enforces principle 5 at the permission level. Request offline access so a refresh token is issued.

**Server-only tables** (row-level security enabled with no client policies):

- `google_accounts`: `google_email`, `refresh_token_encrypted`, `access_token`, `access_token_expires_at`, `foqus_calendar_id`, `status` (`connected`, `needs_reconnect`), `connected_at`.
- `sync_outbox`: `block_id`, `attempts`, `last_error`, `next_attempt_at`, `processed_at`.

Encrypt the refresh token at the application level with a key from the environment. Never return it to the browser.

**Server-owned tables the client pulls but never pushes:** `google_calendars` and `external_events` (Part 4). The client changes a calendar's mode through a route, then pulls.

**Reading.** For each calendar in Show or Block mode, fetch events from 7 days back to 35 days ahead with recurring events expanded into single occurrences. Upsert what came back and soft-delete what did not, so devices learn about removals. Skip cancelled events and events the owner declined. Triggers: app open, return to the foreground (at most once every 5 minutes), pull to refresh, and the scheduled job. A full-window fetch is small for one person; do not use Google's incremental sync tokens here, since they cannot be combined with a time window.

**Writing.** A database trigger on `blocks` adds a `sync_outbox` row whenever a non-draft block is inserted or updated. The outbox says only "this block needs reconciling". The processor reads the block's current state and makes Google match it:

| Block state | Google event |
|---|---|
| Not deleted, status `scheduled`, `active`, or `done` | Exists, with current time and title |
| Deleted, or status `missed` | Does not exist |
| Status `draft` | Never written |

- The event id is the block's UUID with hyphens removed, so creating is idempotent and no id needs storing. (Google event ids allow lowercase a–v and digits; hexadecimal fits.)
- Treat "already exists" on create as an update, and "not found" or "gone" on delete as success.
- After a sync push that included blocks, the client calls `/api/google/push` without waiting on it.
- On failure, increment `attempts` and back off (1 minute, 5 minutes, 30 minutes, then hourly). On an authorization error, mark the account `needs_reconnect`, stop pushing, and keep the queued rows.

**Routes.**

| Route | Purpose |
|---|---|
| `POST /api/google/connect` | Return the consent URL |
| `GET /api/google/callback` | Finish consent, store the token, create the FOQUS calendar, list calendars |
| `GET /api/google/status` | Connection state, pending and failed push counts, last error |
| `POST /api/google/calendars` | Set a calendar's mode |
| `POST /api/google/pull` | Refresh external events |
| `POST /api/google/push` | Process the outbox |
| `POST /api/google/resync` | Rebuild the FOQUS calendar from current blocks |
| `POST /api/google/disconnect` | Revoke, and optionally delete the FOQUS calendar |
| `GET /api/cron/sync` | Scheduled pull and outbox retry; requires the cron secret |

**Scheduled job.** Vercel's Hobby plan runs a cron job at most once per day, with up to an hour of timing drift; Pro allows once per minute. So the design must not depend on the job: the app-open pull and the post-sync push carry normal use, and the daily job is a safety net. If the owner wants fresher data while the app is closed, the same route can be called every 15 minutes from Supabase (`pg_cron` with `pg_net`) or from a Pro-plan cron. Ask him which he prefers when you reach Step 4.3.

**Publishing status.** A Google OAuth app left in "Testing" status issues refresh tokens that expire after about a week, which would force weekly reconnection. The owner should publish the app to production; an unverified-app warning is acceptable for one user. Confirm the current rules when you reach Step 4.1.

## 3.7 Environment variables

| Variable | From stage | Used by |
|---|---|---|
| Supabase project URL | 2 | Client, server |
| Supabase publishable key | 2 | Client |
| Supabase secret key | 3 | Server only |
| Google OAuth client id and secret | 3 | Server only |
| Token encryption key | 3 | Server only |
| Cron secret | 3 | Server only |
| App base URL | 3 | Server (OAuth redirect) |

---

# Part 4 · Data model

Define TypeScript types for all of this in Step 1.1. The same shapes become Postgres tables in Stage 3.

## 4.1 Conventions

- Every row: `id`, `created_at`, `updated_at`, `deleted_at` (null unless deleted). Local only: `_dirty`. Server only: `user_id`, `synced_at`.
- Dates without a time are `YYYY-MM-DD` strings. Clock times are `HH:MM` strings. Instants are UTC ISO strings.
- Weekdays are numbers 1 (Monday) to 7 (Sunday).

**Deterministic ids** (everything else is a random UUID):

| Row | Id |
|---|---|
| `settings` | `settings` |
| `compass` | `compass` |
| `availability_windows`, `peak_windows` | `avail-1` … `avail-7`, `peak-1` … `peak-7` |
| The default area | `area-other` |
| `seasons` | `2026-Q4` |
| `season_plans` | `<goal_id>:<season_id>` |
| `daily_checkins` | The date |
| `weekly_reviews` | The week's Monday date |
| `plan_strength_snapshots` | `<season_plan_id>:<week_start>` |
| An action generated by a recurring rule | `<rule_id>:<occurrence_date>` |

Block ids must be random UUIDs, because the Google event id is derived from them.

## 4.2 Settings and schedule

**`settings`** (one row)

| Field | Default |
|---|---|
| `timezone` | `Asia/Jakarta` |
| `focus_minutes` | 25 |
| `break_minutes` | 5 |
| `max_pomodoros_per_block` | 4 |
| `daily_pomodoro_cap` | 10 |
| `default_buffer_minutes` | 10 |
| `auto_start_next_phase` | true |
| `onboarding_completed_at` | null |

**`availability_windows`** (7 rows): `weekday`, `start_time`, `end_time`. Default 05:00–21:00.

**`peak_windows`** (7 rows): same shape. Default 05:00–09:00.

**`personal_blocks`**: `label`, `weekdays[]`, `start_time`, `end_time`, `active`.

## 4.3 Structure

**`areas`**: `name`, `color`, `sort_order`, `is_default`, `archived_at`.

**`seasons`**: `year`, `quarter`, `starts_on`, `ends_on`, `theme`, `review_note`, `reviewed_at`.

**`goals`**: `area_id` (optional), `title`, `why`, `anti_goals[]`, `rank` (1 = highest priority), `status` (`active`, `achieved`, `dropped`), `closed_at`, `drop_reason`.

**`season_plans`**: `goal_id`, `season_id`, `outcome`, `metric_label`, `metric_target`, `metric_current`, `starts_on`, `ends_on`, `confidence_pct` (0–100), `obstacles` (up to 3 of `{ obstacle, mitigation }`), `resolution` (`carried`, `achieved`, `dropped`; set at quarterly review), `resolved_at`.

**`major_moves`**: `season_plan_id`, `title`, `sort_order`, `status` (`open`, `done`).

**`recurrence_rules`**: `goal_id` or `area_id` (exactly one), `major_move_id` (optional), `title`, `weekdays[]`, `pomodoros`, `preferred_start` (optional), `starts_on`, `ends_on` (optional), `active`.

**`actions`**

| Field | Notes |
|---|---|
| `goal_id`, `area_id` | Exactly one is set |
| `major_move_id` | Optional, goal actions only |
| `title`, `notes` | |
| `estimate_pomodoros` | 1–40, default 1 |
| `due_on` | Optional |
| `status` | `todo`, `done`, `dropped` |
| `planned_week` | Monday of the week list it is in, or null (backlog) |
| `sort_order` | |
| `reschedule_count` | Default 0 |
| `recurrence_rule_id`, `occurrence_date` | Set for generated occurrences |
| `completed_at` | |

Completed pomodoros for an action are derived by summing its blocks.

## 4.4 Time

**`blocks`**

| Field | Notes |
|---|---|
| `action_id` | |
| `starts_at` | |
| `planned_pomodoros` | 1 to the per-block maximum |
| `ends_at` | `starts_at + planned_pomodoros × 30 min`, kept in step by `repo/` |
| `buffer_minutes` | Default from settings |
| `status` | `draft`, `scheduled`, `active`, `done`, `missed` |
| `completed_pomodoros` | Default 0 |
| `resolution` | `rescheduled` or `dropped`, for `missed` |
| `resolved_at` | |
| `origin` | `manual`, `draft`, `adhoc` |
| `off_peak` | Goal work placed outside the peak window |
| `after_due` | Placed after the action's due date |
| `replaced_by_block_id` | Links a rescheduled block to its successor |

**`focus_sessions`**: `block_id`, `action_id`, `started_at`, `ended_at`, `planned_pomodoros`, `completed_pomodoros`, `focus_seconds`, `pause_seconds`, `focus_rating` (1–5), `action_completed`, `note`, `scratchpad`, `state` (current phase and when it started, for resuming), `pomodoros` (list of `{ index, started_at, ended_at, completed }`).

## 4.5 Reflection and coaching (used from Stage 2)

**`daily_checkins`**: `date`, `energy` (1–5), `focus` (1–5), `note`, `completed_at`.

**`weekly_reviews`**: `week_start`, `wins`, `lessons`, `change_next_week`, `stats` (snapshot of the numbers), `step` (for resuming), `completed_at`.

**`compass`** (one row): `vision`, `values[]`.

**`plan_strength_snapshots`**: `season_plan_id`, `week_start`, `total`, `completeness`, `moves`, `scheduled`, `follow_through`.

**`coach_messages`**: `source` (`rule` or `ai`), `rule_code`, `goal_id`, `title`, `body`, `action_link`, `status` (`new`, `dismissed`, `done`), `valid_until`.

Streaks are computed from check-ins and focus sessions; they need no table.

## 4.6 Google (Stage 4, server-owned, pulled by the client)

**`google_calendars`**: `gcal_id`, `summary`, `color`, `mode` (`ignore`, `show`, `block`), `last_synced_at`.

**`external_events`**: `calendar_id`, `gcal_event_id`, `title`, `starts_at`, `ends_at`, `all_day`. A read cache; safe to wipe and rebuild.

---

# Part 5 · Rules

Every rule here is deterministic. Defaults are editable in Settings unless stated.

## 5.1 Time model

| Constant | Value |
|---|---|
| Pomodoro | 25 minutes focus + 5 minutes break = one 30-minute slot |
| Block length | `planned_pomodoros × 30 minutes` |
| Max pomodoros per block | 4 by default, so a block is at most 2 hours |
| Buffer after a block | 10 minutes by default, editable per block |
| Daily pomodoro cap | 10 by default, soft |
| Timeline snap | 5 minutes |
| Week | Monday 00:00 to Sunday 23:59, local time |
| Season | Calendar quarter: Q1 Jan–Mar, Q2 Apr–Jun, Q3 Jul–Sep, Q4 Oct–Dec |
| Week number in a season | Counts Monday-based weeks containing at least one day of the season. Q4 2026 has 14; 5–11 Oct 2026 is week 2 |

There is no separate long break. The buffer after each block plays that role.

An action's numbers:

- `estimate` = pomodoros the owner expects it to take
- `completed` = pomodoros finished across all its blocks
- `remaining` = `max(estimate − completed, 0)`
- `unscheduled` = `max(remaining − pomodoros in future scheduled blocks, 0)`

## 5.2 Areas

- An area has a name, a color from a fixed palette of 8 (§6.2), and a sort order.
- "Other" exists from the start and cannot be deleted or archived.
- A goal may be assigned to one area and inherits its color. A goal with no area uses the accent color.
- Archiving an area hides it from pickers; its history stays in reports. Archiving an area with open actions asks to move them first.

## 5.3 Seasons, goals, and season plans

- Seasons are created automatically, one per calendar quarter, when first needed.
- A goal holds what does not change between quarters: title, why, anti-goals, area, rank, status.
- A season plan holds what is specific to one quarter: outcome (required), optional metric (label, target, current), start and end date (required, inside the season; defaults today and the season's last day), confidence, obstacles, major moves.
- Why, anti-goals, a metric, confidence, obstacles, and 3–5 major moves are optional to save, and each adds to plan strength (§5.17).
- A goal that spans several quarters gets a new season plan each quarter, created in the quarterly review. A short goal simply ends before the quarter does.

Goal rules:

- **Concurrent goal warning.** When saving a season plan, if more than 4 active goals would overlap on any date, show a soft warning: "You'll have 5 goals running at once. Focus works better with 4 or fewer." He can continue.
- **Finishing early.** A goal can be marked achieved at any time. This closes its season plan and triggers a celebration.
- **Dropping.** A goal can be dropped at any time with an optional reason. Its future blocks are deleted and its open actions are marked dropped.
- **Priority.** Rank is set by dragging goals in the Goals list. It drives the draft scheduler.

## 5.4 Actions and the week list

- An action belongs to a goal, or directly to an area. Never neither.
- Marking an action done sets `completed_at`, deletes its future blocks, and triggers a celebration.
- If completed pomodoros reach the estimate but the action is not done, the app asks at the end of the focus session: "Done, or needs more time?" Choosing more time raises the estimate.
- An action with no `planned_week` sits in its goal's or area's backlog.
- **Week list.** An action is on a week's list when `planned_week` is that week's Monday. The tray shows this week's list filtered to actions that are `todo` with `unscheduled > 0`.
- **Week rollover.** On the first app open of a new week, if no weekly review was completed for it, every still-`todo` action from an earlier week's list moves to this week's list automatically. (Before Step 2.3 there is no weekly review, so this always applies.)

## 5.5 Recurring actions (Stage 2)

A rule has: title, goal or area, weekdays, pomodoros per occurrence, an optional preferred start time, a start date, and an end date (defaults to the season plan's end date for goal rules; open-ended for area rules).

- When a week is planned (weekly review step 3, or on the first open of the week if no review was done), each rule generates one action per matching weekday in that week, added to the week list.
- An occurrence is tied to its day. If missed, "Reschedule" only offers slots in the same week; otherwise it is dropped. Occurrences never pile up.
- Editing or pausing a rule affects future occurrences only.

## 5.6 Availability and free time

| Setting | Meaning | Default |
|---|---|---|
| Availability window | Per weekday, the hours FOQUS may schedule in | 05:00–21:00 every day |
| Peak window | Per weekday, the hours reserved first for goal work | 05:00–09:00 every day |
| Personal blocks | Recurring spans FOQUS never schedules over | None |

```
free(day) = availability window
          − personal blocks
          − blocking external events        (none before Stage 4)
          − committed FOQUS blocks and their buffers
          − (for today) anything before now, rounded up to the next 5 minutes
```

## 5.7 Blocks: states

```
          commit                start focus             finish
 draft ──────────► scheduled ──────────────► active ──────────► done
   │                   │                        │
   │ discard           │ end time passes        │ end with 0 pomodoros
   ▼                   ▼                        ▼
 (deleted)        UNRESOLVED ◄──────────── back to scheduled
                       │
                       └──► done / missed (rescheduled) / missed (dropped)
```

- `draft`: proposed by the scheduler, visible only in Plan, never sent to Google.
- `scheduled`: committed.
- `active`: a focus session is running on it.
- `done`: finished, with `completed_pomodoros` recorded (may be fewer than planned).
- `missed`: its time passed and it was resolved as rescheduled or dropped.
- **Unresolved** is derived: status `scheduled` and `ends_at` earlier than now.
- A session that ends with 0 completed pomodoros returns its block to `scheduled`. If its end time has passed, it is then unresolved.
- Manually placed blocks are committed immediately.
- Moving a block before it starts is a plain edit and does not count against follow-through. A block resolved after its end time as rescheduled or dropped counts as missed.

## 5.8 Manual scheduling rules

| Situation | Behavior |
|---|---|
| Overlaps another FOQUS block | **Not allowed.** The block snaps to the nearest free position or returns to where it was |
| Overlaps another block's buffer | Soft warning |
| Overlaps a blocking external event | Soft warning: "This overlaps Team sync (Work calendar)" |
| Overlaps a personal block | Soft warning |
| Outside the availability window | Soft warning |
| Pushes the day past the daily pomodoro cap | Soft warning: "12 pomodoros planned today. Your cap is 10" |
| Action has a due date before the block | Soft warning |
| Goal work placed outside the peak window | No warning. The block shows a small "off-peak" marker |

A soft warning is a confirm sheet stating the conflict in one sentence, with "Place anyway" and "Cancel". `lib/placement` takes a proposed block and returns either the hard-rule rejection or the list of soft warnings.

## 5.9 Focus sessions

**Starting**

- From a block: "Start focus" on the block card or sheet.
- From the center navigation button: resume the active session; otherwise start the current block or the next block if it begins within 15 minutes; otherwise open a picker of this week's actions.
- Starting an action with no block creates an ad hoc block beginning now, with 1 pomodoro (adjustable before starting).
- Starting a block early or late shifts the block to the actual start time.
- If starting now would overlap another scheduled block, ask: "This runs into Grade quizzes at 09:10. Move that block back to the tray?" with "Move it" and "Cancel". The same check applies when adding a pomodoro mid-session; there the first option is to push the next block later, if the space after it is free.
- Only one session can be active at a time.

**Running**

- Phases alternate: focus 25:00, break 05:00, focus, and so on for the planned number of pomodoros. No break after the last one.
- The next phase starts automatically by default.
- The timer is computed from stored timestamps, never from ticking, so it stays correct after backgrounding, locking, or reloading. Reopening the app returns to the running session.
- No sound, no vibration, no notification. Phase changes are visual only.
- The screen is kept awake for the whole session with the Screen Wake Lock API, re-acquired whenever the app becomes visible again. Where it is unavailable, show a one-line hint about raising Auto-Lock.
- Controls: pause and resume, skip break, add a pomodoro, end session.
- A pomodoro counts as completed when its 25 focus minutes have elapsed. Paused time does not count.
- Ending during a focus phase discards the partial pomodoro. Its minutes are still logged.

**During a session**

- **Scratchpad.** Free-text notes saved to the session and viewable later from the action.
- **Capture.** A one-line quick add that creates an area task in "Other" without leaving the session.
- The current task, its goal or area, and pomodoro progress dots are always visible.

**Away check.** If the app returns to the foreground after the whole planned time has passed, show the session as finished and ask: "You planned 3 pomodoros. How many did you complete?" The default is all of them.

**Ending.** A short reflection sheet:

1. "Is this action done?" Yes / Not yet. If not yet and the estimate is used up: "Add how many pomodoros?"
2. Focus rating, 1–5.
3. Optional one-line note.

Then the block becomes `done` with its completed count, and feedback plays (§5.19).

## 5.10 Missed-block resolver

On app open and on return to the foreground, if any block is unresolved, a sheet lists them oldest first. Each has three choices:

| Choice | Effect |
|---|---|
| **Done** | Asks how many pomodoros were completed (default: all planned). Block becomes `done`. Then asks whether the action is done |
| **Reschedule** | Offers "Next free slot" (the slot-picking rule in §5.11, for this one block), "Pick a time", or "Back to tray". The old block becomes `missed` with resolution `rescheduled`, linked to its successor. The action's `reschedule_count` goes up by 1 |
| **Drop** | Block becomes `missed` with resolution `dropped`. The action stays in the tray. A second option, "Drop the action too", marks the action dropped |

The sheet can be dismissed with "Later"; it returns on the next open. A badge on Today shows the unresolved count.

## 5.11 Slot picking and the draft scheduler

`pickSlot` places one chunk of one action. It is needed from Step 1.4 (the resolver's "Next free slot"); the weekly draft in Stage 2 is built on it. Both are pure functions: the same input always gives the same output.

```
pickSlot(item, chunk):
    candidate days = today … Sunday, on or before the due date if there is one
    skip a day if   day load + chunk > daily cap
    skip a day if   the action already has a block that day
                    (unless no other day works before the due date)

    goal action:    earliest PEAK slot across candidate days
                    else earliest non-peak slot, marked off-peak
    area task:      earliest NON-PEAK slot across candidate days
                    else earliest leftover peak slot
    recurring:      its own day only; preferred time if free,
                    else by the goal/area rule above

    if nothing fits before the due date: try days after it, marked after-due
```

A slot is a free interval (§5.6) long enough for the chunk plus its buffer. `pickSlot` never violates a soft rule from §5.8; only the owner can do that, manually.

**The weekly draft (Stage 2).** Optional, triggered by "Draft my week" in Plan or in weekly review step 4.

Input: the target week (remaining days only, when run mid-week); the week list's actions with `unscheduled > 0`, including recurring occurrences; availability, peak windows, personal blocks, blocking external events, committed blocks; settings.

Ranking:

1. Recurring occurrences, by date.
2. Goal actions, sorted by goal rank (1 first), then action due date (earliest first, none last), then season plan end date, then manual order.
3. Area tasks, sorted by due date (earliest first, none last), then manual order.

Placement:

```
for each item in ranked order:
    chunks = split item.unscheduled into pieces of at most max_pomodoros_per_block
    for each chunk:
        slot = pickSlot(item, chunk)
        if slot:      create draft block, reserve slot + buffer, add to day load
        else if a smaller chunk (≥ 1 pomodoro) fits: place it, re-queue the rest
        else:         add to "Didn't fit" with a reason
```

Output and review:

- Draft blocks appear in Plan as dashed, semi-transparent items.
- A "Didn't fit" list gives a reason per action: "No free time before due date", "Daily cap reached all week", "No free slot left".
- The owner can drag, resize, or delete draft blocks.
- **Commit** turns every draft block into a scheduled block. **Discard** deletes the draft.
- Running the draft again replaces the previous draft and leaves committed blocks untouched.
- A draft for a week with 30 actions is produced in under 1 second.

## 5.12 Capacity meter (Stage 2)

Shown in Plan and in weekly review step 3.

```
free_hours(week)    = Σ over remaining days of free time (§5.6), before FOQUS blocks
planned_hours(week) = Σ (block length + buffer) of scheduled and draft blocks
load                = planned_hours ÷ free_hours
```

| Load | Label | Color |
|---|---|---|
| Under 70% | Room to spare | Success |
| 70–90% | Full week | Warning |
| Over 90% | Overbooked | Danger |

The meter also shows the split of planned pomodoros between goal work and area tasks.

## 5.13 Google Calendar rules (Stage 4)

**Reading**

| Calendar mode | Shown in timeline | Blocks scheduling |
|---|---|---|
| **Ignore** (default for new calendars) | No | No |
| **Show** | Yes, as a faint outlined item | No |
| **Block** | Yes, as a solid grey item | Yes |

- Events are read from 7 days back to 35 days ahead; recurring events as individual occurrences.
- Cancelled events and events the owner declined are hidden.
- **All-day events** appear as a banner at the top of the day and never block, even from a Block calendar. (An all-day birthday should not wipe out a day.)
- External events are read-only in FOQUS. Tapping one shows its title, time, and calendar name.
- The FOQUS calendar is excluded from the calendar list and never read back.

**Writing**

- On connecting, FOQUS creates one dedicated calendar named "FOQUS", unless one it created already exists.
- Every committed block maps to exactly one event there.

| FOQUS change | Google result |
|---|---|
| Block committed (manual or from a draft) | Event created |
| Block moved or resized | Event updated |
| Block deleted, or resolved as rescheduled or dropped | Event deleted |
| Block done | Event title prefixed with "✓ " |
| Draft block | Nothing |

- Event title: the action title. Description: goal or area name and planned pomodoros.
- Event span: block start to block end. The buffer is not included.
- Reminders come from Google: the owner sets a default reminder on the FOQUS calendar in Google Calendar.
- Changes normally reach Google within 10 seconds while online. Failures are retried and are visible, never silent.

**Separation of truth**

- FOQUS never creates, edits, or deletes events in any calendar other than "FOQUS".
- Changes made in Google to events inside the FOQUS calendar are not read. The next push for that block overwrites them. Say so in Settings next to the Google section.
- If a blocking external event later lands on top of a committed block, the block shows a conflict badge. Nothing moves automatically.
- If Google access is revoked or expires, Settings and Today show "Reconnect Google", and the rest of the app keeps working.
- Disconnecting offers to delete the FOQUS calendar or keep it. "Resync all" in Settings rebuilds it from current blocks.

## 5.14 Daily check-in (Stage 2)

One per day, opened from Today. It becomes prominent after the day's last block ends, or after 18:00 on days with no blocks.

1. **Resolve.** Any unresolved blocks from today (the resolver, inline).
2. **Rate.** Energy 1–5 and focus 1–5, one tap each.
3. **Note.** One optional field, up to 500 characters: "Anything worth remembering about today?"
4. **Tomorrow.** A read-only preview of tomorrow's blocks and blocking events.
5. **Close.** Streak update, the day's numbers (pomodoros done vs planned), one coach line, and feedback.

A check-in can be edited until the end of the next day. Past check-ins are browsable from Coach.

## 5.15 Weekly review (Stage 2)

Available from Sunday. A card on Today and Coach prompts for it until it is done. Progress is saved between steps, so it can be left and resumed.

**Step 0 · Compass.** The vision and each active goal's why, shown before the numbers.

**Step 1 · Numbers.** For the week ending:

- Pomodoros completed vs planned
- Follow-through rate (completed ÷ planned pomodoros on ended blocks)
- Goal share (goal pomodoros ÷ all completed pomodoros)
- Hours by goal and by area (bar chart)
- Average energy and focus ratings
- Blocks rescheduled and dropped
- Per goal: plan strength change and metric progress
- Streaks

**Step 2 · Wins and lessons.** Three fields: wins, lessons, one change for next week. Up to 3 coach insights are shown beside them.

**Step 3 · Pick next week's actions.** Per goal in rank order, then per area: tick actions into the week list. Recurring occurrences are pre-selected. Unfinished actions from this week are pre-selected and marked "carried". The capacity meter updates live.

**Step 4 · Schedule.** "Draft my week" or "I'll place them myself". After commit, a completion screen with feedback.

On completion the review stores a snapshot of the numbers, so past weeks stay stable. Past reviews are browsable from Coach.

Health targets shown beside the numbers: goal share 30% or more; follow-through 70% or more.

## 5.16 Quarterly review (Stage 2)

Prompted from 7 days before the quarter ends until it is done. (For Q4 2026 the prompt starts on 24 December 2026.)

1. **Compass.** Shown first, editable in place.
2. **Season numbers.** Totals for the quarter: pomodoros, goal share, follow-through, goals achieved.
3. **Each active goal, one at a time.** Every goal must be resolved before the review can finish:

| Choice | Effect |
|---|---|
| **Carry over** | Opens the wizard's Plan steps for the new season, pre-filled. Unfinished major moves and open actions move to the new season plan |
| **Close** | Goal becomes `achieved`. Celebration |
| **Drop** | Goal becomes `dropped`, with an optional reason. Future blocks deleted |

4. **Season note.** What worked, what to change.
5. **Next season.** Add new goals through the GPS wizard. The concurrent-goal warning applies.

## 5.17 Plan strength (Stage 2)

A score from 0 to 100 for each active goal's current season plan, recalculated whenever its inputs change. Four parts of 25 points each.

**Goal completeness (25)**

| Item | Points |
|---|---|
| Outcome is filled and has a metric with a target | 10 (5 if outcome only) |
| Why is filled | 8 |
| At least one anti-goal | 7 |

**Major moves (25)**

| Item | Points |
|---|---|
| Number of moves: 0 → 0, 1–2 → 8, 3–5 → 15, 6 or more → 10 | up to 15 |
| Every open move has at least one open action | 5 |
| Confidence is 80% or higher and at least one obstacle has a mitigation | 5 |

**Scheduled versus needed (25)**

```
weeks_left   = max(1, whole weeks from this Monday to the plan's end date)
needed       = ceil(total remaining pomodoros of open actions ÷ weeks_left)
scheduled    = pomodoros in this week's blocks for the goal (scheduled + done)
score        = min(scheduled ÷ needed, 1) × 25
```

If the goal has no open actions with estimates, the score is 0 with the hint "Add sized actions".

**Follow-through (25)**

```
window     = blocks for this goal that ended in the last 14 days
rate       = Σ min(completed, planned) ÷ Σ planned
score      = rate × 25
```

If there are no ended blocks yet, the score is 12 and shows "No data yet".

**Bands:** 0–39 Weak, 40–69 Fair, 70–100 Strong.

**Improvements.** Each lost point maps to a suggestion with a link to where it can be fixed, ordered by points available. Examples:

- "Add a measurable target to your outcome (+5)"
- "Write why this goal matters (+8)"
- "Define 3–5 major moves (+7)"
- "You need about 6 pomodoros this week and 2 are scheduled (+17)"
- "Follow-through is 55% over two weeks. Try smaller blocks"

A snapshot is saved each week and shown as a small trend line.

## 5.18 Coach (Stage 2)

Insights are generated by rules, evaluated on app open and after each check-in or review. Each has a title, a body, a link to where it can be acted on, and can be dismissed. A dismissed insight does not reappear for the same trigger within 7 days. Thresholds are constants in code.

| Code | Trigger | Message (summary) |
|---|---|---|
| `GOAL_STARVED` | An active goal has 0 pomodoros scheduled this week | Give this goal at least one block |
| `LOW_GOAL_SHARE` | Goal share of planned pomodoros this week is under 30% | Most of the week is going to area work |
| `OVERBOOKED` | Load over 90%, or a day over the cap | The week is overbooked. Move or drop something |
| `LOW_FOLLOW_THROUGH` | Follow-through under 60% over 14 days | Plan fewer or smaller blocks |
| `PEAK_MISUSE` | Over half of peak-window pomodoros this week are area tasks | Peak hours are going to area work |
| `LOW_ENERGY` | Energy rated 2 or lower in 3 check-ins in a row | Plan a lighter day |
| `CHRONIC_RESCHEDULE` | An action has been rescheduled 3 or more times | Break it down, or drop it |
| `DEADLINE_RISK` | A goal's remaining pomodoros exceed the free time before its end date | The plan no longer fits. Cut scope or add time |
| `ESTIMATE_DRIFT` | The last 10 completed actions took over 150% of their estimates on average | Estimates run low. Pad them |
| `TOO_MANY_GOALS` | More than 4 goals active | Consider pausing one |
| `WEAK_PLAN` | A goal's plan strength is under 40 | Links to the top improvement |
| `MISSED_CHECKIN` | No check-in yesterday | Quick prompt to do it now |
| `REVIEW_DUE` | Weekly or quarterly review is available | Start the review |
| `STRONG_WEEK` | Follow-through at 85% or more for the week | Positive reinforcement |

**Daily brief.** A generated sentence at the top of Coach and Today: block count and pomodoros for the day, the first block and its time, the top-ranked goal's plan strength, and the single highest-priority insight.

**Principle cards.** A small built-in library of short prompts written for FOQUS in your own words (for example an if-then plan: "When ___ happens, I will ___"). One is shown per day under the brief.

**Compass.** One page with a long-term vision (free text with prompts) and an optional list of values. Each active goal's why is listed automatically below. Editable at any time from Coach.

Coach messages carry a `source` field (`rule` or `ai`) so AI-written messages can be added later without changing the screen.

## 5.19 Streaks and celebration

| Streak | Counts a day when |
|---|---|
| Check-in streak | A daily check-in was completed |
| Focus streak | At least 1 pomodoro was completed on a goal action |

| Event | Feedback | From |
|---|---|---|
| Pomodoro completed | A progress dot fills with a small burst | Step 1.4 |
| Block done | Check animation, progress bar advance | Step 1.4 |
| Action done | Confetti burst from the row | Step 1.2 |
| Goal achieved | Full-screen celebration with the goal's numbers (plain confetti until Step 2.1) | Step 1.2 |
| All of today's blocks done | "Day won" banner with confetti | Step 2.1 |
| Daily check-in completed | Streak counter animates up | Step 2.1 |
| Streak milestones (7, 30, 100 days) | Full-screen moment | Step 2.1 |
| Weekly review completed | Summary card with confetti | Step 2.3 |
| Plan strength crosses into Strong | Badge animation | Step 2.3 |

All motion respects the system "reduce motion" setting, falling back to a simple fade. Celebrations never block input for more than 2 seconds and can be tapped away.

## 5.20 Offline rules once signed in (from Step 3.3)

In Stages 1 and 2 there is no server, so everything works with no connection. From Stage 3, when signed in and offline:

| Works offline | Disabled offline, with a "You're offline" hint |
|---|---|
| Opening the app and viewing every screen | Creating or editing goals, plans, areas, actions |
| Marking blocks and actions done | Creating, moving, or resizing blocks |
| Resolving missed blocks as Done or Drop | Rescheduling to a new slot |
| A full focus session with notes and reflection | Draft scheduler, daily check-in, reviews |
| Capture during focus, and exporting a backup | Changing settings, importing, and anything involving Google |

Why restrict it when the local store could accept any edit: the owner chose this limit, and it keeps two devices from making conflicting structural edits while apart. Changes made offline are held and sent in order on reconnect. If the same row changed on the server meanwhile, the more recent change wins.

---

# Part 6 · UI

Mobile-first. The reference viewport is 390 × 844 pt. Design for one thumb first, then widen for desktop.

## 6.1 Design principles

1. **One thumb.** Primary actions sit in the lower two-thirds. Sheets rise from the bottom.
2. **The timeline is the home.** The day's timeline is the most-used surface and is always one tap away.
3. **Quiet until earned.** The interface is calm and dark; color and motion are reserved for progress and celebration.
4. **Goals look different from area work.** Goal blocks are filled; area blocks are outlined.
5. **Two taps to focus.** From opening the app to a running timer: tap "Start focus".

## 6.2 Theme tokens

Dark only. These values are a starting point and can be tuned for contrast.

| Token | Value | Use |
|---|---|---|
| `bg` | `#0E0F12` | App background |
| `surface` | `#17191E` | Cards, sheets |
| `surface-raised` | `#1F2228` | Pressed and elevated items |
| `border` | `#2A2E36` | Dividers, outlines |
| `text` | `#F2F3F5` | Primary text |
| `text-muted` | `#A0A6B1` | Secondary text |
| `text-faint` | `#6B7280` | Hints, disabled |
| `accent` | `#FFB020` | Primary buttons, now line, peak strip, goals without an area |
| `success` | `#3DDC97` | Done states, "room to spare" |
| `warning` | `#FF8A3D` | Soft warnings, "full week" |
| `danger` | `#FF5C5C` | Overbooked, conflicts, destructive actions |
| `external` | `#3A3F4A` | Blocking Google events |

**Area palette (8):** `#5B8DEF` blue · `#3DDC97` green · `#B07CFF` violet · `#FF7AA2` pink · `#4DD0E1` teal · `#FFD166` yellow · `#FF8A65` coral · `#9AA3B2` grey (default for "Other").

## 6.3 Type, shape, spacing

- One sans-serif family: the system font, or Inter bundled with the app.
- The timer and all numbers use tabular figures so digits do not shift.

| Style | Size / weight | Use |
|---|---|---|
| Timer | 88 / 600 | Focus countdown |
| Title | 24 / 700 | Screen titles |
| Heading | 18 / 600 | Card titles |
| Body | 16 / 400 | Default text and all inputs (16 minimum prevents iOS zoom) |
| Caption | 13 / 500 | Labels, metadata |

- 4 pt spacing grid. Screen side padding 16.
- Corner radius: 12 for cards, 8 for blocks, 20 for sheets, full for pills.

## 6.4 Timeline item styles

| Item | Appearance |
|---|---|
| Goal block | Filled with the goal's color, dark text |
| Area task block | Surface fill with a 2 px left edge and outline in the area color |
| Draft block | Dashed outline, 60% opacity, "draft" tag |
| Done block | 50% opacity with a check mark |
| Unresolved block | Danger-colored outline with a "?" badge |
| Conflict | Small danger triangle in the block's corner |
| Buffer | Thin diagonal-hatched tail under the block |
| Blocking Google event | Solid `external` fill, calendar name in caption |
| Non-blocking Google event | Outline only, faint text |
| All-day Google event | A banner at the top of the day |
| Personal block | Hatched span, label in faint text, not tappable |
| Outside availability | Timeline background dimmed |
| Peak window | 3 px accent strip along the left edge of the timeline |
| Now | Accent line across the timeline with a dot |

## 6.5 Pomodoro dots

Progress is shown everywhere as dots: `●●○○` means 2 of 4 completed. More than 8 collapses to `● 5/12`.

## 6.6 Navigation

```
┌─────────────────────────────────────┐
│  Today    Plan    (◉)   Goals  Coach│
└─────────────────────────────────────┘
```

| Tab | Purpose |
|---|---|
| **Today** | The day: next block, timeline, tray, prompts |
| **Plan** | The week: day timelines, capacity, draft |
| **Focus** (center, raised) | Start or resume a session |
| **Goals** | Goals by season, backlog, areas |
| **Coach** | Brief, insights, plan strength, reviews, Compass |

- **Until Step 2.3 the fifth slot is "Settings"**, because Coach does not exist yet. When Coach arrives, Settings moves to an icon in the Today header.
- While a session runs, the center button pulses and shows the remaining time.
- The Coach tab shows a dot when there are new insights or a review is due.
- A "+" in the header of Today, Plan, and Goals opens quick add.

## 6.7 Screens

The mockups show the finished app. Items marked with a later stage (sync icon, streak, daily brief, Google events) are absent until that stage.

### Login (Stage 3)

A centered card: FOQUS wordmark, email, password, "Log in". No sign-up link and no reset link. A failed login shows a generic error that does not reveal whether the email exists.

### Today

```
┌──────────────────────────────────┐
│ Mon 5 Oct         🔥12  ⟳  ⚙    │  date · streak · sync · settings
│ Q4 2026 · Week 2 of 14           │
├──────────────────────────────────┤
│ 3 blocks, 6 pomodoros today.     │  daily brief
│ First up at 05:30.               │
├──────────────────────────────────┤
│ NEXT · 05:30 – 06:30             │
│ Outline proposal section 2       │
│ Research proposal · ●●           │
│ ┌──────────────────────────────┐ │
│ │        Start focus           │ │
│ └──────────────────────────────┘ │
├──────────────────────────────────┤
│▌05:00                            │  ▌ = peak strip
│ ───●──────────── now ─────────── │
│▌05:30 ███ Outline section 2      │  goal block (filled)
│▌06:30 ░░ buffer                  │
│▌07:00 ▓▓▓ Team sync · Work       │  blocking Google event
│ 09:10 ┌─ Grade quizzes ───────┐  │  area task (outlined)
│ 10:10 └───────────────────────┘  │
│ 12:00 ╱╱╱ Lunch ╱╱╱              │  personal block
├──────────────────────────────────┤
│ Unscheduled this week (4)      ⌃ │  tray (expands upward)
├──────────────────────────────────┤
│ Today   Plan   (◉)   Goals Coach │
└──────────────────────────────────┘
```

- The header's second line shows the season and the week number within it.
- The timeline opens scrolled to now.
- Prompt cards appear between the brief and the Next card when due: unresolved blocks, daily check-in, weekly review, quarterly review, reconnect Google. At most two are shown; the rest collapse into "1 more".
- With no next block, the card reads "Nothing scheduled. Pick something from your week" with a button that opens the tray.
- When every block today is done, the card becomes the "Day won" banner.
- Dragging an action from the tray onto the timeline creates a block.

### Plan

```
┌──────────────────────────────────┐
│ ‹  5 – 11 Oct  ›              +  │
│ M   T   W   T   F   S   S        │
│ 6   4   8   12! 2   0   0        │  pomodoros per day, ! = over cap
│ ━━                               │  selected day
├──────────────────────────────────┤
│ 18 h planned of 24 h free        │  capacity meter (Stage 2)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░  75% · Full  │
│ Goals 58%  ·  Areas 42%          │
├──────────────────────────────────┤
│  (day timeline, as in Today)     │
│                                  │
├──────────────────────────────────┤
│ Tray (4)    [ Draft my week ]    │  draft button from Stage 2
├──────────────────────────────────┤
│ Today   Plan   (◉)   Goals Coach │
└──────────────────────────────────┘
```

- The week strip selects the day. Swipe the timeline left or right to change day; the arrows change week.
- The capacity meter collapses to a single bar on scroll.
- **Block sheet** (tap a block): title, goal or area, time, a pomodoro stepper, a buffer stepper, then "Start focus", "Mark done", "Delete".
- **Draft state** (Stage 2): after "Draft my week", a sticky bar replaces the tray: `12 blocks drafted · 2 didn't fit  [Discard] [Commit]`. Tapping "2 didn't fit" opens the list with reasons.

### Focus

```
┌──────────────────────────────────┐
│ ⌄                          ●●○○  │  minimise · pomodoro dots
│                                  │
│            FOCUS                 │
│                                  │
│           18:42                  │  timer
│                                  │
│   Outline proposal section 2     │
│   Research proposal              │
│                                  │
│                                  │
│  [ Notes ]        [ Capture ]    │
│                                  │
│   ⏸ Pause     +1 ●     End       │
└──────────────────────────────────┘
```

- Full screen, pure black background (`#000000`), no bottom navigation.
- A thin ring around the timer drains as the phase runs.
- **Break phase:** the label changes to BREAK, the ring and digits switch to `success`, and "Skip break" replaces "Pause".
- **Phase change:** the screen flashes softly once and the completed dot fills with a burst.
- **Notes** opens a bottom sheet with the scratchpad. **Capture** opens a one-line input.
- "⌄" minimises to the app; the session continues and the center button shows the time.
- **End sheet:** "Is this action done?" (Yes / Not yet), then focus rating (five tappable dots), then an optional note, then "Finish".

### Goals

```
┌──────────────────────────────────┐
│ Goals          Q4 2026 ▾      +  │
├──────────────────────────────────┤
│ ① Research proposal              │
│   ◐ 42%   Strong 78   ends 30 Nov│
│ ② Launch course module           │
│   ◔ 20%   Fair 55     ends 31 Dec│
│ ③ Run 10 km                      │
│   ◑ 50%   Weak 35     ends 15 Nov│
├──────────────────────────────────┤
│ Areas                            │
│ ● Work (5)  ● Teaching (3)       │
│ ● Personal (2)  ● Other (6)      │
├──────────────────────────────────┤
│ Today   Plan   (◉)   Goals Coach │
└──────────────────────────────────┘
```

- Long-press and drag a goal to change its rank.
- The progress ring shows completed ÷ estimated pomodoros for the season plan, or metric progress when a metric is set.
- The plan strength band on each card arrives in Step 2.3.
- Tapping an area opens its task list (and its recurring rules from Step 2.2).
- The season selector shows past and future seasons; past seasons are read-only.

**Goal detail** (a scrolling page):

1. Header: title, area, dates, "Achieve" and "⋯" (edit, drop).
2. Outcome and metric, with an inline "update progress" control.
3. Plan strength card: score, band, four mini-bars, top improvement, trend line. (Step 2.3)
4. Why and anti-goals (collapsible).
5. Major moves, each expandable to its actions.
6. Actions without a move.
7. Recurring actions. (Step 2.2)
8. Stats: pomodoros completed, hours, follow-through.

**GPS wizard.** Full-screen, one question group per screen, a five-segment progress bar, "Back" and "Next" at the bottom, "Save and exit" at the top. The goal is created as soon as step 1 is complete, and the wizard can be left and resumed. Each screen has a short prompt and one muted worked example under the input (templates, not AI).

1. **Goal.** Title, area (optional), outcome, optional metric, start and end date.
2. **Why.** Why it matters, and anti-goals.
3. **Plan.** 3–5 major moves.
4. **Reality check.** Confidence slider, and up to 3 obstacle and mitigation pairs. Below 80% confidence, suggest shrinking the outcome or extending the date.
5. **System.** First actions with estimates. (Recurring actions join this step in Step 2.2.)

The finish screen summarises the plan. From Step 2.3 it also shows the plan strength score and its top improvement.

### Coach (Step 2.3)

```
┌──────────────────────────────────┐
│ Coach                            │
├──────────────────────────────────┤
│ 3 blocks, 6 pomodoros today.     │
│ Research proposal is Strong (78).│
├──────────────────────────────────┤
│ ▸ "When ___ happens, I will ___" │  principle card
├──────────────────────────────────┤
│ Insights                         │
│ ! Run 10 km has no time this week│
│   [ Schedule a block ]        ✕  │
│ ! Thursday is over your cap      │
│   [ Open Thursday ]           ✕  │
├──────────────────────────────────┤
│ Plan strength                    │
│ Research proposal   ▓▓▓▓▓▓▓░ 78  │
│ Launch module       ▓▓▓▓▓░░░ 55  │
│ Run 10 km           ▓▓▓░░░░░ 35  │
├──────────────────────────────────┤
│ Weekly review        Due Sunday  │
│ Check-in history               › │
│ Compass                        › │
├──────────────────────────────────┤
│ Today   Plan   (◉)   Goals Coach │
└──────────────────────────────────┘
```

### Flows shown as full-screen steps

All share one layout: a progress bar at the top, content in the middle, one primary button at the bottom.

| Flow | Screens |
|---|---|
| Missed-block resolver | One card per block with three large buttons: Done, Reschedule, Drop |
| Daily check-in | Resolve → Rate (two rows of five dots) → Note → Tomorrow → Close |
| Weekly review | Compass → Numbers → Wins and lessons → Pick actions → Schedule → Done |
| Quarterly review | Compass → Season numbers → one screen per goal → Season note → Next season → Done |
| First-run setup | Availability → Peak → Personal blocks → Areas → Google (added in Step 4.1) → Compass → First goal |

- **Weekly review, Numbers:** a large follow-through percentage, pomodoros done vs planned, goal share as a two-part bar, a horizontal bar chart of hours per goal and area, average energy and focus.
- **Weekly review, Pick actions:** a checklist grouped by goal (in rank order) then by area, with the capacity meter pinned at the bottom.

### Compass (Step 2.3)

A single reading page: the vision in large text, values as pills, then each active goal with its why. An "Edit" button turns the page into a form.

### Settings

A grouped list:

- **Schedule:** availability window and peak window per weekday (each with "copy to all days"), personal blocks.
- **Focus:** max pomodoros per block, daily cap, default buffer, auto-start next phase, time zone.
- **Areas:** create, rename, recolor, reorder, archive.
- **Data** (Step 1.5): export, import, storage use.
- **Google Calendar** (Stage 4): connect, each calendar with a three-way control (Ignore · Show · Block), resync, disconnect.
- **Account** (Stage 3): signed-in email, sync status, log out.

Changes apply immediately.

### Quick add

A bottom sheet with the keyboard open: a title field, then a row of chips: goal or area (default "Other"), estimate (default `●`), due date, "This week" toggle. "Add" and "Add another". Adding a task with only a title takes under 10 seconds.

## 6.8 Gestures

| Gesture | Where | Result |
|---|---|---|
| Tap | Block | Open block sheet |
| Long-press + drag | Block | Move (snaps to 5 minutes) |
| Drag bottom handle | Block | Resize in whole pomodoros |
| Drag | Tray action → timeline | Create a block |
| Tap | Empty slot | "Add block here" → action picker |
| Swipe left/right | Timeline | Previous or next day |
| Swipe right | Action row | Mark done |
| Swipe left | Action row | Schedule |
| Long-press + drag | Goal card | Change rank |
| Pull down | Today, Plan | Refresh (sync from Stage 3, Google events from Stage 4) |
| Swipe down | Any sheet | Dismiss |

While dragging a block, the timeline auto-scrolls near its edges, the target time shows in a floating label, and positions that overlap another FOQUS block tint red. Every drag has a tap alternative through the block sheet.

## 6.9 States

| State | Treatment |
|---|---|
| Empty: no goals | Illustration and "Set your first goal", opening the wizard |
| Empty: no blocks today | "Nothing scheduled" card with a link to the tray |
| Empty: tray | "Everything this week has a time" in success color |
| Loading | Skeleton cards; the timeline shows local data immediately |
| Offline (Stage 3) | A slim banner under the header: "Offline · 2 changes waiting". Disabled controls explain why |
| Sync pending (Stage 3) | The header sync icon spins |
| Sync failed (Stage 3) | The header sync icon turns danger; tapping it shows the reason and "Retry" |
| Google disconnected (Stage 4) | A card on Today: "Reconnect Google to keep your calendar in sync" |
| Error | A toast with a plain sentence and "Retry" where possible |

## 6.10 iPhone specifics

- Installed to the home screen and run standalone, with its own icon and splash screen.
- Layout uses the safe-area insets for the notch and home indicator.
- Heights use dynamic viewport units so the bottom navigation is never hidden.
- Inputs are at least 16 pt to prevent zoom on focus.
- The browser's own pull-to-refresh and overscroll bounce are disabled inside the timeline.
- No reliance on vibration, background audio, or background timers, which web apps on iPhone do not get.
- The Screen Wake Lock API works in home-screen web apps from iOS 18.4. On older versions, show the Auto-Lock hint.
- Storage for a home-screen web app is separate from Safari's. Data entered in a Safari tab does not appear in the installed app.

## 6.11 Desktop (1024 px and wider, Step 2.4)

Until Step 2.4, desktop shows the mobile layout centered in a phone-width column.

- Bottom navigation becomes a left sidebar; Focus is a button at the top of it.
- **Plan** shows all seven days as columns, with the tray as a right-hand panel and the capacity meter above.
- **Today** shows the timeline on the left and the Next card, brief, and prompts on the right.
- **Goals** shows the list on the left and goal detail on the right.
- Sheets become centered dialogs.
- Keyboard: `N` quick add, `F` start focus, `T` today, `←` `→` change day, `Space` pause or resume in Focus.

## 6.12 Accessibility

- Text contrast at least 4.5:1 against its background.
- Block type is never shown by color alone: fill, outline, dashes, and hatching carry the meaning.
- All controls have text labels for screen readers.
- Focus order follows the visual order; sheets trap focus while open.

---

# Part 7 · Build plan

Fifteen steps in four stages. Each step lists what to build and how to tell it is done. "Owner checks" are things only he can verify on his iPhone.

The order is deliberate: Stages 1 and 2 build the entire app against the local store with no server at all, Stage 3 adds login and the database underneath it, and Stage 4 adds Google Calendar.

## Stage 1 · Local MVP

**Goal:** the owner can set goals, plan a day, and run focus sessions on his iPhone, with all data in the browser. No account, no server data, no Google.

There is no password in Stages 1 and 2 and none is needed: the deployed site holds no data, so anyone opening the URL gets their own empty app. Protection arrives with the database in Stage 3.

### Step 1.1 · Foundation

Build:

- Project scaffold: Next.js, TypeScript strict, Tailwind with the tokens from §6.2 and §6.3, lint, Vitest. `CLAUDE.md` (§1.3), `PROGRESS.md`, a README with the commands, `.env.example` (empty for now).
- The app shell: dark theme, bottom navigation with Today, Plan, Focus, Goals, and Settings in the fifth slot (§6.6), safe-area handling, an empty state on each screen.
- `types/` for the whole data model (Part 4).
- The local database, `repo/` with create, update, and soft-delete that maintain the sync metadata (§3.2), and `data/` read hooks.
- First-run seeding: the settings row, seven availability windows, seven peak windows, and the "Other" area, all with their deterministic ids.
- `lib/time`: day, week, quarter, and week-number math in the settings time zone.
- Settings → Focus section (§6.7), reading and writing the settings row.

Done when:

- Typecheck, lint, tests, and production build pass, and the app deploys to Vercel with no environment variables.
- `lib/time` tests cover: Q4 2026 runs 1 Oct to 31 Dec and has 14 weeks; 5–11 Oct 2026 is week 2; a moment at 23:30 UTC on a Sunday falls on Monday in Asia/Jakarta.
- Changing a setting survives a reload, and the stored row has a fresh `updated_at` and `_dirty` of 1.
- No component imports the database directly.

### Step 1.2 · Areas, goals, and actions

Build (§5.2–§5.4, §6.7 Goals):

- Areas: create, rename, recolor, reorder, archive, in Settings → Areas, with area chips on the Goals screen opening each area's task list.
- Seasons created on demand; the season selector.
- The Goals list with rank by drag, goal cards (title, area color, progress ring, end date), and the empty state.
- The GPS wizard, five steps, resumable.
- Goal detail: sections 1, 2, 4, 5, 6, and 8.
- Achieve and drop for goals. The concurrent-goal warning.
- Actions: quick add (§6.7), edit, reorder, move between goals, areas, and moves, mark done, drop, pomodoro dots, the "This week" toggle, swipe right to mark done.
- A shared `celebrate()` helper: confetti on action done and on goal achieved, respecting reduce-motion.

Done when:

- A goal can be created through the wizard, left halfway, and resumed.
- Saving a fifth overlapping active goal shows the soft warning and still allows saving.
- Dropping a goal marks its open actions dropped.
- Quick add with only a title lands in "Other" with an estimate of 1.
- Deleted items are soft-deleted and disappear from every list.

### Step 1.3 · Time blocking

Build (§5.6–§5.8, §6.4, §6.7 Today and Plan, §6.8):

- Settings → Schedule: availability, peak window, personal blocks.
- `lib/availability` (free intervals per day, taking external events as a parameter) and `lib/placement` (hard rule and soft warnings), both with tests.
- The timeline component with every non-Google item style from §6.4.
- Today: header with the date and the season and week number (for example "Q4 2026 · Week 2 of 14"), the Next card with its empty state, the timeline scrolled to now, the tray.
- Plan: week strip with per-day pomodoro counts and over-cap highlight, day timeline, day and week navigation, the tray.
- Blocks: create by dragging from the tray or tapping an empty slot; move by long-press drag; resize by the bottom handle; 5-minute snap; the block sheet; buffers.
- Swipe left on an action row opens scheduling for that action.
- Week rollover (§5.4).

Done when:

- `lib/placement` tests cover every row of the table in §5.8, including that an overlap with another block is rejected, not warned.
- `lib/availability` tests cover a personal block, a committed block with its buffer, and "today before now".
- A block dragged onto another block snaps away or returns; a block dragged onto a personal block shows the confirm sheet and can be placed.
- Goal work outside the peak window shows the off-peak marker without a warning.
- An action whose remaining pomodoros are all scheduled leaves the tray.

Owner checks: dragging and resizing feel smooth on the iPhone, and scrolling the timeline does not accidentally start a drag.

### Step 1.4 · Focus and the resolver

Build (§5.9–§5.11, §6.7 Focus):

- `lib/timer`: given session state and now, return phase, seconds remaining, and completed count. Tests cover pause, skip break, add a pomodoro, a reload mid-phase, and a return after the whole planned time.
- The Focus screen and all three ways to start. The center button shows remaining time while a session runs.
- Wake lock, scratchpad, capture, away check, the overlap check on start and on adding a pomodoro, the end sheet.
- `lib/scheduler.pickSlot` for one block, with tests.
- The missed-block resolver and the unresolved badge and prompt card on Today.
- Feedback: dot fill on a completed pomodoro, check animation on a done block.

Done when:

- A session survives a reload and resumes at the right second.
- Ending a session with 0 pomodoros returns the block to `scheduled`.
- Reaching the estimate without finishing asks "Done, or needs more time?" and raises the estimate when asked.
- An unresolved block produces the resolver on next open; each of Done, Reschedule (all three options), and Drop leaves the data as §5.10 describes, including `reschedule_count` and the successor link.
- Capture during focus creates a task in "Other".

Owner checks: start a 1-pomodoro session, lock the phone for ten minutes, unlock, and confirm the timer is right. Run a full pomodoro with the app open and confirm the screen stays awake and the phase change is visible.

### Step 1.5 · Install, offline shell, and backup

Build (§6.10):

- Web app manifest, icons (a simple FOQUS wordmark on the background color is fine), Apple touch icon, splash, standalone display, theme color.
- A service worker that precaches the app shell and every screen, so the installed app opens with no network. Include an update path: when a new version is available, offer "Reload to update".
- Ask the browser for persistent storage.
- Settings → Data: export everything to one JSON file; import from a file (validated, replaces current data after a confirmation, and soft-deletes rows that are not in the file so the replacement can sync later); a line stating that until an account is connected, data lives only on this device.
- An iPhone pass over every screen: safe areas, viewport height, input sizes, overscroll.

Done when:

- Export followed by import into a fresh browser profile reproduces the same data, with matching row counts per table.
- With the network disabled, the installed build opens and every Stage 1 feature works.
- An invalid import file is rejected with a clear message and changes nothing.

Owner checks: add the app to the home screen from Safari **before** entering real data; open it in airplane mode; export a backup and confirm the file saves.

**Stage 1 exit:** the owner uses the app for real for a few days. Ask him what feels wrong before starting Stage 2, and record changes in `PROGRESS.md`.

## Stage 2 · Complete the loop

**Goal:** the reflection and planning features that turn a timeline with a timer into the full system. Still no server: everything in this stage reads and writes the local store, through the same `repo/` and `data/` layers as Stage 1.

Data still lives only on the device throughout this stage. At the end of every step, remind the owner to export a backup (Settings → Data).

### Step 2.1 · Daily loop

Build (§5.14, §5.19):

- The daily check-in flow and its prompt card on Today; check-in history (reachable from Settings until Coach exists).
- `lib/streaks` with tests; streaks in the Today header.
- The remaining celebrations: "Day won", streak roll-up, streak milestones, the full-screen goal-achieved moment.

Done when:

- The check-in becomes prominent after the last block ends, or after 18:00 on a day with no blocks, and can be edited until the end of the next day.
- Streak tests cover a gap day and the time-zone boundary at midnight.
- With reduce-motion on, every celebration is a short fade.

### Step 2.2 · Planning help

Build (§5.5, §5.11, §5.12):

- `lib/capacity` with tests, and the capacity meter in Plan.
- Recurring actions: rule editor, weekly generation with deterministic ids, the repeat icon, same-week reschedule only; the recurring option in wizard step 5 and goal detail section 7.
- The weekly draft: `lib/scheduler` ranking and placement on top of `pickSlot`, draft blocks in Plan, the sticky draft bar, "Didn't fit", Commit and Discard.

Done when:

- Scheduler tests cover: goal rank order, peak-first placement for goal work and non-peak-first for area tasks, the daily cap, splitting an 8-pomodoro action into two blocks on different days, a due date that cannot be met (marked after-due or listed in "Didn't fit" with a reason), and determinism (same input, same output).
- The draft never overlaps blocking events, personal blocks, other blocks or buffers, never leaves the availability window, and never exceeds the daily cap.
- Draft blocks keep the status `draft` until Commit, and Discard removes every one of them.
- Opening the app twice on a Monday generates each recurring occurrence once.

### Step 2.3 · Reviews and coach

Build (§5.15, §5.17, §5.18, §6.7 Coach and Compass):

- `lib/plan-strength`, `lib/stats`, and `lib/coach`, each with tests.
- Plan strength on goal cards, the goal detail card, and the wizard's finish screen; the weekly snapshot and trend line.
- Compass.
- The weekly review flow, its prompt cards, and the stored snapshot.
- The Coach tab: daily brief, principle card, insights with dismissal, plan strength list, entry points. Settings moves to the Today header icon. The daily brief also appears on Today.

Done when:

- Plan-strength tests reproduce each part's table in §5.17, the "no data yet" case (12), and the "no sized actions" case (0).
- Each coach rule in §5.18 has a test that triggers it and one that does not.
- A dismissed insight stays away for 7 days for the same trigger.
- The weekly review can be left at any step and resumed, and a completed review's numbers do not change when later data changes.

### Step 2.4 · Completion

Build (§5.16, §6.11):

- The quarterly review flow and its prompt.
- First-run setup (§6.7 flows), shown when the app has no data; every step but availability can be skipped; it can be resumed. Leave out the Google step for now; it is added in Step 4.1.
- The desktop layout and keyboard shortcuts.

Done when:

- The quarterly review cannot finish until every active goal is carried over, closed, or dropped; carrying over creates the next season's plan and moves unfinished moves and open actions.
- The review prompt for Q4 2026 first appears on 24 December 2026 (test with an injected date).
- At 1024 px and wider, Plan shows seven day columns and the keyboard shortcuts work.

The quarterly review should be in the owner's hands before 24 December 2026. If the schedule is tight, build it before the other Step 2.4 items.

**Stage 2 exit:** every feature of FOQUS except login, sync, and Google now works on the device. The owner uses it through at least one weekly review. Ask him what to change before starting Stage 3, because changes to the data model are cheapest now, before a server schema exists.

## Stage 3 · Database and login

**Goal:** data is stored in Supabase behind a password and stays in step across the iPhone and a laptop.

**Owner tasks first:** create a Supabase project in the Singapore region; switch public sign-ups off; create his user with email and password; put the project URL and publishable key in `.env.local` and in Vercel.

### Step 3.1 · Schema and login

Build (§3.5):

- A SQL migration in `supabase/migrations/` creating every synced table from Part 4, with the server columns, row-level security policies, the `synced_at` trigger, and the stale-write guard. Every one of these tables already exists in the local store, so the migration mirrors the types in `types/` exactly. Tell the owner how to apply it.
- The Supabase browser client.
- The login screen (§6.7) and the client gate: no session, only login.
- Settings → Account: signed-in email and "Log out".

Done when:

- With no session, the app shows only the login screen.
- A query made without a session returns no rows from any table; include a script or test that proves it.
- A wrong password shows the generic error.
- The session survives closing and reopening the installed app.

### Step 3.2 · Sync

Build (§3.5):

- `lib/merge` with tests covering: new server row, clean local row overwritten, dirty local row that is newer, dirty local row that is older, and a server tombstone.
- The sync cycle and its triggers. One cycle at a time.
- The first-sign-in choice for a device that already has data.
- The header sync icon with its idle, syncing, pending, and failed states (§6.9), and "Retry".
- Logout clears the local database, warning first if changes are unsynced.

Done when:

- Signing in on the device used through Stages 1 and 2 uploads its data; row counts on the server match an export taken just before.
- With two browser profiles signed in, a change in one appears in the other after it returns to the foreground.
- A row deleted on one device disappears on the other.
- A push made with an older `updated_at` than the server's does not overwrite the server row.
- Killing the network mid-sync loses nothing: the rows stay dirty and go up on the next cycle.

### Step 3.3 · Offline rules

Build (§5.20, §6.9):

- Online and offline detection, the offline banner with the count of waiting changes.
- A single guard that the `repo/` functions consult, so the allowed and disabled lists in §5.20 are enforced in one place and the UI can ask it why a control is disabled.

Done when:

- Offline and signed in: a block can be marked done, a missed block resolved as Done or Drop, and a full focus session run, including capture; creating a goal or moving a block is disabled with the hint.
- On reconnect, the waiting changes sync in order and the banner clears.
- Export and import still work, and an import made while signed in reaches the other device.

Owner checks: use the phone in airplane mode for a focus session, reconnect, and confirm the laptop shows it.

## Stage 4 · Google Calendar

**Goal:** real commitments from Google show on the timeline and shape free time; FOQUS blocks appear in a dedicated Google calendar.

**Owner tasks first:** create a Google Cloud project; enable the Calendar API; configure the OAuth consent screen and publish it to production (§3.6); create a web OAuth client with redirect URIs for local development and the Vercel domain; add the Google client id and secret, the Supabase secret key, a token encryption key, a cron secret, and the app base URL to `.env.local` and Vercel. Give him a checklist with the exact values to enter.

### Step 4.1 · Connect

Build (§3.6):

- A migration for `google_accounts`, `sync_outbox`, `google_calendars`, and `external_events`.
- The bearer-token check shared by every `/api/google/*` route.
- Connect, callback, status, calendars, and disconnect routes. Token encryption. Creation of the "FOQUS" calendar.
- Settings → Google Calendar: connect, the calendar list with Ignore · Show · Block, the note about edits made in Google (§5.13), disconnect with the keep-or-delete choice.
- The "Reconnect Google" state in Settings and on Today.
- The Google step in first-run setup (connect and choose calendar modes), skippable like the others.

Done when:

- A route called without a valid session is refused.
- After connecting, a "FOQUS" calendar exists in Google and is absent from the list in Settings.
- Only the three scopes in §3.6 are requested.
- The refresh token is stored encrypted and never appears in a response or in the browser.

### Step 4.2 · Read external events

Build (§5.13 reading, §6.4):

- The pull route and its triggers, including pull to refresh.
- `external_events` reaching the device through the sync pull.
- Timeline rendering for blocking events, non-blocking events, and all-day banners; the tap-to-view sheet.
- External events passed into `lib/availability` and `lib/placement`: blocking events remove free time and raise the soft warning.
- The conflict badge on a block that a blocking event now overlaps.
- Blocking events passed into everything Stage 2 built on free time: the weekly draft, the capacity meter, the `DEADLINE_RISK` coach rule, and the check-in's preview of tomorrow.

Done when:

- An event in a Block calendar appears solid and removes that time from "Next free slot"; the same event in a Show calendar appears outlined and removes nothing; in an Ignore calendar it does not appear.
- An all-day event shows as a banner and blocks nothing.
- An event deleted or declined in Google disappears after the next pull.
- Placing a block over a blocking event shows the warning naming the event and its calendar.
- "Draft my week" places nothing on top of a blocking event, and the capacity meter's free hours drop by that event's length.

### Step 4.3 · Write blocks

Build (§3.6 writing, §5.13 writing):

- The outbox trigger, the push route with state-based reconciliation, retries with backoff, and the reconnect state on authorization errors.
- The client's post-sync call to push, and pending and failed Google states in the header sync icon.
- "Resync all".
- The scheduled route with its secret, and a daily cron entry. Ask the owner whether he wants the more frequent option (§3.6).

Done when:

- Creating, moving, resizing, completing, and deleting a block each produce the matching change in the FOQUS calendar (§5.13 table), and the event spans the block without its buffer.
- Pushing the same block twice creates one event.
- A draft block creates no event; committing the draft creates one event per block.
- With Google access revoked, the app keeps working, shows "Reconnect Google", and sends the queued changes after reconnecting.
- No request is ever made to write to a calendar other than "FOQUS".

Owner checks: commit a block on the phone and see it in Google Calendar; set a default reminder on the FOQUS calendar in Google and confirm it fires.

---

# Part 8 · Not in scope

Do not build these. Several are deliberate omissions the owner chose.

- AI planning or coaching, and voice input. (The `source` field on coach messages is the only preparation.)
- App or website blocking, focus music, any sound or vibration.
- Push notifications.
- Two-way calendar sync; Apple or Outlook calendars; Slack or meeting-note integrations.
- More than one user, sign-up, payments.
- A light theme; languages other than English.
- Native apps.
- A password-reset flow in the app.
