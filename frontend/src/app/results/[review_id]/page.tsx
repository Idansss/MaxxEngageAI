"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type DimensionScore, type ReviewFeedback } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle, XCircle, Award, ArrowRight, RotateCcw,
  User, MessageSquare, Loader2, ChevronDown, ChevronUp,
  ThumbsUp, AlertCircle, BookOpen, Quote,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";

// ── helpers ────────────────────────────────────────────────────────────────

function indicatorColor(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 70) return "[&>div]:bg-green-500";
  if (pct >= 50) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-400";
}

// ── sub-components ─────────────────────────────────────────────────────────

function DimensionCard({ d }: { d: DimensionScore }) {
  const [open, setOpen] = useState(false);
  const pct = d.max_score > 0 ? Math.round((d.score / d.max_score) * 100) : 0;

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-medium truncate">{d.dimension}</span>
            <span className="text-sm font-bold shrink-0">
              {d.score}/{d.max_score}
            </span>
          </div>
          <Progress value={pct} className={cn("h-1.5", indicatorColor(d.score, d.max_score))} />
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t bg-gray-50/50">
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">{d.rationale}</p>
          {d.evidence_quotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Evidence from your submission
              </p>
              {d.evidence_quotes.map((q) => (
                <div key={q} className="flex gap-2 text-xs text-muted-foreground bg-white rounded border px-3 py-2">
                  <Quote className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/50" />
                  <span className="font-mono leading-relaxed">{q}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: ReviewFeedback }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          AI feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">{feedback.summary}</p>

        {feedback.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700 mb-2">Strengths</p>
            <ul className="space-y-1.5">
              {feedback.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                  <ThumbsUp className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.improvements.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-2">Improvements</p>
            <ul className="space-y-1.5">
              {feedback.improvements.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.next_steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-2">Next steps</p>
            <ul className="space-y-1.5">
              {feedback.next_steps.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── main content ───────────────────────────────────────────────────────────

function ResultsContent({ reviewId }: { reviewId: string }) {
  const params = useSearchParams();
  const score = parseFloat(params.get("score") ?? "0");
  const passed = params.get("passed") === "true";
  const credentialId = params.get("credential") ?? "";
  const submissionId = params.get("submission") ?? "";
  const { session, profile } = useAuth();

  const [appealReason, setAppealReason] = useState("");
  const [appealDone, setAppealDone] = useState(false);

  const { data: review, isLoading: reviewLoading } = useQuery({
    queryKey: ["review", reviewId],
    queryFn: () => api.reviews.get(reviewId),
    enabled: !!session && !!reviewId,
    retry: 2,
  });

  const { mutate: submitAppeal, isPending: appealing, error: appealError } = useMutation({
    mutationFn: () => api.submissions.appeal(submissionId, appealReason),
    onSuccess: () => setAppealDone(true),
  });

  const scoreColor_ = score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

      {/* Result header */}
      <Card className={`border-2 ${passed ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {passed ? (
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
          )}
          <div>
            <p className="text-sm text-muted-foreground mb-1">Overall score</p>
            <p className={`text-5xl font-bold ${scoreColor_}`}>{score.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground mt-1">out of 100 &middot; pass threshold: 70</p>
          </div>
          <Progress value={score} className="h-2 max-w-xs mx-auto" />
          <p className="font-semibold text-lg">
            {passed ? "You passed!" : "Not quite — keep going"}
          </p>
          {review && (
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span>Confidence: {review.confidence !== null ? `${(review.confidence * 100).toFixed(0)}%` : "—"}</span>
              {review.model_version && <><span>·</span><span>{review.model_version}</span></>}
              {review.human_review_requested && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">Human review queued</Badge>
              )}
            </div>
          )}
          {passed && credentialId && (
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 rounded-full px-4 py-1.5 text-sm font-medium">
              <Award className="h-4 w-4" /> W3C Credential issued
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credential card */}
      {passed && credentialId && (
        <Card className="border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" /> Your Verifiable Credential
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A W3C VC 2.0 credential has been issued to your DID and stored on Maxx Engage.
              Share the link below — anyone can verify it without contacting us.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <Link href={`/credentials/${credentialId}`} className={cn(buttonVariants({ size: "sm" }), "flex-1 justify-center")}>
                View credential <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
              {profile?.id && (
                <Link href={`/profile/${profile.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 justify-center gap-1.5")}>
                  <User className="h-3.5 w-3.5" /> My Profile
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/credentials/${credentialId}`)}
              >
                Copy share link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-dimension score breakdown */}
      {reviewLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading score breakdown…
        </div>
      ) : review ? (
        <>
          <div>
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-base">
              Score breakdown
              <span className="text-xs font-normal text-muted-foreground">click any row to see rationale</span>
            </h2>
            <div className="space-y-2">
              {review.scores.map((d) => (
                <DimensionCard key={d.dimension} d={d} />
              ))}
            </div>
          </div>

          <FeedbackCard feedback={review.feedback} />
        </>
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-xs text-muted-foreground text-center">
              Sign in to view the full score breakdown.
            </p>
            <code className="block mt-2 text-xs bg-muted rounded px-3 py-2 font-mono break-all text-center">
              {reviewId}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Appeal section */}
      {!passed && submissionId && (
        <Card className="border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-500" /> Disagree with this score?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appealDone ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4 shrink-0" />
                Appeal submitted. A human reviewer will re-evaluate your work.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  If you believe the AI score is inaccurate, explain why below.
                </p>
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="e.g. My responsive layout works correctly — the CSS uses valid media queries and I tested in Chrome and Firefox..."
                  maxLength={500}
                  className="w-full text-sm rounded-md border px-3 py-2 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{appealReason.length}/500</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={appealReason.trim().length < 20 || appealing}
                    onClick={() => submitAppeal()}
                    className="gap-1.5"
                  >
                    {appealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    Submit appeal
                  </Button>
                </div>
                {appealError && (
                  <p className="text-xs text-destructive">{(appealError as Error).message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Next steps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What&apos;s next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {passed ? (
            <>
              <p className="text-sm text-muted-foreground">
                You passed Level {review?.level ?? 1}. Ready to push further?
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/assess?path=${review?.skill_path_slug ?? "web-dev-frontend"}&level=${(review?.level ?? 1) + 1}`}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Attempt Level {(review?.level ?? 1) + 1} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
                <Link href="/" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  Explore other paths
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                A score of {score.toFixed(1)} means there&apos;s room to grow. Get a personalised
                learning path and come back stronger.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/learn/${review?.skill_path_slug ?? "web-dev-frontend"}?score=${score}`}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Get learning path <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
                <Link href="/assess" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Try again
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── page wrapper ───────────────────────────────────────────────────────────

export default function ResultsPage({ params }: { params: Promise<{ review_id: string }> }) {
  const { review_id } = use(params);
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading results…
        </div>
      }>
        <ResultsContent reviewId={review_id} />
      </Suspense>
    </div>
  );
}
