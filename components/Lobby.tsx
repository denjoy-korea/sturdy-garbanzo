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
import {
  bootstrapProfiles,
  cloudToProfile,
  type CloudProfile,
  createProfile,
  deleteProfile,
  fetchCloudProfiles,
  formatRecord,
  getProfiles,
  type Profile,
  setCurrentProfileId,
} from "@/lib/profile";
import InstallPrompt from "./InstallPrompt";

export default function Lobby() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [current, setCurrent] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [lobbyConnected, setLobbyConnected] = useState(false);

  const [cloudProfiles, setCloudProfiles] = useState<CloudProfile[]>([]);

  // Initial profile load + migration from legacy "omok:name"
  useEffect(() => {
    const profile = bootstrapProfiles();
    setCurrent(profile);
    setProfiles(getProfiles());
    setHydrated(true);
  }, []);

  // Cloud ranking: fetch + realtime subscribe
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      fetchCloudProfiles().then((rows) => {
        if (alive) setCloudProfiles(rows);
      });
    };
    refresh();
    const supabase = getSupabase();
    const ch = supabase
      .channel("omok_profiles_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "omok_profiles" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      alive = false;
      ch.unsubscribe();
      supabase.removeChannel(ch);
    };
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
      if (status === "SUBSCRIBED") setLobbyConnected(true);
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddProfile = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (trimmed.length > 12) {
      setError("이름은 12자 이하로 입력해주세요.");
      return;
    }
    const created = createProfile(trimmed);
    setCurrent(created);
    setProfiles(getProfiles());
    setNewName("");
    setError(null);
  };

  const handleSelectProfile = (id: string) => {
    setCurrentProfileId(id);
    const next = profiles.find((p) => p.id === id) ?? null;
    setCurrent(next);
    setShowPicker(false);
  };

  const handleDeleteProfile = (id: string) => {
    if (!window.confirm("이 사용자를 삭제할까요? 전적도 함께 사라집니다.")) return;
    deleteProfile(id);
    const updated = getProfiles();
    setProfiles(updated);
    if (current?.id === id) {
      setCurrent(updated[0] ?? null);
    }
  };

  const handleCreateRoom = () => {
    if (!current) return;
    const code = generateRoomCode();
    router.push(`/play/${code}`);
  };

  const handleJoinRoom = (roomId: string) => {
    if (!current) return;
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
    <main style={pageStyle}>
      <div style={containerStyle}>
        <Header />

        {!hydrated ? (
          <div style={{ ...cardStyle, textAlign: "center", color: "#a0a0a0" }}>
            불러오는 중...
          </div>
        ) : !current ? (
          <FirstTimeForm
            value={newName}
            onChange={(v) => {
              setNewName(v);
              setError(null);
            }}
            onSubmit={handleAddProfile}
            error={error}
          />
        ) : (
          <>
            <ProfileCard
              profile={current}
              onChange={() => {
                setShowPicker(true);
                setError(null);
                setNewName("");
              }}
            />

            <button onClick={handleCreateRoom} style={primaryActionStyle}>
              <span style={{ fontSize: 22, marginRight: 8 }}>🎮</span>
              새 방 만들기
            </button>

            <div style={cardStyle}>
              <div style={roomsHeaderStyle}>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>진행중인 방</h2>
                <span
                  style={{
                    fontSize: 12,
                    color: lobbyConnected ? "#22c55e" : "#a0a0a0",
                    fontWeight: 500,
                  }}
                >
                  {lobbyConnected ? `● 실시간 ${rooms.length}개` : "○ 연결 중"}
                </span>
              </div>

              {rooms.length === 0 ? (
                <p
                  style={{
                    fontSize: 14,
                    color: "#808080",
                    padding: "16px 4px",
                    textAlign: "center",
                  }}
                >
                  {lobbyConnected
                    ? "현재 진행중인 방이 없어요. 첫 방을 만들어보세요!"
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

            <Ranking
              cloudProfiles={cloudProfiles}
              localIds={profiles.map((p) => p.id)}
              currentId={current.id}
            />

            <InstallPrompt />
          </>
        )}
      </div>

      {showPicker && (
        <ProfilePicker
          profiles={profiles}
          currentId={current?.id ?? null}
          onSelect={handleSelectProfile}
          onDelete={handleDeleteProfile}
          onAdd={handleAddProfile}
          newName={newName}
          setNewName={(v) => {
            setNewName(v);
            setError(null);
          }}
          error={error}
          onClose={() => setShowPicker(false)}
        />
      )}
    </main>
  );
}

function Header() {
  return (
    <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <BoardIcon size={56} />
        <div style={{ textAlign: "left" }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: -1,
              lineHeight: 1.1,
              background: "linear-gradient(135deg, #fbbf24, #c8954c 60%, #d97706)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            뽀꼬오목
          </h1>
          <p style={{ fontSize: 13, color: "#a0a0a0", marginTop: 2 }}>
            가족과 함께하는 1:1 온라인 오목
          </p>
        </div>
      </div>
    </div>
  );
}

function BoardIcon({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      style={{ flexShrink: 0, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}
    >
      <rect width="64" height="64" rx="10" fill="#d9a652" />
      <g stroke="#4a2f12" strokeWidth="1.5" strokeLinecap="round">
        <line x1="14" y1="14" x2="50" y2="14" />
        <line x1="14" y1="32" x2="50" y2="32" />
        <line x1="14" y1="50" x2="50" y2="50" />
        <line x1="14" y1="14" x2="14" y2="50" />
        <line x1="32" y1="14" x2="32" y2="50" />
        <line x1="50" y1="14" x2="50" y2="50" />
      </g>
      <circle cx="14" cy="14" r="6" fill="url(#lb-w)" />
      <circle cx="32" cy="32" r="9" fill="url(#lb-b)" />
      <circle cx="50" cy="50" r="6" fill="url(#lb-b)" />
      <defs>
        <radialGradient id="lb-b" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#666" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <radialGradient id="lb-w" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#bbb" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function FirstTimeForm({
  value,
  onChange,
  onSubmit,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
}) {
  return (
    <div style={cardStyle}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        처음이시네요! 👋
      </h2>
      <p style={{ fontSize: 13, color: "#a0a0a0", marginBottom: 16 }}>
        이름을 등록하시면 다음부터는 목록에서 선택해 들어갈 수 있어요.
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="이름 (예: 아빠, 김철수)"
        maxLength={12}
        autoFocus
        style={inputStyle}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
      />
      <button
        onClick={onSubmit}
        style={{ ...primaryActionStyle, marginTop: 12 }}
      >
        등록하고 시작하기
      </button>
      {error && <p style={errorStyle}>{error}</p>}
    </div>
  );
}

function ProfileCard({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: () => void;
}) {
  const total = profile.wins + profile.losses + profile.draws;
  const winRate =
    total > 0 ? Math.round((profile.wins / total) * 100) : null;
  return (
    <div
      style={{
        ...cardStyle,
        background:
          "linear-gradient(135deg, #1a2040 0%, #0f1326 100%)",
        border: "2px solid #4a5170",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              color: "#5ec5ff",
              marginBottom: 4,
              letterSpacing: 1,
            }}
          >
            ▶ PLAYER
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#ffd83d",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textShadow: "0 0 10px rgba(255, 216, 61, 0.3)",
            }}
          >
            {profile.name}
          </div>
        </div>
        <button
          onClick={onChange}
          style={{
            padding: "8px 14px",
            borderRadius: 4,
            background: "#0a0d1c",
            color: "#5ec5ff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            border: "2px solid #4a5170",
            boxShadow: "3px 3px 0 #050710",
            letterSpacing: 1,
          }}
        >
          변경 →
        </button>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px dashed #4a5170",
        }}
      >
        <Stat label="승" value={profile.wins} color="#22c55e" />
        <Stat label="패" value={profile.losses} color="#f87171" />
        <Stat label="무" value={profile.draws} color="#a0a0a0" />
        <Stat
          label="승률"
          value={winRate === null ? "-" : `${winRate}%`}
          color="#fbbf24"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div
        style={{
          fontSize: 10,
          color: "#7a83a8",
          marginBottom: 2,
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color,
          fontFeatureSettings: "tnum",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ProfilePicker({
  profiles,
  currentId,
  onSelect,
  onDelete,
  onAdd,
  newName,
  setNewName,
  error,
  onClose,
}: {
  profiles: Profile[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  newName: string;
  setNewName: (v: string) => void;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#0e1226",
          border: "2px solid #4a5170",
          borderRadius: 4,
          padding: 20,
          boxShadow: "6px 6px 0 #050710",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>사용자 선택</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              color: "#a0a0a0",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {profiles.map((p) => {
            const selected = p.id === currentId;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 4,
                  background: selected ? "#1a2040" : "#161a2c",
                  border: `2px solid ${selected ? "#ffd83d" : "#2e3550"}`,
                  cursor: "pointer",
                  boxShadow: selected ? "3px 3px 0 #050710" : undefined,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: `2px solid ${selected ? "#ffd83d" : "#4a5170"}`,
                    background: selected ? "#ffd83d" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "#1a1a1a",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {selected ? "✓" : ""}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#a0a0a0", marginTop: 2 }}>
                    {formatRecord(p)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(p.id);
                  }}
                  aria-label={`${p.name} 삭제`}
                  title="이 사용자 삭제"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    background: "#0a0d1c",
                    color: "#ff5277",
                    fontSize: 16,
                    cursor: "pointer",
                    flexShrink: 0,
                    border: "2px solid #2e3550",
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px dashed #3a342d",
          }}
        >
          <div style={{ fontSize: 13, color: "#a0a0a0", marginBottom: 8 }}>
            + 새 사람 추가
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름"
              maxLength={12}
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") onAdd();
              }}
            />
            <button
              onClick={onAdd}
              style={{
                padding: "0 18px",
                borderRadius: 4,
                background: "#ffd83d",
                color: "#1a1a1a",
                fontWeight: 800,
                cursor: "pointer",
                border: "2px solid #1a1a1a",
                boxShadow: "3px 3px 0 #050710",
                letterSpacing: 1,
              }}
            >
              추가
            </button>
          </div>
          {error && <p style={errorStyle}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Ranking({
  cloudProfiles,
  localIds,
  currentId,
}: {
  cloudProfiles: CloudProfile[];
  localIds: string[];
  currentId: string;
}) {
  const ranked = useMemo(() => {
    const localSet = new Set(localIds);
    const total = (p: CloudProfile) => p.wins + p.losses + p.draws;
    const winRate = (p: CloudProfile) => {
      const t = total(p);
      return t === 0 ? -1 : p.wins / t;
    };
    return cloudProfiles
      .map((p) => ({
        profile: cloudToProfile(p),
        total: total(p),
        rate: winRate(p),
        isLocal: localSet.has(p.id),
      }))
      .sort((a, b) => {
        if (b.profile.wins !== a.profile.wins)
          return b.profile.wins - a.profile.wins;
        if (b.rate !== a.rate) return b.rate - a.rate;
        if (b.total !== a.total) return b.total - a.total;
        return a.profile.createdAt - b.profile.createdAt;
      });
  }, [cloudProfiles, localIds]);

  return (
    <div style={cardStyle}>
      <div style={roomsHeaderStyle}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#ffd83d" }}>
          🏆 랭킹
        </h2>
        <span style={{ fontSize: 11, color: "#7a83a8", letterSpacing: 1 }}>
          {ranked.length}명 · 전체 공용
        </span>
      </div>
      {ranked.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: "#7a83a8",
            padding: "12px 4px",
            textAlign: "center",
            letterSpacing: 1,
          }}
        >
          아직 등록된 사용자가 없어요.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ranked.map((r, idx) => (
            <RankingRow
              key={r.profile.id}
              rank={idx + 1}
              profile={r.profile}
              total={r.total}
              rate={r.rate}
              isMe={r.profile.id === currentId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RankingRow({
  rank,
  profile,
  total,
  rate,
  isMe,
}: {
  rank: number;
  profile: Profile;
  total: number;
  rate: number;
  isMe: boolean;
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const rankColor =
    rank === 1
      ? "#ffd83d"
      : rank === 2
      ? "#cfd6e6"
      : rank === 3
      ? "#d49060"
      : "#7a83a8";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: isMe ? "#1a2040" : "#0e1226",
        border: `2px solid ${isMe ? "#ffd83d" : "#2e3550"}`,
        borderRadius: 4,
      }}
    >
      <div
        style={{
          width: 32,
          textAlign: "center",
          fontWeight: 800,
          fontSize: 16,
          color: rankColor,
          flexShrink: 0,
        }}
      >
        {medal ?? `${rank}`}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
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
          {profile.name}
          {isMe && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                color: "#5ec5ff",
                letterSpacing: 1,
              }}
            >
              · 나
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#7a83a8",
            marginTop: 2,
            letterSpacing: 0.5,
          }}
        >
          <span style={{ color: "#4ade80" }}>{profile.wins}승</span>
          {" · "}
          <span style={{ color: "#ff5277" }}>{profile.losses}패</span>
          {profile.draws > 0 && (
            <>
              {" · "}
              <span>{profile.draws}무</span>
            </>
          )}
          {" · "}
          <span style={{ color: "#a0a0a0" }}>총 {total}판</span>
        </div>
      </div>
      <div
        style={{
          textAlign: "right",
          flexShrink: 0,
          minWidth: 52,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: rate < 0 ? "#5a607a" : "#ffd83d",
            fontFeatureSettings: "tnum",
          }}
        >
          {rate < 0 ? "-" : `${Math.round(rate * 100)}%`}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "#7a83a8",
            letterSpacing: 1,
          }}
        >
          승률
        </div>
      </div>
    </div>
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
        background: "#0e1226",
        border: "2px solid #2e3550",
        borderRadius: 4,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#1a2040";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#0e1226";
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 16,
            letterSpacing: 2,
            fontWeight: 700,
            color: "#ffd83d",
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
            color: full ? "#7a83a8" : "#4ade80",
            fontWeight: 700,
            letterSpacing: 1,
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
            borderRadius: 4,
            background: "#0a0d1c",
            color: "#ff5277",
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            border: "2px solid #2e3550",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#7f1d1d";
            e.currentTarget.style.color = "#fff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#0a0d1c";
            e.currentTarget.style.color = "#ff5277";
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  padding: "32px 16px 48px",
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const cardStyle: React.CSSProperties = {
  background: "#161a2c",
  border: "2px solid #2e3550",
  borderRadius: 4,
  padding: 20,
  boxShadow: "4px 4px 0 #050710",
};

const roomsHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 16,
  background: "#0a0d1c",
  border: "2px solid #2e3550",
  borderRadius: 4,
  color: "#f0f0f0",
  outline: "none",
};

const primaryActionStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 18px",
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 1,
  borderRadius: 4,
  background: "#ffd83d",
  color: "#1a1a1a",
  border: "2px solid #1a1a1a",
  cursor: "pointer",
  boxShadow: "5px 5px 0 #050710",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const errorStyle: React.CSSProperties = {
  color: "#ff5277",
  marginTop: 10,
  fontSize: 13,
  letterSpacing: 1,
};
