"use client";

import { getSupabase } from "./supabase";

const PREFIX = "omok:call:";

export interface CallPayload {
  id: string;
  name: string;
  ts: number;
}

/**
 * Subscribe to incoming calls for the current profile.
 * Returns an unsubscribe function.
 */
export function subscribeToMyCalls(
  profileId: string,
  onCall: (payload: CallPayload) => void,
): () => void {
  const sb = getSupabase();
  const ch = sb.channel(`${PREFIX}${profileId}`, {
    config: { broadcast: { self: false } },
  });
  ch.on("broadcast", { event: "ring" }, ({ payload }) => {
    if (payload && typeof payload === "object") {
      onCall(payload as CallPayload);
    }
  });
  ch.subscribe();
  return () => {
    ch.unsubscribe();
    sb.removeChannel(ch);
  };
}

/** Send a "ring" to the target profile. Best-effort, fire-and-forget. */
export async function ringPerson(
  targetProfileId: string,
  from: { id: string; name: string },
): Promise<void> {
  const sb = getSupabase();
  const ch = sb.channel(`${PREFIX}${targetProfileId}`);
  await new Promise<void>((resolve) => {
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 2000);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED" && !done) {
        done = true;
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  await ch.send({
    type: "broadcast",
    event: "ring",
    payload: {
      id: from.id,
      name: from.name,
      ts: Date.now(),
    } satisfies CallPayload,
  });
  setTimeout(() => {
    ch.unsubscribe();
    sb.removeChannel(ch);
  }, 300);
}

/** Trigger device-side notification: sound, vibration, OS notification when hidden. */
export function notifyIncomingCall(payload: CallPayload) {
  // Vibration (no-op on iOS)
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([220, 110, 220, 110, 440]);
    } catch {
      /* ignore */
    }
  }
  // OS notification when in background tab and permission granted
  if (
    typeof document !== "undefined" &&
    document.hidden &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification("뽀꼬오목 호출", {
        body: `${payload.name}님이 호출했어요!`,
        icon: "/icon.svg",
        tag: "omok-call",
        silent: false,
      });
    } catch {
      /* ignore */
    }
  }
}

/** Ask for OS Notification permission opportunistically. Safe to call multiple times. */
export async function requestNotifyPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* ignore */
  }
}
