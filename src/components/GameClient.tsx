"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { usePlayerId } from "./usePlayerId";
import { FourInARowBoard, ResponsiveFourInARowBoard } from "./FourInARowBoard";
import { useResizeObserver } from "./useResizeObserver";
import Link from "next/link";
import { Id } from "@convex/_generated/dataModel";

interface Props { gameId: string }

export default function GameClient({ gameId }: Props) {
  const playerId = usePlayerId();
  // Cast the route param string to the branded Convex Id type once (safe if it originated from a valid _id serialized in a link)
  const game = useQuery(api.games.get, playerId ? { id: gameId as Id<"games"> } : "skip");
  const moves = useQuery(api.moves.listForGame, game ? { gameId: game._id } : "skip");
  const play = useMutation(api.moves.play);
  const join = useMutation(api.games.join);
  // Important: place resize observer hook before any early returns so hook order stays stable.
  const { ref: boardContainerRef, size: containerSize } = useResizeObserver<HTMLDivElement>();
  if (!playerId) return <div>Preparing your identity…</div>;
  if (game === undefined) return <div>Loading…</div>;
  if (game === null) return <div>Game not found. <Link href="/">Back</Link></div>;

  const youAreP1 = game.player1 === playerId;
  const youAreP2 = game.player2 === playerId;
  const token = youAreP1 ? "R" : youAreP2 ? "Y" : undefined;
  const yourTurn = token && game.currentPlayer === playerId && game.status === "active";
  const canJoin = game.status === "waiting" && !youAreP1 && !game.player2;

  const handlePlay = async (col: number) => {
    if (!yourTurn) return;
    try {
      await play({ gameId: game._id, player: playerId, column: col });
    } catch (e: unknown) {
      // Narrow unknown error type safely without using 'any'
      if (e instanceof Error) {
        console.error(e);
        alert(e.message);
      } else {
        console.error('Unknown error', e);
        alert(String(e));
      }
    }
  };

  return (
    <div className="space-y-6 flex flex-col items-center">
      <div className="flex justify-between items-center w-full max-w-4xl">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Game {String(game._id).slice(-6)}</h1>
          <p className="text-sm text-gray-500">
            Status: {game.status} {game.winner && ` – Winner: ${game.winner}`}
          </p>
          <p className="text-xs text-gray-500">You: {game.player1 === playerId ? (game.player1Name || playerId) : game.player2 === playerId ? (game.player2Name || playerId) : playerId} {token && `(token ${token})`}</p>
        </div>
        <Link href="/" className="text-sm underline">Lobby</Link>
      </div>

      {canJoin && (
        <button
          className="px-3 py-1 rounded bg-green-600 text-white text-sm hover:bg-green-700"
          onClick={() => join({ gameId: game._id, player: playerId })}
        >Join Game</button>
      )}

      <div ref={boardContainerRef} className="flex justify-center w-full px-2">
        <ResponsiveFourInARowBoard
          board={game.board}
          onPlay={handlePlay}
          canPlay={!!yourTurn}
          winningCells={game.winningCells}
          minCell={40}
          maxCell={72}
          containerWidth={containerSize.width}
        />
      </div>

      <div className="text-xs text-gray-500 text-center">
        {game.status === "finished" ? (
          <span>Game finished {game.winner ? `– Winner: ${game.winner}` : '– Draw'}</span>
        ) : yourTurn ? (
          <span>Your turn!</span>
        ) : (
          <span>{game.currentPlayer === playerId ? 'Waiting...' : 'Opponent turn'}</span>
        )}
      </div>

      <section className="space-y-1 w-full max-w-4xl">
        <h2 className="font-medium text-sm">Moves ({moves?.length ?? 0})</h2>
        <ol className="text-xs list-decimal list-inside space-y-0.5 max-h-48 overflow-y-auto pr-2 bg-black/10 rounded p-2">
          {moves?.map(m => {
            const name = m.player === game.player1 ? (game.player1Name || m.player.slice(0,8)) : m.player === game.player2 ? (game.player2Name || m.player.slice(0,8)) : m.player.slice(0,8);
            return <li key={m._id}>{name} → column {m.column + 1}</li>;
          })}
        </ol>
      </section>
    </div>
  );
}
