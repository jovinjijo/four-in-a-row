<div align="center">
	<h1>four-in-a-row</h1>
	<p>Realtime Four‑in‑a‑Row built with Next.js (App Router), Convex, Tailwind CSS, and TypeScript.</p>
</div>

## Stack
| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 15 (App Router) | `src/app` routes, server + client components |
| Styling | Tailwind CSS v4 | Utility-first; dynamic sizing inline for board cells |
| Realtime Backend | Convex | Live queries + mutations in `convex/` |
| State/Identity | Ephemeral `playerId` | Stored in `localStorage` via `usePlayerId` hook |

## Features
* Create or join games in a lobby (auto navigation on create/join).
* Anonymous players (P1 = Red `R`, P2 = Yellow `Y`).
* Realtime board + move list updates across browsers.
* Win detection server-side; game status transitions: `waiting → active → finished`.
* Accessible board (ARIA labels on pieces; no letters on discs).

## Architecture Overview
High-level flow:
1. Client (Next.js App Router) renders lobby (`/`) listing games via Convex `games.list` live query.
2. User creates or joins a game (Convex mutations `games.create` / `games.join`) then is routed to `/game/[id]`.
3. Game screen (`GameClient`) subscribes to `games.get` + `moves.listForGame` live queries.
4. Player actions invoke `moves.play`; server validates turn order, drops a token, checks for a win, updates `games` + inserts a `moves` record.
5. Convex pushes updated documents to all subscribed clients in realtime (no explicit polling or websockets code needed client-side).

Board logic:
- 6 rows × 7 columns; empty cell = `""`.
- Player1 token = `R`, Player2 token = `Y` (stored as characters in the board array and `winner`).
- `currentPlayer` stores the player *id* (ephemeral), not the token; token is derived by matching the id to `player1`/`player2`.

## Accessibility
The visual discs omit letters to reduce clutter. Each rendered disc/div includes an `aria-label` describing its state (empty / Red piece / Yellow piece) and column buttons (if any) expose descriptive labels for screen readers. Board sizing is responsive via a passed `size` prop.

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
	schema.ts          # Data model (games, moves + indexes)
	games.ts           # list, create, join, get
	moves.ts           # play + move history
src/
	app/
		page.tsx         # Lobby
		game/[id]/page.tsx # Game screen
	components/
		ConvexClientProvider.tsx
		GamesList.tsx
		GameClient.tsx
		FourInARowBoard.tsx
		usePlayerId.ts
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
`games` document:
```ts
{
	createdAt: number;
	status: 'waiting' | 'active' | 'finished';
	currentPlayer: string;     // player id turn pointer
	winner?: 'R' | 'Y';        // token, not player id
	board: string[][];         // 6x7, values '', 'R', 'Y'
	player1: string;
	player2?: string;
}
```
`moves` document:
```ts
{
	gameId: Id<'games'>;
	player: string;
	column: number;            // 0-6
	moveNumber: number;        // 1++ sequential
	createdAt: number;
}
```

## Adding Logic
1. Start Convex: `pnpm exec convex dev` (must be running for types).
2. Add/modify functions in `convex/*.ts` using validators from `convex/values`.
3. Import in client code via generated `api`: `import { api } from '@convex/_generated/api'`.
4. Use hooks: `useQuery(api.games.get, { id })`, `useMutation(api.moves.play)`.
5. Guard queries with `"skip"` until prerequisites (like `playerId`) are ready.

## Roadmap / Extension Ideas
Planned or easy next enhancements:
1. Draw detection: if top row has no empty cells and no winner, mark game finished (no `winner`).
2. Winning disc highlight: compute and persist `winningCells: [ [r,c], ... ]` for client animation.
3. Spectator mode polish: read-only UI cues when viewer is neither `player1` nor `player2`.
4. Nicknames / profiles: add optional display names (`player1Name`, `player2Name`) or a `players` table.
5. Finished games archive: separate listing with pagination + replay of move sequence.
6. Tests: add unit tests for `checkWinner` directional logic & edge cases.
7. Authentication: replace ephemeral `playerId` with real auth provider integration.
8. Draw + resign actions: explicit resign mutation & UX.
9. UI polish: winning line animation, move hover previews, mobile layout tweaks.
10. Deployment pipeline: GitHub Actions CI (lint, typecheck, build) before Vercel deploy.

## Deployment (Vercel Example)
1. Set `NEXT_PUBLIC_CONVEX_URL` env var in Vercel project settings (from Convex dashboard).
2. `pnpm build` (CI) → deploy.

## Common Issues
| Symptom | Cause | Fix |
|--------|-------|-----|
| Missing `./_generated/server` | Convex not running | Run `pnpm exec convex dev` |
| Module resolution errors | Wrong TS settings | Ensure `module: Node16`, `moduleResolution: node16` |
| Join button inert | Navigation missing | Ensure `router.push` after `join/create` |
| Board not updating | Stale query | Check skip logic & mutation patch |
| Async route param warning | Next.js 15 dynamic param handling | Ensure dynamic page component is `async` and awaits `params` |

## Contributing
Small PRs: update schema + server code + client usage together. If you change schema, always run Convex dev so types regenerate. Keep board logic pure—mutations should clone board arrays before editing.

---
Feel free to open issues/PRs for enhancements. Enjoy building! :)
