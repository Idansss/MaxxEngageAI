"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const LINE1 = "Prove What You Know.";
const LINE2 = "Own Your Credentials.";
const CHAR_DELAY = 48; // ms per character

export function HeroSection() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [cursor, setCursor] = useState<"line1" | "line2" | "done">("line1");
  const [showSub, setShowSub] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    async function run() {
      await delay(300);
      // Type line 1
      for (let i = 1; i <= LINE1.length; i++) {
        if (cancelled) return;
        setText1(LINE1.slice(0, i));
        await delay(CHAR_DELAY);
      }
      await delay(180);
      setCursor("line2");
      // Type line 2
      for (let i = 1; i <= LINE2.length; i++) {
        if (cancelled) return;
        setText2(LINE2.slice(0, i));
        await delay(CHAR_DELAY);
      }
      setCursor("done");
      await delay(350);
      if (!cancelled) setShowSub(true);
      await delay(500);
      if (!cancelled) setShowCTA(true);
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="relative overflow-hidden py-28 sm:py-36 px-4 bg-background">
      {/* Light dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(oklch(0.08 0 0 / 0.055) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative max-w-4xl mx-auto text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 mb-8 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground/45 tracking-widest uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-foreground/30 animate-pulse" />
          Engine 1 of Civilization OS
        </div>

        {/* Heading — typewriter */}
        <h1
          className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold leading-[1.1] tracking-tight mb-8"
          style={{ minHeight: "2.6em" }}
        >
          {/* Line 1 */}
          <span className="block text-foreground" style={{ textShadow: "1px 1px 0 oklch(0.80 0 0), 2px 2px 0 oklch(0.72 0 0), 3px 3px 5px oklch(0 0 0 / 0.06)" }}>
            {text1}
            {cursor === "line1" && (
              <span className="inline-block w-[3px] h-[0.9em] bg-foreground align-middle ml-1 animate-pulse" />
            )}
          </span>

          {/* Line 2 — dimmer for visual hierarchy */}
          <span className="block text-foreground/50 mt-1" style={{ textShadow: "1px 1px 0 oklch(0.86 0 0), 2px 2px 0 oklch(0.80 0 0), 3px 3px 4px oklch(0 0 0 / 0.04)" }}>
            {text2 || <span className="opacity-0">placeholder</span>}
            {cursor === "line2" && text2 && (
              <span className="inline-block w-[3px] h-[0.9em] bg-foreground/50 align-middle ml-1 animate-pulse" />
            )}
          </span>
        </h1>

        {/* Subtext */}
        <p
          className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{
            opacity: showSub ? 1 : 0,
            transform: showSub ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          AI-graded skill assessments that issue tamper-proof W3C Verifiable Credentials.
          No gatekeeping. No expensive courses. Your work, fairly judged — for every talent on Earth.
        </p>

        {/* CTA buttons */}
        <div
          className="flex flex-col sm:flex-row gap-3 justify-center"
          style={{
            opacity: showCTA ? 1 : 0,
            transform: showCTA ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s",
          }}
        >
          <Link
            href="/assess"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-foreground text-background font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-black/10"
          >
            Start Free Assessment
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl border border-border text-foreground/70 font-medium text-base hover:bg-muted hover:border-foreground/25 transition-all"
          >
            See How It Works
          </Link>
        </div>

        <p
          className="mt-6 text-sm text-muted-foreground/50"
          style={{
            opacity: showCTA ? 1 : 0,
            transition: "opacity 0.6s ease 0.3s",
          }}
        >
          Free forever for learners · No account required to try
        </p>
      </div>
    </section>
  );
}
