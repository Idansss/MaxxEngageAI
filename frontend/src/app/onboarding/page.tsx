"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight, BookOpen, CheckCircle, Loader2, ShieldCheck, Target,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/onboarding");
  }, [loading, session, router]);

  const { data: skillPaths = [], isLoading: pathsLoading } = useQuery({
    queryKey: ["skill-paths"],
    queryFn: () => api.skillPaths.list(),
    enabled: !!session,
  });

  const { data: submissions } = useQuery({
    queryKey: ["my-submissions", "onboarding"],
    queryFn: () => api.submissions.my(1, 0),
    enabled: !!session,
  });

  const defaultPath = useMemo(() => {
    if (selectedPath) return selectedPath;
    return skillPaths[0]?.slug ?? "web-dev-frontend";
  }, [selectedPath, skillPaths]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasStarted = (submissions?.total ?? 0) > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">

      <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">Getting started</p>
          <h1 className="text-3xl font-extrabold">Choose your first proof path</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
            Welcome, <span className="font-semibold text-foreground">{profile?.display_name ?? "Learner"}</span>.
            Pick one skill path, start the first assessment, and Maxx Engage will build your competence record from actual work.
          </p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          Go to dashboard
        </Link>
      </div>

      {/* Step indicators */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <StepCard
          number={1}
          icon={<Target className="h-4 w-4" />}
          title="Pick a path"
          text="Start narrow so your first credential can ship quickly."
          done={!!defaultPath}
        />
        <StepCard
          number={2}
          icon={<BookOpen className="h-4 w-4" />}
          title="Submit real work"
          text="Your work is graded against a public rubric, not a resume claim."
          done={hasStarted}
        />
        <StepCard
          number={3}
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Earn proof"
          text="Passing work becomes a credential you control and can share."
          done={false}
        />
      </div>

      {/* Path selector */}
      {pathsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skillPaths.map((path) => {
            const selected = defaultPath === path.slug;
            return (
              <button
                key={path.id}
                type="button"
                onClick={() => setSelectedPath(path.slug)}
                className={cn(
                  "rounded-2xl border bg-card p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 duration-200",
                  selected
                    ? "border-primary ring-2 ring-primary/20 shadow-md shadow-primary/10"
                    : "hover:border-primary/30"
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold leading-snug">{path.name}</h2>
                  {selected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <CheckCircle className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground leading-relaxed mb-4">
                  {path.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="capitalize text-xs">{path.domain}</Badge>
                  <Badge variant="outline" className="text-xs">{path.levels.length} levels</Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <Card className="mt-8 overflow-hidden">
        <div className="h-1 w-full bg-primary" />
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-base">Ready to start?</p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              The first assessment takes about 15–30 minutes and creates your first submission record.
            </p>
          </div>
          <Link href={`/assess?path=${defaultPath}`} className={cn(buttonVariants(), "gap-2 shrink-0 h-10 px-6 font-semibold")}>
            Start assessment <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

function StepCard({
  number, icon, title, text, done,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden transition-all", done && "ring-1 ring-(--success)/30")}>
      {done && <div className="h-0.5 w-full bg-success" />}
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black",
            done ? "bg-success-bg text-success" : "bg-primary/10 text-primary"
          )}>
            {done ? <CheckCircle className="h-4 w-4" /> : number}
          </div>
          <span className="flex items-center gap-1.5">
            <span className={done ? "text-success" : "text-primary"}>{icon}</span>
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
      </CardContent>
    </Card>
  );
}
