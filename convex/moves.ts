import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

interface WinResult { winner: string; cells: number[][] }
function checkWinner(board: string[][]): WinResult | null {
  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diag down-right
    [1, -1], // diag down-left
  ];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of directions) {
        const cells = [[r, c]];
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 6 && nc >= 0 && nc < 7 && board[nr][nc] === player) {
          cells.push([nr, nc]);
          if (cells.length === 4) {
            return { winner: player, cells };
          }
          nr += dr;
          nc += dc;
        }
      }
    }
  }
  return null;
}

export const listForGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("moves")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("asc")
      .take(1000);
  },
});

export const play = mutation({
  args: { gameId: v.id("games"), player: v.string(), column: v.number() },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error("Game not found");
    // Mirror TTL logic from games.ts. Recompute inline to avoid import cycles.
    const WAITING_GAME_TTL_MS = 5 * 60 * 1000;
    if (game.status === "waiting" && !game.player2 && Date.now() - game.createdAt > WAITING_GAME_TTL_MS) {
      throw new Error("Game expired");
    }
    if (game.status !== "waiting" && game.status !== "active") throw new Error("Game not active");
    if (game.currentPlayer !== args.player) throw new Error("Not your turn");
    if (args.column < 0 || args.column > 6) throw new Error("Invalid column");

    // Take the board and drop piece
    const board: string[][] = game.board.map((row: string[]) => [...row]);
    let placedRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (!board[r][args.column]) {
        board[r][args.column] = args.player === game.player1 ? "R" : "Y";
        placedRow = r;
        break;
      }
    }
    if (placedRow === -1) throw new Error("Column full");

    const movesForGame = await ctx.db
      .query("moves")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(1);
    const moveNumber = movesForGame.length ? movesForGame[0].moveNumber + 1 : 1;

    await ctx.db.insert("moves", {
      gameId: args.gameId,
      player: args.player,
      column: args.column,
      moveNumber,
      createdAt: Date.now(),
    });

    let status = game.status === "waiting" ? "active" : game.status;

    const win = checkWinner(board);
    let winningCells: number[][] | undefined = undefined;
    if (win) {
      status = "finished";
      winningCells = win.cells;
    } else {
      // Draw detection: board full (top row has no empty cells)
      const topFull = board[0].every((v) => v !== "");
      if (topFull) {
        status = "finished"; // winner remains undefined
      }
    }

    await ctx.db.patch(args.gameId, {
      board,
      currentPlayer: args.player === game.player1 ? (game.player2 ?? game.player1) : game.player1,
      status,
      winner: win?.winner ?? undefined,
      winningCells,
    });
  },
});
