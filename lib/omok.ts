export const BOARD_SIZE = 15;
export const LOBBY_CHANNEL = "omok:lobby";

export interface LobbyPresence {
  roomId: string;
  name: string;
  joinedAt: number;
}

export interface RoomSummary {
  roomId: string;
  hostName: string;
  playerCount: number;
  createdAt: number;
}

export type Stone = "black" | "white";
export type Cell = Stone | null;
export type Board = Cell[][];

export interface Move {
  row: number;
  col: number;
  stone: Stone;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Cell),
  );
}

export function applyMoves(moves: Move[]): Board {
  const board = createEmptyBoard();
  for (const m of moves) {
    if (
      m.row >= 0 &&
      m.row < BOARD_SIZE &&
      m.col >= 0 &&
      m.col < BOARD_SIZE
    ) {
      board[m.row][m.col] = m.stone;
    }
  }
  return board;
}

export function nextStone(moves: Move[]): Stone {
  return moves.length % 2 === 0 ? "black" : "white";
}

export const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export interface WinResult {
  stone: Stone;
  line: Array<[number, number]>;
}

// ─── 연속 돌 개수 계산 ────────────────────────────────────────────────────────
// 특정 방향으로 연속된 stone 개수를 반환합니다.
function countInDirection(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): number {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (
    r >= 0 && r < BOARD_SIZE &&
    c >= 0 && c < BOARD_SIZE &&
    board[r][c] === stone
  ) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

// ─── 한 방향의 연속 라인 길이 (양방향 합산) ──────────────────────────────────
function lineLength(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): number {
  return (
    1 +
    countInDirection(board, row, col, dr, dc, stone) +
    countInDirection(board, row, col, -dr, -dc, stone)
  );
}

// ─── 승리 판정 (렌주룰 적용) ─────────────────────────────────────────────────
// 흑(black): 정확히 5목만 승리. 장목(6목 이상)은 패배(금수).
// 백(white): 5목 이상 모두 승리.
export function checkWin(board: Board, last: Move): WinResult | null {
  const { row, col, stone } = last;

  for (const [dr, dc] of DIRECTIONS) {
    const line: Array<[number, number]> = [[row, col]];

    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 && r < BOARD_SIZE &&
      c >= 0 && c < BOARD_SIZE &&
      board[r][c] === stone
    ) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (
      r >= 0 && r < BOARD_SIZE &&
      c >= 0 && c < BOARD_SIZE &&
      board[r][c] === stone
    ) {
      line.unshift([r, c]);
      r -= dr;
      c -= dc;
    }

    if (stone === "black") {
      // 흑: 정확히 5목만 승리
      if (line.length === 5) return { stone, line };
    } else {
      // 백: 5목 이상 모두 승리
      if (line.length >= 5) return { stone, line };
    }
  }
  return null;
}

// ─── 렌주룰 금수 판정 ────────────────────────────────────────────────────────
// 흑이 (row, col)에 돌을 놓을 때 금수인지 확인합니다.
// 금수 종류: 장목(6목 이상), 4-4(열린 4가 2개 이상), 3-3(열린 3이 2개 이상)
// 단, 금수 위치에 놓아도 즉시 5목이 완성되면 금수 예외(승리 우선)입니다.

export type ForbiddenReason = "overline" | "double-four" | "double-three" | null;

// 가상으로 돌을 놓은 보드를 만들어 금수 판정에 사용
function boardWithStone(board: Board, row: number, col: number, stone: Stone): Board {
  const next = board.map((r) => [...r]);
  next[row][col] = stone;
  return next;
}

// 열린 4(open-four): 양쪽이 모두 열려 있는 4목
// 막힌 4(closed-four): 한쪽만 열려 있는 4목 (4-4 금수에서는 열린/막힌 모두 포함)
// 4-4 금수: 4목(열린/막힌 포함)이 2방향 이상인 경우
function countFours(board: Board, row: number, col: number, stone: Stone): number {
  let fours = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const len = lineLength(board, row, col, dr, dc, stone);
    if (len === 4) {
      fours++;
    }
  }
  return fours;
}

// 열린 3(open-three): 양쪽이 열려 있어 다음 수에 열린 4가 될 수 있는 3목
// 렌주룰의 3-3 금수는 '열린 3'이 2방향 이상인 경우입니다.
// 열린 3 판정: 해당 방향에서 길이가 3이고, 양 끝이 모두 빈 칸인 경우
function isOpenThree(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): boolean {
  const len = lineLength(board, row, col, dr, dc, stone);
  if (len !== 3) return false;

  // 라인의 양 끝 좌표를 구합니다
  let r = row;
  let c = col;
  // 양의 방향 끝
  while (
    r + dr >= 0 && r + dr < BOARD_SIZE &&
    c + dc >= 0 && c + dc < BOARD_SIZE &&
    board[r + dr][c + dc] === stone
  ) {
    r += dr;
    c += dc;
  }
  const frontR = r + dr;
  const frontC = c + dc;

  r = row;
  c = col;
  // 음의 방향 끝
  while (
    r - dr >= 0 && r - dr < BOARD_SIZE &&
    c - dc >= 0 && c - dc < BOARD_SIZE &&
    board[r - dr][c - dc] === stone
  ) {
    r -= dr;
    c -= dc;
  }
  const backR = r - dr;
  const backC = c - dc;

  const frontOpen =
    frontR >= 0 && frontR < BOARD_SIZE &&
    frontC >= 0 && frontC < BOARD_SIZE &&
    board[frontR][frontC] === null;

  const backOpen =
    backR >= 0 && backR < BOARD_SIZE &&
    backC >= 0 && backC < BOARD_SIZE &&
    board[backR][backC] === null;

  return frontOpen && backOpen;
}

function countOpenThrees(board: Board, row: number, col: number, stone: Stone): number {
  let threes = 0;
  for (const [dr, dc] of DIRECTIONS) {
    if (isOpenThree(board, row, col, dr, dc, stone)) {
      threes++;
    }
  }
  return threes;
}

export function checkForbidden(
  board: Board,
  row: number,
  col: number,
): ForbiddenReason {
  // 빈 칸이 아니면 금수 판정 불필요
  if (board[row][col] !== null) return null;

  const stone: Stone = "black";
  const next = boardWithStone(board, row, col, stone);

  // 5목 완성 시 금수 예외 (승리 우선)
  const winMove: Move = { row, col, stone };
  if (checkWin(next, winMove) !== null) return null;

  // 장목: 6목 이상
  for (const [dr, dc] of DIRECTIONS) {
    if (lineLength(next, row, col, dr, dc, stone) >= 6) {
      return "overline";
    }
  }

  // 4-4 금수: 4목(열린/막힌 포함)이 2방향 이상
  if (countFours(next, row, col, stone) >= 2) {
    return "double-four";
  }

  // 3-3 금수: 열린 3이 2방향 이상
  if (countOpenThrees(next, row, col, stone) >= 2) {
    return "double-three";
  }

  return null;
}

// ─── 보드 전체 금수 위치 목록 반환 ───────────────────────────────────────────
export function getForbiddenCells(board: Board): Array<{ row: number; col: number; reason: ForbiddenReason }> {
  const result: Array<{ row: number; col: number; reason: ForbiddenReason }> = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      const reason = checkForbidden(board, r, c);
      if (reason !== null) {
        result.push({ row: r, col: c, reason });
      }
    }
  }
  return result;
}

export function isBoardFull(board: Board): boolean {
  for (const row of board) {
    for (const cell of row) {
      if (cell === null) return false;
    }
  }
  return true;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generatePlayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
