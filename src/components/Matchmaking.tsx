"use client";
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";

// Lazy import small QR generation (simple algorithm) to avoid adding heavy deps.
// We implement a trivial SVG QR via dynamically imported library if added later; for now use a data URI placeholder approach.
// For correctness & scannability we implement a minimal QR code generator (version auto) using third-party 'qrcode' if available.
let generateQr: (text: string) => Promise<string>;
try {
  // @ts-ignore dynamic optional import
  generateQr = async (text: string) => {
    const mod = await import("qrcode");
    return await mod.toDataURL(text, { width: 256, margin: 1 });
  };
} catch {
  generateQr = async (text: string) => Promise.resolve(`data:text/plain,${encodeURIComponent(text)}`);
}

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
  const editing = !profile;

  // Poll the invite game to detect when friend joins (simple approach: query games.get periodically)
  const inviteGame = useQuery(api.games.get, inviteGameId && playerId ? { id: inviteGameId as any } : "skip");
  const friendJoined = inviteGame && inviteGame.status !== "waiting";
  useEffect(() => {
    if (friendJoined && inviteGameId) {
      router.push(`/game/${inviteGameId}`);
    }
  }, [friendJoined, inviteGameId, router]);

  const gameLink = useMemo(() => inviteGameId ? `${window.location.origin}/game/${inviteGameId}` : null, [inviteGameId]);
  useEffect(() => {
    if (gameLink) {
      generateQr(gameLink).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [gameLink]);

  return (
    <div className="space-y-8 max-w-md">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Start Playing</h2>
        <p className="text-xs text-gray-500">Choose how you want to start a game.</p>
        <div className="flex flex-col gap-3">
          <button
            className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-40"
            disabled={!playerId || loadingAuto}
            onClick={async () => {
              if (!playerId) return;
              setLoadingAuto(true);
              try {
                const { gameId } = await autoMatch({ player: playerId });
                router.push(`/game/${gameId}`);
              } finally {
                setLoadingAuto(false);
              }
            }}
          >{loadingAuto ? "Matching..." : "Auto Match"}</button>
          <button
            className="px-4 py-2 rounded bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-40"
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

      {inviteGameId && (
        <section className="space-y-3 border rounded p-4 bg-white/5">
          <h3 className="font-medium text-sm">Invite a Friend</h3>
          <p className="text-xs text-gray-500">Share this link or QR code. Waiting for friend to join...</p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Game invite QR" className="w-40 h-40 mx-auto border bg-white p-2 rounded" />
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
                className="self-start text-[10px] underline"
                onClick={() => {
                  navigator.clipboard.writeText(gameLink);
                }}
              >Copy Link</button>
            </div>
          )}
          <div className="text-xs text-gray-500">You: {profile ? profile.username : playerId}</div>
        </section>
      )}
    </div>
  );
}
