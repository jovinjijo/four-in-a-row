import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// TTL (ms) for games that are still in 'waiting' state without a second player.
const WAITING_GAME_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isExpiredWaitingGame(game: any): boolean {
  if (!game) return false;
  if (game.status !== "waiting") return false;
  return Date.now() - game.createdAt > WAITING_GAME_TTL_MS && !game.player2;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db.query("games").withIndex("by_created").order("desc").take(50);
    // Filter out expired waiting games (cannot delete in a query; client just won't see them)
    return games.filter((g) => !isExpiredWaitingGame(g)).slice(0, 20);
  },
});

export const create = mutation({
  args: { player: v.string() },
  handler: async (ctx, args) => {
    const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill(""));
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.player))
      .unique();
    const id = await ctx.db.insert("games", {
      createdAt: Date.now(),
      status: "waiting",
      currentPlayer: args.player,
      winner: undefined,
      board: emptyBoard,
      player1: args.player,
      player2: undefined,
      player1Name: profile?.username,
      player2Name: undefined,
    });
    return id;
  },
});

export const join = mutation({
  args: { gameId: v.id("games"), player: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (isExpiredWaitingGame(game)) {
      // Safe to delete here; game was never joined.
      await ctx.db.delete(args.gameId);
      throw new Error("Game expired");
    }
    if (game.player1 === args.player || game.player2 === args.player) {
      return { alreadyIn: true };
    }
    if (game.player2) throw new Error("Game already has two players");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.player))
      .unique();
    await ctx.db.patch(args.gameId, { player2: args.player, player2Name: profile?.username, status: "active" });
    return { joined: true };
  },
});

export const get = query({
  args: { id: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.id);
    if (isExpiredWaitingGame(game)) {
      // Can't delete inside a query; treat as not found to clients.
      return null;
    }
    return game;
  },
});
