# FOQUS — Progress

Spec and plan: `BRIEF.md` (the brief's own instructions call it `FOQUS-BUILD-BRIEF.md`; in this repo it is `BRIEF.md`).

## Steps

| Step | Status |
|---|---|
| 1.1 Foundation | Done; owner checked |
| 1.2 Areas, goals, and actions | Done |
| 1.3 Time blocking | Done |
| 1.4 Focus and the resolver | Done |
| 1.5 Install, offline shell, and backup | Done |
| 2.1 Daily loop | Done; owner checked |
| 2.2 Planning help | Done; waiting for the owner to check on the iPhone |
| 2.3 Reviews and coach | Next |
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

### Step 1.3 · Time blocking — what exists

- Settings → Schedule: availability and peak window per weekday, each with "Copy to all days"; personal blocks (label, days, times, active).
- `lib/intervals`, `lib/availability` (free time per day; external events are a parameter), and `lib/placement` (the hard rule, every soft warning, off-peak and after-due flags, snap to the nearest free position), all tested.
- The timeline: hours, dimmed time outside availability, the peak strip, hatched personal blocks, goal blocks filled, area blocks outlined, done and unresolved and draft styles, off-peak tag, hatched buffer tails, the now line.
- Today: date and season week, the Next card (or "Nothing scheduled" with a tray button), the timeline scrolled to now, the tray.
- Plan: week arrows, the week strip with pomodoros per day and "!" over the cap, a day timeline, swipe to change day, the tray.
- Blocks: drag from the tray, tap an empty slot ("Add block at 17:00"), long-press to move, the bottom handle to resize, 5-minute snap, auto-scroll near edges, a floating time label, red preview when it would overlap. Overlaps snap to the nearest free spot (with a toast) or change nothing; soft warnings ask "Place anyway?". The block sheet edits day, time, pomodoros, and buffer, and offers Mark done and Delete. The schedule sheet (tap a tray item, or swipe an action row left) is the tap alternative to every drag.
- Week rollover on every app open (§5.4).
- Checked in Chromium at iPhone size with real touch input: tray drag, snap-away, personal-block confirm, resize, off-peak without warning, tray emptying as actions get scheduled, scrolling over a block not moving it, empty-slot tap, swipe between days.

### Step 1.4 · Focus and the resolver — what exists

- `lib/timer`: the session is computed from a stored anchor and "now", walking through focus and break phases; pause, resume, skip break, +1, start next phase, and end are pure functions returning the new anchor. Tested for pause, skip break, add a pomodoro, a reload mid-phase, a return after the whole planned time, and auto-start off.
- `lib/scheduler.pickSlot` (§5.11) for one block, with tests for peak-first goal work, non-peak-first area tasks, the cap, spreading across days, due dates and after-due, personal blocks and buffers, determinism.
- Three ways to start: "Start focus" on the Next card and the block sheet; the center button (current block, or the next within 15 minutes, otherwise a picker of this week's actions with an adjustable ad hoc size). Starting shifts the block to now; a clash asks "Move that block back to the tray?".
- The Focus screen (full screen, black): timer and draining ring, FOCUS/BREAK/PAUSED, dots, Pause/Resume, Skip break, +1 (offers to push the next block later or move it to the tray when it would run into it), End, Notes (scratchpad, autosaved), Capture (one line into "Other"), wake lock with the Auto-Lock hint where unsupported, a soft flash and dot burst on phase change, minimise. The center button shows the time left and pulses.
- End sheet: away check when the finish was not seen live, "Is this action done?", "Done, or needs more time?" when the estimate is used up, focus rating, note. 0 pomodoros returns the block to scheduled.
- The resolver: full-screen, one card per unresolved block, oldest first, on open and on return to the foreground; Done (count, then "is the action done?"), Reschedule (next free slot, pick a time, back to tray), Drop (or drop the action too); "Later". A count badge on the Today tab and a prompt card on Today.
- Checked in Chromium at iPhone size with a controlled clock: reload mid-phase lands on the right second (14:48 after 10:12), pause holds through 5 minutes, all three starts, capture, notes, both end paths, the away check, the overlap question, and every resolver outcome with `reschedule_count` and the successor link.

### Step 1.5 · Install, offline shell, and backup — what exists

- Manifest (`app/manifest.ts`): standalone, portrait, start at `/today`, dark theme and background colors, 192/512/maskable icons. Apple touch icon, `apple-mobile-web-app-capable` with a black-translucent status bar, and splash screens for ten iPhone sizes. Icons and splashes are the FOQUS wordmark (the O as an accent ring) on the background color, rendered by `scripts/make-icons.cjs` and committed.
- Service worker at `/sw.js` (a static route with a per-build version). On install it caches every screen's HTML and every static file those screens use, following lazy chunk references; navigations are served from that versioned cache, so the installed app opens and runs with no network. A new deploy shows "A new version is ready · Reload to update"; nothing reloads on its own.
- Persistent storage requested on every open.
- Settings → Data: Export backup (share sheet on a phone, so "Save to Files" works; a download elsewhere), Import backup (validated with a plain-sentence error and no changes on failure; a confirmation naming the backup's date and row count; replaces everything and soft-deletes rows not in the file), storage use and whether it is persistent, and the line that data lives only on this device until an account is connected.
- iPhone pass: every form control is at 16 px (two quick add chips were 13 px and are fixed); safe areas, dynamic viewport height, and overscroll were already in place.
- Checked in Chromium at iPhone size: offline reload and every screen by tab and by direct load, the goal wizard, quick add, scheduling, a focus session, and confetti all work with the network off; export then import into a fresh profile matches the row counts of all 20 tables; an invalid file is rejected and changes nothing; a rebuild shows "Reload to update" and switches to the new version.

### Step 2.1 · Daily loop — what exists

- **Daily check-in** at `/checkin` (full screen; `?date=` for yesterday or an edit): Resolve (the day's unresolved blocks, one resolver card at a time; only when there are some) → Rate (energy and focus, two rows of five dots, one tap each) → Note (optional, 500 characters) → Tomorrow (read-only: tomorrow's blocks and personal blocks, with the pomodoros planned) → Close (the streak rolls up, pomodoros done of planned, one coach line). Ratings and the note save as you go, so "Save and exit" keeps them. One row per date (`daily_checkins`, id = date).
- **On Today**: the check-in is a quiet row above the timeline until the day's last block ends (or 18:00 on a day with no blocks), then a prominent "Time to check in" card. Due prompt cards (unresolved blocks, yesterday's open check-in, today's prominent check-in) stick with the header under the Next card, at most two, the rest behind "1 more". Yesterday's card only appears when yesterday had planned blocks or a started check-in.
- **Editing**: a check-in can be changed until the end of the next day in the settings time zone; the repo refuses later edits. Re-editing keeps the first completion time and does not move the streak.
- **Check-in history**: Settings → Reflection → Check-ins (both streaks, then each day's energy, focus, and note, with Edit or Finish while still open).
- **`lib/streaks`**: check-in streak (days with a completed check-in) and focus streak (days with at least one completed pomodoro on a goal action, on the local day the block started). A streak is the run ending today, or ending yesterday while today is still open. Tests cover a gap day and the time-zone midnight boundary. `lib/checkin`: when the check-in is due, the edit window, the day's numbers, "Day won", the coach line; tested.
- **Streaks in the Today header**: ✓ check-in days and 🔥 focus days (colored once today counts); a number that went up since last shown rolls up; tapping opens the history.
- **Celebrations**: "Day won" (the Next card becomes a green banner when every planned block today is done, with confetti the first time that day); the streak roll-up on the check-in's last screen and in the header; streak milestones at 7, 30, and 100 days and the goal-achieved moment as full-screen moments (goal: metric, actions done, pomodoros, focus hours, follow-through). A tap anywhere dismisses a moment; it leaves by itself after 6 seconds. With reduce motion on, every celebration is a 300 ms fade and there is no confetti.
- Checked in Chromium at iPhone size with a fake clock: the card is quiet at 06:00 and prominent once the block ended; the whole flow including inline resolving; Day won with confetti once (not again on reload); streaks 1/1; history and Edit; edits allowed at 23:50 the next day and refused at 00:01 after; yesterday's card; the 7-day milestone; the goal moment dismissed by tap and by time; reduce motion (fade, no confetti). No console errors; the Stage 1 suites still pass.

### Step 2.2 · Planning help — what exists

- **Recurring actions** (§5.5): a rule editor sheet (title, goal or area, major move, days, pomodoros each time, preferred time, end date, pause, delete) in wizard step 5, goal detail section 7 ("Recurring actions"), and each area page ("Recurring tasks"). Each rule shows its days, size, time, end, and "This week: 1 of 3 done".
- **Weekly generation**: on every app open, each active rule adds one action per matching weekday from today to Sunday, with the id `<rule_id>:<date>`, straight onto the week list. Opening twice creates nothing new. A rule created mid-week fills the rest of this week at once. Editing, pausing, or deleting a rule changes only occurrences from today on that have no block yet.
- **Occurrences stay in their week**: the repo refuses to place, move, or re-list them outside it; date pickers are limited to the week; at the week rollover, unfinished ones are dropped instead of carried. The repeat icon and the occurrence's day show on action rows and in the tray. Occurrences are listed under their rule, not one by one in goal and area lists.
- **`lib/capacity`** and the **capacity meter** sticking under Plan's week strip: a bar with "75% · Full week" (Room to spare / Full week / Overbooked in success, warning, danger), "18 h planned of 24 h free · Goals 58% · Areas 42%". Free time is before FOQUS blocks over the week's remaining days; planned is length + buffer of scheduled and draft blocks still ahead.
- **The weekly draft** (`lib/draft` on top of `pickSlot`): ranking (recurring by date; goal work by goal rank, due date, plan end, order; then area tasks by due date, order) and chunked placement with smaller chunks when a full one does not fit. "Draft my week" sits in Plan's tray bar for the current week. Draft blocks are dashed and see-through in the owner's color, can be dragged, resized, or deleted, and keep the status `draft` until Commit. While a draft exists, a sticky bar replaces the tray: "11 blocks drafted · 1 didn't fit [Discard] [Commit]"; "didn't fit" opens the list with reasons ("No free time before due date", "Daily cap reached all week", "No free slot left"). Running it again replaces the draft and leaves committed blocks alone.
- Tests: scheduler and draft (goal rank order, peak-first goal work and non-peak-first area tasks, the daily cap, 8 pomodoros split over two days, smaller chunks re-queued, an unmeetable due date marked after-due or listed with its reason, recurring on its own day at its preferred time, determinism with shuffled input, and a 30-action week checked for no overlap with blocks, buffers, personal blocks, or events, within availability, under the cap, in well under a second); capacity; recurrence; repo tests for generating twice on a Monday, editing and pausing, rollover dropping occurrences, same-week moves, and draft → re-draft → discard → commit.
- Checked in Chromium at iPhone size: a rule from the wizard and one from an area page, three opens on Monday giving 8 occurrences once, the tray with repeat icons, the meter before and with a draft, draft → discard → draft → commit, occurrences on their own days, "didn't fit" with a cap of 4, and the goal page's recurring section. No console errors; the Stage 1 and Step 2.1 suites still pass.

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
- **A block must end by midnight** of its day: the timeline is one day long, so this is a second hard check ("A block has to end by midnight.").
- **Done blocks keep their time** for the overlap rule; missed blocks free it. Free time (§5.6) counts committed blocks only (scheduled, active, done).
- **Buffer warning works both ways**: the new block runs into another's buffer, or its own buffer runs into the next block.
- **Snap** tries every 5-minute start within the day, nearest first, later on a tie.
- **"Mark done" in the block sheet** records the planned pomodoros as completed (no focus session ran). It does not mark the action done.
- **Dropping from the tray** creates a block of min(unscheduled, max per block) pomodoros, centred on the finger. "Add block here" uses the same size.
- **Swiping the Today timeline** opens Plan on the neighbouring day; Today itself always shows today.
- **Repo re-checks the hard rule** and recomputes `off_peak`/`after_due` inside the write transaction, so a stale screen can never create an overlap.
- **Week rollover runs on every app open**; it is idempotent. When weekly reviews arrive (Step 2.3) it will skip weeks whose review is complete.
- **Personal block labels** use `text-muted`, not `text-faint`, for contrast.
- **Timeline scale**: 1.6 px per minute (a pomodoro is 48 px, the 5-minute snap 8 px).
- **Session anchor**: `FocusSessionState` gained an optional `phase_elapsed_before` (seconds of the phase already run before a resume). `focus_seconds` holds focus time up to the anchor while a session runs, and the total once it ends. The pomodoro list is written on each user action and at the end.
- **A session that ends early trims its done block** to the minute it ended, so the next session can start right away without overlapping. "Mark done" on a block before its end does the same.
- **Away check rule**: asked when the screen first notices the finish more than 5 seconds after it happened (a lock, backgrounding, or opening the app later). Watching it finish live goes straight to the end sheet.
- **The finished session's end sheet cannot be dismissed**: a finished session has to be ended.
- **Center button with no session**: a ready screen ("Start focus") for the current block or one starting within 15 minutes, rather than starting instantly, so a stray tap never starts a session.
- **"Back to tray"** in the resolver counts as a reschedule (count +1) with no successor; "Move that block back to the tray" when starting focus soft-deletes the block, since it has not happened yet.
- **pickSlot fallbacks**: goal work tries inside the peak, then fully outside it (off-peak), then straddling it; area tasks the reverse. A slot needs room for the chunk plus its buffer inside the free interval. It searches today to Sunday only; past Sunday it reports "No free slot left this week".
- **The resolver stays away while a session runs**, and the app underneath it is `inert`.
- **Sheets always call the latest `onClose`** (a stale Escape handler had saved old scratchpad text).
- **Compound repo operations use every table** in their transaction scope (`ALL_TABLES`), since nested repo calls must stay inside it.
- **Service worker by hand**, not a library: Serwist and next-pwa hook into webpack, and Next 16 builds with Turbopack. The worker's precache list is discovered at install time from the screens' HTML and chunks, so no build-time manifest is needed.
- **HTML is never refreshed in the background**: a navigation is served from the cache of the worker's own build, so HTML and its chunks always match. New versions arrive only through "Reload to update".
- **Client-side route payloads (RSC) are not cached**: offline, Next.js falls back to a full page load, which the cache serves.
- **Backup format** `foqus-backup` version 1: every row of every table, soft-deleted rows included, without the local `_dirty` flag. Imported rows are stamped as fresh changes (`updated_at` now, `_dirty` 1) so a Stage 3 first sync uploads the replacement.
- **Ending a session with the action done but 0 pomodoros** marks its block done (with 0) instead of returning it to scheduled, so no orphan block for a finished action waits in the resolver.
- **Schedule sheet with no free time left today** suggests the next 5-minute mark after now, never a time that has passed.
- **Prompt cards stick with the Today header.** Today opens scrolled to now, so cards above the timeline were out of sight; the due ones sit under the Next card instead. The scroll area turns off scroll anchoring (`overflow-anchor: none`, as iOS Safari already behaves) so a growing header never pushes the now line under it.
- **Focus streak counts blocks**, not sessions: a block's completed pomodoros include ones entered in the resolver, and every session has a block. It counts once the session ends.
- **"Day won"** ignores drafts and missed blocks that were rescheduled (their successor counts); a dropped block means the day is not won.
- **Moments are tapped away**, not timed out within 2 s: any tap dismisses them at once, so input is never held up (§5.19); they also leave after 6 s.
- **The coach line on Close** is rule-based (low energy, no blocks, low focus, all done, most done, less done) until the coach arrives in Step 2.3.
- **The draft covers the current week only** (its remaining days). Planning next week arrives with the weekly review in Step 2.3; `draftMyWeek` already takes any week.
- **"Didn't fit" is kept for the session**, not stored: it is the result of the last run. After a reload the draft bar still shows the drafted blocks.
- **Commit drops drafts whose start has passed** rather than turning them into instantly unresolved blocks.
- **Occurrences have no due date**; they are tied to `occurrence_date` and their week. Generation never creates days already past, so a first open on Wednesday does not add Monday's.
- **An occurrence the owner deleted is not recreated**, and a rule change leaves occurrences that already have a block alone.
- **Lint-enforced layering.** `app/` and `components/` may not import `db/` or Dexie. `lib/` may not import db, repo, data, or React.

## Deviations

- **Capacity meter is always the compact two-line form** (owner feedback on compactness), rather than three lines collapsing on scroll. The tray bar on Plan reads "Tray (n)" to make room for "Draft my week".
- **Compact type scale** (owner's request at the Stage 1 exit): §6.3's Title 24, Heading 18, Body 16 became 20, 16, 15; inputs stay 16 px. The timeline scale is 1.2 px per minute.
- **Compact sticky screen header** (owner's request after Step 1.4): every tabbed screen uses one `ScreenHeader` that sticks to the top while scrolling, so "+" and the other actions are always one tap away. It is a single 52 px row (plus the safe-area inset) with the title at 20/700 instead of §6.3's 24/700 Title style, and a one-line subtitle. Long titles wrap to two lines. Plan's arrows and week sit in the header; the goal page's back, title, and ⋯ do too, with area, dates, and Achieve just below. The Plan week strip is two lines (day and date, then the count) instead of three.

### Refinement after Step 1.4 — compact sticky header

- `ScreenHeader` is sticky, opaque, and carries the top safe-area inset; the scroll area no longer pads the top. The timeline's scroll-to-now and drag auto-scroll allow for the header covering the top.
- Measured at iPhone size: 57 px before the safe-area inset (was about 88 px for Today and 166 px for Plan with its week strip), and "+" stays visible and opens quick add after scrolling.

### Stage 1 exit — owner feedback and changes

The owner used the app for several days. Feedback: overall it feels nice; four changes, all done:

1. **Sheets jumped when the keyboard closed**, so a tap meant for one control landed on another. Now tapping a button inside a sheet while typing (chips, steppers, toggles) keeps the keyboard up, so the sheet does not move; and whenever a sheet does move with the keyboard, taps inside it are ignored for 350 ms.
2. **Today's Next card is sticky** under the header, as one compact row (time, dots, title, goal or area, Start). **Plan's week strip is sticky** under its header.
3. **More compact UI**: the type scale is one step smaller (title 20, heading 16, body 15; form fields stay at 16 px so iOS never zooms), tighter rows, cards, settings groups, and bottom navigation, and the timeline at 1.2 px per minute (a pomodoro is 36 px), so about 5½ hours fit on screen instead of 4. Settings → Schedule shows one line per day. Touch targets stay at 44 pt.

## Owner tasks

- Stage 1 owner checks (Step 1.5):
  - Add the app to the home screen from Safari (Share → Add to Home Screen) **before** entering real data. Storage for the installed app is separate from Safari's, so anything entered in a Safari tab will not appear there.
  - Open the installed app once online, then open it in airplane mode.
  - Settings → Data → Export backup, and confirm the file saves (choose "Save to Files").
- Stage 1 exit: done (feedback applied).
- Step 2.1 checks on the iPhone:
  - **Export a backup first** (Settings → Data → Export backup): data still lives only on this device.
  - After the day's last block, Today shows "Time to check in"; go through it. The streak rolls up and the ✓ number in the header goes up.
  - Finish every block one day and see the "Day won" banner.
  - Settings → Reflection → Check-ins: yesterday's entry has Edit until midnight tonight.
  - With Settings → Accessibility → Motion → Reduce Motion on, celebrations are a short fade.
- Step 2.2 checks on the iPhone:
  - **Export a backup first** (Settings → Data → Export backup).
  - Add a recurring action on a goal (goal page → Recurring actions) and one on an area; this week's occurrences appear in the tray with the repeat icon.
  - Plan → Draft my week. Drag or delete a draft block, then Commit (or Discard). Check the capacity meter before and after.
