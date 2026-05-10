"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { generateRoomCode } from "@/lib/omok";

const NAME_KEY = "omok:name";

export default function Lobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_KEY);
    if (saved) setName(saved);
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

  const handleJoin = () => {
    const trimmed = validateName();
    if (!trimmed) return;
    const code = joinCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,8}$/.test(code)) {
      setError("올바른 방 코드를 입력해주세요.");
      return;
    }
    persistName(trimmed);
    router.push(`/play/${code}`);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#262626",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
        }}
      >
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>오목</h1>
        <p style={{ color: "#a0a0a0", marginBottom: 24 }}>
          친구와 1:1로 즐기는 온라인 오목
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
            marginBottom: 24,
          }}
        >
          새 방 만들기
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "8px 0 16px",
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#404040" }} />
          <span style={{ fontSize: 12, color: "#808080" }}>또는</span>
          <div style={{ flex: 1, height: 1, background: "#404040" }} />
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
            방 코드로 입장
          </span>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="예: ABC234"
            maxLength={8}
            style={{ ...inputStyle, letterSpacing: 4, textAlign: "center" }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
            }}
          />
        </label>
        <button
          onClick={handleJoin}
          style={{
            ...buttonStyle,
            background: "#404040",
            color: "#fff",
          }}
        >
          입장
        </button>

        {error && (
          <p style={{ color: "#f87171", marginTop: 16, fontSize: 14 }}>
            {error}
          </p>
        )}
      </div>
    </main>
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
