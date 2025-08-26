# AI Coding Agent Instructions for `four-in-a-row`

These instructions capture the project-specific context so an AI agent can be productive immediately.

## 1. High-Level Architecture
- Frontend: Next.js App Router (`src/app`) + Tailwind CSS v4. Lobby uses `Matchmaking` component (no global public list).
- Backend: Convex functions under `convex/` (schema + queries + mutations) with generated types in `convex/_generated/*` (not committed; run `pnpm exec convex dev`).
- Game Domain: Four-in-a-row (6x7) stored in `games`, moves in `moves`, usernames in `profiles`.
  - `games` fields: `status`, `mode` (`auto|friend`), `currentPlayer` (player id), `winner` (token), `board`, `player1/2`, optional `player1Name/2Name`, optional `winningCells`.
  - `moves`: chronological history (`moveNumber`) for deterministic replays.
  - `profiles`: claimed usernames (unique canonical lowercase index).
- Client Identity: Anonymous ephemeral `playerId` in `localStorage` (via `usePlayerId` or local logic in `Matchmaking`). Not secure; avoid trusting for auth.

## 2. Key Directories & Files
- `convex/schema.ts`: Data model & indexes (`games` + matchmaking indexes, `moves`, `profiles`).
- `convex/games.ts`: Matchmaking + lifecycle: `create`, `autoMatch`, `join`, `get`, `activeForPlayer`, `waitingAutoForPlayer`.
- `convex/moves.ts`: `play` mutation (turn validation, win/draw detection) + `listForGame` query.
- `convex/profiles.ts`: Username claim logic (not originally documented; ensure kept consistent with uniqueness checks).
- `src/components/Matchmaking.tsx`: Lobby UI (Auto Match, Friend Invite + QR, Active games list, username form, waiting overlays).
- `src/components/GameClient.tsx`: Game runtime view (responsive board, join logic, move list).
- `src/components/FourInARowBoard.tsx`: Board + `ResponsiveFourInARowBoard` wrapper.
- `src/components/useResizeObserver.ts`: Hook powering responsive board sizing.
- `src/shared/{constants,expiry,qr}.ts`: Shared constants, TTL helpers, QR generation.
- `tsconfig.json`: Path aliases `@/*` and `@convex/*`; keep `moduleResolution: node16` and `module: Node16`.

## 3. Data & Logic Conventions
- Board: `string[][]` 6×7; values `""`, `"R"`, `"Y"`.
- Turn Tracking: `currentPlayer` = player id; derive token via role (player1→R, player2→Y).
- Matchmaking Modes: `mode: 'auto' | 'friend'`. Auto mode scans `by_status_mode` index for waiting games; friend mode exposes QR link.
- Win Detection: `checkWinner` in `moves.ts` returns winner token and cell coordinates (`winningCells`) stored in game.
- Draw Detection: After each move if top row is full and no win → `status: finished` with no winner.
- TTL: Waiting games expire at 5 minutes (`WAITING_GAME_TTL_MS`) if unjoined; filtered / deleted opportunistically.
- Move Ordering: `moveNumber` incremental via last move query (`by_game` index, descending take(1)).
- Idempotent Join: `games.join` returns `{ alreadyIn: true }` if player already present.
- Live Query Skips: Use `"skip"` sentinel until prerequisites (e.g., `playerId`) ready.

## 4. Runtime & Dev Workflows
- Install deps: `pnpm install`.
- Start Convex (codegen + hot reload): `pnpm exec convex dev` (must be running for `_generated` imports to resolve).
- Start Next.js: `pnpm dev` (or run both with `pnpm dev:all`).
- Environment: Add `.env.local` with `NEXT_PUBLIC_CONVEX_URL` (see example file). Changes require Next.js restart.
- Type Generation: Automatic while Convex dev server runs; manual trigger: `pnpm exec convex codegen`.
- Linting: `pnpm lint` (ESLint 9 + Next config). Type errors may hinge on correct `moduleResolution` settings.

## 5. Patterns & Gotchas
- Always add new Convex functions under `convex/`; import via generated `api` in clients.
- Missing generated modules? Ensure Convex dev process is running (codegen) and TS settings unchanged.
- Never mutate the original `board` object directly—clone rows before edits.
- Responsive board: keep `useResizeObserver` (and any custom hooks) above conditional early returns to avoid React hook order warnings.
- Loading overlay: Set a `navigatingGameId` state before `router.push` to freeze UI (see `Matchmaking.tsx`).
- TTL logic: Use `isWaitingGameExpired` / `remainingWaitMs` from `expiry.ts`; do not re‑implement.
- QR generation: Use `generateQrDataUrl` wrapper; avoid importing `qrcode` directly in components.
- Accessibility: Entire columns are clickable; maintain ARIA labels (`aria-label` on discs/columns). Avoid shrinking touch targets below ~40px.

## 6. Adding New Features (Examples)
- Spectator Support: Allow non‑participant to open `/game/[id]`; render read‑only state (UI mostly present already).
- Rematch Flow: Add mutation to create a fresh game copying opponent identities.
- Resign: Mutation marking game finished with opposing winner or `null` (depending spec).
- Game Replay: Query `moves` and simulate board progression client‑side.
- Auth Integration: Replace ephemeral id with provider (update schema + server validation).

## 7. Code Style & Conventions
- TypeScript strict; avoid `any` (use generics, inference, or narrow `unknown`).
- Client components require `"use client"` at top when using state/effects.
- Tailwind utilities for static styles. Inline styles only for computed dimensions (board sizing/gaps) or dynamic animations.
- Keep shared domain constants in `shared/constants.ts`.
- Provide explicit return types for exported functions (especially in Convex code) when inference is unclear.

## 8. Safe Change Process
1. Define schema/table changes in `convex/schema.ts`.
2. Run `pnpm exec convex dev` to validate + push (if logged in) and regenerate types.
3. Add / update functions; use validators from `convex/values` (`v.*`).
4. Reference new API via `import { api } from "@convex/_generated/api"` in client code.
5. Test locally with two browser sessions (different playerIds) for realtime behavior.

## 9. Common Errors & Fixes
| Symptom | Cause | Fix |
|--------|-------|-----|
| `Cannot find module './_generated/server'` | Convex dev not running | Start `pnpm exec convex dev` |
| `Cannot find module 'convex/...` | TS module settings changed | Ensure `module: Node16` & `moduleResolution: node16` |
| Hook order warning | Hook after conditional return | Move hook before returns |
| Auto match never starts | No second player joined | Wait or open second browser/session |
| Column click inert | Not your turn / game finished | Check `currentPlayer` & `status` |
| QR fails to render | Dynamic import failure | Fallback data URI already returned (investigate network) |

## 10. When Extending
- Schema First: Add needed fields & indexes in `schema.ts` then run Convex dev.
- Index Strategy: Add narrowly scoped indexes (e.g., composite for status+mode) before writing filtered queries that would scan large sets.
- Shared Logic: Consolidate expiry / sizing / QR helpers; avoid duplication.
- Testing (future): Introduce unit tests for `checkWinner` & expiry in a dedicated test folder; keep logic pure to ease testing.

---
If something here drifts from reality after your change, update this file in the same PR to prevent assistant decay.
