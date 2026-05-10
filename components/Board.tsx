"use client";

import { BOARD_SIZE, type Board, type Stone } from "@/lib/omok";

interface Props {
  board: Board;
  lastMove: { row: number; col: number } | null;
  winningLine: Array<[number, number]> | null;
  hint: { row: number; col: number } | null;
  myStone: Stone | null;
  myTurn: boolean;
  disabled: boolean;
  onPlace: (row: number, col: number) => void;
}

export default function BoardView({
  board,
  lastMove,
  winningLine,
  hint,
  myStone,
  myTurn,
  disabled,
  onPlace,
}: Props) {
  const winSet = new Set(
    (winningLine ?? []).map(([r, c]) => `${r},${c}`),
  );

  return (
    <div
      style={{
        display: "inline-block",
        background: "#dcb16a",
        padding: 18,
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: CELL * (BOARD_SIZE - 1),
          height: CELL * (BOARD_SIZE - 1),
        }}
      >
        {/* grid lines */}
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <div
            key={`h-${i}`}
            style={{
              position: "absolute",
              left: 0,
              top: i * CELL,
              width: "100%",
              height: 1,
              background: "#3b2a13",
            }}
          />
        ))}
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <div
            key={`v-${i}`}
            style={{
              position: "absolute",
              top: 0,
              left: i * CELL,
              height: "100%",
              width: 1,
              background: "#3b2a13",
            }}
          />
        ))}
        {/* star points */}
        {STAR_POINTS.map(([r, c]) => (
          <div
            key={`s-${r}-${c}`}
            style={{
              position: "absolute",
              left: c * CELL - 4,
              top: r * CELL - 4,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3b2a13",
            }}
          />
        ))}
        {/* clickable intersections */}
        {board.map((row, r) =>
          row.map((cell, c) => {
            const empty = cell === null;
            const canPlace = !disabled && empty && myTurn && myStone !== null;
            return (
              <button
                key={`${r}-${c}`}
                aria-label={`행 ${r + 1}, 열 ${c + 1}`}
                onClick={() => canPlace && onPlace(r, c)}
                disabled={!canPlace}
                style={{
                  position: "absolute",
                  left: c * CELL - CELL / 2,
                  top: r * CELL - CELL / 2,
                  width: CELL,
                  height: CELL,
                  cursor: canPlace ? "pointer" : "default",
                  background: "transparent",
                  padding: 0,
                  zIndex: 2,
                }}
              />
            );
          }),
        )}
        {/* hint marker */}
        {hint && board[hint.row]?.[hint.col] === null && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: hint.col * CELL - STONE / 2,
              top: hint.row * CELL - STONE / 2,
              width: STONE,
              height: STONE,
              borderRadius: "50%",
              border: "3px dashed #fbbf24",
              boxShadow: "0 0 12px rgba(251, 191, 36, 0.7)",
              animation: "omokHintPulse 1.2s ease-in-out infinite",
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        )}
        <style>{`
          @keyframes omokHintPulse {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.15); opacity: 1; }
          }
        `}</style>
        {/* stones */}
        {board.map((row, r) =>
          row.map((cell, c) => {
            if (!cell) return null;
            const isLast =
              lastMove && lastMove.row === r && lastMove.col === c;
            const isWin = winSet.has(`${r},${c}`);
            return (
              <div
                key={`stone-${r}-${c}`}
                style={{
                  position: "absolute",
                  left: c * CELL - STONE / 2,
                  top: r * CELL - STONE / 2,
                  width: STONE,
                  height: STONE,
                  borderRadius: "50%",
                  background:
                    cell === "black"
                      ? "radial-gradient(circle at 30% 30%, #555, #000)"
                      : "radial-gradient(circle at 30% 30%, #fff, #c0c0c0)",
                  boxShadow: isWin
                    ? "0 0 0 3px #ef4444, 0 2px 4px rgba(0,0,0,0.4)"
                    : isLast
                    ? "0 0 0 2px #3b82f6, 0 2px 4px rgba(0,0,0,0.4)"
                    : "0 2px 4px rgba(0,0,0,0.4)",
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

const CELL = 32;
const STONE = 28;
const STAR_POINTS: Array<[number, number]> = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];
