"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Award, Zap, CheckCircle2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const LINE1 = "Prove What You Know.";
const LINE2 = "Own Your Credentials.";
const CHAR_DELAY = 46;

// ── Mock credential card ──────────────────────────────────────────────────────

function CredentialCard({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "w-full max-w-[420px] mx-auto rounded-2xl border border-border bg-card shadow-2xl shadow-black/8 overflow-hidden transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
      style={{ transitionDelay: visible ? "0ms" : "0ms" }}
    >
      {/* Top stripe */}
      <div className="h-1.5 w-full bg-foreground" />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-background" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Verified Credential</p>
              <p className="text-xs font-semibold text-foreground">W3C VC 2.0 Standard</p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-foreground/6 border border-border px-2 py-1 rounded-full text-foreground/60">
            <CheckCircle2 className="h-3 w-3" /> Valid
          </span>
        </div>

        {/* Skill name */}
        <div className="mb-5">
          <h3 className="text-lg font-extrabold text-foreground leading-tight">Frontend Web Development</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Level 1 · Foundations · Technology</p>
        </div>

        {/* Score row */}
        <div className="flex items-end gap-4 mb-5">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Score</p>
            <p className="text-4xl font-black text-foreground leading-none">87</p>
            <p className="text-xs text-muted-foreground">/100</p>
          </div>
          <div className="flex-1">
            <div className="h-1.5 bg-foreground/8 rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-foreground rounded-full" style={{ width: "87%" }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span className="font-semibold text-foreground">Pass: 70</span>
              <span>100</span>
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: "Semantic HTML", score: 18, max: 20 },
            { label: "CSS Quality",   score: 17, max: 20 },
            { label: "Responsive",    score: 22, max: 25 },
          ].map((d) => (
            <div key={d.label} className="rounded-lg bg-foreground/4 border border-border/60 p-2">
              <p className="text-[9px] text-muted-foreground leading-tight mb-1">{d.label}</p>
              <p className="text-sm font-bold text-foreground">{d.score}<span className="text-[10px] font-normal text-muted-foreground">/{d.max}</span></p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border/60">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground font-mono truncate">did:web:maxx-engage-ai.vercel.app</span>
          </div>
          <span className="text-[10px] text-muted-foreground">May 2026</span>
        </div>
      </div>
    </div>
  );
}

// ── Main hero ──────────────────────────────────────────────────────────────────

export function HeroSection() {
  const [text1, setText1] = useState("");
  const [text2, setText2] = useState("");
  const [cursor, setCursor] = useState<"line1" | "line2" | "done">("line1");
  const [showSub, setShowSub] = useState(false);
  const [showCTA, setShowCTA] = useState(false);
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
      await delay(180);
      setCursor("line2");
      for (let i = 1; i <= LINE2.length; i++) {
        if (cancelled) return;
        setText2(LINE2.slice(0, i));
        await delay(CHAR_DELAY);
      }
      setCursor("done");
      await delay(300);
      if (!cancelled) setShowSub(true);
      await delay(400);
      if (!cancelled) setShowCTA(true);
      await delay(300);
      if (!cancelled) setShowCard(true);
    }

    run();
    return () => { cancelled = true; };
  }, []);

  const fadeIn = (show: boolean, extraDelay = "0ms") => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0px)" : "translateY(18px)",
    transition: `opacity 0.65s ease ${extraDelay}, transform 0.65s ease ${extraDelay}`,
  });

  return (
    <section className="relative overflow-hidden bg-background">
      {/* Radial gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 90% 55% at 50% 0%, oklch(0.93 0 0), oklch(0.99 0 0) 70%)",
        }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(oklch(0.08 0 0 / 0.045) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content */}
      <div className="relative pt-24 pb-16 sm:pt-32 sm:pb-20 px-4">

        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/90 backdrop-blur px-4 py-1.5 text-[11px] font-bold text-foreground/45 tracking-widest uppercase shadow-sm">
            <Zap className="h-3 w-3" />
            Engine 1 of Civilization OS
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="text-5xl sm:text-7xl lg:text-[84px] font-extrabold tracking-tight leading-[1.05]"
            style={{ minHeight: "2.2em" }}
          >
            <span
              className="block text-foreground"
              style={{
                textShadow: "0 1px 0 oklch(0.78 0 0), 0 2px 0 oklch(0.70 0 0), 0 3px 0 oklch(0.63 0 0), 0 4px 8px oklch(0 0 0 / 0.08)",
              }}
            >
              {text1}
              {cursor === "line1" && (
                <span className="inline-block w-[4px] h-[0.85em] bg-foreground align-middle ml-1 animate-pulse" />
              )}
            </span>
            <span
              className="block text-foreground/45"
              style={{
                textShadow: "0 1px 0 oklch(0.88 0 0), 0 2px 0 oklch(0.83 0 0), 0 3px 4px oklch(0 0 0 / 0.04)",
              }}
            >
              {text2 || <span className="invisible">placeholder</span>}
              {cursor === "line2" && text2 && (
                <span className="inline-block w-[4px] h-[0.85em] bg-foreground/45 align-middle ml-1 animate-pulse" />
              )}
            </span>
          </h1>
        </div>

        {/* Subtext */}
        <p
          className="text-base sm:text-lg text-muted-foreground text-center max-w-xl mx-auto leading-relaxed mb-10"
          style={fadeIn(showSub)}
        >
          AI-graded skill assessments that issue tamper-proof W3C Verifiable Credentials.
          No gatekeeping. No expensive courses. Your work, fairly judged.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row gap-3 justify-center mb-6"
          style={fadeIn(showCTA, "0.08s")}
        >
          <Link
            href="/assess"
            className="inline-flex items-center justify-center gap-2 h-13 px-9 rounded-xl bg-foreground text-background font-bold text-base hover:opacity-85 transition-opacity shadow-xl shadow-black/12"
          >
            Start Free Assessment
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center gap-2 h-13 px-8 rounded-xl border border-border bg-card text-foreground/70 font-medium text-base hover:bg-muted hover:border-foreground/20 transition-all"
          >
            See How It Works
          </Link>
        </div>

        {/* Trust strip */}
        <div
          className="flex flex-wrap items-center justify-center gap-5 text-xs text-muted-foreground/60 mb-16"
          style={fadeIn(showCTA, "0.18s")}
        >
          {[
            { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "Free forever for learners" },
            { icon: <Award className="h-3.5 w-3.5" />,       label: "No account to try" },
            { icon: <Globe className="h-3.5 w-3.5" />,        label: "Works in 45+ countries" },
          ].map((t) => (
            <span key={t.label} className="flex items-center gap-1.5">
              {t.icon} {t.label}
            </span>
          ))}
        </div>

        {/* Credential card showcase */}
        <div className="max-w-lg mx-auto" style={fadeIn(showCard, "0.05s")}>
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-4">
            What you earn
          </p>
          <CredentialCard visible={showCard} />
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div
        className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, oklch(0.99 0 0))" }}
      />
    </section>
  );
}
