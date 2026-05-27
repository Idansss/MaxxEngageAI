"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type SkillPath } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight, CheckCircle, ChevronRight, Loader2,
  ShieldCheck, Target, User, Zap,
} from "lucide-react";

// ── Quiz config ──────────────────────────────────────────────────────────────

const QUIZ_DOMAINS = [
  { label: "Technology", value: "technology", hint: "Code, APIs, systems" },
  { label: "Design", value: "design",         hint: "UI/UX, visual" },
  { label: "Data",   value: "data",           hint: "Analysis, insights" },
  { label: "Writing", value: "writing",       hint: "Copy, content" },
  { label: "Business", value: "business",     hint: "Strategy, pitch" },
  { label: "Ops",   value: "ops",             hint: "Presentations, comms" },
] as const;

const QUIZ_GOALS = [
  { label: "Get a remote job",       value: "hired" },
  { label: "Freelancing / contracts", value: "freelance" },
  { label: "Career advancement",     value: "career" },
  { label: "Personal development",   value: "personal" },
] as const;

// ── Progress checklist ────────────────────────────────────────────────────────

interface ChecklistProps {
  hasSubmission: boolean;
  hasCredential: boolean;
  hasUsername: boolean;
  isPublic: boolean;
}

function ProgressChecklist({ hasSubmission, hasCredential, hasUsername, isPublic }: ChecklistProps) {
  const steps = [
    { label: "Joined Maxx Engage",      done: true },
    { label: "Submitted an assessment", done: hasSubmission },
    { label: "Earned a credential",     done: hasCredential },
    { label: "Set your @username",       done: hasUsername,  href: "/identity" },
    { label: "Made proof page public",  done: isPublic,     href: "/identity" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pctClass = (["w-0", "w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"] as const)[doneCount];

  return (
    <Card className="sticky top-20">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Your progress</p>
          <span className="text-xs text-muted-foreground">{doneCount}/{steps.length}</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full bg-muted rounded-full mb-4 overflow-hidden">
          <div className={cn("h-full bg-primary rounded-full transition-all duration-500", pctClass)} />
        </div>

        <ul className="space-y-2.5">
          {steps.map((step) => (
            <li key={step.label}>
              {step.href && !step.done ? (
                <Link
                  href={step.href}
                  className="flex items-center gap-2.5 text-sm group"
                >
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0 group-hover:border-primary transition-colors" />
                  <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {step.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto group-hover:text-primary transition-colors" />
                </Link>
              ) : (
                <div className="flex items-center gap-2.5 text-sm">
                  {step.done ? (
                    <CheckCircle className="w-5 h-5 text-success shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={step.done ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>

        {doneCount === steps.length && (
          <div className="mt-4 rounded-xl bg-success-bg border border-success/20 px-3 py-2.5 text-xs text-success font-medium flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            All done — you&apos;re fully set up!
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Quiz step ────────────────────────────────────────────────────────────────

function QuizStep({
  onComplete,
  onSkip,
}: {
  onComplete: (domain: string, goal: string) => void;
  onSkip: () => void;
}) {
  const [domain, setDomain] = useState("");
  const [goal, setGoal] = useState("");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Step 1 of 2</p>
        <h2 className="text-2xl font-extrabold">What&apos;s your primary skill area?</h2>
        <p className="text-sm text-muted-foreground mt-1">We&apos;ll recommend paths that match what you want to prove.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {QUIZ_DOMAINS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => setDomain(d.value)}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm",
              domain === d.value
                ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                : "hover:border-primary/30"
            )}
          >
            <p className="font-semibold text-sm">{d.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{d.hint}</p>
          </button>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3">What&apos;s your main goal?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUIZ_GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(g.value)}
              className={cn(
                "rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium transition-all hover:shadow-sm",
                goal === g.value
                  ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "hover:border-primary/30"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!domain || !goal}
          onClick={() => onComplete(domain, goal)}
          className={cn(
            buttonVariants(),
            "gap-2",
            (!domain || !goal) && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          See recommended paths <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip quiz
        </button>
      </div>
    </div>
  );
}

// ── Path selection step ───────────────────────────────────────────────────────

function PathCard({
  path,
  selected,
  recommended,
  onSelect,
}: {
  path: SkillPath;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border bg-card p-5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 duration-200 w-full",
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-md shadow-primary/10"
          : "hover:border-primary/30",
        !recommended && "opacity-60 hover:opacity-100"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug">{path.name}</h3>
          {recommended && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-wider mt-0.5">
              <Target className="h-2.5 w-2.5" /> Recommended
            </span>
          )}
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
      <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed mb-4">
        {path.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="capitalize text-xs">{path.domain}</Badge>
        <Badge variant="outline" className="text-xs">{path.levels.length} level{path.levels.length !== 1 ? "s" : ""}</Badge>
        {path.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
        ))}
      </div>
    </button>
  );
}

function PathStep({
  paths,
  recommendedDomain,
  selectedPath,
  onSelect,
  onBack,
}: {
  paths: SkillPath[];
  recommendedDomain: string;
  selectedPath: string;
  onSelect: (slug: string) => void;
  onBack: () => void;
}) {
  const sortedPaths = useMemo(() => {
    if (!recommendedDomain) return paths;
    const rec = paths.filter((p) => p.domain === recommendedDomain);
    const rest = paths.filter((p) => p.domain !== recommendedDomain);
    return [...rec, ...rest];
  }, [paths, recommendedDomain]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Step 2 of 2</p>
        <h2 className="text-2xl font-extrabold">Choose your first skill path</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {recommendedDomain
            ? `Showing ${recommendedDomain} paths first — they match your answers.`
            : "Pick one to start. You can try others later."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedPaths.map((path) => (
          <PathCard
            key={path.id}
            path={path}
            selected={selectedPath === path.slug}
            recommended={path.domain === recommendedDomain}
            onSelect={() => onSelect(path.slug)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

// ── Done state ────────────────────────────────────────────────────────────────

function DoneState({ username }: { username: string | null }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-success-bg border border-success/20 p-8 text-center space-y-3">
        <CheckCircle className="h-12 w-12 text-success mx-auto" />
        <h2 className="text-2xl font-extrabold">You&apos;re fully set up</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          You have verified credentials and a public proof page.
          Keep building your record.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/assess"
          className={cn(buttonVariants({ variant: "default" }), "gap-2 justify-center")}
        >
          <Zap className="h-4 w-4" /> Take next assessment
        </Link>
        {username && (
          <Link
            href={`/u/${username}`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2 justify-center")}
          >
            <User className="h-4 w-4" /> My proof page
          </Link>
        )}
        <Link
          href="/verify"
          className={cn(buttonVariants({ variant: "outline" }), "gap-2 justify-center")}
        >
          <ShieldCheck className="h-4 w-4" /> Verify
        </Link>
      </div>
    </div>
  );
}

// ── CTA card ──────────────────────────────────────────────────────────────────

function AssessCTA({ pathSlug, hasSubmission }: { pathSlug: string; hasSubmission: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-primary" />
      <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-base">
            {hasSubmission ? "Ready to continue?" : "Ready to start?"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
            {hasSubmission
              ? "You've already submitted. Keep going — more submissions improve your record."
              : "The first assessment takes 15–45 minutes. Your submission creates a permanent record."}
          </p>
        </div>
        <Link
          href={`/assess/${pathSlug}`}
          className={cn(buttonVariants(), "gap-2 shrink-0 h-10 px-6 font-semibold")}
        >
          <ShieldCheck className="h-4 w-4" />
          {hasSubmission ? "Continue" : "Begin assessment"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type WizardStep = "quiz" | "paths";

export default function OnboardingPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();

  const [wizardStep, setWizardStep] = useState<WizardStep>("quiz");
  const [quizDomain, setQuizDomain] = useState("");
  const [selectedPath, setSelectedPath] = useState("");

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

  const { data: credentialStatus } = useQuery({
    queryKey: ["credential-decay-status"],
    queryFn: () => api.credentials.myDecayStatus(),
    enabled: !!session,
  });

  const hasSubmission = (submissions?.total ?? 0) > 0;
  const hasCredential = (credentialStatus?.credentials?.length ?? 0) > 0;
  const hasUsername = !!profile?.username;
  const isPublic = profile?.proof_page_visibility === "public";
  const allDone = hasSubmission && hasCredential && hasUsername && isPublic;

  // Default selected path: first recommended domain, or first path overall
  const effectiveSelectedPath = selectedPath || skillPaths.find((p) => p.domain === quizDomain)?.slug || skillPaths[0]?.slug || "";

  if (loading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">

      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Getting started</p>
          <h1 className="text-3xl font-extrabold">
            {allDone ? "You're set up" : `Welcome, ${profile?.display_name?.split(" ")[0] ?? "Learner"}`}
          </h1>
          {!allDone && (
            <p className="mt-1 text-sm text-muted-foreground max-w-lg leading-relaxed">
              Prove your skills with real work graded against a transparent rubric — not a resume claim.
            </p>
          )}
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          Go to dashboard
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">

        {/* Main content */}
        <div>
          {allDone ? (
            <DoneState username={profile?.username ?? null} />
          ) : pathsLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : wizardStep === "quiz" ? (
            <QuizStep
              onComplete={(domain) => {
                setQuizDomain(domain);
                setWizardStep("paths");
              }}
              onSkip={() => setWizardStep("paths")}
            />
          ) : (
            <>
              <PathStep
                paths={skillPaths}
                recommendedDomain={quizDomain}
                selectedPath={effectiveSelectedPath}
                onSelect={setSelectedPath}
                onBack={() => setWizardStep("quiz")}
              />

              {effectiveSelectedPath && (
                <div className="mt-6">
                  <AssessCTA pathSlug={effectiveSelectedPath} hasSubmission={hasSubmission} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Progress sidebar */}
        <div className="hidden lg:block">
          <ProgressChecklist
            hasSubmission={hasSubmission}
            hasCredential={hasCredential}
            hasUsername={hasUsername}
            isPublic={isPublic}
          />
        </div>
      </div>

      {/* Mobile progress checklist */}
      <div className="lg:hidden mt-8">
        <ProgressChecklist
          hasSubmission={hasSubmission}
          hasCredential={hasCredential}
          hasUsername={hasUsername}
          isPublic={isPublic}
        />
      </div>
    </main>
  );
}
