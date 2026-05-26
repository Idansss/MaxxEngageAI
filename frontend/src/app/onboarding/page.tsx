"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Loader2,
  ShieldCheck,
  Target,
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasStarted = (submissions?.total ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Setup</Badge>
            <h1 className="text-2xl font-bold">Choose your first proof path</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Welcome, {profile?.display_name ?? "Learner"}. Pick one skill path, start the first assessment, and Maxx Engage will build your competence record from actual work.
            </p>
          </div>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
            Go to dashboard
          </Link>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <StepCard
            icon={<Target className="h-4 w-4 text-blue-600" />}
            title="Pick a path"
            text="Start narrow so your first credential can ship quickly."
            done={!!defaultPath}
          />
          <StepCard
            icon={<BookOpen className="h-4 w-4 text-blue-600" />}
            title="Submit real work"
            text="Your work is graded against a public rubric, not a resume claim."
            done={hasStarted}
          />
          <StepCard
            icon={<ShieldCheck className="h-4 w-4 text-blue-600" />}
            title="Earn proof"
            text="Passing work becomes a credential you control and can share."
            done={false}
          />
        </div>

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
                    "rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-sm",
                    selected && "border-blue-500 ring-2 ring-blue-100"
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug">{path.name}</h2>
                    {selected && <CheckCircle className="h-4 w-4 shrink-0 text-blue-600" />}
                  </div>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{path.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="capitalize">{path.domain}</Badge>
                    <Badge variant="outline">{path.levels.length} levels</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Card className="mt-8">
          <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Ready to start?</p>
              <p className="text-sm text-muted-foreground">
                The first assessment takes about 15-30 minutes and creates your first submission record.
              </p>
            </div>
            <Link href={`/assess?path=${defaultPath}`} className={cn(buttonVariants(), "gap-1.5 shrink-0")}>
              Start assessment <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StepCard({
  icon,
  title,
  text,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  done: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          {done && <CheckCircle className="ml-auto h-4 w-4 text-green-600" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
