<div align="center">
	<h1>four-in-a-row</h1>
	<p>Realtime Four‑in‑a‑Row built with Next.js (App Router), Convex, Tailwind CSS, and TypeScript – now with matchmaking & QR friend invites.</p>
  <h3><strong>⚡ VIBE-CODED PROJECT ⚡</strong></h3>
  <p><em>Fast, pragmatic, playful. Expect lean patterns over ceremony.</em></p>
</div>

## Stack
| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 15 (App Router) | `src/app` routes, server + client components |
| Styling | Tailwind CSS v4 | Utility-first; dynamic sizing inline for board cells |
| Realtime Backend | Convex | Live queries + mutations in `convex/` |
| State/Identity | Ephemeral `playerId` | Stored in `localStorage` via `usePlayerId` hook |

## Features
* Matchmaking Lobby (no global list):
	* `Auto Match` pairs you with another waiting player (or creates a waiting slot) and auto‑navigates when a second player joins.
	* `Play with a Friend` creates an invite game (mode `friend`) and shows a shareable link + QR code; navigation only after friend joins.
* Active games list: quickly re‑open any ongoing games you are part of.
* Anonymous players (P1 = Red `R`, P2 = Yellow `Y`) with optional claimed usernames (`profiles` table).
* Realtime board + move history via Convex live queries.
* Server‑side win detection, draw detection, and winning disc highlighting (`winningCells`).
* Countdown timers for waiting games (5‑minute TTL auto‑expiry) with opportunistic cleanup.
* Loading overlay during navigation ensuring the UI “freezes” after a match is found.
* Fully clickable columns (no arrow buttons) with keyboard (Enter / Space) support; ARIA labels for accessibility.
* Responsive board sizing (observed container width, adjustable min/max cell size + horizontal scroll fallback) for mobile friendliness.
* Strong TypeScript types (strict mode, no `any`) and isolated shared helpers (TTL, QR, constants).
* Resign & Mutual Rematch: both players must request within 5‑minute window; winner starts next game (draw alternates starter).
* Ghost hover preview + animated falling discs for the last move.

## Architecture Overview
High-level matchmaking flows:

Auto Match:
1. User clicks `Auto Match` → mutation `games.autoMatch`.
2. Server searches for an existing `waiting` auto game (mode `auto`) not created by the player and not expired; if found it patches to active & assigns them as `player2`; else creates a new waiting game.
3. Client watches `games.get` for that game id; when `status` changes to `active`, it shows a loading overlay and navigates to `/game/[id]`.

Friend Invite:
1. User clicks `Play with a Friend` → mutation `games.create` with `mode: friend`.
2. Client displays link + QR (generated via dynamic import of `qrcode` wrapped in `src/shared/qr.ts`) while polling the same game via `games.get`.
3. Second player opens link, triggers `games.join`; server marks game `active` and sets `player2` / name snapshot.
4. First client detects `status: active`, overlays, then navigates.

In-Game:
1. `GameClient` subscribes to `games.get` (board, players, turn, status) and `moves.listForGame` (chronological history) live queries.
2. Moves invoke `moves.play` which validates turn & column, clones board, drops token, runs `checkWinner`, sets `winningCells` and updates `games`.
3. Draw detection occurs if top row is full with no winner.
4. Realtime updates propagate automatically to both players.

Board logic:
* 6 × 7 matrix of strings `"" | "R" | "Y"`.
* Player1 token = `R`, Player2 token = `Y`; `winner` holds the token not the player id.
* `currentPlayer` holds the active player's ephemeral id; token derived client‑side.
* `winningCells` (array of `[r,c]` pairs) highlights the four discs that completed a win.

## Accessibility
Columns are fully clickable (no small hit targets) and focusable; keyboard activation via Enter/Space. Discs have descriptive `aria-label`s (Empty / Red piece / Yellow piece). Visual letters are omitted for clarity. Responsive sizing preserves clear tap targets on small screens.

## Identity & Security
Identity is a locally generated UUID (`playerId`) persisted in `localStorage`. It is NOT secure and can be spoofed; do not rely on it for any production security guarantees. To harden:
- Introduce real authentication (e.g., Convex Auth, OAuth provider).
- Store player profiles in a dedicated table.
- Validate ownership of moves against authenticated identity server-side.

## Environment Variables
Runtime configuration (client-visible) comes from `NEXT_PUBLIC_CONVEX_URL` which must point to your Convex deployment. For local dev Convex prints the appropriate URL when you run its dev server. Create `.env.local` (not committed) containing:
```
NEXT_PUBLIC_CONVEX_URL="https://<your-deployment>.convex.cloud"
```

## Project Structure
```
convex/
	schema.ts             # Data model (games, moves, profiles + indexes including matchmaking)
	games.ts              # create, autoMatch, join, get, activeForPlayer, waitingAutoForPlayer
	moves.ts              # play + win/draw detection + winningCells
	profiles.ts           # username claim / lookup
src/
	app/
		page.tsx            # Lobby (Matchmaking component)
		game/[id]/page.tsx  # Game screen route
	components/
		Matchmaking.tsx     # Lobby UI (Auto Match + Friend Invite + Active Games)
		GameClient.tsx      # Main realtime game view
		FourInARowBoard.tsx # Presentational + Responsive wrapper
		usePlayerId.ts      # Ephemeral player id hook
		useResizeObserver.ts# Observer hook powering responsive board
	shared/
		constants.ts        # TTL + board constants
		expiry.ts           # Waiting game expiry helpers
		qr.ts               # QR code generation wrapper
```

## Quick Start
```bash
pnpm install
pnpm exec convex dev   # starts Convex + generates convex/_generated/*
pnpm dev               # start Next.js (or `pnpm dev:all` to run both)
```

Create `.env.local` (if not already present) with the variable shown above.

Then open http://localhost:3000 and in a second browser/profile to simulate another player.

## Scripts
| Script | Description |
|--------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm convex:dev` | Convex dev/codegen only |
| `pnpm dev:all` | Run Next.js + Convex concurrently |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint (Next config) |

## Convex Data Model
`games` document (key fields):
```ts
{
	createdAt: number;
	status: 'waiting' | 'active' | 'finished';
	mode?: 'friend' | 'auto';      // matchmaking context
	currentPlayer: string;         // player id whose turn it is
	winner?: 'R' | 'Y';            // token, not id
	board: string[][];             // 6x7 grid
	player1: string;
	player2?: string;
	player1Name?: string;
	player2Name?: string;
	winningCells?: number[][];     // [[r,c], ...] highlighted on win
}
```
`moves` document:
```ts
{
	gameId: Id<'games'>;
	player: string;
	column: number;          // 0-6
	moveNumber: number;      // sequential
	createdAt: number;
}
```
`profiles` document:
```ts
{
	playerId: string;        // ephemeral local id
	username: string;        // chosen unique display name
	usernameLower: string;   // canonical key
	createdAt: number;
}
```

Key indexes (see `schema.ts`):
* `games.by_status_mode` (status, mode) – auto‑match scanning.
* `games.by_player1` / `games.by_player2` – active games listing per player.
* `moves.by_game` – ordered move history.
* `profiles.by_usernameLower` – uniqueness enforcement.

## Adding Logic
1. Run Convex dev: `pnpm exec convex dev` (ensures codegen up‑to‑date).
2. Update `schema.ts` for new fields/indexes first; rely on validators (`v.*`).
3. Add server functions in `convex/*.ts` importing from `./_generated/server` only.
4. Reference APIs via generated `api` object (never deep import `_generated/server` in client code).
5. Guard `useQuery` with `'skip'` for dependencies (e.g., player id).
6. Put resize / other hooks before early returns in components to avoid React hook order warnings.
7. Use shared helpers: `expiry.ts` (TTL), `constants.ts`, `qr.ts` (dynamic import wrapper) instead of duplicating logic.

## Roadmap / Extension Ideas
1. Spectator mode polish (read‑only UI cues if not a participant).
2. Game replay (step through moves, auto/playback).
3. Persistent ranking / ELO once real auth exists.
4. Scheduled cleanup job (cron) removing expired waiting games physically (manual mutation exists; automate scheduling).
5. Test suite: unit tests for `checkWinner`, expiry logic, matchmaking, resign/rematch.
6. Replay mode & move-by-move animation.
7. Spectator chat / emoji reactions.

## Deployment

### 1. Convex Production Deployment
You need a production Convex deployment so clients have a stable URL.

Steps:
1. Login (one time): `npx convex login` (locally) and follow browser auth.
2. From project root run: `npx convex deploy` (or add a script `pnpm convex:deploy`). This creates / updates your prod deployment and prints a URL:
	```
	https://<your-deployment>.convex.cloud
	```
3. Copy that URL into `NEXT_PUBLIC_CONVEX_URL` for production (Vercel dashboard → Project → Settings → Environment Variables).
4. (Optional) Preview Deployments: You can run `npx convex deploy --preview` to create an isolated preview deployment and set its URL in `NEXT_PUBLIC_CONVEX_URL` for Preview env only.

Environment Matrix Suggestion:
| Environment | Vercel | Convex | Variable Value |
|-------------|--------|--------|----------------|
| Production  | Production Deploy | Production Deploy | `NEXT_PUBLIC_CONVEX_URL=https://<prod>.convex.cloud` |
| Preview     | Preview Deploy (PR) | Preview Deploy (`--preview`) | `NEXT_PUBLIC_CONVEX_URL=https://<preview>.convex.cloud` |
| Development | Local `pnpm exec convex dev` | Local Dev | auto‑written to `.env.local` |

### 2. Vercel (Next.js) Deployment
1. Push repo to GitHub (or GitLab/Bitbucket) and import into Vercel.
2. Set `NEXT_PUBLIC_CONVEX_URL` in Production (and optionally Preview) envs before the first build.
3. Build Command: `pnpm build` (Vercel will auto-detect; ensure `pnpm i` first). Output directory: `.next` (default).
4. No custom server required; standard Next.js 15 output works. Turbopack is dev-only; production build uses Next's compiler.
5. After deployment, open the URL and verify real-time updates (open two tabs, start a friend game, ensure moves sync).

### 3. Local Production Smoke Test (Optional)
Simulate production locally before first Vercel deploy:
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start  # serves optimized Next build
```
Point `NEXT_PUBLIC_CONVEX_URL` to either your dev or (safer) preview Convex deployment while testing.

### 4. Updating Schema / Backend After Go-Live
1. Edit `convex/schema.ts`.
2. Run locally: `pnpm exec convex dev` to validate & generate types.
3. Deploy backend changes: `npx convex deploy` (or `--preview` first).
4. Commit frontend code referencing new fields; push → triggers Vercel build using same URL.

### 5. Rollbacks / Previews
Use `--preview` deployments to validate risky changes. Point a temporary preview Vercel environment to the preview Convex URL. Once satisfied, redeploy both (Convex prod + Vercel production) referencing the stable production URL.

### 6. Environment Variables Recap
| Name | Scope | Description |
|------|-------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Client + Server | Base URL for Convex (must match target deployment). |

No secrets are currently required; identity is still anonymous. Introducing auth later will add secret server-side env vars (e.g. OAuth client secrets) which you would configure in Vercel as non-`NEXT_PUBLIC_` names.

### 7. Common Deployment Pitfalls
| Issue | Cause | Fix |
|-------|-------|-----|
| Lobby loads but queries fail | Missing / wrong `NEXT_PUBLIC_CONVEX_URL` | Set correct URL in Vercel env, redeploy |
| Types mismatch after deploy | Built against stale generated types | Run local `convex dev` before committing changes |
| Real-time not updating | Using preview Convex with prod Vercel (or vice versa) | Align both to same environment URL |
| 404 on game pages after deploy | Build succeeded before migrations? (rare) | Ensure schema deployed first, then commit frontend referencing it |

---
Minimal one-shot production flow (once configured):
```bash
npx convex deploy
pnpm build
git push origin main  # triggers Vercel build using existing env var
```


## Common Issues
| Symptom | Cause | Fix |
|--------|-------|-----|
| Missing `./_generated/server` | Convex not running | Run `pnpm exec convex dev` |
| Module resolution errors | Wrong TS settings | Ensure `module: Node16`, `moduleResolution: node16` |
| Hook order warning | Early return before custom hook | Move hook (e.g. `useResizeObserver`) above returns |
| Auto match button disabled | Already waiting game present | Wait for expiry or open existing game tab & cancel flow (future UX) |
| Game vanished while waiting | TTL expired | Start a new matchmaking attempt |
| Column click does nothing | Not your turn / finished | Check `status` & `currentPlayer` in UI state |

## Contributing
Keep PRs focused: update schema + server + client usage together. Always run Convex dev for regenerated types after schema edits. Clone board arrays in mutations (avoid mutating prior references). Use shared helpers instead of duplicating TTL or QR logic. Ensure new hooks precede any conditional returns.

---
Feel free to open issues/PRs for enhancements. Enjoy building! :)
