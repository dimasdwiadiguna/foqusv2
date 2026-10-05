# FOQUS

A personal goal-to-action app: quarterly goals → weekly plan → time blocks → pomodoro focus sessions. Mobile-first PWA, dark only, local-first (all data in the browser's IndexedDB until Stage 3).

The full specification and build plan is in `BRIEF.md`; progress is tracked in `PROGRESS.md`.

## Requirements

Node.js 22.12 or newer.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run typecheck` | TypeScript, strict |
| `npm run lint` | ESLint (includes the "no component imports the database" rule) |
| `npm test` | Vitest unit tests |
| `npm run build` | Production build |
| `npm run check` | All four of the above, in order |
| `npm start` | Serve the production build |

## Deploying

Import the repository into Vercel with the default Next.js settings. No environment variables are needed in Stages 1 and 2.

## Data

Until Stage 3, everything lives in IndexedDB on the device that entered it. A home-screen install on iPhone has storage separate from Safari tabs.
