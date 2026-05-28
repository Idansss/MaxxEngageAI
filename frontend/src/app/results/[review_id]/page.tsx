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
  CheckCircle, XCircle, Award, ArrowRight,
  User, MessageSquare, Loader2, ChevronDown, ChevronUp,
  ThumbsUp, AlertCircle, BookOpen, Quote, Clock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

function indicatorColor(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 70) return "[&>div]:bg-emerald-500";
  if (pct >= 50) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-400";
}

function DimensionCard({ d }: { d: DimensionScore }) {
  const [open, setOpen] = useState(false);
  const pct = d.max_score > 0 ? Math.round((d.score / d.max_score) * 100) : 0;

  return (
    <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
      <button
        type="button"
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-semibold truncate">{d.dimension}</span>
            <span className="text-sm font-black shrink-0">{d.score}/{d.max_score}</span>
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
        <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">{d.rationale}</p>
          {d.evidence_quotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Evidence from your submission
              </p>
              {d.evidence_quotes.map((q) => (
                <div key={q} className="flex gap-2 text-xs text-muted-foreground bg-card rounded-lg border px-3 py-2">
                  <Quote className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/40" />
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
          <BookOpen className="h-4 w-4 text-primary" />
          AI feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">{feedback.summary}</p>

        {feedback.strengths.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-success mb-2.5">Strengths</p>
            <ul className="space-y-2">
              {feedback.strengths.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                  <ThumbsUp className="h-3.5 w-3.5 shrink-0 mt-0.5 text-success" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.improvements.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold mb-2.5">Improvements</p>
            <ul className="space-y-2">
              {feedback.improvements.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gold" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feedback.next_steps.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2.5">Next steps</p>
            <ul className="space-y-2">
              {feedback.next_steps.map((s) => (
                <li key={s} className="flex gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
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

function ResultsContent({ reviewId }: { reviewId: string }) {
  const params = useSearchParams();
  const score = parseFloat(params.get("score") ?? "0");
  const passed = params.get("passed") === "true";
  const credentialId = params.get("credential") ?? "";
  const submissionId = params.get("submission") ?? "";
  const pathSlug = params.get("path") ?? "";
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

  const passThreshold = review?.rubric_id === "translate-yo-en-001" ? 75 : 70;
  const scoreColorClass = score >= passThreshold ? "text-success" : score >= 50 ? "text-gold" : "text-destructive";
  const pendingHumanReview = passed && !credentialId && (review?.human_review_requested ?? false);

  const weakestDim = review && review.scores.length > 0
    ? review.scores.reduce((min, d) => {
        const ratio = d.max_score > 0 ? d.score / d.max_score : 0;
        const minRatio = min.max_score > 0 ? min.score / min.max_score : 0;
        return ratio < minRatio ? d : min;
      }, review.scores[0])
    : null;

  const skillSlug = review?.skill_path_slug ?? pathSlug;

  return (
    <div className="max-w-2xl px-6 py-10 space-y-6">

      {/* Result hero card */}
      <Card className={cn("overflow-hidden", passed ? "ring-1 ring-success/30" : "ring-1 ring-destructive/20")}>
        <div className={cn("h-1.5 w-full", passed ? "bg-success" : "bg-destructive")} />
        <CardContent className="pt-8 pb-7 text-center space-y-5">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mx-auto",
            passed ? "bg-success-bg" : "bg-destructive/10"
          )}>
            {passed ? (
              <CheckCircle className="h-8 w-8 text-success" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" />
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Overall score</p>
            <p className={cn("text-6xl font-black leading-none", scoreColorClass)}>{score.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground mt-2">out of 100 &middot; pass threshold: {passThreshold}</p>
          </div>

          <Progress value={score} className="h-2 max-w-xs mx-auto" />

          <p className="font-bold text-xl">
            {passed ? "You passed! 🎉" : "Not quite — keep going"}
          </p>

          {review && (
            <div className="flex items-center justify-center flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Confidence: {review.confidence !== null ? `${(review.confidence * 100).toFixed(0)}%` : "—"}</span>
              {review.model_version && <><span>·</span><span>{review.model_version}</span></>}
              {review.human_review_requested && (
                <Badge className="bg-amber-100 text-amber-700 text-xs">Human review queued</Badge>
              )}
            </div>
          )}

          {passed && credentialId && (
            <div className="inline-flex items-center gap-2 bg-success-bg text-success rounded-full px-5 py-1.5 text-sm font-semibold">
              <Award className="h-4 w-4" /> W3C Credential issued
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credential card */}
      {passed && credentialId && (
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Your Verifiable Credential
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A W3C VC 2.0 credential has been issued to your DID and stored on Maxx Engage.
              Share the link below — anyone can verify it without contacting us.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              <Link href={`/credentials/${credentialId}`} className={cn(buttonVariants({ size: "sm" }), "flex-1 justify-center gap-1.5")}>
                View credential <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              {profile?.id && (
                <Link href={`/profile/${profile.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 justify-center gap-1.5")}>
                  <User className="h-3.5 w-3.5" /> My Profile
                </Link>
              )}
              <Button
                type="button"
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

      {/* Pending human review card — shown for translation passes before credential is issued */}
      {pendingHumanReview && (
        <Card className="overflow-hidden ring-1 ring-amber-300/40">
          <div className="h-1 bg-amber-400" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" /> Credential pending human review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your submission passed the AI review. Because translation accuracy requires
              expert judgment, a human translator will review it within{" "}
              <strong className="text-foreground font-semibold">48 hours</strong>.
              Your credential will be issued automatically once the review is complete —
              you&apos;ll receive an email notification.
            </p>
            {profile?.username ? (
              <Link
                href={`/u/${profile.username}`}
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
              >
                <User className="h-3.5 w-3.5" /> View my proof page
              </Link>
            ) : (
              <Link
                href="/identity"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
              >
                <User className="h-3.5 w-3.5" /> Set up your proof page
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Score breakdown */}
      {reviewLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading score breakdown…
        </div>
      ) : review ? (
        <>
          <div>
            <h2 className="font-bold mb-1 text-base">Score breakdown</h2>
            <p className="text-xs text-muted-foreground mb-4">Click any row to see the AI&apos;s rationale and evidence.</p>
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
          <CardContent className="py-6 text-center">
            <p className="text-xs text-muted-foreground">
              Sign in to view the full score breakdown.
            </p>
            <code className="block mt-2 text-xs bg-muted rounded-lg px-3 py-2 font-mono break-all">
              {reviewId}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Appeal */}
      {!passed && submissionId && (
        <Card className="ring-1 ring-amber-300/30 overflow-hidden">
          <div className="h-1 bg-gold" />
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-gold" /> Disagree with this score?
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appealDone ? (
              <div className="flex items-center gap-2 text-sm text-success">
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
                  className="input-base resize-none h-24"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{appealReason.length}/500</span>
                  <Button
                    type="button"
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
          <CardTitle className="text-base font-bold">What&apos;s next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {passed && pendingHumanReview ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your translation is with a human reviewer. While you wait, explore other skill paths.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                  Explore other assessments <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          ) : passed ? (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You passed Level {review?.level ?? 1}. Ready to push further?
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/assess/${skillSlug}?level=${(review?.level ?? 1) + 1}`}
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                >
                  Attempt Level {(review?.level ?? 1) + 1} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/assess" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>
                  Explore other paths
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Weakest dimension callout */}
              {weakestDim && (
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">
                    Focus area
                  </p>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {weakestDim.dimension} — {weakestDim.score}/{weakestDim.max_score}pts
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {weakestDim.rationale}
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed">
                A score of {score.toFixed(1)} means there&apos;s room to grow. Get a personalised
                week-by-week learning path, then come back when you&apos;re ready.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  href={`/learn/${skillSlug}?score=${score.toFixed(1)}${weakestDim ? `&focus=${encodeURIComponent(weakestDim.dimension)}` : ""}`}
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Build my learning path
                </Link>
                <Link
                  href={`/assess/${skillSlug}`}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
                >
                  Retake now <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ review_id: string }> }) {
  const { review_id } = use(params);
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading results…
        </div>
      }>
        <ResultsContent reviewId={review_id} />
      </Suspense>
    </div>
  );
}
