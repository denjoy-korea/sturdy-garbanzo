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

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export interface WinResult {
  stone: Stone;
  line: Array<[number, number]>;
}

export function checkWin(board: Board, last: Move): WinResult | null {
  const { row, col, stone } = last;
  for (const [dr, dc] of DIRECTIONS) {
    const line: Array<[number, number]> = [[row, col]];
    let r = row + dr;
    let c = col + dc;
    while (
      r >= 0 &&
      r < BOARD_SIZE &&
      c >= 0 &&
      c < BOARD_SIZE &&
      board[r][c] === stone
    ) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }
    r = row - dr;
    c = col - dc;
    while (
      r >= 0 &&
      r < BOARD_SIZE &&
      c >= 0 &&
      c < BOARD_SIZE &&
      board[r][c] === stone
    ) {
      line.unshift([r, c]);
      r -= dr;
      c -= dc;
    }
    if (line.length >= 5) return { stone, line };
  }
  return null;
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
