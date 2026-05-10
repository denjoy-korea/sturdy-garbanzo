"use client";

import { useEffect, useState } from "react";
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

const LABEL = 12;
const MIN_CELL = 18;
const MAX_CELL = 34;
// Total non-grid horizontal space: border(4*2) + padding(8*2) + label = 8 + 16 + LABEL
const CHROME_X = 8 + 16 + LABEL;

function computeCell(): number {
  if (typeof window === "undefined") return 28;
  const vw = window.innerWidth;
  // Page padding on Game page is ~24px sides total
  const pageInner = Math.min(vw - 16, 560);
  const cell = Math.floor((pageInner - CHROME_X) / BOARD_SIZE);
  return Math.max(MIN_CELL, Math.min(MAX_CELL, cell));
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
  const [cell, setCell] = useState<number>(28);

  useEffect(() => {
    const update = () => setCell(computeCell());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const stone = Math.round(cell * 0.86);
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
        gap: 2,
        background: "#dcb16a",
        padding: "6px 8px 8px",
        borderRadius: 4,
        border: "4px solid #050710",
        boxShadow:
          "0 0 0 2px #4a5170, 4px 4px 0 #050710, 0 0 24px rgba(255,216,61,0.08)",
      }}
    >
      {/* Column labels (top) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${LABEL}px repeat(${BOARD_SIZE}, ${cell}px)`,
          gap: 0,
          fontSize: 9,
          color: "#5a3818",
          fontWeight: 700,
          marginLeft: -cell / 2,
          paddingLeft: LABEL,
        }}
      >
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <div
            key={`col-${i}`}
            style={{
              width: cell,
              textAlign: "center",
              transform: `translateX(${cell / 2}px)`,
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
            fontSize: 9,
            color: "#5a3818",
            fontWeight: 700,
          }}
        >
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <div
              key={`row-${i}`}
              style={{
                height: cell,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 3,
                transform: `translateY(${-cell / 2}px)`,
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
            width: cell * (BOARD_SIZE - 1),
            height: cell * (BOARD_SIZE - 1),
            margin: `${cell / 2}px ${cell / 2}px`,
          }}
        >
          {/* grid lines */}
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <div
              key={`h-${i}`}
              style={{
                position: "absolute",
                left: 0,
                top: i * cell,
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
                left: i * cell,
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
                left: c * cell - 3,
                top: r * cell - 3,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#3b2a13",
              }}
            />
          ))}
          {/* clickable intersections */}
          {board.map((row, r) =>
            row.map((boardCell, c) => {
              const empty = boardCell === null;
              const canPlaceHere = canPlaceAnywhere && empty;
              return (
                <button
                  key={`${r}-${c}`}
                  aria-label={`${COLS[c]}${r + 1}`}
                  onClick={() => canPlaceHere && onPlace(r, c)}
                  onMouseEnter={() =>
                    canPlaceHere && setHover({ row: r, col: c })
                  }
                  onMouseLeave={() =>
                    setHover((h) =>
                      h && h.row === r && h.col === c ? null : h,
                    )
                  }
                  disabled={!canPlaceHere}
                  style={{
                    position: "absolute",
                    left: c * cell - cell / 2,
                    top: r * cell - cell / 2,
                    width: cell,
                    height: cell,
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
                  left: hover.col * cell - stone / 2,
                  top: hover.row * cell - stone / 2,
                  width: stone,
                  height: stone,
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
                left: hint.col * cell - stone / 2,
                top: hint.row * cell - stone / 2,
                width: stone,
                height: stone,
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
            row.map((boardCell, c) => {
              if (!boardCell) return null;
              const key = `${r},${c}`;
              const isLast = lastKey === key;
              const isWin = winSet.has(key);
              return (
                <div
                  key={`stone-${r}-${c}`}
                  style={{
                    position: "absolute",
                    left: c * cell - stone / 2,
                    top: r * cell - stone / 2,
                    width: stone,
                    height: stone,
                    borderRadius: "50%",
                    background:
                      boardCell === "black"
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
                        color: boardCell === "black" ? "#5ec5ff" : "#3b82f6",
                        fontSize: Math.max(8, Math.round(stone * 0.4)),
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

const STAR_POINTS: Array<[number, number]> = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11],
];
