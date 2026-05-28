import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import {
  ArrowRight, Award, BookOpen, CheckCircle, ChevronDown,
  Globe, Lock, ShieldCheck, Wifi, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HeroSection } from "@/components/hero-section";
import { LandingNav } from "@/components/landing-nav";

export const dynamic = "force-dynamic";

async function getData() {
  const [skillPaths, stats] = await Promise.allSettled([
    api.skillPaths.list(),
    api.platform.stats(),
  ]);
  return {
    skillPaths: skillPaths.status === "fulfilled" ? skillPaths.value : [],
    stats: stats.status === "fulfilled" ? stats.value : null,
  };
}

function domainStripe(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology", design: "stripe-design",
    data: "stripe-data",            writing: "stripe-writing",
    business: "stripe-business",    ops: "stripe-ops",
    science: "stripe-science",
  };
  return map[domain] ?? "bg-muted-foreground/40";
}

function domainColor(_domain: string) {
  return "bg-muted text-muted-foreground";
}

// ── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. Assessments, AI grading, and credential issuance are free for learners. Employers can verify shared credentials without an account.",
  },
  {
    q: "How is the AI grading fair?",
    a: "Every score includes the exact rubric dimensions used, the AI's reasoning, and evidence quotes pulled directly from your submission. You can see exactly why you got each score — no black boxes.",
  },
  {
    q: "What is a W3C Verifiable Credential?",
    a: "It's an open internet standard for tamper-proof digital credentials. Your credential is cryptographically signed with our DID key. Anyone can verify it hasn't been altered — even if Maxx Engage shut down tomorrow.",
  },
  {
    q: "Can employers trust these credentials?",
    a: "Every credential links to a public verify page where anyone can confirm the cryptographic signature, the score, the rubric, and the date. No need to contact us — the math is the proof.",
  },
  {
    q: "What if I disagree with my score?",
    a: "You can flag any review for human review. Our team reads the submission and the AI's reasoning and can override the score. You can also retake assessments to improve.",
  },
  {
    q: "Do credentials expire?",
    a: "Skills decay. Each credential has a stated half-life — after that, your score is gradually reduced to reflect that the skill may have been practised less recently. Refreshing with a new submission resets the clock.",
  },
];

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-6 py-4">
      <p className="text-3xl font-black text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── FAQ item (pure CSS details/summary) ───────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group border-b border-border/60 last:border-0">
      <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none select-none hover:text-foreground transition-colors">
        <span className="text-sm font-semibold">{q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
    </details>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { skillPaths, stats } = await getData();

  return (
    <div className="flex flex-col min-h-screen">
      <LandingNav />
      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <HeroSection />

        {/* ── Stats bar ────────────────────────────────────────────────────── */}
        {stats && (
          <section
            className="py-6 px-6"
            style={{ background: "rgba(255,255,255,0.72)", borderTop: "1px solid rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.08)", backdropFilter: "blur(12px)" }}
          >
            <div className="max-w-4xl mx-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { value: stats.credential_count > 0 ? stats.credential_count.toLocaleString() : "—", label: "Credentials issued", color: "#6366F1" },
                  { value: stats.user_count > 0 ? stats.user_count.toLocaleString() : "—",             label: "Learners joined",    color: "#8B5CF6" },
                  { value: stats.country_count > 0 ? `${stats.country_count}+` : "—",                  label: "Countries",           color: "#06B6D4" },
                  { value: String(stats.skill_path_count),                                              label: "Skill paths",         color: "#10B981" },
                ].map((s) => (
                  <div key={s.label} className="text-center px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.60)", border: "1px solid rgba(255,255,255,0.90)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <p className="text-2xl font-black mb-0.5" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Features bento grid (inspired by image 2) ───────────────────── */}
        <section id="how-it-works" className="py-24 px-6"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 80% 30%, rgba(139,92,246,0.07) 0%, transparent 55%),
              radial-gradient(ellipse 50% 50% at 20% 70%, rgba(6,182,212,0.06) 0%, transparent 55%),
              #F8F9FF
            `,
          }}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-3">How it works</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-800">Everything you need to prove your skills</h2>
              <p className="text-gray-400 mt-3 max-w-lg mx-auto leading-relaxed">
                From choosing a skill to owning a tamper-proof credential — all in under an hour.
              </p>
            </div>

            {/* 3-col bento grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: <BookOpen className="h-5 w-5" />,
                  title: "Pick a skill path",
                  desc: "Choose from Technology, Writing, Design, Data, Business, Operations, and more.",
                  tag: "Step 01",
                  gradient: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
                  iconBg: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  tagColor: "#6366F1",
                  tagBg: "rgba(99,102,241,0.10)",
                },
                {
                  icon: <Zap className="h-5 w-5" />,
                  title: "Submit your work",
                  desc: "Complete the task at your own pace. Paste your code, writing, or design — no time pressure.",
                  tag: "Step 02",
                  gradient: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                  iconBg: "linear-gradient(135deg, #10B981, #059669)",
                  tagColor: "#059669",
                  tagBg: "rgba(5,150,105,0.10)",
                },
                {
                  icon: <CheckCircle className="h-5 w-5" />,
                  title: "AI grades it instantly",
                  desc: "Claude scores every rubric dimension with specific evidence quotes pulled from your work.",
                  tag: "Step 03",
                  gradient: "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
                  iconBg: "linear-gradient(135deg, #F97316, #EA580C)",
                  tagColor: "#EA580C",
                  tagBg: "rgba(234,88,12,0.10)",
                },
                {
                  icon: <Award className="h-5 w-5" />,
                  title: "Earn your credential",
                  desc: "Score 70+ and receive a W3C Verifiable Credential you own forever — signed, shareable, tamper-proof.",
                  tag: "Step 04",
                  gradient: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
                  iconBg: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                  tagColor: "#7C3AED",
                  tagBg: "rgba(124,58,237,0.10)",
                },
                {
                  icon: <ShieldCheck className="h-5 w-5" />,
                  title: "Open reasoning, always",
                  desc: "Every score comes with the AI's exact reasoning. No black boxes — you see exactly why you got each mark.",
                  tag: "Transparent",
                  gradient: "linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%)",
                  iconBg: "linear-gradient(135deg, #0EA5E9, #0284C7)",
                  tagColor: "#0284C7",
                  tagBg: "rgba(2,132,199,0.10)",
                },
                {
                  icon: <Globe className="h-5 w-5" />,
                  title: "You own your data",
                  desc: "W3C VC 2.0 credentials are cryptographically signed and held by you — never locked to our platform.",
                  tag: "Sovereign",
                  gradient: "linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)",
                  iconBg: "linear-gradient(135deg, #F43F5E, #E11D48)",
                  tagColor: "#E11D48",
                  tagBg: "rgba(225,29,72,0.10)",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl p-5 flex flex-col gap-3 transition-all hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    background: f.gradient,
                    border: "1.5px solid rgba(255,255,255,0.85)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* Icon pair — like image 2 */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                      style={{ background: f.iconBg }}
                    >
                      {f.icon}
                    </div>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: "rgba(255,255,255,0.70)", border: "1px solid rgba(255,255,255,0.90)" }}
                    >
                      <Zap className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-base mb-1.5">{f.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                  </div>

                  {/* Tag pill — like image 2 */}
                  <div className="flex">
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full"
                      style={{ background: f.tagBg, color: f.tagColor }}
                    >
                      {f.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Skill paths ──────────────────────────────────────────────────── */}
        <section id="skill-paths" className="py-24 px-4 bg-secondary/30">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">Start today</p>
                <h2 className="text-3xl sm:text-4xl font-extrabold">Available skill paths</h2>
                <p className="text-muted-foreground mt-2 max-w-md leading-relaxed">
                  Prove your skills across tech, design, data, writing and more.
                </p>
              </div>
              <Link href="/skill-paths" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 self-start sm:self-auto gap-1.5")}>
                View all paths <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {skillPaths.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Loading skill paths…</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {skillPaths.slice(0, 6).map((sp) => (
                  <Card key={sp.id} className="overflow-hidden p-0 hover:shadow-md transition-shadow">
                    <div className={cn("h-1.5 w-full", domainStripe(sp.domain))} />
                    <CardHeader className="pt-5 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-bold leading-snug">{sp.name}</CardTitle>
                        <Badge variant="secondary" className={cn("text-xs shrink-0 capitalize", domainColor(sp.domain))}>
                          {sp.domain}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-5">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{sp.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {sp.levels.length} levels &middot; Credential refreshes every {sp.decay_half_life_months} months
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/skill-paths/${sp.slug}`}
                          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "justify-center gap-1")}
                        >
                          Details
                        </Link>
                        <Link
                          href={`/assess/${sp.slug}`}
                          className={cn(buttonVariants({ size: "sm" }), "justify-center gap-1")}
                        >
                          Start <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Trust section ────────────────────────────────────────────────── */}
        <section className="py-24 px-4 bg-foreground text-background">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold">Built different, on purpose</h2>
              <p className="text-background/60 mt-3 max-w-lg mx-auto leading-relaxed">
                We started from first principles — what does fair, global, open credentialing actually look like?
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                { icon: <Globe className="h-7 w-7 text-background/75" />, title: "Open reasoning",    desc: "Every score comes with the AI's exact reasoning and evidence quotes. No black boxes, ever." },
                { icon: <Lock className="h-7 w-7 text-background/75" />,  title: "You own your data", desc: "Credentials are W3C VC 2.0 — held by you, verifiable by anyone, never locked to our platform." },
                { icon: <Wifi className="h-7 w-7 text-background/75" />,  title: "Works on 3G",       desc: "Designed for Africa's internet reality. Fast, lightweight, no app to install." },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/8 flex items-center justify-center">{item.icon}</div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-background/60 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── For employers ────────────────────────────────────────────────── */}
        <section className="py-24 px-4 bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-3">For employers</p>
                <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
                  Hire talent you can verify in 30 seconds
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Ask for a Maxx Engage proof link, paste it into Verify, and see the skill, score, rubric, and issue date before you make a hiring decision.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Cryptographically signed credentials — tamper-proof",
                    "Transparent rubric scores, not just pass/fail",
                    "Optional human review for highest-stakes hires",
                    "Public proof pages for every verified credential",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm">
                      <ShieldCheck className="h-4 w-4 text-foreground/60 mt-0.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/verify"
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify a credential
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: <ShieldCheck className="h-5 w-5 text-foreground/70" />, stat: "Public", label: "proof pages" },
                  { icon: <ShieldCheck className="h-5 w-5 text-foreground/70" />, stat: "100%",   label: "rubric-graded" },
                  { icon: <Globe className="h-5 w-5 text-foreground/70" />,       stat: "Global", label: "talent pool" },
                  { icon: <Award className="h-5 w-5 text-foreground/70" />,       stat: "Free",   label: "to verify" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-card p-5 space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-foreground/6 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <p className="text-xl font-black">{item.stat}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="py-24 px-4 bg-secondary/30">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-3">Common questions</p>
              <h2 className="text-3xl font-extrabold">FAQ</h2>
            </div>
            <div className="rounded-2xl border bg-card divide-y divide-border/60 px-6">
              {FAQ.map((item) => <FaqItem key={item.q} q={item.q} a={item.a} />)}
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="py-20 px-4 bg-background">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold mb-4">Ready to prove your skills?</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Join learners worldwide building a verified track record that belongs to them — not a platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/assess"
                className="inline-flex items-center justify-center gap-2 h-12 px-10 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-black/15"
              >
                Start Free — No Account Needed
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-8")}
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div>
            <p className="font-bold text-foreground mb-1">Maxx Engage</p>
            <p className="text-xs">Engine 1 of Civilization OS &mdash; Built for global talent.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
            <Link href="/skill-paths" className="hover:text-foreground transition-colors">Skill Paths</Link>
            <Link href="/verify" className="hover:text-foreground transition-colors">Verify a Credential</Link>
            <Link href="/community" className="hover:text-foreground transition-colors">Community</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
