"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, type AssessRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, AlertCircle, Sparkles } from "lucide-react";
import { Suspense, useEffect } from "react";

const schema = z.object({
  content: z.string().min(50, "Submission must be at least 50 characters."),
});
type FormData = z.infer<typeof schema>;

const SUBMISSION_TYPE_FOR_RUBRIC: Record<string, string> = {
  "web-dev-html-001": "html_css_js",
};

function AssessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const pathSlug = params.get("path") ?? "web-dev-frontend";
  const { session, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?next=/assess${pathSlug ? `?path=${pathSlug}` : ""}`);
    }
  }, [authLoading, session, router, pathSlug]);

  const { data: skillPath, isLoading: pathLoading } = useQuery({
    queryKey: ["skill-path", pathSlug],
    queryFn: () => api.skillPaths.get(pathSlug),
    enabled: !!session,
  });

  const { data: adaptiveTask, isLoading: taskLoading, error: taskError } = useQuery({
    queryKey: ["adaptive-task", pathSlug, profile?.id],
    queryFn: () => api.assessmentJobs.adaptiveTask(pathSlug, profile?.id),
    enabled: !!session && !!profile?.id,
    staleTime: 60_000,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (content: string) => {
      if (!adaptiveTask) throw new Error("Task not loaded. Please refresh.");
      const submissionType = SUBMISSION_TYPE_FOR_RUBRIC[adaptiveTask.rubric_id] ?? "text";
      const job = await api.assessmentJobs.create({
        task_id: adaptiveTask.task_id,
        skill_path_slug: pathSlug,
        level: adaptiveTask.recommended_level,
        submission_type: submissionType as AssessRequest["submission_type"],
        content,
        rubric_id: adaptiveTask.rubric_id,
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
      router.push(
        `/results/${data.review_id}?score=${data.overall_score}&passed=${data.passed}&credential=${data.credential_id ?? ""}&submission=${data.submission_id ?? ""}`
      );
    },
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

  const levelLabel = adaptiveTask?.level_label ?? "Level 1 — Foundations";
  const taskText = adaptiveTask?.prompt?.text ?? "";
  const rubricId = adaptiveTask?.rubric_id ?? "web-dev-html-001";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to paths
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="capitalize">{skillPath?.domain ?? "technology"}</Badge>
          <Badge variant="outline">{levelLabel}</Badge>
        </div>
        <h1 className="text-3xl font-extrabold">{skillPath?.name ?? "Frontend Web Development"}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Diagnostic assessment &middot; rubric: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{rubricId}</code> &middot; pass threshold: 70/100
        </p>
        {adaptiveTask?.reasoning && adaptiveTask.recommended_level > 1 && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs text-primary bg-primary/8 rounded-lg px-3 py-2 border border-primary/15">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {adaptiveTask.reasoning}
          </div>
        )}
      </div>

      {/* Task prompt */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1 bg-primary" />
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Your task</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {taskText ? (
            <p>{taskText}</p>
          ) : (
            <>
              <p>
                Build a{" "}
                <strong className="text-foreground font-semibold">
                  semantic, accessible, responsive HTML/CSS landing page
                </strong>{" "}
                for a fictional local business of your choice. The page must include:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 mt-3">
                <li>A navigation bar with at least 3 links</li>
                <li>A hero section with a headline and call-to-action button</li>
                <li>A features or services section with at least 3 items</li>
                <li>A footer with contact info</li>
              </ul>
              <p className="mt-3">Use only HTML and CSS — no JavaScript required.</p>
            </>
          )}
          <p className="text-xs pt-4 text-muted-foreground/70">
            Work at your own pace — time is not scored. Paste your full HTML below.
          </p>
        </CardContent>
      </Card>

      {/* Rubric dimensions */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Graded on
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Semantic HTML", pts: 20 },
            { label: "CSS Quality", pts: 20 },
            { label: "Responsiveness", pts: 25 },
            { label: "Accessibility", pts: 15 },
            { label: "Correctness", pts: 20 },
          ].map((d) => (
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
          <Textarea
            {...register("content")}
            placeholder={"<!DOCTYPE html>\n<html lang='en'>\n  ..."}
            className="font-mono text-xs min-h-[340px] resize-y"
            disabled={isPending}
          />
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
          disabled={isPending || !adaptiveTask}
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
        <AssessForm />
      </Suspense>
    </div>
  );
}
