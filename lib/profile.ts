"use client";

export interface Profile {
  id: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  createdAt: number;
}

const PROFILES_KEY = "omok:profiles";
const CURRENT_KEY = "omok:currentProfileId";
const LEGACY_NAME_KEY = "omok:name";

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
  return getCurrentProfile();
}

export function formatRecord(p: Profile): string {
  return `${p.wins}승 ${p.losses}패${p.draws ? ` ${p.draws}무` : ""}`;
}
