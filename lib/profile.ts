"use client";

import { getSupabase } from "./supabase";

export interface Profile {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  createdAt: number;
}

export interface CloudProfile {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  created_at: string;
  updated_at: string;
}

const PROFILES_KEY = "omok:profiles";
const CURRENT_KEY = "omok:currentProfileId";
const LEGACY_NAME_KEY = "omok:name";
const TABLE = "omok_profiles";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readProfiles(): Profile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is Profile =>
          typeof p?.id === "string" &&
          typeof p?.name === "string" &&
          typeof p?.wins === "number" &&
          typeof p?.losses === "number" &&
          typeof p?.draws === "number",
      )
      .map((p) => ({ ...p, createdAt: p.createdAt ?? Date.now() }));
  } catch {
    return [];
  }
}

function writeProfiles(profiles: Profile[]) {
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getProfiles(): Profile[] {
  return readProfiles().sort((a, b) => a.createdAt - b.createdAt);
}

export function getCurrentProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  const profiles = readProfiles();
  if (profiles.length === 0) return null;
  const id = window.localStorage.getItem(CURRENT_KEY);
  if (id) {
    const found = profiles.find((p) => p.id === id);
    if (found) return found;
  }
  return profiles[0];
}

export function setCurrentProfileId(id: string) {
  window.localStorage.setItem(CURRENT_KEY, id);
}

export function createProfile(name: string): Profile {
  const trimmed = name.trim();
  const profile: Profile = {
    id: generateId(),
    name: trimmed,
    wins: 0,
    losses: 0,
    draws: 0,
    createdAt: Date.now(),
  };
  const profiles = readProfiles();
  profiles.push(profile);
  writeProfiles(profiles);
  setCurrentProfileId(profile.id);
  // fire-and-forget cloud sync
  pushProfileToCloud(profile).catch(() => {});
  return profile;
}

export function deleteProfile(id: string) {
  const remaining = readProfiles().filter((p) => p.id !== id);
  writeProfiles(remaining);
  const current = window.localStorage.getItem(CURRENT_KEY);
  if (current === id) {
    if (remaining.length > 0) {
      setCurrentProfileId(remaining[0].id);
    } else {
      window.localStorage.removeItem(CURRENT_KEY);
    }
  }
  // fire-and-forget cloud delete
  deleteProfileFromCloud(id).catch(() => {});
}

export function recordResult(
  id: string,
  result: "win" | "loss" | "draw",
): Profile | null {
  const profiles = readProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated = { ...profiles[idx] };
  if (result === "win") updated.wins += 1;
  else if (result === "loss") updated.losses += 1;
  else updated.draws += 1;
  profiles[idx] = updated;
  writeProfiles(profiles);
  // fire-and-forget cloud sync
  pushProfileToCloud(updated).catch(() => {});
  return updated;
}

export function bootstrapProfiles(): Profile | null {
  if (typeof window === "undefined") return null;
  const profiles = readProfiles();
  if (profiles.length === 0) {
    const legacy = window.localStorage.getItem(LEGACY_NAME_KEY);
    if (legacy && legacy.trim()) {
      const created = createProfile(legacy.trim());
      window.localStorage.removeItem(LEGACY_NAME_KEY);
      return created;
    }
  }
  // Push all local profiles to cloud once at startup (idempotent upsert)
  syncAllLocalToCloud().catch(() => {});
  return getCurrentProfile();
}

export function formatRecord(p: Profile): string {
  return `${p.wins}승 ${p.losses}패${p.draws ? ` ${p.draws}무` : ""}`;
}

// ─── Cloud sync ──────────────────────────────────────────────────────────

export async function pushProfileToCloud(p: Profile): Promise<void> {
  const sb = getSupabase();
  await sb.from(TABLE).upsert(
    {
      id: p.id,
      name: p.name,
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
      created_at: new Date(p.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

export async function deleteProfileFromCloud(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from(TABLE).delete().eq("id", id);
}

export async function fetchCloudProfiles(): Promise<CloudProfile[]> {
  const sb = getSupabase();
  const { data, error } = await sb.from(TABLE).select("*");
  if (error || !data) return [];
  return data as CloudProfile[];
}

async function syncAllLocalToCloud(): Promise<void> {
  const profiles = readProfiles();
  if (profiles.length === 0) return;
  await Promise.allSettled(profiles.map((p) => pushProfileToCloud(p)));
}

export function cloudToProfile(c: CloudProfile): Profile {
  return {
    id: c.id,
    name: c.name,
    wins: c.wins,
    losses: c.losses,
    draws: c.draws,
    createdAt: new Date(c.created_at).getTime(),
  };
}
