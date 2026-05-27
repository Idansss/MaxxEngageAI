"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, type AssessRequest, type SkillPath } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, ArrowLeft, AlertCircle, Sparkles, ArrowRight, Clock,
  CheckCircle2, Trophy,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { assessmentSlugs } from "@/lib/assessments";

// ── Rubric config ───────────────────────────────────────────────────────────

const SUBMISSION_TYPE_FOR_RUBRIC: Record<string, AssessRequest["submission_type"]> = {
  "web-dev-html-001":    "html_css_js",
  "backend-api-001":     "code",
  "copy-en-001":         "text",
  "translate-yo-en-001": "text",
};

const PASS_THRESHOLD_FOR_RUBRIC: Record<string, number> = {
  "translate-yo-en-001": 75,
};

function getPassThreshold(rubricId: string): number {
  return PASS_THRESHOLD_FOR_RUBRIC[rubricId] ?? 70;
}

const RUBRIC_DIMENSIONS: Record<string, { label: string; pts: number }[]> = {
  "web-dev-html-001": [
    { label: "Semantic HTML",   pts: 20 },
    { label: "CSS Quality",     pts: 20 },
    { label: "Responsiveness",  pts: 25 },
    { label: "Accessibility",   pts: 15 },
    { label: "Correctness",     pts: 20 },
  ],
  "backend-api-001": [
    { label: "API Correctness",            pts: 30 },
    { label: "Validation & Error Handling",pts: 20 },
    { label: "Status Code Accuracy",       pts: 15 },
    { label: "Code Quality",               pts: 20 },
    { label: "Documentation",              pts: 15 },
  ],
  "copy-en-001": [
    { label: "Clarity",         pts: 20 },
    { label: "Specificity",     pts: 25 },
    { label: "Audience Fit",    pts: 20 },
    { label: "Structure",       pts: 15 },
    { label: "Persuasiveness",  pts: 20 },
  ],
  "translate-yo-en-001": [
    { label: "Accuracy of Meaning", pts: 30 },
    { label: "Register & Tone",     pts: 25 },
    { label: "Natural Yoruba",      pts: 25 },
    { label: "Translator's Note",   pts: 20 },
  ],
};

// ── Assessment index ────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  technology: "Technology",
  writing:    "Writing",
  design:     "Design",
  data:       "Data",
  business:   "Business",
  ops:        "Operations",
  science:    "Science",
};

const ESTIMATED_MINUTES: Record<string, string> = {
  technology: "60–90 min",
  writing:    "45 min",
  data:       "60 min",
  design:     "60 min",
  business:   "45 min",
  ops:        "45 min",
  science:    "60 min",
};

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
  return map[domain] ?? "bg-muted-foreground/30";
}

interface PriorBest {
  score: number;
  passed: boolean;
  reviewId: string | null;
}

function AssessIndex() {
  const { session, loading: authLoading } = useAuth();
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { data: skillPaths = [], isLoading } = useQuery({
    queryKey: ["skill-paths"],
    queryFn: () => api.skillPaths.list(),
  });

  const { data: submissionHistory } = useQuery({
    queryKey: ["my-submissions-brief"],
    queryFn: () => api.submissions.my(100),
    enabled: !!session,
  });

  const priorBestMap = (() => {
    const map: Record<string, PriorBest> = {};
    if (!submissionHistory) return map;
    for (const item of submissionHistory.items) {
      if (item.score === null) continue;
      const existing = map[item.skill_path_slug];
      if (!existing || item.score > existing.score) {
        map[item.skill_path_slug] = {
          score: item.score,
          passed: item.credential_eligible === true,
          reviewId: item.review_id,
        };
      }
    }
    return map;
  })();

  const phase1SkillPaths = skillPaths.filter((path) => assessmentSlugs.has(path.slug));
  const domains = ["all", ...Array.from(new Set(phase1SkillPaths.map((p) => p.domain))).sort()];

  const filtered = activeFilter === "all"
    ? phase1SkillPaths
    : phase1SkillPaths.filter((p) => p.domain === activeFilter);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">
          Skill assessments
        </p>
        <h1 className="text-3xl font-extrabold">Prove what you can do.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Pick a skill, complete the diagnostic, and earn a verifiable credential you own.
          Graded by AI against a transparent rubric — no prerequisites required to start.
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter by category">
        {domains.map((domain) => (
          <button
            key={domain}
            type="button"
            onClick={() => setActiveFilter(domain)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              activeFilter === domain
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
            )}
          >
            {domain === "all" ? "All" : (DOMAIN_LABELS[domain] ?? domain)}
          </button>
        ))}
      </div>

      {/* Assessment grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {filtered.map((path) => (
          <AssessmentCard
            key={path.id}
            path={path}
            requiresAuth={!session}
            priorBest={priorBestMap[path.slug]}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No assessments in that category yet.{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-2"
            onClick={() => setActiveFilter("all")}
          >
            View all
          </button>
        </div>
      )}

      {activeFilter === "all" && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Coming soon
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {["Design", "Business", "Communication"].map((label) => (
              <Card key={label} className="opacity-60 border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Assessments in this category are planned for a later phase.</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function AssessmentCard({
  path,
  requiresAuth,
  priorBest,
}: {
  path: SkillPath;
  requiresAuth: boolean;
  priorBest?: PriorBest;
}) {
  const level = path.levels[0];
  const estimatedTime = ESTIMATED_MINUTES[path.domain] ?? "45–60 min";
  const href = requiresAuth
    ? `/login?next=/assess/${path.slug}`
    : `/assess/${path.slug}`;

  return (
    <Card className="overflow-hidden p-0 flex flex-col card-hover">
      <div className={cn("h-1.5 w-full shrink-0", domainStripe(path.domain))} />
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{path.name}</CardTitle>
          {priorBest && (
            <span
              className={cn(
                "shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border",
                priorBest.passed
                  ? "bg-success-bg text-success border-success/20"
                  : "bg-amber-50 text-amber-700 border-amber-200/70"
              )}
            >
              {priorBest.passed ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {priorBest.score.toFixed(0)}
                </span>
              ) : (
                priorBest.score.toFixed(0)
              )}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Badge variant="secondary" className="text-xs capitalize">
            {DOMAIN_LABELS[path.domain] ?? path.domain}
          </Badge>
          {level && <Badge variant="outline" className="text-xs">{level.label}</Badge>}
          {priorBest?.passed && (
            <Badge className="text-xs bg-success-bg text-success border-success/20">
              <Trophy className="h-2.5 w-2.5 mr-1" /> Passed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pb-5 gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {path.description}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {estimatedTime}
        </div>
        <Link
          href={href}
          className={cn(buttonVariants({ size: "sm", variant: priorBest ? "outline" : "default" }), "w-full justify-center gap-1.5 mt-auto")}
        >
          {priorBest ? (
            <><ArrowRight className="h-3.5 w-3.5" /> {priorBest.passed ? "Retake" : "Try again"}</>
          ) : (
            <>Start assessment <ArrowRight className="h-3.5 w-3.5" /></>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}

// ── Assessment detail (pre-start screen) ───────────────────────────────────

function AssessDetail({ pathSlug }: { pathSlug: string }) {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?next=/assess/${pathSlug}`);
    }
  }, [authLoading, session, router, pathSlug]);

  const { data: skillPath, isLoading: pathLoading } = useQuery({
    queryKey: ["skill-path", pathSlug],
    queryFn: () => api.skillPaths.get(pathSlug),
    enabled: !!session,
  });

  const { data: adaptiveTask, isLoading: taskLoading } = useQuery({
    queryKey: ["adaptive-task", pathSlug],
    queryFn: () => api.assessmentJobs.adaptiveTask(pathSlug, profile?.id),
    enabled: !!session,
    staleTime: 5 * 60_000,
  });

  if (authLoading || !session || pathLoading || taskLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your assessment…</p>
        </div>
      </div>
    );
  }

  const rubricId        = adaptiveTask?.rubric_id ?? "";
  const levelLabel      = adaptiveTask?.level_label ?? "Level 1 — Foundations";
  const timeLimitMins   = adaptiveTask?.prompt?.time_limit_minutes;
  const estimatedTime   = timeLimitMins ? `${timeLimitMins} min` : (ESTIMATED_MINUTES[skillPath?.domain ?? ""] ?? "45–60 min");
  const dimensions      = RUBRIC_DIMENSIONS[rubricId] ?? [];
  const threshold       = getPassThreshold(rubricId);
  const isTranslation   = rubricId === "translate-yo-en-001";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href="/assess"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All assessments
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="capitalize">
            {DOMAIN_LABELS[skillPath?.domain ?? ""] ?? skillPath?.domain}
          </Badge>
          <Badge variant="outline">{levelLabel}</Badge>
        </div>
        <h1 className="text-3xl font-extrabold">{skillPath?.name ?? "Assessment"}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          {skillPath?.description}
        </p>
      </div>

      {/* Assessment summary card */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1 bg-primary" />
        <CardContent className="pt-5 pb-5 grid grid-cols-2 gap-y-4 gap-x-6 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Time estimate</p>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {estimatedTime}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Pass threshold</p>
            <p className="text-sm font-semibold">{threshold}/100</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Rubric</p>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{rubricId}</code>
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      {dimensions.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            What you&apos;ll be graded on
          </p>
          <div className="flex flex-wrap gap-2">
            {dimensions.map((d) => (
              <div
                key={d.label}
                className="flex items-center gap-1.5 bg-card border rounded-full px-3 py-1 text-xs shadow-sm"
              >
                <span className="font-medium">{d.label}</span>
                <span className="text-muted-foreground">{d.pts}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Translation notice */}
      {isTranslation && (
        <div className="mb-6 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <p>
            <strong className="font-semibold">Human review required.</strong>{" "}
            Translation results are reviewed by a human translator within 48 hours.
            Credentials are issued after human review, not automatically.
          </p>
        </div>
      )}

      <Button
        onClick={() => router.push(`/assess/${pathSlug}?start=1`)}
        size="lg"
        className="w-full sm:w-auto h-11 px-8 text-base font-semibold gap-2"
      >
        <Sparkles className="h-4 w-4" />
        Begin assessment
      </Button>
      <p className="text-xs text-muted-foreground mt-3">
        Work at your own pace — time is not scored.
      </p>
    </div>
  );
}

// ── Assessment form ─────────────────────────────────────────────────────────

const schema = z.object({
  content: z.string().min(50, "Submission must be at least 50 characters."),
});
type FormData = z.infer<typeof schema>;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function AssessForm({ pathSlug }: { pathSlug: string }) {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?next=/assess/${pathSlug}`);
    }
  }, [authLoading, session, router, pathSlug]);

  const { data: skillPath, isLoading: pathLoading } = useQuery({
    queryKey: ["skill-path", pathSlug],
    queryFn: () => api.skillPaths.get(pathSlug),
    enabled: !!session,
  });

  const { data: adaptiveTask, isLoading: taskLoading, error: taskError } = useQuery({
    queryKey: ["adaptive-task", pathSlug],
    queryFn: () => api.assessmentJobs.adaptiveTask(pathSlug, profile?.id),
    enabled: !!session,
    staleTime: 5 * 60_000,
  });

  const draftKey = `assess-draft-${pathSlug}`;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, formState: { errors }, control, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      content: typeof window !== "undefined" ? (localStorage.getItem(draftKey) ?? "") : "",
    },
  });

  const contentValue = useWatch({ control, name: "content" }) ?? "";
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (contentValue) localStorage.setItem(draftKey, contentValue);
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [contentValue, draftKey]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (content: string) => {
      const rubricId       = adaptiveTask?.rubric_id          ?? "web-dev-html-001";
      const taskId         = adaptiveTask?.task_id             ?? "web-dev-html-001-l1";
      const level          = adaptiveTask?.recommended_level   ?? 1;
      const submissionType = SUBMISSION_TYPE_FOR_RUBRIC[rubricId] ?? "text";
      const job = await api.assessmentJobs.create({
        task_id: taskId,
        skill_path_slug: pathSlug,
        level,
        submission_type: submissionType,
        content,
        rubric_id: rubricId,
        user_id: profile?.id,
      });

      for (let attempt = 0; attempt < 90; attempt += 1) {
        const latest = await api.assessmentJobs.get(job.id);
        if (latest.status === "succeeded" && latest.result) return latest.result;
        if (latest.status === "failed") throw new Error(latest.error ?? "Assessment failed.");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error("Assessment is still running. Check submission history in a few minutes.");
    },
    onSuccess: (data) => {
      localStorage.removeItem(draftKey);
      router.push(
        `/results/${data.review_id}?score=${data.overall_score}&passed=${data.passed}&credential=${data.credential_id ?? ""}&submission=${data.submission_id ?? ""}&path=${pathSlug}`
      );
    },
  });

  const rubricId     = adaptiveTask?.rubric_id ?? "web-dev-html-001";
  const isTranslation = rubricId === "translate-yo-en-001";
  const isCodeTask    = SUBMISSION_TYPE_FOR_RUBRIC[rubricId] === "html_css_js" || SUBMISSION_TYPE_FOR_RUBRIC[rubricId] === "code";

  if (authLoading || !session || pathLoading || taskLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your assessment…</p>
        </div>
      </div>
    );
  }

  if (taskError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold mb-0.5">Could not load assessment task</p>
            <p className="text-destructive/80">{(taskError as Error).message}</p>
          </div>
        </div>
      </div>
    );
  }

  const levelLabel    = adaptiveTask?.level_label ?? "Level 1 — Foundations";
  const taskText      = adaptiveTask?.prompt?.text ?? "";
  const threshold     = getPassThreshold(rubricId);
  const dimensions    = RUBRIC_DIMENSIONS[rubricId] ?? [
    { label: "Semantic HTML", pts: 20 },
    { label: "CSS Quality",   pts: 20 },
    { label: "Responsiveness",pts: 25 },
    { label: "Accessibility", pts: 15 },
    { label: "Correctness",   pts: 20 },
  ];

  const chars = contentValue?.length ?? 0;
  const words = contentValue ? wordCount(contentValue) : 0;
  const hasDraft = chars >= 50;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href={`/assess/${pathSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Assessment overview
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="capitalize">{skillPath?.domain ?? "technology"}</Badge>
          <Badge variant="outline">{levelLabel}</Badge>
        </div>
        <h1 className="text-3xl font-extrabold">{skillPath?.name ?? "Assessment"}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Diagnostic assessment &middot; rubric:{" "}
          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{rubricId}</code>{" "}
          &middot; pass threshold: {threshold}/100
        </p>
        {adaptiveTask?.reasoning && adaptiveTask.recommended_level > 1 && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-primary bg-primary/8 rounded-lg px-3 py-2 border border-primary/15">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {adaptiveTask.reasoning}
          </div>
        )}
      </div>

      {/* Translation notice */}
      {isTranslation && (
        <div className="mb-6 rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <p>
            <strong className="font-semibold">Human review required.</strong>{" "}
            Your translation result will be reviewed by a human translator within 48 hours.
            Credentials for this assessment are issued after human review, not automatically.
          </p>
        </div>
      )}

      {/* Task prompt */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1 bg-primary" />
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Your task</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
          {taskText || (
            <>
              Build a{" "}
              <strong className="text-foreground font-semibold">
                semantic, accessible, responsive HTML/CSS landing page
              </strong>{" "}
              for a fictional local business of your choice.
            </>
          )}
          <p className="text-xs pt-4 text-muted-foreground/70">
            Work at your own pace — time is not scored.
          </p>
        </CardContent>
      </Card>

      {/* Rubric dimensions */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Graded on
        </p>
        <div className="flex flex-wrap gap-2">
          {dimensions.map((d) => (
            <div
              key={d.label}
              className="flex items-center gap-1.5 bg-card border rounded-full px-3 py-1 text-xs shadow-sm"
            >
              <span className="font-medium">{d.label}</span>
              <span className="text-muted-foreground">{d.pts}pts</span>
            </div>
          ))}
        </div>
      </div>

      {/* Submission form */}
      <form onSubmit={handleSubmit((data) => mutate(data.content))}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              {isCodeTask ? (
                <span>{chars} chars{hasDraft && <span className="ml-2 text-success">· Draft auto-saved</span>}</span>
              ) : (
                <>
                  <span>{words} {words === 1 ? "word" : "words"}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{chars} chars</span>
                  {hasDraft && <span className="text-success">· Draft auto-saved</span>}
                </>
              )}
            </p>
            {contentValue && (
              <button
                type="button"
                onClick={() => { setValue("content", ""); localStorage.removeItem(draftKey); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
              >
                Clear draft
              </button>
            )}
          </div>
          <Textarea
            {...register("content")}
            placeholder={isCodeTask ? "// Paste your code here…" : "Paste your submission here…"}
            className={cn("min-h-[340px] resize-y", isCodeTask && "font-mono text-xs")}
            disabled={isPending}
          />
          {!isCodeTask && words < 50 && chars > 0 && (
            <p className="text-xs text-muted-foreground/70 mt-1.5">
              Aim for 150+ words for a strong submission.
            </p>
          )}
          {errors.content && (
            <p className="text-destructive text-xs mt-2 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {errors.content.message}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {(error as Error).message}
          </div>
        )}

        <Button
          type="submit"
          disabled={isPending}
          className="w-full sm:w-auto h-11 px-8 text-base font-semibold gap-2"
          size="lg"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Queued for AI review…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Submit for grading
            </>
          )}
        </Button>

        {isPending && (
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            AI grading runs in the background. This page will navigate automatically when your result is ready.
          </p>
        )}
      </form>
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────────────

export function AssessmentExperience({
  pathSlug,
  start,
}: {
  pathSlug: string | null;
  start: boolean;
}) {
  if (!pathSlug || !assessmentSlugs.has(pathSlug)) return <AssessIndex />;
  if (start) return <AssessForm pathSlug={pathSlug} />;
  return <AssessDetail pathSlug={pathSlug} />;
}

function AssessPageInner() {
  const params = useSearchParams();
  const pathSlug = params.get("path");
  return <AssessmentExperience pathSlug={pathSlug} start={params.get("start") === "1"} />;
}

export default function AssessPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-28">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <AssessPageInner />
      </Suspense>
    </div>
  );
}
