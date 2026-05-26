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
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Navbar } from "@/components/navbar";

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

  if (authLoading || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pathLoading || taskLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (taskError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          Could not load assessment task: {(taskError as Error).message}
        </div>
      </div>
    );
  }

  const levelLabel = adaptiveTask?.level_label ?? "Level 1 — Foundations";
  const taskText = adaptiveTask?.prompt?.text ?? "";
  const rubricId = adaptiveTask?.rubric_id ?? "web-dev-html-001";

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary">{skillPath?.domain ?? "technology"}</Badge>
          <Badge variant="outline">{levelLabel}</Badge>
        </div>
        <h1 className="text-2xl font-bold">{skillPath?.name ?? "Frontend Web Development"}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Diagnostic assessment &middot; rubric: {rubricId} &middot; pass threshold: 70/100
        </p>
        {adaptiveTask?.reasoning && adaptiveTask.recommended_level > 1 && (
          <p className="mt-2 text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5 border border-blue-100 inline-block">
            {adaptiveTask.reasoning}
          </p>
        )}
      </div>

      {/* Task prompt */}
      <Card className="mb-6 border-blue-100 bg-blue-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your task</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          {taskText ? (
            <p>{taskText}</p>
          ) : (
            <>
              <p>
                Build a <strong className="text-foreground">semantic, accessible, responsive HTML/CSS landing page</strong> for
                a fictional local business of your choice. The page must include:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 mt-2">
                <li>A navigation bar with at least 3 links</li>
                <li>A hero section with a headline and call-to-action button</li>
                <li>A features or services section with at least 3 items</li>
                <li>A footer with contact info</li>
              </ul>
              <p className="mt-2">Use only HTML and CSS — no JavaScript required.</p>
            </>
          )}
          <p className="text-xs pt-3">
            Work at your own pace &mdash; time is not scored. Paste your full HTML below.
          </p>
        </CardContent>
      </Card>

      {/* Rubric dimensions preview */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
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
            <div key={d.label} className="flex items-center gap-1.5 bg-white border rounded-full px-3 py-1 text-xs">
              <span>{d.label}</span>
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
            placeholder="<!DOCTYPE html>&#10;<html lang='en'>&#10;  ..."
            className="font-mono text-xs min-h-[320px] resize-y"
            disabled={isPending}
          />
          {errors.content && (
            <p className="text-destructive text-xs mt-1.5 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {errors.content.message}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error.message}
          </div>
        )}

        <Button type="submit" disabled={isPending || !adaptiveTask} className="w-full sm:w-auto" size="lg">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Queued for AI review...
            </>
          ) : (
            "Submit for grading"
          )}
        </Button>

        {isPending && (
          <p className="text-xs text-muted-foreground mt-3">
            AI grading runs in the background. This page will move on when the result is ready.
          </p>
        )}
      </form>
    </div>
  );
}

export default function AssessPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
        <AssessForm />
      </Suspense>
    </div>
  );
}
