"use client";

import { useEffect, useRef } from "react";
import { playFireworkPop } from "@/lib/sound";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  color: string;
  size: number;
}

const COLORS = [
  "#ffd83d",
  "#5ec5ff",
  "#4ade80",
  "#ff5277",
  "#a855f7",
  "#fb923c",
  "#fafafa",
];

interface Props {
  active: boolean;
  durationMs?: number;
}

export default function Fireworks({ active, durationMs = 5000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const setSize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();
    window.addEventListener("resize", setSize);

    const particles: Particle[] = [];
    const start = performance.now();
    let lastBurst = 0;
    let raf = 0;

    const burst = (cx: number, cy: number) => {
      const count = 36 + Math.floor(Math.random() * 20);
      const baseColor = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
        const speed = 2 + Math.random() * 4;
        const useBase = Math.random() < 0.7;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          life: 1,
          decay: 0.008 + Math.random() * 0.012,
          color: useBase
            ? baseColor
            : COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 3 + Math.floor(Math.random() * 2),
        });
      }
      playFireworkPop();
    };

    const tick = (t: number) => {
      const elapsed = t - start;
      // Trail effect
      ctx.fillStyle = "rgba(10, 13, 24, 0.18)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      if (elapsed < durationMs && t - lastBurst > 500) {
        const cx = window.innerWidth * (0.15 + Math.random() * 0.7);
        const cy = window.innerHeight * (0.18 + Math.random() * 0.4);
        burst(cx, cy);
        lastBurst = t;
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07;
        p.vx *= 0.99;
        p.life -= p.decay;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        // Pixel-style square particle (matches retro theme)
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      if (elapsed < durationMs + 1500 || particles.length > 0) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setSize);
    };
  }, [active, durationMs]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
