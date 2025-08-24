"use client";
import { useEffect, useState } from "react";

export function usePlayerId() {
  const [playerId, setPlayerId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const existing = localStorage.getItem("playerId");
      if (existing) setPlayerId(existing);
      else {
        const id = "p-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem("playerId", id);
        setPlayerId(id);
      }
    } catch {}
  }, []);
  return playerId;
}
