"use client";
import React, { useMemo } from "react";

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
  const cellStyle: React.CSSProperties = { width: cell, height: cell };
  const columnStyle: React.CSSProperties = { gap }; // vertical spacing between discs per column
  const winningSet = new Set<string>(winningCells?.map(([r,c]) => `${r},${c}`) ?? []);

  return (
    <div className="inline-block bg-blue-700 p-3 rounded-xl shadow-lg select-none" style={{ gap: gap / 2 }}>
      <div className="grid grid-cols-7" style={{ gap }}>
        {Array.from({ length: 7 }, (_, c) => {
          return (
            <div
              key={`col-${c}`}
              onClick={() => canPlay && onPlay(c)}
              className={`flex flex-col items-center ${canPlay ? 'cursor-pointer group' : ''}`}
              style={columnStyle}
              aria-label={`Column ${c + 1}`}
              role={canPlay ? 'button' : undefined}
              tabIndex={canPlay ? 0 : -1}
              onKeyDown={(e) => { if (canPlay && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPlay(c); } }}
            >
              {/* Column cells */}
              {board.map((row, r) => {
                const cellVal = row[c];
                const color = cellVal === 'R' ? 'bg-red-500' : cellVal === 'Y' ? 'bg-yellow-400' : 'bg-white';
                const isWin = winningSet.has(`${r},${c}`);
                return (
                  <div
                    key={`cell-${r}-${c}`}
                    style={cellStyle}
                    className={`rounded-full ${color} flex items-center justify-center shadow-inner transition-colors ${isWin ? 'ring-4 ring-green-400 animate-pulse' : ''} ${canPlay ? 'group-hover:brightness-110' : ''}`}
                    aria-label={cellVal ? (cellVal === 'R' ? 'Red piece' : 'Yellow piece') : 'Empty'}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Responsive wrapper: chooses a size based on available width while respecting min/max cell sizes.
// Assumes board is 7 columns wide; includes internal padding + approximate gap scaling like base component.
export interface ResponsiveBoardProps extends Omit<FourInARowBoardProps, 'size'> {
  minCell?: number; // lower bound for cell size
  maxCell?: number; // upper bound for cell size
  /** Optional explicit width to compute against (used for SSR fallbacks). */
  containerWidth?: number;
}

export function ResponsiveFourInARowBoard(props: ResponsiveBoardProps) {
  const { minCell = 40, maxCell = 72, containerWidth, ...rest } = props;
  // Estimate horizontal chrome: padding (p-3 => 0.75rem each side ~12px *2) + gaps.
  // We'll mirror gap = size*0.1 and 6 gaps between 7 cols.
  const computedSize = useMemo(() => {
    const width = containerWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
    // Iterate to solve size considering dynamic gap: total = 7*cell + 6*(cell*0.1) + horizontal padding (~24)
    // => total = cell * (7 + 0.6) + 24 = cell * 7.6 + 24
    const available = Math.max(0, width - 24);
    let cell = available / 7.6;
    cell = Math.max(minCell, Math.min(maxCell, cell));
    return Math.round(cell);
  }, [containerWidth, minCell, maxCell]);

  return <FourInARowBoard {...rest} size={computedSize} />;
}

