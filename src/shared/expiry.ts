import { WAITING_GAME_TTL_MS } from "./constants";

export interface HasCreatedAt { createdAt: number; status: string; player2?: string; mode?: string; }

// Generic expiry check for waiting games without a second player.
export function isWaitingGameExpired(game: HasCreatedAt | null | undefined, now = Date.now()): boolean {
  if (!game) return false;
  if (game.status !== "waiting") return false;
  return now - game.createdAt > WAITING_GAME_TTL_MS && !game.player2;
}

export function remainingWaitMs(game: HasCreatedAt | null | undefined, now = Date.now()): number {
  if (!game || game.status !== "waiting") return 0;
  return Math.max(0, game.createdAt + WAITING_GAME_TTL_MS - now);
}
