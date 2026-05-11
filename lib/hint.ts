import {
  applyMoves,
  BOARD_SIZE,
  type Board,
  checkForbidden,
  type Move,
  type Stone,
} from "./omok";

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function scoreLine(
  board: Board,
  r: number,
  c: number,
  dr: number,
  dc: number,
  stone: Stone,
): number {
  let count = 1;
  let openEnds = 0;

  let fr = r + dr;
  let fc = c + dc;
  while (
    fr >= 0 &&
    fr < BOARD_SIZE &&
    fc >= 0 &&
    fc < BOARD_SIZE &&
    board[fr][fc] === stone
  ) {
    count++;
    fr += dr;
    fc += dc;
  }
  if (
    fr >= 0 &&
    fr < BOARD_SIZE &&
    fc >= 0 &&
    fc < BOARD_SIZE &&
    board[fr][fc] === null
  ) {
    openEnds++;
  }

  let br = r - dr;
  let bc = c - dc;
  while (
    br >= 0 &&
    br < BOARD_SIZE &&
    bc >= 0 &&
    bc < BOARD_SIZE &&
    board[br][bc] === stone
  ) {
    count++;
    br -= dr;
    bc -= dc;
  }
  if (
    br >= 0 &&
    br < BOARD_SIZE &&
    bc >= 0 &&
    bc < BOARD_SIZE &&
    board[br][bc] === null
  ) {
    openEnds++;
  }

  if (count >= 5) return 100000;
  if (count === 4) {
    if (openEnds === 2) return 10000;
    if (openEnds === 1) return 1000;
    return 0;
  }
  if (count === 3) {
    if (openEnds === 2) return 1000;
    if (openEnds === 1) return 100;
    return 0;
  }
  if (count === 2) {
    if (openEnds === 2) return 100;
    if (openEnds === 1) return 10;
    return 0;
  }
  if (count === 1) {
    return openEnds >= 1 ? 1 : 0;
  }
  return 0;
}

function scoreCell(board: Board, r: number, c: number, stone: Stone): number {
  let total = 0;
  for (const [dr, dc] of DIRECTIONS) {
    total += scoreLine(board, r, c, dr, dc, stone);
  }
  return total;
}

function hasNearbyStone(board: Board, r: number, c: number): boolean {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 &&
        nr < BOARD_SIZE &&
        nc >= 0 &&
        nc < BOARD_SIZE &&
        board[nr][nc] !== null
      ) {
        return true;
      }
    }
  }
  return false;
}

export function suggestMove(
  moves: Move[],
  myStone: Stone,
): { row: number; col: number } | null {
  if (moves.length === 0) {
    return { row: 7, col: 7 };
  }

  const board = applyMoves(moves);
  const oppStone: Stone = myStone === "black" ? "white" : "black";

  let bestRow = -1;
  let bestCol = -1;
  let bestScore = -1;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      if (!hasNearbyStone(board, r, c)) continue;

      // 흑의 경우 금수 위치는 추천하지 않음 (단, 즉시 승리 가능한 위치는 예외)
      if (myStone === "black") {
        const forbidden = checkForbidden(board, r, c);
        if (forbidden !== null) continue;
      }

      const my = scoreCell(board, r, c, myStone);
      const opp = scoreCell(board, r, c, oppStone);
      const total = my * 1.1 + opp;

      if (total > bestScore) {
        bestScore = total;
        bestRow = r;
        bestCol = c;
      }
    }
  }

  if (bestRow === -1) return null;
  return { row: bestRow, col: bestCol };
}
