"use client";
import React, { useMemo } from "react";

export interface FourInARowBoardProps {
  board: string[][]; // 6 x 7
  currentPlayerToken?: string; // 'R' or 'Y'
  canPlay: boolean;
  onPlay: (col: number) => void;
  size?: number; // pixel size of a cell (default 56)
  winningCells?: number[][]; // [[r,c], ...] to highlight
  lastMove?: { row: number; col: number } | null; // coordinate of last placed piece for animation
}

export function FourInARowBoard({ board, onPlay, canPlay, size = 56, winningCells, currentPlayerToken, lastMove }: FourInARowBoardProps) {
  const [hoverCol, setHoverCol] = React.useState<number | null>(null);
  // Detect whether the current primary pointer actually supports hover (exclude touch-only devices)
  const [supportsHover, setSupportsHover] = React.useState(false);
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
      const update = () => setSupportsHover(mq.matches);
      update();
      if (mq.addEventListener) mq.addEventListener('change', update);
      return () => { if (mq.removeEventListener) mq.removeEventListener('change', update); };
    }
  }, []);
  const cell = size;
  const gap = Math.round(size * 0.1); // dynamic gap
  const cellStyle: React.CSSProperties = { width: cell, height: cell };
  const columnStyle: React.CSSProperties = { gap }; // vertical spacing between discs per column
  const winningSet = new Set<string>(winningCells?.map(([r,c]) => `${r},${c}`) ?? []);
  const rows = board.length;

  function landingRow(col: number): number | null {
    for (let r = rows - 1; r >= 0; r--) {
      if (!board[r][col]) return r;
    }
    return null;
  }
  const ghostRow = hoverCol != null ? landingRow(hoverCol) : null;

  return (
    <div className="inline-block bg-blue-700 p-3 rounded-xl shadow-lg select-none" style={{ gap: gap / 2 }}>
      <div className="grid grid-cols-7" style={{ gap }}>
        {Array.from({ length: 7 }, (_, c) => {
          return (
            <div
              key={`col-${c}`}
              onClick={() => canPlay && onPlay(c)}
              className={`flex flex-col items-center relative ${canPlay ? 'cursor-pointer group' : ''}`}
              style={columnStyle}
              aria-label={`Column ${c + 1}`}
              role={canPlay ? 'button' : undefined}
              tabIndex={canPlay ? 0 : -1}
              onKeyDown={(e) => { if (canPlay && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPlay(c); } }}
              onMouseEnter={() => supportsHover && setHoverCol(c)}
              onMouseLeave={() => supportsHover && setHoverCol(prev => prev === c ? null : prev)}
            >
              {/* Column cells */}
              {board.map((row, r) => {
                const cellVal = row[c];
                const color = cellVal === 'R' ? 'bg-red-500' : cellVal === 'Y' ? 'bg-yellow-400' : 'bg-white';
                const isWin = winningSet.has(`${r},${c}`);
                const isLast = lastMove && lastMove.row === r && lastMove.col === c;
                return (
                  <div
                    key={`cell-${r}-${c}`}
                    style={{ ...cellStyle, ...(isLast ? { ['--fromY' as unknown as string]: `-${(r + 1) * (cell + gap)}px` } : {}) }}
                    className={`rounded-full ${color} flex items-center justify-center shadow-inner transition-colors ${isWin ? 'ring-4 ring-green-400 animate-pulse' : ''} ${canPlay ? 'group-hover:brightness-110' : ''} ${isLast ? 'animate-drop' : ''}`}
                    aria-label={cellVal ? (cellVal === 'R' ? 'Red piece' : 'Yellow piece') : 'Empty'}
                  />
                );
              })}
              {/* Ghost preview overlay */}
              {canPlay && supportsHover && hoverCol === c && ghostRow != null && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center" style={{ gap }}>
                  {board.map((_, r) => {
                    if (r !== ghostRow) return <div key={`ghost-spacer-${r}`} style={cellStyle} className="opacity-0" />;
                    const ghostColor = currentPlayerToken === 'R' ? 'bg-red-500' : 'bg-yellow-400';
                    return (
                      <div key={`ghost-${r}`} style={cellStyle} className={`rounded-full ${ghostColor} opacity-35 ring-2 ring-white/60`} />
                    );
                  })}
                </div>
              )}
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

