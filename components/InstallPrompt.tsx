"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "omok:installDismissedAt";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ms = (window as any).MSStream;
    const ios = /iPad|iPhone|iPod/.test(ua) && !ms;
    setIsIOS(ios);

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // Check dismissal (re-show after 3 days)
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissedAt && Date.now() - dismissedAt < 1000 * 60 * 60 * 24 * 3) {
      setDismissed(true);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      /* ignore */
    } finally {
      setDeferred(null);
    }
  };

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  // Hide if dismissed and no active prompt
  if (dismissed && !deferred && !showIOSGuide) return null;

  // Standard browsers (Chrome/Edge/Samsung Internet) with beforeinstallprompt
  if (deferred) {
    return (
      <button onClick={handleInstall} style={btnStyle}>
        📱 홈 화면에 앱으로 설치
      </button>
    );
  }

  // iOS Safari: show manual instructions
  if (isIOS) {
    return (
      <>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowIOSGuide(true)}
            style={{ ...btnStyle, flex: 1 }}
          >
            📱 iPhone에서 설치하는 법
          </button>
          <button
            onClick={handleDismiss}
            aria-label="닫기"
            title="다시 보지 않기"
            style={{
              width: 40,
              borderRadius: 4,
              background: "#0e1226",
              color: "#7a83a8",
              border: "2px solid #2e3550",
              boxShadow: "3px 3px 0 #050710",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
        {showIOSGuide && (
          <IOSGuide onClose={() => setShowIOSGuide(false)} />
        )}
      </>
    );
  }

  return null;
}

function IOSGuide({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 200,
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
          padding: 22,
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
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#ffd83d",
              letterSpacing: 1,
            }}
          >
            📱 iPhone 설치 방법
          </h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              color: "#a0a0a0",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>

        <p
          style={{
            fontSize: 13,
            color: "#a0a0a0",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          iPhone Safari는 앱처럼 추가하려면 직접 단계를 거쳐야 해요.
          <br />
          반드시 <b style={{ color: "#5ec5ff" }}>Safari</b>에서 열어주세요.
          (Chrome 앱은 설치 불가)
        </p>

        <Step
          n={1}
          text="Safari 하단 가운데의 공유 버튼"
          icon={<ShareIcon />}
        />
        <Step
          n={2}
          text="아래로 스크롤 → '홈 화면에 추가' 선택"
          icon={<PlusBoxIcon />}
        />
        <Step
          n={3}
          text="우측 상단 '추가' 탭하면 끝!"
          icon={
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#4ade80",
                letterSpacing: 1,
              }}
            >
              추가
            </div>
          }
        />

        <p
          style={{
            fontSize: 12,
            color: "#7a83a8",
            marginTop: 14,
            padding: "10px 12px",
            background: "#161a2c",
            border: "1px dashed #2e3550",
            borderRadius: 4,
            lineHeight: 1.5,
          }}
        >
          홈 화면 아이콘으로 들어가면 풀스크린으로 실행됩니다.
          가족 모두 같은 방식으로 설치하면 돼요.
        </p>

        <button
          onClick={onClose}
          style={{
            ...btnStyle,
            marginTop: 14,
            width: "100%",
            background: "#ffd83d",
            color: "#1a1a1a",
            border: "2px solid #1a1a1a",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

function Step({
  n,
  text,
  icon,
}: {
  n: number;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "#161a2c",
        border: "2px solid #2e3550",
        borderRadius: 4,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          background: "#ffd83d",
          color: "#1a1a1a",
          fontWeight: 800,
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 13, color: "#e8e8e8", flex: 1 }}>{text}</div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
      <path
        d="M11 1V17M11 1L6 6M11 1L16 6M3 13V23C3 24.1046 3.89543 25 5 25H17C18.1046 25 19 24.1046 19 23V13"
        stroke="#5ec5ff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusBoxIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="4"
        stroke="#4ade80"
        strokeWidth="2"
      />
      <path
        d="M12 7V17M7 12H17"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 4,
  background: "#0e1226",
  color: "#5ec5ff",
  border: "2px solid #2e3550",
  boxShadow: "3px 3px 0 #050710",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1,
  cursor: "pointer",
  width: "100%",
};
