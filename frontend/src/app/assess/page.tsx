"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Suspense } from "react";

const schema = z.object({
  content: z.string().min(50, "Submission must be at least 50 characters."),
});
type FormData = z.infer<typeof schema>;

function AssessForm() {
  const router = useRouter();
  const params = useSearchParams();
  const pathSlug = params.get("path") ?? "web-dev-frontend";

  const { data: skillPath, isLoading: pathLoading } = useQuery({
    queryKey: ["skill-path", pathSlug],
    queryFn: () => api.skillPaths.get(pathSlug),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { mutate, isPending, error, data: result } = useMutation({
    mutationFn: (content: string) =>
      api.assess({
        task_id: "8f451824-8a4c-4f55-acac-2aafdec5755f",
        skill_path_slug: pathSlug,
        level: 1,
        submission_type: "html_css_js",
        content,
        rubric_id: "web-dev-html-001",
      }),
    onSuccess: (data) => {
      router.push(`/results/${data.review_id}?score=${data.overall_score}&passed=${data.passed}&credential=${data.credential_id ?? ""}`);
    },
  });

  if (pathLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary">{skillPath?.domain ?? "technology"}</Badge>
          <Badge variant="outline">Level 1 — Foundations</Badge>
        </div>
        <h1 className="text-2xl font-bold">{skillPath?.name ?? "Frontend Web Development"}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Diagnostic assessment &middot; rubric: web-dev-html-001 &middot; pass threshold: 70/100
        </p>
      </div>

      {/* Task prompt */}
      <Card className="mb-6 border-blue-100 bg-blue-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your task</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-3 text-muted-foreground">
          <p>
            Build a <strong className="text-foreground">semantic, accessible, responsive HTML/CSS landing page</strong> for
            a fictional local business of your choice. The page must include:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>A navigation bar with at least 3 links</li>
            <li>A hero section with a headline and call-to-action button</li>
            <li>A features or services section with at least 3 items</li>
            <li>A footer with contact info</li>
          </ul>
          <p>Use only HTML and CSS — no JavaScript required.</p>
          <p className="text-xs pt-1">
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

        <Button type="submit" disabled={isPending} className="w-full sm:w-auto" size="lg">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Grading with Claude...
            </>
          ) : (
            "Submit for grading"
          )}
        </Button>

        {isPending && (
          <p className="text-xs text-muted-foreground mt-3">
            AI grading typically takes 15–30 seconds. Do not close this tab.
          </p>
        )}
      </form>
    </div>
  );
}

export default function AssessPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="font-bold tracking-tight">
            Proof<span className="text-blue-600">OS</span>
          </Link>
        </nav>
      </header>
      <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
        <AssessForm />
      </Suspense>
    </div>
  );
}
