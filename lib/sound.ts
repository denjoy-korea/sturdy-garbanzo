"use client";

const MUTED_KEY = "omok:muted";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      const Ctx =
        window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
    } catch {
      return null;
    }
  }
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTED_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0");
}

function beep(
  freq: number,
  duration: number,
  type: OscillatorType = "square",
  gainStart = 0.08,
  delay = 0,
) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(gainStart, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

export function playStone(stone: "black" | "white") {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;

  // Short noise burst, bandpass-filtered to mimic wood-on-board "tok"
  const duration = 0.12;
  const buffer = c.createBuffer(
    1,
    Math.max(1, Math.floor(c.sampleRate * duration)),
    c.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    // Decaying white noise envelope
    const env = Math.exp(-i * 0.0006);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = stone === "black" ? 1100 : 1500;
  filter.Q.value = 6;

  // Add a tonal "thock" via short sine
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(stone === "black" ? 220 : 280, t0);
  osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.08);

  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.18, t0);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);

  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.35, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(c.destination);

  osc.connect(oscGain);
  oscGain.connect(c.destination);

  noise.start(t0);
  noise.stop(t0 + duration);
  osc.start(t0);
  osc.stop(t0 + 0.1);
}

export function playFireworkPop() {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;

  // Quick whistle up + boom
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(400, t0);
  osc.frequency.exponentialRampToValueAtTime(1800, t0 + 0.18);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.05, t0);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc.connect(oscGain);
  oscGain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);

  // Boom: quick noise burst
  const dur = 0.35;
  const buffer = c.createBuffer(
    1,
    Math.max(1, Math.floor(c.sampleRate * dur)),
    c.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.exp(-i * 0.00018);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.0001, t0 + 0.18);
  ng.gain.exponentialRampToValueAtTime(0.4, t0 + 0.21);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
  noise.connect(lp);
  lp.connect(ng);
  ng.connect(c.destination);
  noise.start(t0 + 0.18);
  noise.stop(t0 + 0.55);
}

export function playWin() {
  // Ascending arpeggio C5 - E5 - G5 - C6
  beep(523.25, 0.12, "square", 0.09, 0);
  beep(659.25, 0.12, "square", 0.09, 0.13);
  beep(783.99, 0.12, "square", 0.09, 0.26);
  beep(1046.5, 0.3, "square", 0.1, 0.39);
}

export function playLose() {
  // Descending sad tone
  beep(440, 0.15, "sawtooth", 0.07, 0);
  beep(330, 0.15, "sawtooth", 0.07, 0.16);
  beep(220, 0.35, "sawtooth", 0.08, 0.32);
}

export function playDraw() {
  beep(440, 0.18, "triangle", 0.07, 0);
  beep(440, 0.25, "triangle", 0.07, 0.2);
}

export function playHint() {
  beep(880, 0.08, "triangle", 0.06, 0);
  beep(1175, 0.12, "triangle", 0.06, 0.09);
}

export function playClick() {
  beep(660, 0.04, "square", 0.04);
}

export function playRing() {
  if (isMuted()) return;
  // Two short chime pairs, like a phone ring
  beep(880, 0.16, "sine", 0.1, 0);
  beep(660, 0.16, "sine", 0.1, 0.18);
  beep(880, 0.16, "sine", 0.1, 0.5);
  beep(660, 0.22, "sine", 0.1, 0.68);
}
