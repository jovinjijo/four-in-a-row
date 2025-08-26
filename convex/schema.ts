import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Basic schema for a fourinarow game lobby and moves.
export default defineSchema({
  games: defineTable({
    createdAt: v.number(), // Date.now()
    status: v.string(), // waiting, active, finished
    mode: v.optional(v.string()), // friend | auto (default friend for legacy rows)
    currentPlayer: v.string(), // player1 / player2
    winner: v.optional(v.string()),
    board: v.array(v.array(v.string())), // 6 rows x 7 cols, values: '', 'R', 'Y'
    player1: v.string(),
    player2: v.optional(v.string()),
    player1Name: v.optional(v.string()),
    player2Name: v.optional(v.string()),
    winningCells: v.optional(v.array(v.array(v.number()))), // [[r,c], ...] when a win occurs
    rematchRequestP1At: v.optional(v.number()), // timestamp of player1 rematch request
    rematchRequestP2At: v.optional(v.number()), // timestamp of player2 rematch request
    rematchGameId: v.optional(v.id("games")), // forward link to created rematch game
    previousGameId: v.optional(v.id("games")), // back link for lineage
  })
    .index("by_status", ["status"]) // existing
    .index("by_created", ["createdAt"]) // existing
    .index("by_status_mode", ["status", "mode"]) // for auto-match queries
    .index("by_player1", ["player1"]) // for active games per player
    .index("by_player2", ["player2"]), // for active games per player
  moves: defineTable({
    gameId: v.id("games"),
    player: v.string(),
    column: v.number(),
    moveNumber: v.number(),
    createdAt: v.number(),
  }).index("by_game", ["gameId", "moveNumber"]),
  profiles: defineTable({
    playerId: v.string(),
    username: v.string(),
    usernameLower: v.string(),
    createdAt: v.number(),
  })
    .index("by_usernameLower", ["usernameLower"]) // uniqueness check
    .index("by_playerId", ["playerId"]),
});
