"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Zap, CheckCircle2, Globe, Users, Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const LINE1 = "Prove What You Know.";
const LINE2 = "Own Your Credentials.";
const CHAR_DELAY = 46;

// ── Floating credential card ──────────────────────────────────────────────────

function CredentialCard({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "relative w-full transition-all duration-700",
        visible ? "opacity-100 translate-y-0 animate-float" : "opacity-0 translate-y-10"
      )}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-3xl scale-110 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.25) 0%, transparent 70%)", filter: "blur(20px)" }}
      />

      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(32px)",
        }}
      >
        {/* Top gradient stripe */}
        <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, #6366F1, #8B5CF6, #06B6D4)" }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}
              >
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Verified Credential
                </p>
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.80)" }}>
                  W3C VC 2.0 Standard
                </p>
              </div>
            </div>
            <span
              className="flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
              style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", color: "#34D399" }}
            >
              <CheckCircle2 className="h-3 w-3" /> Valid
            </span>
          </div>

          {/* Skill */}
          <div className="mb-5">
            <h3 className="text-lg font-extrabold text-white leading-tight">
              Frontend Web Development
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
              Level 1 · Foundations · Technology
            </p>
          </div>

          {/* Score */}
          <div className="flex items-end gap-4 mb-5">
            <div>
              <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>Score</p>
              <p
                className="text-6xl font-black leading-none"
                style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                87
              </p>
            </div>
            <div className="flex-1 pb-2">
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: "87%", background: "linear-gradient(90deg, #6366F1, #8B5CF6)" }}
                />
              </div>
              <div className="flex justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                <span>0</span>
                <span style={{ color: "rgba(255,255,255,0.50)" }}>Pass: 70</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Rubric dims */}
          <div className="grid grid-cols-3 gap-1.5 mb-5">
            {[
              { label: "Semantic HTML", pts: "18", max: "20" },
              { label: "CSS Quality",   pts: "17", max: "20" },
              { label: "Responsive",    pts: "22", max: "25" },
            ].map((d) => (
              <div
                key={d.label}
                className="rounded-xl p-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <p className="text-[9px] leading-tight mb-1" style={{ color: "rgba(255,255,255,0.30)" }}>{d.label}</p>
                <p className="text-sm font-bold text-white">
                  {d.pts}<span className="text-[10px] font-normal" style={{ color: "rgba(255,255,255,0.35)" }}>/{d.max}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between pt-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3" style={{ color: "rgba(255,255,255,0.25)" }} />
              <span className="text-[10px] font-mono truncate max-w-[180px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                did:web:maxx-engage-ai.vercel.app
              </span>
            </div>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>May 2026</span>
          </div>
        </div>
      </div>

      {/* Mini stat pills below card */}
      <div className="flex gap-2 mt-3 justify-center">
        {[
          { label: "AI Graded", color: "#6366F1" },
          { label: "Tamper-proof", color: "#8B5CF6" },
          { label: "Shareable", color: "#06B6D4" },
        ].map((p) => (
          <span
            key={p.label}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: `${p.color}18`, border: `1px solid ${p.color}30`, color: p.color }}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main hero ─────────────────────────────────────────────────────────────────

export function HeroSection() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [cursor, setCursor] = useState<"line1" | "line2" | "done">("line1");
  const [showSub,  setShowSub]  = useState(false);
  const [showCTA,  setShowCTA]  = useState(false);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    async function run() {
      await delay(400);
      for (let i = 1; i <= LINE1.length; i++) {
        if (cancelled) return;
        setText1(LINE1.slice(0, i));
        await delay(CHAR_DELAY);
      }
      await delay(200);
      setCursor("line2");
      for (let i = 1; i <= LINE2.length; i++) {
        if (cancelled) return;
        setText2(LINE2.slice(0, i));
        await delay(CHAR_DELAY);
      }
      setCursor("done");
      await delay(280);
      if (!cancelled) setShowSub(true);
      await delay(420);
      if (!cancelled) setShowCTA(true);
      await delay(280);
      if (!cancelled) setShowCard(true);
    }
    run();
    return () => { cancelled = true; };
  }, []);

  const fadeUp = (show: boolean, delay = "0ms") => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(20px)",
    transition: `opacity 0.65s ease ${delay}, transform 0.65s ease ${delay}`,
  });

  return (
    <section className="relative overflow-hidden hero-bg">

      {/* Gradient orbs */}
      <div className="orb w-[700px] h-[700px] top-[-20%] left-[-12%]"  style={{ background: "radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 65%)" }} />
      <div className="orb w-[600px] h-[600px] top-[5%] right-[-12%]"   style={{ background: "radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)" }} />
      <div className="orb w-[500px] h-[500px] bottom-[-5%] left-[35%]" style={{ background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 65%)" }} />

      {/* Mesh grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />

      {/* Main content */}
      <div className="relative pt-20 pb-24 sm:pt-28 sm:pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-20 items-center">

            {/* ── Left column ── */}
            <div>

              {/* Logo */}
              <div className="flex justify-center lg:justify-start mb-7">
                <Image
                  src="/logo.png"
                  alt="Maxx Engage"
                  width={68}
                  height={68}
                  className="rounded-xl"
                  style={{ mixBlendMode: "screen" }}
                  priority
                />
              </div>

              {/* Badge */}
              <div className="flex justify-center lg:justify-start mb-6">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase"
                  style={{
                    background: "rgba(99,102,241,0.14)",
                    border: "1px solid rgba(99,102,241,0.35)",
                    color: "#A5B4FC",
                  }}
                >
                  <Zap className="h-3 w-3" />
                  Engine 1 of Civilization OS
                </div>
              </div>

              {/* Heading */}
              <h1
                className="text-center lg:text-left font-extrabold tracking-tight leading-[1.07] mb-6"
                style={{
                  fontSize: "clamp(2.4rem, 5vw, 4rem)",
                  minHeight: "2.4em",
                }}
              >
                <span className="block text-white">
                  {text1}
                  {cursor === "line1" && (
                    <span className="inline-block w-1 h-[0.82em] bg-white/80 align-middle ml-1 animate-pulse" />
                  )}
                </span>
                {/* Gradient line 2 */}
                <span
                  className="block"
                  style={{
                    background: "linear-gradient(135deg, #818CF8 0%, #A78BFA 45%, #22D3EE 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    minHeight: "1.1em",
                  }}
                >
                  {text2}
                  {cursor === "line2" && text2 && (
                    <span
                      className="inline-block w-1 h-[0.82em] align-middle ml-1 animate-pulse"
                      style={{ background: "#A78BFA", WebkitTextFillColor: "initial" }}
                    />
                  )}
                  {!text2 && <span className="invisible">Own Your Credentials.</span>}
                </span>
              </h1>

              {/* Subtext */}
              <p
                className="text-center lg:text-left text-base sm:text-lg leading-relaxed mb-8 max-w-lg"
                style={{ ...fadeUp(showSub), color: "rgba(255,255,255,0.52)", marginLeft: 0 }}
              >
                AI-graded skill assessments that issue tamper-proof W3C Verifiable
                Credentials. No gatekeeping. No courses. Your work, fairly judged —
                for every talent on Earth.
              </p>

              {/* CTAs */}
              <div
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8"
                style={fadeUp(showCTA, "0.08s")}
              >
                <Link
                  href="/assess"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl font-bold text-base text-white transition-opacity hover:opacity-88"
                  style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", boxShadow: "0 0 30px rgba(99,102,241,0.40)" }}
                >
                  Start Free Assessment
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl font-medium text-base transition-all hover:brightness-125"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  See How It Works
                </Link>
              </div>

              {/* Trust strip */}
              <div
                className="flex flex-wrap gap-5 justify-center lg:justify-start text-xs"
                style={{ ...fadeUp(showCTA, "0.18s"), color: "rgba(255,255,255,0.32)" }}
              >
                {[
                  { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Free forever for learners" },
                  { icon: <Lock className="h-3.5 w-3.5" />,        label: "No account to try" },
                  { icon: <Users className="h-3.5 w-3.5" />,        label: "Every talent on Earth" },
                ].map((t) => (
                  <span key={t.label} className="flex items-center gap-1.5">
                    {t.icon}{t.label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Right column: credential card ── */}
            <div className="flex justify-center lg:justify-end" style={fadeUp(showCard, "0.05s")}>
              <div className="w-full">
                <p
                  className="text-center text-[10px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: "rgba(255,255,255,0.22)" }}
                >
                  What you earn
                </p>
                <CredentialCard visible={showCard} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade into light section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, oklch(0.99 0.004 264))" }}
      />
    </section>
  );
}
