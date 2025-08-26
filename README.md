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

## Deployment (Vercel Example)
1. Set `NEXT_PUBLIC_CONVEX_URL` env var in Vercel project settings (from Convex dashboard).
2. `pnpm build` (CI) → deploy.

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
