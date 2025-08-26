"use client";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { generateQrDataUrl } from "../shared/qr";
import { remainingWaitMs } from "../shared/expiry";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { Id, Doc } from "@convex/_generated/dataModel";

// QR generation handled by shared helper.

export function Matchmaking() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  useEffect(() => {
    let id = localStorage.getItem("playerId");
    if (!id) { id = "p-" + Math.random().toString(36).slice(2,8); localStorage.setItem("playerId", id); }
    setPlayerId(id);
  }, []);
  const profile = useQuery(api.profiles.me, playerId ? { playerId } : "skip");
  const setUsername = useMutation(api.profiles.setUsername);
  const autoMatch = useMutation(api.games.autoMatch);
  const create = useMutation(api.games.create);
  const router = useRouter();
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [loadingFriend, setLoadingFriend] = useState(false);
  const [inviteGameId, setInviteGameId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [autoGameId, setAutoGameId] = useState<string | null>(null);
  const [navigatingGameId, setNavigatingGameId] = useState<string | null>(null);
  // Auto-match waiting state
  const waitingAutoGame = useQuery(api.games.waitingAutoForPlayer, playerId ? { player: playerId } : "skip");
  const activeGames = useQuery(api.games.activeForPlayer, playerId ? { player: playerId } : "skip");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!waitingAutoGame && !inviteGameId) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waitingAutoGame, inviteGameId]);
  // Track auto game id if query finds one (handles refresh)
  useEffect(() => {
    if (waitingAutoGame && !autoGameId) setAutoGameId(String(waitingAutoGame._id));
  }, [waitingAutoGame, autoGameId]);
  const autoRemainingMs = remainingWaitMs(waitingAutoGame ?? null, now);
  const autoRemainingStr = waitingAutoGame ? `${Math.floor(autoRemainingMs/1000)}s` : null;
  // Friend invite countdown
  const inviteGame = useQuery(api.games.get, inviteGameId && playerId ? { id: inviteGameId as Id<"games"> } : "skip");
  const friendRemainingMs = remainingWaitMs(inviteGame ?? null, now);
  const friendRemainingStr = inviteGame ? `${Math.floor(friendRemainingMs/1000)}s` : null;
  const editing = !profile;

  // Auto-match game watcher
  const autoGame = useQuery(api.games.get, autoGameId && playerId ? { id: autoGameId as Id<"games"> } : "skip");
  useEffect(() => {
    if (autoGame && autoGame.status === "active" && autoGameId) {
      // Set navigating state before triggering route change so UI can freeze.
      if (!navigatingGameId) setNavigatingGameId(autoGameId);
      router.push(`/game/${autoGameId}`);
    }
  }, [autoGame, autoGameId, router, navigatingGameId]);
  // Friend invite watcher
  const friendJoined = inviteGame && inviteGame.status === "active";
  useEffect(() => {
    if (friendJoined && inviteGameId) {
      if (!navigatingGameId) setNavigatingGameId(inviteGameId);
      router.push(`/game/${inviteGameId}`);
    }
  }, [friendJoined, inviteGameId, router, navigatingGameId]);

  const gameLink = useMemo(() => inviteGameId ? `${window.location.origin}/game/${inviteGameId}` : null, [inviteGameId]);
  useEffect(() => {
    if (gameLink) {
      generateQrDataUrl(gameLink).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [gameLink]);

  return (
    <div className="space-y-8 max-w-md relative">
      {navigatingGameId && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm text-center px-6">
          <div className="animate-spin h-6 w-6 rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm font-medium text-white">Loading game…</p>
          <p className="text-[11px] text-white/70">Preparing realtime state</p>
        </div>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Start Playing</h2>
        <p className="text-xs text-gray-500">Choose how you want to start a game.</p>
        <p className="text-[11px] text-gray-600">You: {profile ? profile.username : playerId ? playerId.slice(0,8) : '...'}</p>
  <div className={`flex flex-col gap-3 ${navigatingGameId ? 'opacity-50 pointer-events-none select-none' : ''}`}> 
          <div className="flex flex-col gap-1">
            <button
              className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-40 cursor-pointer"
              disabled={!playerId || loadingAuto || !!waitingAutoGame || !!autoGameId && autoGame?.status !== 'active'}
              onClick={async () => {
                if (!playerId) return;
                setLoadingAuto(true);
                try {
                  const { gameId, matched } = await autoMatch({ player: playerId });
                  if (matched) {
                    // Immediate match (you joined an existing waiting game) – show loading overlay
                    setNavigatingGameId(String(gameId));
                    router.push(`/game/${gameId}`);
                  } else {
                    setAutoGameId(String(gameId));
                  }
                } finally {
                  setLoadingAuto(false);
                }
              }}
            >{waitingAutoGame ? "Waiting for Opponent" : loadingAuto ? "Matching..." : "Auto Match"}</button>
            {waitingAutoGame && (
              <p className="text-[10px] text-gray-500">Auto-match: waiting… Expires in {autoRemainingStr}</p>
            )}
          </div>
          <button
            className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-40 cursor-pointer"
            disabled={!playerId || loadingFriend}
            onClick={async () => {
              if (!playerId) return;
              setLoadingFriend(true);
              try {
                const gameId = await create({ player: playerId, mode: "friend" });
                setInviteGameId(String(gameId));
              } finally {
                setLoadingFriend(false);
              }
            }}
          >{loadingFriend ? "Creating..." : "Play with a Friend"}</button>
        </div>
      </section>

      {playerId && editing && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Pick a Username</h3>
            <form
              className="flex gap-2 items-center text-xs"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!nameInput) return;
                try {
                  setNameError(null);
                  const res = await setUsername({ playerId, username: nameInput });
                  if (!res.ok) { setNameError(res.message); return; }
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
              <button className="px-2 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-40" disabled={!nameInput}>Save</button>
              {nameError && <span className="text-red-600 ml-2">{nameError}</span>}
            </form>
        </section>
      )}

      {activeGames && activeGames.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium text-sm">Your Active Games</h3>
          <ul className="border rounded divide-y text-xs">
            {activeGames.map(g => {
              const p1 = g.player1Name || g.player1.slice(0,8);
              const p2 = g.player2Name || (g.player2 ? g.player2.slice(0,8) : '—');
              const youAreP1 = playerId === g.player1;
              const youAreP2 = playerId === g.player2;
              return (
                <li key={g._id} className="p-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono">{String(g._id).slice(-6)}</span>
                    <button
                      className="underline cursor-pointer hover:text-indigo-600"
                      onClick={() => router.push(`/game/${g._id}`)}
                    >Open</button>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    <span>{youAreP1 ? 'You' : p1}</span>
                    <span className="mx-1">vs</span>
                    <span>{youAreP2 ? 'You' : p2}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {inviteGameId && inviteGame && inviteGame.status === 'waiting' && (
        <section className="space-y-3 border rounded p-4 bg-white/5">
          <h3 className="font-medium text-sm">Invite a Friend</h3>
          <p className="text-xs text-gray-500">Share this link or QR code. Waiting for friend to join… Expires in {friendRemainingStr}</p>
          {qrDataUrl ? (
            <Image src={qrDataUrl} width={160} height={160} alt="Game invite QR" className="w-40 h-40 mx-auto border bg-white p-2 rounded cursor-pointer" onClick={() => gameLink && navigator.clipboard.writeText(gameLink)} title="Click to copy link" unoptimized />
          ) : (
            <div className="w-40 h-40 flex items-center justify-center bg-gray-200 text-gray-500 text-xs mx-auto rounded">QR...</div>
          )}
          {gameLink && (
            <div className="flex flex-col gap-1">
              <input
                readOnly
                className="text-xs px-2 py-1 border rounded font-mono"
                value={gameLink}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                className="self-start text-[10px] underline cursor-pointer hover:text-indigo-600"
                onClick={() => {
                  navigator.clipboard.writeText(gameLink);
                }}
              >Copy Link</button>
            </div>
          )}
          <div className="text-xs text-gray-500">You: {profile ? profile.username : playerId}</div>
        </section>
      )}
      {inviteGameId && inviteGame && inviteGame.status !== 'waiting' && (
        <p className="text-[10px] text-gray-500">Friend joined! Opening game…</p>
      )}
    </div>
  );
}
