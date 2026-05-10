"use client";

import { useEffect } from "react";
import type { CallPayload } from "@/lib/call";

interface Props {
  call: CallPayload | null;
  onDismiss: () => void;
  durationMs?: number;
}

export default function IncomingCallToast({
  call,
  onDismiss,
  durationMs = 6000,
}: Props) {
  useEffect(() => {
    if (!call) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [call, durationMs, onDismiss]);

  if (!call) return null;

  return (
    <div
      role="alert"
      onClick={onDismiss}
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        background: "#0e1226",
        border: "2px solid #ffd83d",
        borderRadius: 4,
        boxShadow: "5px 5px 0 #050710, 0 0 24px rgba(255,216,61,0.35)",
        padding: "12px 18px",
        minWidth: 240,
        maxWidth: "calc(100vw - 24px)",
        cursor: "pointer",
        animation: "callShake 0.7s ease-in-out 2",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#5ec5ff",
          letterSpacing: 1,
          marginBottom: 4,
          fontWeight: 700,
        }}
      >
        📞 INCOMING CALL
      </div>
      <div
        style={{
          fontSize: 16,
          color: "#ffd83d",
          fontWeight: 800,
          letterSpacing: 1,
          textAlign: "center",
          textShadow: "0 0 8px rgba(255,216,61,0.4)",
        }}
      >
        {call.name}님이 호출했어요!
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#7a83a8",
          marginTop: 6,
          textAlign: "center",
          letterSpacing: 1,
        }}
      >
        탭해서 닫기
      </div>
      <style>{`
        @keyframes callShake {
          0%, 100% { transform: translate(-50%, 0); }
          15% { transform: translate(calc(-50% - 4px), -2px); }
          30% { transform: translate(calc(-50% + 4px), 2px); }
          45% { transform: translate(calc(-50% - 3px), -1px); }
          60% { transform: translate(calc(-50% + 3px), 1px); }
          75% { transform: translate(calc(-50% - 2px), 0); }
        }
      `}</style>
    </div>
  );
}
