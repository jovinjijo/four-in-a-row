import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Basic schema for a fourinarow game lobby and moves.
export default defineSchema({
  games: defineTable({
    createdAt: v.number(), // Date.now()
    status: v.string(), // waiting, active, finished
    currentPlayer: v.string(), // player1 / player2
    winner: v.optional(v.string()),
    board: v.array(v.array(v.string())), // 6 rows x 7 cols, values: '', 'R', 'Y'
    player1: v.string(),
    player2: v.optional(v.string()),
  }).index("by_status", ["status"]).index("by_created", ["createdAt"]),
  moves: defineTable({
    gameId: v.id("games"),
    player: v.string(),
    column: v.number(),
    moveNumber: v.number(),
    createdAt: v.number(),
  }).index("by_game", ["gameId", "moveNumber"]),
});
