import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("games").withIndex("by_created").order("desc").take(20);
  },
});

export const create = mutation({
  args: { player: v.string() },
  handler: async (ctx, args) => {
    const emptyBoard = Array.from({ length: 6 }, () => Array(7).fill(""));
    const id = await ctx.db.insert("games", {
      createdAt: Date.now(),
      status: "waiting",
      currentPlayer: args.player,
      winner: undefined,
      board: emptyBoard,
      player1: args.player,
      player2: undefined,
    });
    return id;
  },
});

export const join = mutation({
  args: { gameId: v.id("games"), player: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    if (game.player1 === args.player || game.player2 === args.player) {
      return { alreadyIn: true };
    }
    if (game.player2) throw new Error("Game already has two players");
    await ctx.db.patch(args.gameId, { player2: args.player, status: "active" });
    return { joined: true };
  },
});

export const get = query({
  args: { id: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
