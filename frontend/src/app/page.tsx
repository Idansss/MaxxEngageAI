import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { CheckCircle, Award, BookOpen, Zap, ArrowRight, Globe, Lock, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import AuthRedirect from "@/components/auth-redirect";

export const dynamic = "force-dynamic";

async function getSkillPaths() {
  try {
    return await api.skillPaths.list();
  } catch {
    return [];
  }
}

function domainStripe(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology",
    design: "stripe-design",
    data: "stripe-data",
    writing: "stripe-writing",
    business: "stripe-business",
    ops: "stripe-ops",
    science: "stripe-science",
  };
  return map[domain] ?? "bg-muted-foreground/40";
}

export default async function HomePage() {
  const skillPaths = await getSkillPaths();

  return (
    <div className="flex flex-col min-h-screen">
      <AuthRedirect />
      <main className="flex-1">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="hero-bg dot-grid relative overflow-hidden py-24 sm:py-32 px-4">
          {/* Ambient orbs */}
          <div className="orb w-[520px] h-[520px] top-[-15%] left-[-8%] bg-indigo-600/20" />
          <div className="orb w-[400px] h-[400px] top-[20%] right-[-8%] bg-violet-500/15" />
          <div className="orb w-[380px] h-[380px] bottom-[-20%] left-[30%] bg-amber-500/10" />

          <div className="relative max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-7 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-200 tracking-wider uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Engine 1 of Civilization OS
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] mb-7 tracking-tight">
              Prove What You Know.{" "}
              <span className="bg-linear-to-r from-indigo-300 via-violet-300 to-amber-300 bg-clip-text text-transparent">
                Own Your Credentials.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-indigo-200/75 mb-10 max-w-2xl mx-auto leading-relaxed">
              AI-graded skill assessments that issue tamper-proof W3C Verifiable Credentials.
              No gatekeeping. No expensive courses. Your work, fairly judged — for every talent on Earth.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/assess"
                className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-gold text-gold-fg font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-amber-500/20"
              >
                Start Free Assessment
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl border border-indigo-400/30 text-indigo-200 font-medium text-base hover:bg-indigo-500/10 hover:border-indigo-400/50 transition-all"
              >
                See How It Works
              </Link>
            </div>

            <p className="mt-7 text-sm text-indigo-300/45">
              Free forever for learners &middot; No account required to try
            </p>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 px-4 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-3">
                Simple process
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold">
                Four steps to verified mastery
              </h2>
              <p className="text-muted-foreground mt-3 max-w-lg mx-auto leading-relaxed">
                From choosing a skill to owning a tamper-proof credential — all in under an hour.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  step: "01",
                  icon: <BookOpen className="h-5 w-5" />,
                  title: "Pick a skill",
                  desc: "Choose a skill path and level. Start with a diagnostic to see exactly where you stand.",
                },
                {
                  step: "02",
                  icon: <Zap className="h-5 w-5" />,
                  title: "Submit your work",
                  desc: "Complete the task at your own pace. Paste your code, writing, or design directly.",
                },
                {
                  step: "03",
                  icon: <CheckCircle className="h-5 w-5" />,
                  title: "AI grades it",
                  desc: "Claude grades every dimension of the rubric with specific evidence quotes from your work.",
                },
                {
                  step: "04",
                  icon: <Award className="h-5 w-5" />,
                  title: "Earn a credential",
                  desc: "Score 70+ and get a W3C Verifiable Credential you own forever — shareable, tamper-proof.",
                },
              ].map((item, i) => (
                <div
                  key={item.step}
                  className="card-hover relative flex flex-col gap-4 p-6 rounded-2xl border bg-card shadow-sm"
                >
                  {/* Step number */}
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-black text-primary/10 leading-none select-none">
                      {item.step}
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      {item.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base mb-1.5">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                  {/* Connector line (desktop) */}
                  {i < 3 && (
                    <div className="hidden lg:block absolute -right-3 top-[2.25rem] w-6 border-t-2 border-dashed border-border z-10" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Skill Paths ──────────────────────────────────────────────────── */}
        <section className="py-24 px-4 bg-secondary/30">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">
                  Start today
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold">Available skill paths</h2>
                <p className="text-muted-foreground mt-2 max-w-md leading-relaxed">
                  Prove your skills across tech, design, data, writing and more.
                </p>
              </div>
              <Badge variant="outline" className="text-xs self-start sm:self-auto shrink-0">
                More paths coming soon
              </Badge>
            </div>

            {skillPaths.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                Loading skill paths…
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {skillPaths.map((sp) => (
                  <Card key={sp.id} className="card-hover overflow-hidden p-0">
                    {/* Domain colour stripe */}
                    <div className={cn("h-1.5 w-full", domainStripe(sp.domain))} />
                    <CardHeader className="pt-5 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-bold leading-snug">{sp.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                          {sp.domain}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-5">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {sp.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {sp.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-3">
                          {sp.levels.length} levels &middot; Credential refreshes every {sp.decay_half_life_months} months
                        </p>
                        <Link
                          href={`/assess?path=${sp.slug}`}
                          className={cn(buttonVariants({ size: "sm" }), "w-full justify-center gap-1.5")}
                        >
                          Start assessment <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Trust / Built different ──────────────────────────────────────── */}
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
                {
                  icon: <Globe className="h-7 w-7 text-gold" />,
                  title: "Open reasoning",
                  desc: "Every score comes with the AI's exact reasoning and evidence quotes. No black boxes, ever.",
                },
                {
                  icon: <Lock className="h-7 w-7 text-gold" />,
                  title: "You own your data",
                  desc: "Credentials are W3C VC 2.0 — held by you, verifiable by anyone, never locked to our platform.",
                },
                {
                  icon: <Wifi className="h-7 w-7 text-gold" />,
                  title: "Works on 3G",
                  desc: "Designed for Africa's internet reality. Fast, lightweight, no app to install.",
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/8 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                    <p className="text-background/60 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA banner ───────────────────────────────────────────────────── */}
        <section className="py-20 px-4 bg-secondary/40">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-extrabold mb-4">Ready to prove your skills?</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Join thousands of learners worldwide building a verified track record that belongs to them.
            </p>
            <Link
              href="/assess"
              className="inline-flex items-center justify-center gap-2 h-12 px-10 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
            >
              Start Free — No Account Needed
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>
            <span className="font-bold text-foreground">Maxx Engage</span> &mdash; Engine 1 of{" "}
            <span className="font-semibold text-foreground">Civilization OS</span>.
          </p>
          <p className="text-xs">Built for global talent. Owned by no one.</p>
        </div>
      </footer>
    </div>
  );
}
