"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, ArrowRight, Award, BookOpen, CheckCircle, Clock,
  Loader2, RefreshCw, ShieldCheck, Target, User, Zap,
  AlertCircle, ExternalLink, Flame, X,
} from "lucide-react";

// â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function domainStripe(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology", design: "stripe-design",
    data:       "stripe-data",       writing: "stripe-writing",
    business:   "stripe-business",   ops:    "stripe-ops",
    science:    "stripe-science",
  };
  return map[domain] ?? "bg-primary/40";
}

function domainColor(domain: string) {
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

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-gold";
  return "text-destructive";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ai_reviewed:           { label: "Reviewed",      cls: "bg-blue-100 text-blue-700" },
    pending_ai_review:     { label: "In review",     cls: "bg-yellow-100 text-yellow-700" },
    pending_human_review:  { label: "Human review",  cls: "bg-amber-100 text-amber-700" },
    human_reviewed:        { label: "Human reviewed", cls: "bg-green-100 text-green-700" },
    appealed:              { label: "Appealed",       cls: "bg-purple-100 text-purple-700" },
    final:                 { label: "Final",          cls: "bg-gray-100 text-gray-700" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={cn("text-[10px] px-1.5 py-0", v.cls)}>{v.label}</Badge>;
}

// â"€â"€ Sub-components â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function StatCard({ accent, icon, label, value, sub }: {
  accent: string; icon: React.ReactNode; label: string; value: string; sub: string;
}) {
  return (
    <Card className={cn("overflow-hidden", accent)}>
      <CardContent className="pt-5 pb-4 pl-5">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-xs text-muted-foreground capitalize mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

// â"€â"€ Activity feed â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type FeedItem =
  | { kind: "credential"; id: string; name: string; levelLabel: string; score: number; domain: string; date: string }
  | { kind: "submission"; id: string; name: string; level: number; score: number | null; status: string; domain: string; date: string };

function FeedRow({ item }: { item: FeedItem }) {
  if (item.kind === "credential") {
    return (
      <div className="flex items-center gap-3 py-3">
        <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
          <Award className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{item.name}</p>
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 shrink-0", domainColor(item.domain))}>
              {item.domain}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Credential earned · {fmtDate(item.date)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-lg font-black tabular-nums", scoreColor(item.score))}>{item.score.toFixed(0)}</p>
          <Link href={`/credentials/${item.id}`} className="text-[10px] text-primary hover:underline">view</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Zap className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <span className="text-xs text-muted-foreground shrink-0">Lv {item.level}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Submission · {fmtDate(item.date)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.score !== null && (
          <p className={cn("text-sm font-bold tabular-nums", scoreColor(item.score))}>{item.score.toFixed(0)}</p>
        )}
        {statusBadge(item.status)}
      </div>
    </div>
  );
}

// â"€â"€ Onboarding banner â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const BANNER_KEY = "onboarding_banner_dismissed";

interface BannerStep { label: string; done: boolean }

function OnboardingBanner({ steps }: { steps: BannerStep[] }) {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(BANNER_KEY) === "1"
  );

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed || allDone) return null;

  const nextStep = steps.find((s) => !s.done);
  const barClass = (["w-0", "w-1/4", "w-2/4", "w-3/4", "w-full"] as const)[
    Math.min(doneCount, 4)
  ];

  function dismiss() {
    localStorage.setItem(BANNER_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold mb-1.5">
            Complete your setup &mdash; {doneCount}/{steps.length} done
          </p>
          <div className="h-1.5 w-full max-w-xs bg-primary/20 rounded-full overflow-hidden mb-2">
            <div
              className={cn("h-full bg-primary rounded-full transition-all duration-500", barClass)}
            />
          </div>
          {nextStep && (
            <p className="text-xs text-muted-foreground">Next: {nextStep.label}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5 text-xs h-8")}
          >
            Continue setup <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss setup banner"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function DashboardPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ["user-credentials", profile?.id],
    queryFn: () => api.users.credentials(profile!.id),
    enabled: !!profile?.id,
  });

  const { data: submissions, isLoading: subsLoading } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: () => api.submissions.my(10, 0),
    enabled: !!session,
  });

  const { data: skillPaths = [] } = useQuery({
    queryKey: ["skill-paths"],
    queryFn: () => api.skillPaths.list(),
    enabled: !!session,
  });

  const { data: humanityData } = useQuery({
    queryKey: ["my-humanity-score"],
    queryFn: () => api.identity.myScore(),
    enabled: !!session,
  });

  const { data: decayStatus } = useQuery({
    queryKey: ["my-credential-decay"],
    queryFn: () => api.credentials.myDecayStatus(),
    enabled: !!session,
  });

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // â"€â"€ Derived data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const humanityScore   = humanityData?.humanity_score ?? 0;
  const humanityFull    = humanityData?.full_weight_achieved ?? false;
  const submItems       = submissions?.items ?? [];
  const overdueCredentials = decayStatus?.credentials.filter((c) => c.overdue_for_refresh) ?? [];

  // Suggested paths: paths with no submissions yet
  const triedSlugs = new Set(submItems.map((s) => s.skill_path_slug));
  const suggestedPaths = skillPaths.filter((sp) => !triedSlugs.has(sp.slug)).slice(0, 3);

  // Current path (most recent activity)
  const activeSlug    = submItems[0]?.skill_path_slug ?? skillPaths[0]?.slug ?? "";
  const activePathName = submItems[0]?.skill_path_name ?? skillPaths[0]?.name ?? "—";
  const activeDomain  = submItems[0]?.domain ?? skillPaths[0]?.domain ?? "technology";
  const pathSubmissions = submItems.filter((s) => s.skill_path_slug === activeSlug);
  const bestScore     = pathSubmissions.reduce<number | null>(
    (best, s) => (s.score === null ? best : Math.max(best ?? 0, s.score)), null
  );
  const progressValue = Math.min(100, Math.max(credentials.length * 25, pathSubmissions.length * 20, bestScore ?? 0));

  // Unified activity feed (newest first)
  const feedItems: FeedItem[] = [
    ...credentials.slice(0, 5).map((c): FeedItem => ({
      kind: "credential", id: c.id, name: c.skill_path_name,
      levelLabel: c.level_label, score: c.score, domain: c.domain, date: c.created_at,
    })),
    ...submItems.slice(0, 8).map((s): FeedItem => ({
      kind: "submission", id: s.id, name: s.skill_path_name, level: s.level,
      score: s.score, status: s.status, domain: s.domain, date: s.submitted_at,
    })),
  ].sort((a, b) => {
    const dA = new Date(a.date).getTime();
    const dB = new Date(b.date).getTime();
    return dB - dA;
  }).slice(0, 10);

  // Streak: count distinct calendar days with a submission in the last 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const dayStr = day.toISOString().slice(0, 10);
    if (submItems.some((s) => s.submitted_at.slice(0, 10) === dayStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return (
    <main className="px-6 py-10">

      {/* Welcome */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Dashboard</p>
        <h1 className="text-3xl font-extrabold">
          Welcome back, {profile?.display_name ?? "Learner"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          Here&apos;s your Maxx Engage overview.
        </p>
      </div>

      {/* Decay alert */}
      {overdueCredentials.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-50/50 px-4 py-3.5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {overdueCredentials.length} credential{overdueCredentials.length > 1 ? "s" : ""} need{overdueCredentials.length === 1 ? "s" : ""} refreshing
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {overdueCredentials.map((c) => (
                <Link
                  key={c.id}
                  href={`/assess/${c.skill_path_slug}`}
                  className="text-xs text-amber-700 hover:underline underline-offset-2 inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> {c.skill_path_name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Onboarding checklist banner */}
      <OnboardingBanner steps={[
        { label: "Submit your first assessment", done: (submissions?.total ?? 0) > 0 },
        { label: "Earn a credential",            done: credentials.length > 0 },
        { label: "Set your @username",           done: !!profile?.username },
        { label: "Make your proof page public",  done: profile?.proof_page_visibility === "public" },
      ]} />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard
          accent="stat-accent-indigo"
          icon={<Award className="h-4 w-4 text-primary" />}
          label="Credentials"
          value={credsLoading ? "…" : String(credentials.length)}
          sub="earned"
        />
        <StatCard
          accent="stat-accent-green"
          icon={<CheckCircle className="h-4 w-4 text-success" />}
          label="Submissions"
          value={subsLoading ? "…" : String(submissions?.total ?? 0)}
          sub="total"
        />
        <StatCard
          accent="stat-accent-amber"
          icon={<Zap className="h-4 w-4 text-gold" />}
          label="Overall score"
          value={profile?.overall_score ? profile.overall_score.toFixed(0) : "—"}
          sub="average"
        />
        <StatCard
          accent="stat-accent-violet"
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          label="Active days"
          value={streak > 0 ? `${streak}` : "—"}
          sub={streak === 1 ? "day this week" : streak > 1 ? "days this week" : "no streak yet"}
        />
      </div>

      {/* Current path */}
      {activeSlug && (
        <Card className="mb-8 overflow-hidden">
          <div className={cn("h-1 w-full", domainStripe(activeDomain))} />
          <CardContent className="py-5">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
                  <Target className="h-4 w-4" /> Current path
                </div>
                <h2 className="text-xl font-bold">{activePathName}</h2>
                <div className="mt-3 max-w-xl">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress signal</span>
                    <span className="font-semibold text-foreground">{progressValue.toFixed(0)}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on submissions, best score, and issued credentials.
                </p>
              </div>
              <div className="rounded-xl border bg-secondary/30 p-4 md:min-w-52">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next step</p>
                <p className="mt-1 font-bold text-base">
                  {submItems.length === 0 ? "First diagnostic" : bestScore && bestScore >= 70 ? "Level up" : "Improve score"}
                </p>
                <Link
                  href={`/assess/${activeSlug}`}
                  className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full justify-center gap-1.5")}
                >
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left: activity feed */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent activity
              </CardTitle>
              <Link href="/submissions" className="text-xs text-primary hover:underline underline-offset-2">
                All submissions
              </Link>
            </CardHeader>
            <CardContent className="py-0">
              {(credsLoading || subsLoading) ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : feedItems.length === 0 ? (
                <div className="text-center py-10">
                  <Zap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No activity yet.</p>
                  <Link href="/assess" className={cn(buttonVariants({ size: "sm" }))}>
                    Take your first assessment
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {feedItems.map((item, i) => (
                    <FeedRow key={`${item.kind}-${item.id}-${i}`} item={item} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-6">

          {/* Identity score */}
          <Card className={cn("overflow-hidden", humanityFull ? "ring-1 ring-success/30" : "ring-1 ring-amber-400/30")}>
            <div className={cn("h-1 w-full", humanityFull ? "bg-success" : "bg-gold")} />
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className={cn("h-4 w-4", humanityFull ? "text-success" : "text-gold")} />
                Identity score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Humanity score</span>
                  <span className="font-bold text-foreground">{humanityScore.toFixed(0)}/100</span>
                </div>
                <Progress value={humanityScore} className="h-2" />
              </div>
              {humanityFull ? (
                <p className="text-xs text-success flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" /> Full credential weight achieved
                </p>
              ) : (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Score 50+ for full credential weight
                </p>
              )}
              <Link
                href="/identity"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-center text-xs gap-1.5")}
              >
                Collect stamps <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Suggested next paths */}
          {suggestedPaths.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  Explore next
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 divide-y divide-border/60">
                {suggestedPaths.map((sp) => (
                  <div key={sp.id} className="py-3 flex items-center gap-3">
                    <div className={cn("w-1 self-stretch rounded-full shrink-0", domainStripe(sp.domain))} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sp.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{sp.domain}</p>
                    </div>
                    <Link
                      href={`/assess/${sp.slug}`}
                      className="shrink-0 text-xs text-primary hover:underline underline-offset-2 inline-flex items-center gap-0.5"
                    >
                      Start <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "w-full justify-start gap-2")}>
                <Zap className="h-3.5 w-3.5" /> Start assessment
              </Link>
              {profile?.username ? (
                <Link href={`/u/${profile.username}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
                  <ExternalLink className="h-3.5 w-3.5" /> My proof page
                </Link>
              ) : (
                <Link href="/identity" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
                  <User className="h-3.5 w-3.5" /> Set up proof page
                </Link>
              )}
              {profile?.id && (
                <Link href={`/profile/${profile.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
                  <Award className="h-3.5 w-3.5" /> My credentials
                </Link>
              )}
              <Link href="/skill-paths" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
                <BookOpen className="h-3.5 w-3.5" /> Browse skill paths
              </Link>
            </CardContent>
          </Card>

          {/* DID */}
          {profile?.did && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your DID</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs text-muted-foreground break-all leading-relaxed block bg-muted rounded-lg px-3 py-2">
                  {profile.did}
                </code>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Your W3C Decentralized Identifier — lives on your credentials forever.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
