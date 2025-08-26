import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { isWaitingGameExpired as sharedIsExpired } from "../src/shared/expiry";
import { WAITING_GAME_TTL_MS } from "../src/shared/constants";
import type { Doc, Id } from "./_generated/dataModel";

// Minimal shape used for expiry checks; align with games doc fields accessed in helper
type GameForExpiry = Pick<Doc<"games">, "createdAt" | "status" | "player2"> & { _id: Id<"games"> };
// Delegate to shared helper (kept name locally for minimal diff where referenced)
function isExpiredWaitingGame(game: GameForExpiry | null | undefined): boolean { return sharedIsExpired(game); }

export const list = query({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db.query("games").withIndex("by_created").order("desc").take(50);
    // Filter out expired waiting games (cannot delete in a query; client just won't see them)
    return games.filter((g) => !isExpiredWaitingGame(g)).slice(0, 20);
  },
});

export const create = mutation({
  args: { player: v.string(), mode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill(""));
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.player))
      .unique();
    const id = await ctx.db.insert("games", {
      createdAt: Date.now(),
      status: "waiting",
      mode: args.mode || "friend",
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

// Auto-match: find an existing waiting auto game not created by this player; otherwise create one.
export const autoMatch = mutation({
  args: { player: v.string() },
  handler: async (ctx, args) => {
    // Find a waiting game in auto mode
    const candidates = await ctx.db
      .query("games")
      .withIndex("by_status_mode", (q) => q.eq("status", "waiting").eq("mode", "auto"))
      .take(20);
    for (const g of candidates) {
      if (isExpiredWaitingGame(g)) {
        await ctx.db.delete(g._id); // clean up dead game
        continue;
      }
      if (g.player1 !== args.player && !g.player2) {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_playerId", (q) => q.eq("playerId", args.player))
          .unique();
        await ctx.db.patch(g._id, { player2: args.player, player2Name: profile?.username, status: "active" });
        return { gameId: g._id, matched: true };
      }
    }
    // No suitable game; create one in auto mode
    const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill(""));
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.player))
      .unique();
    const id = await ctx.db.insert("games", {
      createdAt: Date.now(),
      status: "waiting",
      mode: "auto",
      currentPlayer: args.player,
      winner: undefined,
      board: emptyBoard,
      player1: args.player,
      player2: undefined,
      player1Name: profile?.username,
      player2Name: undefined,
    });
    return { gameId: id, matched: false };
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

export const activeForPlayer = query({
  args: { player: v.string() },
  handler: async (ctx, args) => {
    const p1 = await ctx.db
      .query("games")
      .withIndex("by_player1", (q) => q.eq("player1", args.player))
      .take(100);
    const p2 = await ctx.db
      .query("games")
      .withIndex("by_player2", (q) => q.eq("player2", args.player))
      .take(100);
    return [...p1, ...p2].filter(g => g.status === "active");
  }
});

export const waitingAutoForPlayer = query({
  args: { player: v.string() },
  handler: async (ctx, args) => {
    // Return a single waiting auto game the player owns (they are player1, no player2 yet)
    const games = await ctx.db
      .query("games")
      .withIndex("by_player1", (q) => q.eq("player1", args.player))
      .take(50);
    const candidate = games.find(g => g.status === "waiting" && g.mode === "auto" && !g.player2 && !isExpiredWaitingGame(g));
    return candidate || null;
  }
});

// Resign: active participant ends the game; opponent token becomes winner (if opponent exists).
export const resign = mutation({
  args: { gameId: v.id("games"), player: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game not active");
    if (game.player1 !== args.player && game.player2 !== args.player) throw new Error("Not a participant");
    if (!game.player2) {
      await ctx.db.patch(args.gameId, { status: "finished", winner: undefined, winningCells: undefined });
      return;
    }
    const resigningIsP1 = game.player1 === args.player;
    const winnerToken = resigningIsP1 ? "Y" : "R"; // opponent token
    await ctx.db.patch(args.gameId, { status: "finished", winner: winnerToken, winningCells: undefined });
  }
});

// Mutual rematch handshake: both players must request within TTL window before a new game is created.
export const requestRematch = mutation({
  args: { gameId: v.id("games"), player: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "finished") throw new Error("Game not finished");
    if (!game.player2) throw new Error("Need two players for rematch");
    if (game.player1 !== args.player && game.player2 !== args.player) throw new Error("Not a participant");
    if (game.rematchGameId) return { newGameId: game.rematchGameId };
    const now = Date.now();
    const p1Active = !!game.rematchRequestP1At && now - game.rematchRequestP1At < WAITING_GAME_TTL_MS;
    const p2Active = !!game.rematchRequestP2At && now - game.rematchRequestP2At < WAITING_GAME_TTL_MS;
    const patch: Partial<Doc<"games">> = {};
    if (args.player === game.player1) patch.rematchRequestP1At = now; else patch.rematchRequestP2At = now;
    const willP1 = args.player === game.player1 ? true : p1Active;
    const willP2 = args.player === game.player2 ? true : p2Active;
    if (willP1 && willP2) {
      let startingPlayer: string;
      if (game.winner) startingPlayer = game.winner === "R" ? game.player1 : game.player2; else startingPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
      const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill(""));
      const newId = await ctx.db.insert("games", {
        createdAt: now,
        status: "active",
        mode: game.mode || "friend",
        currentPlayer: startingPlayer,
        winner: undefined,
        board: emptyBoard,
        player1: game.player1,
        player2: game.player2,
        player1Name: game.player1Name,
        player2Name: game.player2Name,
        winningCells: undefined,
        previousGameId: game._id,
      });
  patch.rematchGameId = newId; // direct assignment; type matches optional field
      await ctx.db.patch(args.gameId, patch);
      return { newGameId: newId };
    }
    await ctx.db.patch(args.gameId, patch);
    return { waiting: true };
  }
});

// Cleanup: physically delete expired waiting games (can be invoked ad-hoc or on a schedule)
export const cleanupExpiredWaiting = mutation({
  args: {},
  handler: async (ctx) => {
    const waiting = await ctx.db.query("games").withIndex("by_status", q => q.eq("status", "waiting")).take(500);
    let deleted = 0;
    for (const g of waiting) {
      if (isExpiredWaitingGame(g)) {
        await ctx.db.delete(g._id);
        deleted++;
      }
    }
    return { deleted };
  }
});
