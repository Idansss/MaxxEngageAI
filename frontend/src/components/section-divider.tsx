"use client";

import { useEffect, useRef, useState } from "react";

export function SectionDivider() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0 → 1 as the divider scrolls through viewport

  useEffect(() => {
    function onScroll() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Animate from when the top enters viewport bottom → top exits viewport top
      const total = vh + rect.height;
      const passed = vh - rect.top;
      const p = Math.max(0, Math.min(1, passed / total));
      setProgress(p);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Spiral path: parametric — radius grows with angle, draws from center outward
  // path strung as SVG `path` d="M ... A ... A ..." — actually use polyline for simplicity
  const cx = 200, cy = 100;
  const turns = 3;
  const totalAngle = turns * 2 * Math.PI;
  const points: string[] = [];
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * totalAngle;
    const radius = 6 + t * 84; // grows from 6px to 90px
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.42; // squashed vertically
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const pathData = "M " + points.join(" L ");

  // Draw the spiral progressively based on scroll progress
  const dashLength = 2200;
  const offset = dashLength * (1 - progress);

  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: "200px", marginTop: "-2rem", marginBottom: "-2rem", zIndex: 5 }}>

      {/* Background fade — top half light, bottom half dark to bridge sections */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(180deg, #F8F9FF 0%, #F8F9FF 35%, #0d0b1a 100%)",
        }}
      />

      {/* Lightning bolts */}
      <div className="absolute inset-0 pointer-events-none flex justify-around items-center">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="relative"
            style={{
              opacity: progress > 0.2 + i * 0.1 ? 1 : 0,
              transform: `translateY(${(1 - progress) * 20}px) scale(${0.8 + progress * 0.3})`,
              transition: "opacity 0.5s ease, transform 0.7s ease",
            }}
          >
            <svg width="34" height="56" viewBox="0 0 34 56" fill="none">
              <defs>
                <linearGradient id={`bolt-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#A78BFA" />
                  <stop offset="50%"  stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
                <filter id={`glow-${i}`}>
                  <feGaussianBlur stdDeviation="2.5" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d="M 19 2 L 4 30 L 14 30 L 11 54 L 30 22 L 18 22 L 22 2 Z"
                fill={`url(#bolt-${i})`}
                filter={`url(#glow-${i})`}
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Central spiral */}
      <svg
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        width="400"
        height="200"
        viewBox="0 0 400 200"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="spiral-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#6366F1" stopOpacity="0.95" />
            <stop offset="50%"  stopColor="#8B5CF6" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.95" />
          </linearGradient>
          <filter id="spiral-glow">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Spiral path */}
        <path
          d={pathData}
          fill="none"
          stroke="url(#spiral-grad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={dashLength}
          strokeDashoffset={offset}
          filter="url(#spiral-glow)"
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
        />

        {/* Center pulse dot */}
        <circle
          cx={cx}
          cy={cy}
          r={3 + progress * 4}
          fill="#A78BFA"
          opacity={progress}
          style={{ filter: "drop-shadow(0 0 8px #A78BFA)" }}
        />
      </svg>

      {/* Light sweep at the meet point */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: `${35 + progress * 25}%`,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(167,139,250,0.5), rgba(99,102,241,0.85), rgba(6,182,212,0.5), transparent)",
          opacity: 0.6 + progress * 0.4,
          filter: "blur(1px)",
        }}
      />
    </div>
  );
}
