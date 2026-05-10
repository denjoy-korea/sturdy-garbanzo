"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  generateRoomCode,
  LOBBY_CHANNEL,
  type LobbyPresence,
  type RoomSummary,
} from "@/lib/omok";

const NAME_KEY = "omok:name";

export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [lobbyConnected, setLobbyConnected] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_KEY);
    if (saved) setName(saved);
  }, []);

  // Subscribe to global lobby presence to discover active rooms
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel(LOBBY_CHANNEL, {
      config: { presence: { key: "viewer" } },
    });

    const refresh = () => {
      const state = channel.presenceState<LobbyPresence>();
      const list: RoomSummary[] = [];
      for (const key of Object.keys(state)) {
        if (key === "viewer") continue;
        const metas = state[key];
        if (!metas || metas.length === 0) continue;
        const sorted = [...metas].sort((a, b) => a.joinedAt - b.joinedAt);
        const host = sorted[0];
        if (!host?.roomId) continue;
        list.push({
          roomId: host.roomId,
          hostName: host.name,
          playerCount: metas.length,
          createdAt: host.joinedAt,
        });
      }
      list.sort((a, b) => {
        if (a.playerCount !== b.playerCount) return a.playerCount - b.playerCount;
        return b.createdAt - a.createdAt;
      });
      setRooms(list);
    };

    channel.on("presence", { event: "sync" }, refresh);
    channel.on("presence", { event: "join" }, refresh);
    channel.on("presence", { event: "leave" }, refresh);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setLobbyConnected(true);
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const persistName = (value: string) => {
    setName(value);
    window.localStorage.setItem(NAME_KEY, value);
  };

  const validateName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("닉네임을 입력해주세요.");
      return null;
    }
    if (trimmed.length > 12) {
      setError("닉네임은 12자 이하로 입력해주세요.");
      return null;
    }
    setError(null);
    return trimmed;
  };

  const handleCreate = () => {
    const trimmed = validateName();
    if (!trimmed) return;
    persistName(trimmed);
    const code = generateRoomCode();
    router.push(`/play/${code}`);
  };

  const handleJoinRoom = (roomId: string) => {
    const trimmed = validateName();
    if (!trimmed) return;
    persistName(trimmed);
    router.push(`/play/${roomId}`);
  };

  const handleDeleteRoom = async (roomId: string) => {
    const ok = window.confirm(
      `방 ${roomId} 을(를) 삭제할까요?\n진행중인 게임이 즉시 종료되고 모든 참가자가 로비로 돌아갑니다.`,
    );
    if (!ok) return;
    const supabase = getSupabase();
    const ch = supabase.channel(`omok:${roomId}`);
    await new Promise<void>((resolve) => {
      let done = false;
      ch.subscribe((status) => {
        if (done) return;
        if (status === "SUBSCRIBED") {
          done = true;
          resolve();
        }
      });
      setTimeout(() => {
        if (!done) {
          done = true;
          resolve();
        }
      }, 2000);
    });
    await ch.send({
      type: "broadcast",
      event: "close",
      payload: { reason: "방이 삭제되었습니다." },
    });
    // Brief delay to ensure delivery before unsubscribing
    setTimeout(() => {
      ch.unsubscribe();
      supabase.removeChannel(ch);
    }, 300);
  };

  const waitingRooms = useMemo(
    () => rooms.filter((r) => r.playerCount < 2),
    [rooms],
  );
  const playingRooms = useMemo(
    () => rooms.filter((r) => r.playerCount >= 2),
    [rooms],
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
        }}
      >
        <div
          style={{
            background: "#262626",
            borderRadius: 16,
            padding: 32,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 32, marginBottom: 8 }}>뽀꼬오목</h1>
          <p style={{ color: "#a0a0a0", marginBottom: 24 }}>
            가족과 1:1로 즐기는 온라인 뽀꼬오목
          </p>

          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
              닉네임
            </span>
            <input
              value={name}
              onChange={(e) => persistName(e.target.value)}
              placeholder="예: 김철수"
              maxLength={12}
              style={inputStyle}
            />
          </label>

          <button
            onClick={handleCreate}
            style={{
              ...buttonStyle,
              background: "#3b82f6",
              color: "#fff",
            }}
          >
            새 방 만들기
          </button>

          {error && (
            <p style={{ color: "#f87171", marginTop: 16, fontSize: 14 }}>
              {error}
            </p>
          )}
        </div>

        <div
          style={{
            background: "#262626",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>진행중인 방</h2>
            <span
              style={{
                fontSize: 12,
                color: lobbyConnected ? "#22c55e" : "#a0a0a0",
              }}
            >
              {lobbyConnected
                ? `● 실시간 (${rooms.length})`
                : "○ 연결 중..."}
            </span>
          </div>

          {rooms.length === 0 ? (
            <p style={{ fontSize: 14, color: "#808080", padding: "12px 4px" }}>
              {lobbyConnected
                ? "현재 진행중인 방이 없습니다. 첫 방을 만들어보세요!"
                : "잠시만 기다려주세요..."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {waitingRooms.length > 0 && (
                <SectionLabel text="대기 중 (입장 가능)" />
              )}
              {waitingRooms.map((r) => (
                <RoomItem
                  key={r.roomId}
                  room={r}
                  onClick={() => handleJoinRoom(r.roomId)}
                  onDelete={() => handleDeleteRoom(r.roomId)}
                />
              ))}
              {playingRooms.length > 0 && (
                <SectionLabel text="진행 중 (관전 가능)" />
              )}
              {playingRooms.map((r) => (
                <RoomItem
                  key={r.roomId}
                  room={r}
                  onClick={() => handleJoinRoom(r.roomId)}
                  onDelete={() => handleDeleteRoom(r.roomId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#808080",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 4,
      }}
    >
      {text}
    </div>
  );
}

function RoomItem({
  room,
  onClick,
  onDelete,
}: {
  room: RoomSummary;
  onClick: () => void;
  onDelete: () => void;
}) {
  const full = room.playerCount >= 2;
  return (
    <div
      onClick={onClick}
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#2a2a2a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#1a1a1a";
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 16,
            letterSpacing: 2,
            fontWeight: 600,
          }}
        >
          {room.roomId}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#a0a0a0",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          호스트: {room.hostName}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: full ? "#a0a0a0" : "#22c55e",
            fontWeight: 600,
          }}
        >
          {full ? "관전" : "입장 →"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`방 ${room.roomId} 삭제`}
          title="이 방 삭제"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "#333",
            color: "#f87171",
            fontSize: 16,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#7f1d1d";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#333";
            e.currentTarget.style.color = "#f87171";
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  background: "#1a1a1a",
  border: "1px solid #404040",
  borderRadius: 8,
  color: "#f0f0f0",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  fontWeight: 600,
  borderRadius: 8,
};
