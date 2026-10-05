# FOQUS — Progress

Spec and plan: `BRIEF.md` (the brief's own instructions call it `FOQUS-BUILD-BRIEF.md`; in this repo it is `BRIEF.md`).

## Steps

| Step | Status |
|---|---|
| 1.1 Foundation | Done; owner checked |
| 1.2 Areas, goals, and actions | Done; waiting for the owner to check on the iPhone |
| 1.3 Time blocking | Next |
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

### Step 1.2 · Areas, goals, and actions — what exists

- Settings → Areas: create (8-color palette), rename, recolor, reorder by long-press, archive (moving open tasks first; "Other" cannot be archived), restore.
- Goals: season selector (existing seasons plus current and next; past ones read-only), goal cards (rank, title, area color, progress ring, end date), rank by long-press drag, closed goals section, empty state opening the wizard, area chips with open-task counts opening each area's task list.
- GPS wizard at `/goal-setup`: five steps plus a summary, progress bar, Back/Next, "Save and exit", muted worked examples. The goal is created on step 1; "Continue setting up" on Goals resumes it. The concurrent-goal warning shows on saving step 1, with "Save anyway".
- Goal detail: header with Achieve and ⋯ (Edit, Drop with reason, Delete), outcome and metric with inline update, why and anti-goals (collapsible), major moves with their actions (add, remove, mark done), other actions, stats.
- Actions: quick add (the "+" on Today, Plan, Goals, and area pages), edit sheet (move between goals, areas, and moves; estimate; due date; This week; done, drop, delete), reorder by long-press, swipe right or tap the circle to mark done, pomodoro dots.
- `celebrate()`: confetti for an action done and a full-screen burst for a goal achieved; with reduce-motion on, a short fade.
- Tests: `lib/actions`, `lib/goals`, `lib/order`, `lib/areas`, `lib/goal-setup`, plus repo tests for every Step 1.2 "done when" item. Also driven end to end in Chromium at iPhone size, including CDP touch for swipe and long-press reorder.

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
- **Wizard progress is a device-local bookmark** (`localStorage`, `data/goal-setup.ts`). It holds only which goal and step to resume. The goal itself is saved through `repo/` from step 1, so no column was added to the data model. In Stage 3 the "Continue setting up" card will not follow the owner to another device.
- **Editing a goal reuses the wizard** (`mode=edit`), returning to goal detail.
- **Concurrent-goal warning** fires when saving step 1 for a new goal, or when an edit changes the dates. "Active" means the goal is active and its season plan unresolved. A goal with two plans counts once per date.
- **Goal progress ring** without a metric: completed ÷ estimated pomodoros over the goal's actions that are not dropped. A done action counts as fully complete.
- **Goal stats** cover all of the goal's non-draft blocks. Follow-through is completed ÷ planned on ended blocks, and shows "—" until a block has ended.
- **Ranks** are renumbered 1…n across all active goals when one season's list is reordered. Goals not shown keep their places (`lib/order.reorderSubset`). New goals go last.
- **Delete goal** (in ⋯) soft-deletes the goal, its plans, moves, actions, and their blocks. It exists for goals created by mistake; Drop keeps history.
- **Removing a major move** keeps its actions on the goal, without a move.
- **Quick add defaults "This week" on** when opened from Today or Plan, and off elsewhere. Items added this way are visible in the area or goal lists; the tray arrives in Step 1.3.
- **Season rows** are created when a goal is first planned in a season, not when the season is merely selected.
- **Libraries.** `@dnd-kit/core` 6 + `@dnd-kit/sortable` 10 (stable; `@dnd-kit/react` is still 0.x). `canvas-confetti`, bundled, so no third-party script loads at runtime. Touch drag starts after a 300 ms hold; mouse drag after 6 px; keyboard via each row's grip.
- **Deterministic ids** moved to `lib/ids.ts` so components can use them without importing `db/`.
- **Lint-enforced layering.** `app/` and `components/` may not import `db/` or Dexie. `lib/` may not import db, repo, data, or React.

## Deviations

- None.

## Owner tasks

- Before Step 1.3, on the iPhone:
  - Create a goal, leave the wizard at step 2 or 3 with "Save and exit", then continue it from Goals.
  - Press and hold a goal card, then drag to change its rank. Check that scrolling the list does not start a drag.
  - Swipe an action row right to mark it done, and check the confetti.
  - Quick add from Today: the keyboard should open with the sheet.
