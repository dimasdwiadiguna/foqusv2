# FOQUS

FOQUS is a personal, mobile-first PWA for one owner on an iPhone. It connects quarterly goals to a weekly plan, the plan to time blocks on a day timeline, and each block to a pomodoro focus session; check-ins and reviews feed a rule-based coach. It is local-first: IndexedDB holds the working copy and the UI only ever talks to it. Supabase sync (Stage 3) and Google Calendar (Stage 4) are added underneath later without rewriting the UI.

**Start every session by reading `PROGRESS.md`, then the parts of `BRIEF.md` the next step points to.** `BRIEF.md` is the full spec and build plan; it is long, so read only the sections you need. Build one step per session, then stop.

## Commands

- `npm run dev` — dev server
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
- `npm run check` — all four; must pass before a step is done

## Layout

- `types/` — the whole data model (BRIEF Part 4). `Tables` maps table name → row type.
- `db/` — Dexie database, schema, seeding. Only `db/`, `repo/`, `data/` may import it.
- `repo/` — the only code that writes. `createRow`, `updateRow`, `softDelete`, plus domain functions.
- `data/` — read queries and live hooks (`useSettings`, `useRow`, `useRows`, `useToday`, `useNow`).
- `lib/` — pure logic with unit tests next to it (`*.test.ts`). No db, repo, data, or React. Deterministic ids live in `lib/ids.ts`.
- `test/` — Vitest setup (fake IndexedDB) and `freshDb()` for repo tests.
- `app/(app)/<screen>/` — tabbed screens; `app/(flows)/` — full-screen flows (wizard). Detail pages use query params (`/goals/goal?id=`) so every route stays static.
- `components/` — UI pieces. `ui/Sheet`, `ui/Sortable`, `ui/SwipeRow` are the shared interaction primitives; `actions/QuickAdd` is global (`useQuickAdd()`); `celebration/celebrate`.
- `components/timeline/` — `DayTimeline`, `TimelineBoard` (timeline + tray), and `PlacementProvider` (`usePlacement()`: every block create/move/resize goes through `place()`, which applies §5.8: snap on overlap, confirm soft warnings). Drags use `useDragGesture` (long-press on touch).
- `components/focus/` — `useStartFocus()` (start with the clash question), the Focus screen (`app/(flows)/focus`), `EndSheet`. The timer is always `lib/timer.timerAt(session, now)`; never store ticking state. `components/resolver/` — the missed-block resolver overlay.
- `components/checkin/` — the daily check-in flow (`app/(flows)/checkin`), Today's `PromptCards`, `StreakBadges`. `lib/streaks`, `lib/checkin`. Full-screen celebrations: `celebration/Moments` (`showMoment`, mounted in the root layout).
- Planning (Step 2.2): `lib/recurrence` + `repo/recurrence` (occurrences `<rule_id>:<date>`, generated on open in `data/ready`), `lib/draft` + `repo/draft` (weekly draft on `lib/scheduler.pickSlot`), `lib/capacity`. UI: `components/recurrence/`, `timeline/DraftBar`, `timeline/CapacityMeter`.
- PWA: `app/manifest.ts`, `app/sw.js/` (service worker source, versioned per build; every new route goes in its `ROUTES`), `components/shell/ServiceWorker.tsx` (registers in production only; "Reload to update"). Icons and splashes: `node scripts/make-icons.cjs`. Backups: `lib/backup` (format, validation), `data/getBackup`, `repo/importBackup`.

## Conventions (BRIEF §3.2, §3.3)

1. One write path: components never touch the database (ESLint enforces it). Writes via `repo/`, reads via `data/`.
2. Ids are client-generated: `crypto.randomUUID()`, or the deterministic ids in BRIEF §4.1. Block ids are always random UUIDs.
3. Every row has `created_at`, `updated_at`, `deleted_at`, `_dirty`; `repo/` maintains them. Never clear `_dirty` before Stage 3.
4. No hard deletes. `softDelete` sets `deleted_at`; reads filter it out.
5. `lib/` functions take data and "now" as arguments; they never read the database or the clock.
6. `lib/availability` takes external events as a parameter (empty until Stage 4).
7. Instants are UTC ISO strings; dates `YYYY-MM-DD`; times `HH:MM`; weekdays 1 (Mon)–7 (Sun).
8. All day/week/quarter math goes through `lib/time` with the time zone from settings, never the device's.
9. Dexie schema changes add a new `version()`; never edit a shipped version in place.

## Stack and style

Next.js App Router + TypeScript strict, Tailwind v4 (tokens in `app/globals.css`, default palette removed), Dexie + dexie-react-hooks, Vitest. Dark only. System font, tabular numbers. Inputs ≥ 16 px, touch targets ≥ 44 pt. `text-faint` fails 4.5:1 contrast: use it only for disabled states, never for readable text. No analytics, third-party scripts, or remote fonts. No dead buttons or "coming soon": a screen shows only what its step builds.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
