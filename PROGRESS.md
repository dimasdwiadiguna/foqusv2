# FOQUS — Progress

Spec and plan: `BRIEF.md` (the brief's own instructions call it `FOQUS-BUILD-BRIEF.md`; in this repo it is `BRIEF.md`).

## Steps

| Step | Status |
|---|---|
| 1.1 Foundation | Done; waiting for the owner to deploy to Vercel and check |
| 1.2 Areas, goals, and actions | Next |
| 1.3 Time blocking | Not started |
| 1.4 Focus and the resolver | Not started |
| 1.5 Install, offline shell, and backup | Not started |
| 2.1 Daily loop | Not started |
| 2.2 Planning help | Not started |
| 2.3 Reviews and coach | Not started |
| 2.4 Completion | Not started |
| 3.1 Schema and login | Not started |
| 3.2 Sync | Not started |
| 3.3 Offline rules | Not started |
| 4.1 Connect | Not started |
| 4.2 Read external events | Not started |
| 4.3 Write blocks | Not started |

### Step 1.1 · Foundation — what exists

- Next.js 16 (App Router), TypeScript strict, Tailwind v4 with §6.2/§6.3 tokens, ESLint, Vitest.
- App shell: dark theme, bottom nav (Today · Plan · Focus (raised) · Goals · Settings), safe areas, `100dvh`, an empty state on every screen. Today shows the date and "Q4 2026 · Week 2 of 14"; Plan shows the week range.
- `types/`: every table in Part 4, plus a `Tables` map.
- `db/`: Dexie database with all 20 tables (every table indexes `_dirty` and `updated_at` for Stage 3), first-run seeding with deterministic ids.
- `repo/`: `createRow`, `updateRow`, `softDelete`, `updateSettings`; all maintain the sync metadata.
- `data/`: `useSettings`, `useRow`, `useRows`, `useToday`, `useNow`, `useDbReady`.
- `lib/time` (with tests) and `lib/settings` (validation, with tests).
- Settings → Focus: pomodoros per block, daily cap, default buffer, auto-start next phase, time zone.
- Checked in headless Chromium at iPhone size: changing settings survives a reload, the row has a fresh `updated_at` and `_dirty: 1`, no console errors.

## Decisions

Choices made where the brief was silent.

- **Brief file name.** `CLAUDE.md` and this file point to `BRIEF.md`, the name it has in this repo.
- **Settings ranges.** Pomodoros per block 1–8; daily cap 1–32; buffer 0–60 min in steps of 5. Numbers outside a range are clamped, not rejected.
- **`focus_minutes` / `break_minutes`** are stored (Part 4) but not shown in Settings. §5.1 fixes a pomodoro at 25 + 5 = one 30-minute slot that block lengths depend on, so `repo/` rejects any other value.
- **Time zone picker** lists the browser's `Intl.supportedValuesOf("timeZone")`, always including the current value.
- **Today header** already shows the date and season week in Step 1.1. It has no controls, so nothing is built ahead of its step; it makes `lib/time` visible on the phone.
- **Seeding** runs on every app open and adds only rows that are missing (a soft-deleted seed row is not re-created). Seeded rows are `_dirty: 1` so Stage 3's first sync uploads them.
- **Seasons are not seeded**; Step 1.2 creates them on demand.
- **`/` redirects to `/today`** through `next.config.ts`.
- **Errors inside Dexie transactions** come back wrapped, so `repo/` signals "not found" outside the transaction and throws `NotFoundError` there.
- **Desktop** (until Step 2.4): the mobile layout in a centered 480 px column.
- **The Tailwind default palette is removed**, so only the brief's tokens can be used.
- **Contrast.** `text-faint` (#6B7280) measures 3.6–4.0:1 on the backgrounds, under the 4.5:1 bar, so it is used only for disabled controls. Hints use `text-muted` (7.2:1 on surface).
- **`CLAUDE.md` includes the Next.js agent-rules block.** `next dev` inserts it automatically when it is missing, so committing it keeps the working tree clean.
- **Lint-enforced layering.** `app/` and `components/` may not import `db/` or Dexie. `lib/` may not import db, repo, data, or React.

## Deviations

- None.

## Owner tasks

- Before Step 1.2: import the repository into Vercel (default Next.js settings, no environment variables) and open the deployed URL on the iPhone. Check that the bottom nav clears the home indicator, that the date header shows the correct Jakarta date, and that a Settings change survives closing and reopening the tab.
