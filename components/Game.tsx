"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import {
  applyMoves,
  checkWin,
  generatePlayerId,
  isBoardFull,
  LOBBY_CHANNEL,
  type LobbyPresence,
  type Move,
  nextStone,
  type Stone,
  type WinResult,
} from "@/lib/omok";
import { suggestMove } from "@/lib/hint";
import {
  formatRecord,
  getCurrentProfile,
  type Profile,
  recordResult,
} from "@/lib/profile";
import BoardView from "./Board";

const ID_KEY = "omok:playerId";

type PresenceMeta = {
  playerId: string;
  name: string;
  joinedAt: number;
};

type Status =
  | { kind: "connecting" }
  | { kind: "waiting" }
  | { kind: "playing" }
  | { kind: "ended"; reason: "win" | "draw"; winner?: Stone };

interface Props {
  roomId: string;
}

export default function Game({ roomId }: Props) {
  const router = useRouter();

  const [me, setMe] = useState<{
    id: string;
    name: string;
    profileId: string;
  } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missingProfile, setMissingProfile] = useState(false);
  const [moves, setMoves] = useState<Move[]>([]);
  const [players, setPlayers] = useState<PresenceMeta[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "connecting" });
  const [restartRequest, setRestartRequest] = useState<string | null>(null);
  const [chanceUsed, setChanceUsed] = useState(false);
  const [hint, setHint] = useState<{ row: number; col: number } | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const movesRef = useRef<Move[]>([]);
  const recordedKeyRef = useRef<string | null>(null);

  // Load identity from localStorage
  useEffect(() => {
    let id = window.localStorage.getItem(ID_KEY);
    if (!id) {
      id = generatePlayerId();
      window.localStorage.setItem(ID_KEY, id);
    }
    const current = getCurrentProfile();
    if (!current) {
      setMissingProfile(true);
      return;
    }
    setMe({ id, name: current.name, profileId: current.id });
    setProfile(current);
  }, []);

  // Keep movesRef in sync for handlers
  useEffect(() => {
    movesRef.current = moves;
  }, [moves]);

  // Subscribe to channel
  useEffect(() => {
    if (!me) return;

    let cancelled = false;
    const supabase = getSupabase();
    const joinedAt = Date.now();
    const channel = supabase.channel(`omok:${roomId}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: me.id },
      },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const list: PresenceMeta[] = [];
      for (const key of Object.keys(state)) {
        const metas = state[key];
        if (metas && metas.length > 0) {
          list.push(metas[0]);
        }
      }
      list.sort((a, b) => a.joinedAt - b.joinedAt);
      if (!cancelled) setPlayers(list);
    });

    channel.on("broadcast", { event: "move" }, ({ payload }) => {
      const move = payload as Move & { senderId: string };
      const current = movesRef.current;
      // Validate sequence
      const expectedStone = nextStone(current);
      if (move.stone !== expectedStone) return;
      const board = applyMoves(current);
      if (board[move.row]?.[move.col] !== null) return;
      const next = [...current, { row: move.row, col: move.col, stone: move.stone }];
      setMoves(next);
    });

    channel.on("broadcast", { event: "request_state" }, ({ payload }) => {
      const { requesterId } = payload as { requesterId: string };
      if (requesterId === me.id) return;
      channel.send({
        type: "broadcast",
        event: "state",
        payload: { moves: movesRef.current, to: requesterId },
      });
    });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      const { moves: incoming, to } = payload as {
        moves: Move[];
        to: string;
      };
      if (to !== me.id) return;
      // Adopt the longer history if it's longer than ours
      if (incoming.length > movesRef.current.length) {
        setMoves(incoming);
      }
    });

    channel.on("broadcast", { event: "restart_request" }, ({ payload }) => {
      const { from } = payload as { from: string };
      if (from === me.id) return;
      setRestartRequest(from);
    });

    channel.on("broadcast", { event: "restart_confirm" }, () => {
      setMoves([]);
      setStatus({ kind: "playing" });
      setRestartRequest(null);
      setChanceUsed(false);
      setHint(null);
      recordedKeyRef.current = null;
    });

    channel.on("broadcast", { event: "close" }, ({ payload }) => {
      const { reason } = (payload ?? {}) as { reason?: string };
      window.alert(reason || "방이 삭제되었습니다.");
      router.push("/");
    });

    channel.subscribe(async (state) => {
      if (state !== "SUBSCRIBED") return;
      await channel.track({
        playerId: me.id,
        name: me.name,
        joinedAt,
      } satisfies PresenceMeta);
      channel.send({
        type: "broadcast",
        event: "request_state",
        payload: { requesterId: me.id },
      });
    });

    channelRef.current = channel;

    // Lobby presence: announce this room to the global lobby
    const lobbyChannel = supabase.channel(LOBBY_CHANNEL, {
      config: { presence: { key: roomId } },
    });
    lobbyChannel.subscribe(async (state) => {
      if (state !== "SUBSCRIBED") return;
      await lobbyChannel.track({
        roomId,
        name: me.name,
        joinedAt,
      } satisfies LobbyPresence);
    });

    return () => {
      cancelled = true;
      channel.unsubscribe();
      supabase.removeChannel(channel);
      lobbyChannel.unsubscribe();
      supabase.removeChannel(lobbyChannel);
      channelRef.current = null;
    };
  }, [me, roomId]);

  // Record win/loss/draw to current profile (once per game)
  useEffect(() => {
    if (status.kind !== "ended") return;
    if (!me || !profile) return;
    const myStoneNow: Stone | null = (() => {
      const idx = players.findIndex((p) => p.playerId === me.id);
      if (idx === 0) return "black";
      if (idx === 1) return "white";
      return null;
    })();
    if (myStoneNow === null) return; // spectator: no record
    const key = `${moves.length}:${status.reason}:${status.reason === "win" ? status.winner : ""}`;
    if (recordedKeyRef.current === key) return;
    recordedKeyRef.current = key;
    let result: "win" | "loss" | "draw";
    if (status.reason === "draw") result = "draw";
    else if (status.winner === myStoneNow) result = "win";
    else result = "loss";
    const updated = recordResult(profile.id, result);
    if (updated) setProfile(updated);
  }, [status, me, profile, players, moves.length]);

  // Update status based on game state
  useEffect(() => {
    if (!me) return;
    if (players.length < 2) {
      setStatus({ kind: "waiting" });
      return;
    }
    const board = applyMoves(moves);
    let win: WinResult | null = null;
    if (moves.length > 0) {
      win = checkWin(board, moves[moves.length - 1]);
    }
    if (win) {
      setStatus({ kind: "ended", reason: "win", winner: win.stone });
    } else if (isBoardFull(board)) {
      setStatus({ kind: "ended", reason: "draw" });
    } else {
      setStatus({ kind: "playing" });
    }
  }, [moves, players, me]);

  const board = useMemo(() => applyMoves(moves), [moves]);
  const lastMove = moves.length
    ? { row: moves[moves.length - 1].row, col: moves[moves.length - 1].col }
    : null;
  const winningLine = useMemo(() => {
    if (moves.length === 0) return null;
    const w = checkWin(board, moves[moves.length - 1]);
    return w ? w.line : null;
  }, [board, moves]);

  const myStone: Stone | null = useMemo(() => {
    if (!me || players.length === 0) return null;
    const idx = players.findIndex((p) => p.playerId === me.id);
    if (idx === 0) return "black";
    if (idx === 1) return "white";
    return null; // spectator
  }, [me, players]);

  const turnStone = nextStone(moves);
  const myTurn = myStone !== null && myStone === turnStone && status.kind === "playing";

  const opponent = useMemo(() => {
    if (!me) return null;
    return players.find((p) => p.playerId !== me.id) ?? null;
  }, [me, players]);

  const handlePlace = (row: number, col: number) => {
    if (!me || !myStone || !myTurn) return;
    const channel = channelRef.current;
    if (!channel) return;
    const move: Move = { row, col, stone: myStone };
    setMoves((prev) => [...prev, move]);
    setHint(null);
    channel.send({
      type: "broadcast",
      event: "move",
      payload: { ...move, senderId: me.id },
    });
  };

  const handleChance = () => {
    if (chanceUsed || !myStone || !myTurn) return;
    const suggestion = suggestMove(moves, myStone);
    if (suggestion) {
      setHint(suggestion);
      setChanceUsed(true);
    }
  };

  const handleRestart = () => {
    const channel = channelRef.current;
    if (!channel || !me) return;
    channel.send({
      type: "broadcast",
      event: "restart_request",
      payload: { from: me.id },
    });
    setRestartRequest(me.id); // mark as pending from us
  };

  const handleAcceptRestart = () => {
    const channel = channelRef.current;
    if (!channel) return;
    channel.send({
      type: "broadcast",
      event: "restart_confirm",
      payload: {},
    });
    setMoves([]);
    setStatus({ kind: "playing" });
    setRestartRequest(null);
    setChanceUsed(false);
    setHint(null);
    recordedKeyRef.current = null;
  };

  if (missingProfile) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>사용자 등록이 필요해요</h1>
          <p style={{ color: "#a0a0a0", marginBottom: 16 }}>
            로비에서 이름을 먼저 등록해주세요.
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ ...btnStyle, background: "#3b82f6", color: "#fff" }}
          >
            로비로 가기
          </button>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main style={pageStyle}>
        <p>불러오는 중...</p>
      </main>
    );
  }

  const stoneLabel = (s: Stone | null) => (s === "black" ? "흑" : s === "white" ? "백" : "관전자");

  return (
    <main style={pageStyle}>
      <div style={{ width: "100%", maxWidth: 560, marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <button onClick={() => router.push("/")} style={pixelBtnStyle}>
            ← 나가기
          </button>
          <div
            style={{
              fontSize: 13,
              color: "#5ec5ff",
              letterSpacing: 2,
              textShadow: "0 0 6px rgba(94, 197, 255, 0.5)",
            }}
          >
            ▶ PLAY
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <PlayerCard
            label={`${stoneLabel(myStone)} (나)`}
            name={me.name}
            stone={myStone}
            active={myTurn}
            sub={profile ? formatRecord(profile) : null}
          />
          <PlayerCard
            label={
              opponent
                ? `${stoneLabel(myStone === "black" ? "white" : myStone === "white" ? "black" : null)} (상대)`
                : "상대 대기 중"
            }
            name={opponent?.name ?? "—"}
            stone={
              myStone === "black" ? "white" : myStone === "white" ? "black" : null
            }
            active={!myTurn && status.kind === "playing" && opponent !== null}
            sub={null}
          />
        </div>

        <StatusBanner
          status={status}
          myStone={myStone}
          turnStone={turnStone}
          opponent={opponent}
        />
      </div>

      <BoardView
        board={board}
        lastMove={lastMove}
        winningLine={winningLine}
        hint={hint}
        myStone={myStone}
        myTurn={myTurn}
        disabled={status.kind !== "playing"}
        onPlace={handlePlace}
      />

      {myStone !== null && status.kind === "playing" && (
        <div style={{ marginTop: 18, textAlign: "center" }}>
          <button
            onClick={handleChance}
            disabled={chanceUsed || !myTurn}
            style={{
              padding: "10px 18px",
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 1,
              background: chanceUsed
                ? "#161a2c"
                : myTurn
                ? "#ffd83d"
                : "#161a2c",
              color: chanceUsed
                ? "#5a607a"
                : myTurn
                ? "#1a1a1a"
                : "#5a607a",
              border: `2px solid ${
                chanceUsed ? "#2e3550" : myTurn ? "#1a1a1a" : "#2e3550"
              }`,
              boxShadow:
                chanceUsed || !myTurn
                  ? "3px 3px 0 #050710"
                  : "4px 4px 0 #050710",
              cursor: chanceUsed || !myTurn ? "not-allowed" : "pointer",
            }}
            title={
              chanceUsed
                ? "이번 판에 찬스를 이미 사용했습니다"
                : !myTurn
                ? "내 차례에만 사용 가능합니다"
                : "다음 수 추천"
            }
          >
            ★ {chanceUsed ? "찬스 사용 완료" : "찬스 (1회) — 다음 수 추천"}
          </button>
          {hint && (
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "#ffd83d",
                letterSpacing: 1,
              }}
            >
              ▶ 추천: {hint.row + 1}행 {hint.col + 1}열 (노란 점선)
            </p>
          )}
        </div>
      )}

      {status.kind === "ended" && (
        <div style={{ marginTop: 24, textAlign: "center" }}>
          {restartRequest && restartRequest !== me.id ? (
            <div>
              <p
                style={{
                  marginBottom: 10,
                  color: "#ffd83d",
                  letterSpacing: 1,
                }}
              >
                ▶ 상대가 다시 두기를 요청했습니다
              </p>
              <button
                onClick={handleAcceptRestart}
                style={{
                  ...pixelBtnStyle,
                  background: "#4ade80",
                  color: "#0a0d18",
                  borderColor: "#0a0d18",
                  fontSize: 14,
                  padding: "10px 18px",
                }}
              >
                수락하고 다시 두기
              </button>
            </div>
          ) : restartRequest === me.id ? (
            <p
              style={{
                color: "#7a83a8",
                animation: "blink 1.1s steps(2) infinite",
              }}
            >
              ··· 상대 응답 대기 중 ···
            </p>
          ) : myStone !== null ? (
            <button
              onClick={handleRestart}
              style={{
                ...pixelBtnStyle,
                background: "#5ec5ff",
                color: "#0a0d18",
                borderColor: "#0a0d18",
                fontSize: 14,
                padding: "10px 18px",
              }}
            >
              ▶ 다시 두기 요청
            </button>
          ) : null}
        </div>
      )}
    </main>
  );
}

function PlayerCard({
  label,
  name,
  stone,
  active,
  sub,
}: {
  label: string;
  name: string;
  stone: Stone | null;
  active: boolean;
  sub: string | null;
}) {
  return (
    <div
      style={{
        background: active ? "#2a2540" : "#161a2c",
        border: active ? "2px solid #ffd83d" : "2px solid #2e3550",
        borderRadius: 4,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: active
          ? "0 0 14px rgba(255,216,61,0.35), 3px 3px 0 #050710"
          : "3px 3px 0 #050710",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background:
            stone === "black"
              ? "radial-gradient(circle at 30% 30%, #555, #000)"
              : stone === "white"
              ? "radial-gradient(circle at 30% 30%, #fff, #bbb)"
              : "#2e3550",
          flexShrink: 0,
          boxShadow:
            stone !== null ? "0 0 0 2px #050710" : "inset 0 0 0 2px #4a5170",
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: active ? "#ffd83d" : "#7a83a8",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#f0f0f0",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 10,
              color: "#7a83a8",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: 1,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBanner({
  status,
  myStone,
  turnStone,
  opponent,
}: {
  status: Status;
  myStone: Stone | null;
  turnStone: Stone;
  opponent: PresenceMeta | null;
}) {
  let text = "";
  let color = "#7a83a8";
  let blink = false;

  if (status.kind === "connecting") {
    text = "▶ 연결중...";
  } else if (status.kind === "waiting") {
    text = opponent
      ? "▶ 잠시만 기다려주세요"
      : "▶ 가족이 들어올 때까지 대기중";
    blink = true;
  } else if (status.kind === "playing") {
    if (myStone === null) {
      text = `관전중 — ${turnStone === "black" ? "흑" : "백"} 차례`;
    } else if (myStone === turnStone) {
      text = "★ 내 차례 ★";
      color = "#ffd83d";
      blink = true;
    } else {
      text = "··· 상대 차례 ···";
      color = "#5ec5ff";
    }
  } else if (status.kind === "ended") {
    if (status.reason === "draw") {
      text = "DRAW · 무승부";
    } else if (status.winner === myStone) {
      text = "♛ WIN · 승리 ♛";
      color = "#4ade80";
    } else if (myStone === null) {
      text = `${status.winner === "black" ? "흑" : "백"} 승리`;
    } else {
      text = "GAME OVER · 패배";
      color = "#ff5277";
    }
  }

  return (
    <div
      style={{
        background: "#0e1226",
        border: `2px solid ${color}`,
        borderRadius: 4,
        padding: "10px 14px",
        fontSize: 14,
        color,
        textAlign: "center",
        fontWeight: 700,
        letterSpacing: 1,
        boxShadow: "3px 3px 0 #050710",
        animation: blink ? "blink 1.1s steps(2) infinite" : undefined,
      }}
    >
      {text}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "24px 16px",
};

const cardStyle: React.CSSProperties = {
  background: "#161a2c",
  border: "2px solid #2e3550",
  borderRadius: 4,
  padding: 24,
  maxWidth: 360,
  width: "100%",
  boxShadow: "4px 4px 0 #050710",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 4,
  fontWeight: 700,
  letterSpacing: 1,
};

const pixelBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 4,
  background: "#161a2c",
  color: "#e8e8e8",
  border: "2px solid #4a5170",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1,
  boxShadow: "3px 3px 0 #050710",
  cursor: "pointer",
};
