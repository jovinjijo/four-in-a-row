# AI Coding Agent Instructions for `four-in-a-row`

These instructions capture the project-specific context so an AI agent can be productive immediately.

## 1. High-Level Architecture
- Frontend: Next.js App Router (`src/app`) with Tailwind CSS (v4) for styling.
- Backend (realtime & data): Convex functions in `convex/` (schema + queries + mutations) generating typed APIs in `convex/_generated/*` (NOT committed until `pnpm exec convex dev` runs).
- Game Domain: Four-in-a-row (6x7 board) with documents stored in `games` table and `moves` table.
  - `games` includes: `status` (`waiting|active|finished`), `currentPlayer` (player id string), `winner` (optional), `board` (2D array of tokens), `player1`, `player2`.
  - `moves` capture the chronological action history with an index for ordering.
- Client State: Players are anonymous; a persistent `playerId` is generated/stored in `localStorage` (`usePlayerId` hook) and passed to Convex mutations.

## 2. Key Directories & Files
- `convex/schema.ts`: Source of truth for data model and indexes.
- `convex/games.ts`: Game lifecycle functions (`list`, `create`, `join`, `get`).
- `convex/moves.ts`: Mutation `play` and query `listForGame`; contains win detection logic.
- `src/components/ConvexClientProvider.tsx`: Wraps the app with `ConvexProvider` (requires `NEXT_PUBLIC_CONVEX_URL`).
- `src/components/GamesList.tsx`: Lobby UI (create/join + navigation to game pages).
- `src/components/GameClient.tsx`: Main game runtime view (fetch game + moves, join, play turns).
- `src/components/FourInARowBoard.tsx`: Presentational board component (`FourInARowBoard`) with adjustable cell size via `size` prop.
- `src/app/game/[id]/page.tsx`: Dynamic game route.
- `tsconfig.json`: Path aliases `@/*` -> `src/*`, `@convex/*` -> `convex/*`; uses `moduleResolution: node16` + `module: Node16` to satisfy Convex export maps.

## 3. Data & Logic Conventions
- Board Representation: `string[][]` with cells: `""`, `"R"`, `"Y"`. New board created with 6 rows × 7 columns of empty strings.
- Turn Tracking: `currentPlayer` holds the player id (not the token). The token maps as: player1 -> `R`, player2 -> `Y`.
- Win Detection: Implemented in `convex/moves.ts` (`checkWinner`) scanning four directions; if found, mutation sets `status: "finished"` and `winner` to token (NOT player id).
- Move Ordering: `moves` store incremental `moveNumber` derived from latest query (O(1) last read via descending order + `take(1)`).
- Idempotency: `games.join` returns `{ alreadyIn: true }` if the caller is already a participant.
- Client Queries: Skip pattern (`useQuery(api.fn, condition ? args : "skip")`) to defer queries until dependencies (like `playerId`) exist.

## 4. Runtime & Dev Workflows
- Install deps: `pnpm install`.
- Start Convex (codegen + hot reload): `pnpm exec convex dev` (must be running for `_generated` imports to resolve).
- Start Next.js: `pnpm dev` (or run both with `pnpm dev:all`).
- Environment: Add `.env.local` with `NEXT_PUBLIC_CONVEX_URL` (see example file). Changes require Next.js restart.
- Type Generation: Automatic while Convex dev server runs; manual trigger: `pnpm exec convex codegen`.
- Linting: `pnpm lint` (ESLint 9 + Next config). Type errors may hinge on correct `moduleResolution` settings.

## 5. Patterns & Gotchas
- Always add new Convex functions under `convex/` and reference them through generated `api` (never hardcode paths to `_generated/server` elsewhere than server functions).
- If TypeScript reports missing `convex/*` modules, ensure: (1) Convex server running, (2) `tsconfig` not reverted to `bundler` resolution.
- Player identity is purely client-side; do NOT trust it for security—future auth would replace this.
- When modifying board state server-side, always clone (`map([...row])`) before mutation to avoid mutating the existing object directly.
- UI is intentionally minimal; accessibility: game pieces have `aria-label` (no letters on discs) and column buttons have labels.
- Navigation after create/join is handled in `GamesList.tsx` using `router.push`; reuse that pattern for new lobby actions.

## 6. Adding New Features (Examples)
- Draw Detection: After inserting a move, if no winner and top row has no empty cells, set `status: "finished"` without `winner`.
- Spectator Support: Allow third parties to view game; no schema change needed—just allow load without join.
- Nicknames: Add `players` table or extend `games` with `player1Name`/`player2Name`; update mutations & UI accordingly.
- Highlight Winning Discs: Return winning coordinates from `checkWinner` and store (e.g., `winningCells: [[r,c],...]`) in `games`.

## 7. Code Style & Conventions
- Typescript strict mode is ON (`strict: true`), minimally explicit `any` usage (Convex codegen provides types once running).
- Prefer functional React components with hooks; client components start with `"use client"` when they depend on browser APIs or hooks.
- Tailwind used for layout; avoid mixing inline styles except for dynamic sizing (board uses inline `style`).

## 8. Safe Change Process
1. Define schema/table changes in `convex/schema.ts`.
2. Run `pnpm exec convex dev` to validate + push (if logged in) and regenerate types.
3. Add / update functions; use validators from `convex/values` (`v.*`).
4. Reference new API via `import { api } from "@convex/_generated/api"` in client code.
5. Test locally with two browser sessions (different playerIds) for realtime behavior.

## 9. Common Errors & Fixes
| Symptom | Cause | Fix |
|--------|-------|-----|
| `Cannot find module './_generated/server'` | Convex codegen not run | Start `pnpm exec convex dev` |
| `Cannot find module 'convex/...` | Wrong `moduleResolution` | Keep `node16` + `module: Node16` in `tsconfig.json` |
| Join button does nothing | Mutation success but no navigation | Ensure `router.push` after join/create |
| Pieces not updating | Stale board | Confirm mutation patches game & query not skipped |

## 10. When Extending
Provide migrations via updating schema; keep indexes minimal (currently: `games` has `by_created`, `by_status`; `moves` has composite `by_game`). Add indexes before introducing heavy filtered queries.

---
If something here seems outdated after your change, update this file in the same PR.
