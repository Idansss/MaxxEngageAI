import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Award, BarChart3, ChevronLeft, Clock, Layers, ShieldCheck, Star, Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type SkillPath, type SkillPathStats, type SkillPathRubric } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MyProgress } from "./my-progress";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  let path: SkillPath | null = null;
  try { path = await api.skillPaths.get(slug); } catch { /* ignore */ }

  if (!path) return { title: "Skill Path" };

  const title = path.name;
  const description = path.description ||
    `Master ${path.name} with AI-graded assessments and earn a tamper-proof W3C Verifiable Credential.`;

  const ogImage = `/og/skill-path/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/skill-paths/${slug}`,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

// ── Domain helpers ────────────────────────────────────────────────────────────

function domainStripe(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology",
    design:     "stripe-design",
    data:       "stripe-data",
    writing:    "stripe-writing",
    business:   "stripe-business",
    ops:        "stripe-ops",
    science:    "stripe-science",
  };
  return map[domain] ?? "bg-muted-foreground/40";
}

function domainBadge(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-primary/10 text-primary",
    design:     "bg-violet-100 text-violet-700",
    data:       "bg-emerald-100 text-emerald-700",
    writing:    "bg-amber-100 text-amber-700",
    business:   "bg-orange-100 text-orange-700",
    ops:        "bg-slate-100 text-slate-700",
    science:    "bg-teal-100 text-teal-700",
  };
  return map[domain] ?? "bg-muted text-muted-foreground";
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-lg font-black leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Rubric dimension bar ──────────────────────────────────────────────────────

function DimensionBar({ name, description, weight }: { name: string; description: string; weight: number }) {
  const pct = Math.round(weight * 100);
  const widthClass = pct >= 30 ? "w-[30%]" : pct >= 25 ? "w-1/4" : pct >= 20 ? "w-1/5" : pct >= 15 ? "w-[15%]" : "w-[10%]";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium">{name}</p>
        <span className="text-xs text-muted-foreground font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full mb-1.5">
        <div className={cn("h-full bg-primary rounded-full", widthClass)} />
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

// ── Top performer row ─────────────────────────────────────────────────────────

function PerformerRow({
  rank, username, display_name, avatar_url, score, verified_by_human, level_label,
}: {
  rank: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  verified_by_human: boolean;
  level_label: string;
}) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  function initials(name: string) {
    return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  return (
    <Link
      href={`/u/${username}`}
      className="flex items-center gap-3 py-2.5 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
    >
      <span className="w-6 text-center text-sm shrink-0">
        {medal ?? <span className="text-xs text-muted-foreground font-mono">#{rank}</span>}
      </span>

      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden text-primary font-bold text-xs">
        {avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(display_name)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{display_name}</p>
        <p className="text-[11px] text-muted-foreground">{level_label}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {verified_by_human && <ShieldCheck className="h-3 w-3 text-success" />}
        <span className="text-sm font-bold tabular-nums">{score.toFixed(0)}</span>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SkillPathDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let path: SkillPath, stats: SkillPathStats, rubric: SkillPathRubric | null;

  try {
    [path, stats] = await Promise.all([
      api.skillPaths.get(slug),
      api.skillPaths.stats(slug),
    ]);
  } catch {
    notFound();
  }

  // Fetch level-1 rubric (best-effort)
  try {
    rubric = await api.skillPaths.rubric(slug, 1);
  } catch {
    rubric = null;
  }

  return (
    <main className="px-6 py-10">

      {/* Breadcrumb */}
      <Link
        href="/skill-paths"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> All skill paths
      </Link>

      {/* Hero card */}
      <Card className="overflow-hidden p-0 mb-6">
        <div className={cn("h-2 w-full", domainStripe(path.domain))} />
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h1 className="text-2xl font-extrabold leading-tight">{path.name}</h1>
            <Badge className={cn("text-xs capitalize shrink-0 mt-1", domainBadge(path.domain))}>
              {path.domain}
            </Badge>
          </div>
          <p className="text-muted-foreground leading-relaxed mb-4">{path.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {path.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatPill
          icon={<Users className="h-4 w-4" />}
          label="earners"
          value={String(stats.earner_count)}
        />
        <StatPill
          icon={<Award className="h-4 w-4" />}
          label="credentials"
          value={String(stats.credential_count)}
        />
        <StatPill
          icon={<BarChart3 className="h-4 w-4" />}
          label="avg score"
          value={stats.avg_score != null ? stats.avg_score.toFixed(1) : "—"}
        />
        <StatPill
          icon={<Star className="h-4 w-4" />}
          label="top score"
          value={stats.top_score != null ? stats.top_score.toFixed(0) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

        {/* Left: levels + rubric */}
        <div className="space-y-6">

          {/* Levels */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" /> Levels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {path.levels.map((lv, i) => (
                <div key={lv.level} className={cn("flex items-center justify-between gap-3 py-2.5", i > 0 && "border-t")}>
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {lv.level}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{lv.label}</p>
                      {lv.typical_duration_weeks && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" /> ~{lv.typical_duration_weeks} weeks prep
                        </p>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/assess/${slug}?level=${lv.level}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "text-xs shrink-0 gap-1")}
                  >
                    Start <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
              <MyProgress slug={slug} levels={path.levels} />
            </CardContent>
          </Card>

          {/* Rubric dimensions */}
          {rubric && rubric.dimensions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" /> What gets assessed (Level 1)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Pass threshold: {rubric.pass_threshold}/100
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {rubric.dimensions.map((d) => (
                  <DimensionBar
                    key={d.id}
                    name={d.name}
                    description={d.description}
                    weight={d.weight}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: top performers + CTA */}
        <div className="space-y-5">

          {/* CTA */}
          <Card className="overflow-hidden p-0">
            <div className={cn("h-1.5 w-full", domainStripe(path.domain))} />
            <CardContent className="pt-5 pb-5 space-y-3">
              <p className="text-sm font-semibold">Ready to prove your skills?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Submit your work and receive AI-graded feedback with a transparent rubric. Earn a cryptographically signed credential.
              </p>
              <Link
                href={`/assess/${slug}`}
                className={cn(buttonVariants({ size: "sm" }), "w-full justify-center gap-1.5")}
              >
                <Zap className="h-3.5 w-3.5" />
                Start assessment
              </Link>
            </CardContent>
          </Card>

          {/* Top performers */}
          {stats.top_performers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Top performers</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 divide-y divide-border/60">
                {stats.top_performers.map((p, i) => (
                  <PerformerRow
                    key={p.username}
                    rank={i + 1}
                    {...p}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Path meta */}
          <div className="text-xs text-muted-foreground space-y-1 px-1">
            <p>Credential validity: {path.decay_half_life_months} months half-life</p>
            <p>Credentials are W3C VC 2.0 signed and publicly verifiable.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
