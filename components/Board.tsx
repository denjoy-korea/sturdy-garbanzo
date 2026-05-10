"use client";

import { useState } from "react";
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
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);
  const winSet = new Set(
    (winningLine ?? []).map(([r, c]) => `${r},${c}`),
  );

  const COLS = "ABCDEFGHIJKLMNO";
  const lastKey = lastMove ? `${lastMove.row},${lastMove.col}` : null;
  const canPlaceAnywhere = !disabled && myTurn && myStone !== null;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        background: "#dcb16a",
        padding: "10px 14px 14px",
        borderRadius: 4,
        border: "4px solid #050710",
        boxShadow:
          "0 0 0 2px #4a5170, 6px 6px 0 #050710, 0 0 24px rgba(255,216,61,0.08)",
      }}
    >
      {/* Column labels (top) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${LABEL}px repeat(${BOARD_SIZE}, ${CELL}px)`,
          gap: 0,
          marginLeft: -CELL / 2,
          fontSize: 10,
          color: "#5a3818",
          fontWeight: 700,
          letterSpacing: 0,
          paddingLeft: LABEL,
        }}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <div
            key={`col-${i}`}
            style={{
              width: CELL,
              textAlign: "center",
              transform: `translateX(${CELL / 2}px)`,
            }}
          >
            {COLS[i]}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 0,
        }}
      >
        {/* Row labels (left) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: LABEL,
            fontSize: 10,
            color: "#5a3818",
            fontWeight: 700,
            paddingTop: 0,
          }}
        >
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <div
              key={`row-${i}`}
              style={{
                height: CELL,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 4,
                transform: `translateY(${-CELL / 2}px)`,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Board grid */}
        <div
          style={{
            position: "relative",
            width: CELL * (BOARD_SIZE - 1),
            height: CELL * (BOARD_SIZE - 1),
            margin: `${CELL / 2}px ${CELL / 2}px`,
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
              const canPlaceHere = canPlaceAnywhere && empty;
              return (
                <button
                  key={`${r}-${c}`}
                  aria-label={`${COLS[c]}${r + 1}`}
                  onClick={() => canPlaceHere && onPlace(r, c)}
                  onMouseEnter={() => canPlaceHere && setHover({ row: r, col: c })}
                  onMouseLeave={() =>
                    setHover((h) =>
                      h && h.row === r && h.col === c ? null : h,
                    )
                  }
                  disabled={!canPlaceHere}
                  style={{
                    position: "absolute",
                    left: c * CELL - CELL / 2,
                    top: r * CELL - CELL / 2,
                    width: CELL,
                    height: CELL,
                    cursor: canPlaceHere ? "pointer" : "default",
                    background: "transparent",
                    padding: 0,
                    zIndex: 2,
                  }}
                />
              );
            }),
          )}
          {/* hover preview */}
          {hover &&
            myStone &&
            board[hover.row][hover.col] === null &&
            canPlaceAnywhere && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: hover.col * CELL - STONE / 2,
                  top: hover.row * CELL - STONE / 2,
                  width: STONE,
                  height: STONE,
                  borderRadius: "50%",
                  background:
                    myStone === "black"
                      ? "radial-gradient(circle at 30% 30%, #888, #000)"
                      : "radial-gradient(circle at 30% 30%, #fff, #aaa)",
                  opacity: 0.45,
                  pointerEvents: "none",
                  zIndex: 3,
                }}
              />
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
            @keyframes omokStonePop {
              0% { transform: scale(0.2); opacity: 0; }
              60% { transform: scale(1.18); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes omokWinFlash {
              0%, 100% { box-shadow: 0 0 0 3px #ef4444, 0 2px 4px rgba(0,0,0,0.4); }
              50% { box-shadow: 0 0 0 4px #ffd83d, 0 0 18px rgba(255,216,61,0.9); }
            }
          `}</style>
          {/* stones */}
          {board.map((row, r) =>
            row.map((cell, c) => {
              if (!cell) return null;
              const key = `${r},${c}`;
              const isLast = lastKey === key;
              const isWin = winSet.has(key);
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
                      ? "0 0 0 2px #3b82f6, 0 0 10px rgba(59,130,246,0.6)"
                      : "0 2px 4px rgba(0,0,0,0.4)",
                    pointerEvents: "none",
                    zIndex: 3,
                    animation: isLast
                      ? "omokStonePop 0.22s ease-out"
                      : isWin
                      ? "omokWinFlash 0.9s ease-in-out infinite"
                      : undefined,
                  }}
                >
                  {isLast && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: cell === "black" ? "#5ec5ff" : "#3b82f6",
                        fontSize: 12,
                        fontWeight: 800,
                        pointerEvents: "none",
                      }}
                    >
                      ●
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

const CELL = 32;
const STONE = 28;
const LABEL = 14;
const STAR_POINTS: Array<[number, number]> = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];
