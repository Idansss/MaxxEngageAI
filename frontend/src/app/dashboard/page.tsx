"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";
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
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
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
      <div className="flex items-center justify-center min-h-screen">
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Welcome back, {profile?.display_name ?? "Learner"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here&apos;s your Maxx Engage overview.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Award className="h-5 w-5 text-blue-600" />}
            label="Credentials"
            value={credsLoading ? "…" : String(credentials.length)}
            sub="earned"
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            label="Submissions"
            value={subsLoading ? "…" : String(submissions?.total ?? 0)}
            sub="total"
          />
          <StatCard
            icon={<Zap className="h-5 w-5 text-amber-500" />}
            label="Overall score"
            value={profile?.overall_score ? profile.overall_score.toFixed(0) : "—"}
            sub="average"
          />
          <StatCard
            icon={<ShieldCheck className="h-5 w-5 text-purple-600" />}
            label="Humanity"
            value={`${humanityScore.toFixed(0)}/100`}
            sub={humanityFull ? "verified" : "incomplete"}
          />
        </div>

        <Card className="mb-8">
          <CardContent className="py-5">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="h-4 w-4 text-blue-600" />
                  Current path
                </div>
                <h2 className="mt-2 text-lg font-semibold">{activePathName}</h2>
                <div className="mt-3 max-w-xl">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress signal</span>
                    <span>{progressValue.toFixed(0)}%</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on recent submissions, best score, and issued credentials.
                </p>
              </div>
              <div className="rounded-lg border bg-white p-4 md:min-w-56">
                <p className="text-xs uppercase text-muted-foreground">Pending task</p>
                <p className="mt-1 font-medium">{pendingTaskLabel}</p>
                <Link href={`/assess?path=${activeSlug}`} className={cn(buttonVariants({ size: "sm" }), "mt-3 w-full justify-center gap-1.5")}>
                  Continue <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left column: credentials + quick actions */}
          <div className="lg:col-span-2 space-y-6">

            {/* Recent credentials */}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-600" />
                  Recent credentials
                </CardTitle>
                {profile?.id && (
                  <Link href={`/profile/${profile.id}`} className="text-xs text-blue-600 hover:underline">
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
                    <Award className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No credentials yet.</p>
                    <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "mt-3")}>
                      Take your first assessment
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recentCredentials.map((c) => (
                      <li key={c.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.skill_path_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Level {c.level} &middot; {c.level_label}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={cn("text-lg font-bold", scoreColor(c.score))}>
                            {c.score.toFixed(0)}
                          </span>
                          <Link
                            href={`/credentials/${c.id}`}
                            className="text-blue-600 hover:text-blue-700"
                            title="View credential"
                          >
                            <ArrowRight className="h-4 w-4" />
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
                <Link href="/submissions" className="text-xs text-blue-600 hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {subsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : recentSubmissions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No submissions yet.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {recentSubmissions.map((s) => (
                      <li key={s.id} className="py-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {s.skill_path_name} — Level {s.level}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.submitted_at).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {s.score !== null && (
                            <span className={cn("text-sm font-semibold", scoreColor(s.score))}>
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

          {/* Right column: quick actions + identity */}
          <div className="space-y-6">

            {/* Identity card */}
            <Card className={humanityFull ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/20"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className={cn("h-4 w-4", humanityFull ? "text-green-600" : "text-amber-500")} />
                  Identity score
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Humanity score</span>
                    <span className="font-semibold text-foreground">{humanityScore.toFixed(0)}/100</span>
                  </div>
                  <Progress value={humanityScore} className="h-2" />
                </div>
                {humanityFull ? (
                  <p className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Full credential weight achieved
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Score 50+ for full credential weight
                  </p>
                )}
                <Link href="/identity" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-center text-xs")}>
                  Collect stamps <ArrowRight className="ml-1 h-3 w-3" />
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

            {/* DID info */}
            {profile?.did && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Your DID</CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="text-xs text-muted-foreground break-all leading-relaxed block">
                    {profile.did}
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    This is your W3C Decentralized Identifier — it lives on your credentials forever.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon, label, value, sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground capitalize">{sub}</p>
      </CardContent>
    </Card>
  );
}
