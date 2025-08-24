"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api"; // generated after running convex dev first time
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function GamesList() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  useEffect(() => {
    const existing = localStorage.getItem("playerId");
    if (existing) {
      setPlayerId(existing);
    } else {
      const id = "p-" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem("playerId", id);
      setPlayerId(id);
    }
  }, []);

  const router = useRouter();
  const games = useQuery(api.games.list) ?? [];
  const create = useMutation(api.games.create);
  const join = useMutation(api.games.join);
  const profile = useQuery(api.profiles.me, playerId ? { playerId } : "skip");
  const setUsername = useMutation(api.profiles.setUsername);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const editing = !profile; // show picker until one exists
  return (
    <div className="space-y-2 w-full max-w-md">
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40"
          onClick={async () => {
            if (!playerId) return;
            try {
              setCreating(true);
              const id = await create({ player: playerId });
              // Convex Id serializes to string automatically
              router.push(`/game/${id}`);
            } finally {
              setCreating(false);
            }
          }}
          disabled={!playerId || creating}
        >
          {creating ? "Creating..." : "New Game"}
        </button>
        <span className="text-xs text-gray-500">You: {profile ? profile.username : playerId ?? "..."}</span>
      </div>
      {playerId && editing && (
        <form
          className="flex gap-2 items-center text-xs"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nameInput) return;
            try {
              setNameError(null);
              const res = await setUsername({ playerId, username: nameInput });
              if (!res.ok) {
                setNameError(res.message);
                return;
              }
              setNameInput("");
            } catch (err) {
              setNameError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          <input
            className="border rounded px-2 py-1 flex-1 text-xs"
            placeholder="Pick a username"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={20}
          />
          <button className="px-2 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-40" disabled={!nameInput}>
            Save
          </button>
          {nameError && <span className="text-red-600 ml-2">{nameError}</span>}
        </form>
      )}
      <ul className="divide-y border rounded">
        {games.map((g) => {
          const youAreP1 = playerId && g.player1 === playerId;
          const youAreP2 = playerId && g.player2 === playerId;
          const canJoin = g.status === "waiting" && !youAreP1 && !g.player2;
          return (
            <li key={g._id} className="p-2 flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <Link href={`/game/${g._id}`} className="font-mono underline-offset-2 hover:underline">
                  {g._id.slice(-6)}
                </Link>
                <span className="uppercase tracking-wide text-xs text-gray-500">{g.status}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>P1: {(g.player1Name || g.player1.slice(0, 8))}{youAreP1 && " (you)"}</span>
                <span>P2: {g.player2 ? (g.player2Name || g.player2.slice(0, 8)) + (youAreP2 ? " (you)" : "") : canJoin ? (
                  <button
                    className="px-2 py-0.5 border rounded text-[10px] hover:bg-gray-100 disabled:opacity-40"
                    disabled={joiningId === String(g._id)}
                    onClick={async () => {
                      if (!playerId) return;
                      setJoiningId(String(g._id));
                      try {
                        await join({ gameId: g._id, player: playerId });
                        router.push(`/game/${g._id}`);
                      } finally {
                        setJoiningId(null);
                      }
                    }}
                  >{joiningId === String(g._id) ? '...' : 'Join'}</button>
                ) : "—"}</span>
              </div>
            </li>
          );
        })}
        {games.length === 0 && (
          <li className="p-2 text-xs text-gray-500">No games yet.</li>
        )}
      </ul>
    </div>
  );
}
