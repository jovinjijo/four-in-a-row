"use client";
import React from "react";

export interface FourInARowBoardProps {
  board: string[][]; // 6 x 7
  currentPlayerToken?: string; // 'R' or 'Y'
  canPlay: boolean;
  onPlay: (col: number) => void;
  size?: number; // pixel size of a cell (default 56)
  winningCells?: number[][]; // [[r,c], ...] to highlight
}

export function FourInARowBoard({ board, onPlay, canPlay, size = 56, winningCells }: FourInARowBoardProps) {
  const cell = size;
  const gap = Math.round(size * 0.1); // dynamic gap
  const btnHeight = Math.max(28, Math.round(size * 0.35));
  const btnStyle: React.CSSProperties = { height: btnHeight, width: cell, fontSize: Math.round(size * 0.25) };
  const cellStyle: React.CSSProperties = { width: cell, height: cell };
  const winningSet = new Set<string>(winningCells?.map(([r,c]) => `${r},${c}`) ?? []);

  return (
    <div className="inline-block bg-blue-700 p-3 rounded-xl shadow-lg select-none" style={{ gap: gap / 2 }}>
      <div className="grid grid-cols-7" style={{ gap }}>
        {Array.from({ length: 7 }, (_, c) => (
          <button
            key={`col-btn-${c}`}
            style={btnStyle}
            className="rounded bg-blue-500 hover:bg-blue-400 text-white font-semibold leading-none flex items-center justify-center transition disabled:opacity-30"
            disabled={!canPlay}
            onClick={() => onPlay(c)}
            aria-label={`Drop in column ${c + 1}`}
          >
            ▼
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 mt-2" style={{ gap }}>
        {board.map((row, r) =>
          row.map((cellVal, c) => {
            const color = cellVal === "R" ? "bg-red-500" : cellVal === "Y" ? "bg-yellow-400" : "bg-white";
            const isWin = winningSet.has(`${r},${c}`);
            return (
              <div
                key={`cell-${r}-${c}`}
                style={cellStyle}
                className={`rounded-full ${color} flex items-center justify-center shadow-inner ${isWin ? 'ring-4 ring-green-400 animate-pulse' : ''}`}
                aria-label={cellVal ? (cellVal === "R" ? "Red piece" : "Yellow piece") : "Empty"}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
