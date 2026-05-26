"use client";

import { useEffect } from "react";
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
  Award, ShieldCheck, Clock, ArrowRight, Loader2,
  BookOpen, Zap, CheckCircle, AlertCircle, User, Target,
} from "lucide-react";

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    ai_reviewed:           { label: "Reviewed",       className: "bg-blue-100 text-blue-700" },
    pending_ai_review:     { label: "In review",      className: "bg-yellow-100 text-yellow-700" },
    pending_human_review:  { label: "Human review",   className: "bg-amber-100 text-amber-700" },
    human_reviewed:        { label: "Human reviewed", className: "bg-green-100 text-green-700" },
    appealed:              { label: "Appealed",        className: "bg-purple-100 text-purple-700" },
    final:                 { label: "Final",           className: "bg-gray-100 text-gray-700" },
  };
  const v = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <Badge className={cn("text-xs capitalize", v.className)}>{v.label}</Badge>;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "score-pass";
  if (score >= 50) return "score-mid";
  return "score-fail";
}

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
    queryFn: () => api.submissions.my(5, 0),
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

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const recentCredentials = credentials.slice(0, 3);
  const recentSubmissions = submissions?.items ?? [];
  const humanityScore = humanityData?.humanity_score ?? 0;
  const humanityFull = humanityData?.full_weight_achieved ?? false;
  const activeSlug = recentSubmissions[0]?.skill_path_slug ?? skillPaths[0]?.slug ?? "web-dev-frontend";
  const activePathName = recentSubmissions[0]?.skill_path_name ?? skillPaths[0]?.name ?? "Frontend Web Development";
  const pathSubmissions = recentSubmissions.filter((s) => s.skill_path_slug === activeSlug);
  const bestScore = pathSubmissions.reduce<number | null>(
    (best, s) => (s.score === null ? best : Math.max(best ?? 0, s.score)),
    null
  );
  const progressValue = Math.min(100, Math.max(credentials.length * 25, pathSubmissions.length * 20, bestScore ?? 0));
  const pendingTaskLabel = recentSubmissions.length === 0 ? "First diagnostic" : "Next assessment";

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">

      {/* Welcome */}
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Dashboard</p>
        <h1 className="text-3xl font-extrabold">
          Welcome back, {profile?.display_name ?? "Learner"} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          Here&apos;s your Maxx Engage overview.
        </p>
      </div>

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
          icon={<ShieldCheck className="h-4 w-4 text-violet-500" />}
          label="Humanity"
          value={`${humanityScore.toFixed(0)}/100`}
          sub={humanityFull ? "verified" : "incomplete"}
        />
      </div>

      {/* Current path */}
      <Card className="mb-8 overflow-hidden">
        <div className="h-1 w-full stripe-technology" />
        <CardContent className="py-5">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
                <Target className="h-4 w-4" />
                Current path
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
                Based on recent submissions, best score, and issued credentials.
              </p>
            </div>
            <div className="rounded-xl border bg-secondary/30 p-4 md:min-w-52">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending task</p>
              <p className="mt-1 font-bold text-base">{pendingTaskLabel}</p>
              <Link
                href={`/assess?path=${activeSlug}`}
                className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full justify-center gap-1.5")}
              >
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Left: credentials + submissions */}
        <div className="lg:col-span-2 space-y-6">

          {/* Recent credentials */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                Recent credentials
              </CardTitle>
              {profile?.id && (
                <Link href={`/profile/${profile.id}`} className="text-xs text-primary hover:underline underline-offset-2">
                  View all
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {credsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentCredentials.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Award className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">No credentials yet.</p>
                  <Link href="/assess" className={cn(buttonVariants({ size: "sm" }))}>
                    Take your first assessment
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recentCredentials.map((c) => (
                    <li key={c.id} className="py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{c.skill_path_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Level {c.level} &middot; {c.level_label}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={cn("text-xl font-black", scoreColor(c.score))}>
                          {c.score.toFixed(0)}
                        </span>
                        <Link
                          href={`/credentials/${c.id}`}
                          className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                          title="View credential"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent submissions */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent submissions
              </CardTitle>
              <Link href="/submissions" className="text-xs text-primary hover:underline underline-offset-2">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              {subsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentSubmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No submissions yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recentSubmissions.map((s) => (
                    <li key={s.id} className="py-3.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {s.skill_path_name}
                          <span className="font-normal text-muted-foreground"> — Level {s.level}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(s.submitted_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.score !== null && (
                          <span className={cn("text-sm font-bold", scoreColor(s.score))}>
                            {s.score.toFixed(0)}
                          </span>
                        )}
                        {statusBadge(s.status)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: identity + quick actions */}
        <div className="space-y-6">

          {/* Identity */}
          <Card className={cn("overflow-hidden", humanityFull ? "ring-1 ring-(--success)/30" : "ring-1 ring-amber-400/30")}>
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
                  <CheckCircle className="h-3.5 w-3.5" />
                  Full credential weight achieved
                </p>
              ) : (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Score 50+ for full credential weight
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

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "w-full justify-start gap-2")}>
                <Zap className="h-3.5 w-3.5" /> Start assessment
              </Link>
              {profile?.id && (
                <Link href={`/profile/${profile.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
                  <User className="h-3.5 w-3.5" /> My public profile
                </Link>
              )}
              <Link href="/submissions" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
                <Clock className="h-3.5 w-3.5" /> Submission history
              </Link>
              <Link href="/" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-start gap-2")}>
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

function StatCard({
  accent, icon, label, value, sub,
}: {
  accent: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className={cn("overflow-hidden", accent)}>
      <CardContent className="pt-5 pb-4 pl-5">
        <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground font-medium">{label}</span></div>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-xs text-muted-foreground capitalize mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
