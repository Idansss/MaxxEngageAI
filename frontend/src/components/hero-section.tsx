"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Zap, CheckCircle2, Globe, Users, Lock, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const LINE1 = "Prove What";
const LINE1B = "You Know.";
const LINE2 = "Own Your Credentials.";
const CHAR_DELAY = 50;

// ── Concentric-ring visual (inspired by image 1) ─────────────────────────────

function HeroVisual({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "relative transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      style={{ animation: visible ? "float 7s ease-in-out infinite" : "none" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, rgba(99,102,241,0.18) 0%, transparent 70%)",
          filter: "blur(24px)",
          transform: "scale(1.15)",
        }}
      />

      {/* Glass card container */}
      <div
        className="relative rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.68)",
          border: "1.5px solid rgba(255,255,255,0.92)",
          backdropFilter: "blur(28px) saturate(180%)",
          boxShadow: "0 24px 64px rgba(99,102,241,0.13), 0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        {/* Top visual: concentric rings on soft gradient */}
        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            height: "220px",
            background: "linear-gradient(145deg, #EEF2FF 0%, #E0E7FF 40%, #C7D2FE 100%)",
          }}
        >
          {/* Rings */}
          {[280, 220, 165, 115, 72].map((size, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                background: `rgba(255,255,255,${0.22 + i * 0.08})`,
                border: `${i === 4 ? "2px" : "1.5px"} solid rgba(255,255,255,${0.5 + i * 0.09})`,
                boxShadow: i === 4 ? "0 4px 24px rgba(99,102,241,0.28)" : undefined,
              }}
            />
          ))}
          {/* Center shield */}
          <div
            className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
          >
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>

          {/* Floating badge */}
          <div
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold shadow-sm"
            style={{ background: "rgba(255,255,255,0.85)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.18)" }}
          >
            <CheckCircle2 className="h-3 w-3" /> Valid
          </div>

          {/* Score pill top-left */}
          <div
            className="absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] font-black shadow-sm"
            style={{ background: "rgba(99,102,241,0.12)", color: "#6366F1", border: "1px solid rgba(99,102,241,0.20)" }}
          >
            87 / 100
          </div>
        </div>

        {/* Info panel */}
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-extrabold text-gray-800 text-base">Frontend Development</h3>
              <p className="text-xs text-gray-400 mt-0.5">Level 1 · Foundations · Technology</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>87</p>
              <p className="text-[10px] text-gray-400">Passed</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-indigo-50 overflow-hidden mb-3">
            <div
              className="h-full rounded-full"
              style={{ width: "87%", background: "linear-gradient(90deg, #6366F1, #8B5CF6)" }}
            />
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "AI Graded",   bg: "bg-indigo-50",  text: "text-indigo-600" },
              { label: "W3C VC 2.0",  bg: "bg-violet-50",  text: "text-violet-600" },
              { label: "Shareable",   bg: "bg-sky-50",     text: "text-sky-600" },
            ].map((t) => (
              <span key={t.label} className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full border", t.bg, t.text, "border-current/20")}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Floating pills */}
      <div
        className="absolute -top-3 -right-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg"
        style={{ background: "white", color: "#7C3AED", border: "1px solid rgba(124,58,237,0.15)", boxShadow: "0 4px 16px rgba(124,58,237,0.14)" }}
      >
        <Star className="h-3 w-3 fill-current" /> Credential Earned
      </div>
      <div
        className="absolute -bottom-3 -left-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg"
        style={{ background: "white", color: "#0EA5E9", border: "1px solid rgba(14,165,233,0.15)", boxShadow: "0 4px 16px rgba(14,165,233,0.12)" }}
      >
        <Globe className="h-3 w-3" /> 45+ Countries
      </div>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export function HeroSection() {
  const [t1, setT1] = useState("");
  const [t1b, setT1b] = useState("");
  const [t2, setT2] = useState("");
  const [phase, setPhase] = useState<"l1" | "l1b" | "l2" | "done">("l1");
  const [showSub,  setShowSub]  = useState(false);
  const [showCTA,  setShowCTA]  = useState(false);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    let c = false;
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    async function run() {
      await delay(350);
      for (let i = 1; i <= LINE1.length;  i++) { if (c) return; setT1(LINE1.slice(0, i));  await delay(CHAR_DELAY); }
      await delay(120);
      setPhase("l1b");
      for (let i = 1; i <= LINE1B.length; i++) { if (c) return; setT1b(LINE1B.slice(0, i)); await delay(CHAR_DELAY); }
      await delay(200);
      setPhase("l2");
      for (let i = 1; i <= LINE2.length;  i++) { if (c) return; setT2(LINE2.slice(0, i));  await delay(CHAR_DELAY); }
      setPhase("done");
      await delay(280); if (!c) setShowSub(true);
      await delay(400); if (!c) setShowCTA(true);
      await delay(280); if (!c) setShowCard(true);
    }
    run();
    return () => { c = true; };
  }, []);

  const fadeUp = (show: boolean, delay = "0ms") => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 0.65s ease ${delay}, transform 0.65s ease ${delay}`,
  });

  const cursor = (active: boolean) => active
    ? <span className="inline-block w-[3px] h-[0.82em] rounded-full bg-current align-middle ml-0.5 animate-pulse" />
    : null;

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 70% 60% at 10% 40%, rgba(99,102,241,0.10) 0%, transparent 55%),
          radial-gradient(ellipse 60% 50% at 90% 20%, rgba(139,92,246,0.08) 0%, transparent 55%),
          radial-gradient(ellipse 50% 60% at 55% 90%, rgba(6,182,212,0.07) 0%, transparent 55%),
          radial-gradient(ellipse 40% 40% at 80% 75%, rgba(251,191,36,0.06) 0%, transparent 55%),
          #F8F9FF
        `,
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(rgba(99,102,241,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative pt-10 pb-20 sm:pt-14 sm:pb-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_400px] gap-10 lg:gap-16 items-center">

            {/* ── Left ── */}
            <div>
              {/* Pill badge */}
              <div className="flex justify-center lg:justify-start mb-5">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase shadow-sm"
                  style={{
                    background: "rgba(99,102,241,0.09)",
                    border: "1px solid rgba(99,102,241,0.22)",
                    color: "#6366F1",
                  }}
                >
                  <Zap className="h-3 w-3" />
                  Engine 1 of Civilization OS
                </div>
              </div>

              {/* Heading — mixed style like image 1 */}
              <div className="text-center lg:text-left mb-6" style={{ minHeight: "3.6em" }}>
                {/* Line 1a — regular weight */}
                <span className="block text-5xl sm:text-6xl lg:text-[68px] font-extrabold tracking-tight leading-[1.07] text-gray-800">
                  {t1}{cursor(phase === "l1")}
                </span>
                {/* Line 1b — gradient italic-style */}
                <span
                  className="block text-5xl sm:text-6xl lg:text-[68px] font-extrabold tracking-tight leading-[1.07] italic"
                  style={{
                    background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 55%, #06B6D4 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {t1b || <span className="invisible">You Know.</span>}{cursor(phase === "l1b")}
                </span>
                {/* Line 2 — dark */}
                <span className="block text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.15] text-gray-500 mt-1">
                  {t2 || <span className="invisible">Own Your Credentials.</span>}{cursor(phase === "l2")}
                </span>
              </div>

              {/* Subtext */}
              <p
                className="text-center lg:text-left text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-md"
                style={fadeUp(showSub)}
              >
                AI-graded skill assessments that issue tamper-proof W3C Verifiable
                Credentials. No gatekeeping. Free for every talent on Earth.
              </p>

              {/* CTAs */}
              <div
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-7"
                style={fadeUp(showCTA, "0.06s")}
              >
                <Link
                  href="/assess"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-2xl font-bold text-base text-white transition-all hover:scale-[1.02] hover:shadow-xl"
                  style={{
                    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                    boxShadow: "0 8px 28px rgba(99,102,241,0.35)",
                  }}
                >
                  Start Free Assessment
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-2xl font-semibold text-base text-gray-600 border border-gray-200 bg-white/80 hover:bg-white hover:border-indigo-200 transition-all"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
                >
                  See How It Works
                </Link>
              </div>

              {/* Trust strip */}
              <div
                className="flex flex-wrap gap-4 justify-center lg:justify-start text-xs text-gray-400"
                style={fadeUp(showCTA, "0.14s")}
              >
                {[
                  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Free forever for learners" },
                  { icon: <Lock className="h-3.5 w-3.5" />,        label: "No account to try" },
                  { icon: <Users className="h-3.5 w-3.5" />,        label: "Open to all talent" },
                ].map((t) => (
                  <span key={t.label} className="flex items-center gap-1.5">
                    {t.icon}{t.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right: hero visual ── */}
            <div className="flex justify-center lg:justify-end" style={fadeUp(showCard, "0.04s")}>
              <div className="w-full max-w-sm">
                <HeroVisual visible={showCard} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
