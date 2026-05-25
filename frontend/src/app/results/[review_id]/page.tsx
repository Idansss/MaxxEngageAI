"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Award, ArrowRight, RotateCcw, User, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { api } from "@/lib/api";

function ResultsContent({ reviewId }: { reviewId: string }) {
  const params = useSearchParams();
  const score = parseFloat(params.get("score") ?? "0");
  const passed = params.get("passed") === "true";
  const credentialId = params.get("credential") ?? "";
  const submissionId = params.get("submission") ?? "";
  const { profile } = useAuth();

  const [appealReason, setAppealReason] = useState("");
  const [appealDone, setAppealDone] = useState(false);

  const { mutate: submitAppeal, isPending: appealing, error: appealError } = useMutation({
    mutationFn: () => api.submissions.appeal(submissionId, appealReason),
    onSuccess: () => setAppealDone(true),
  });

  const scoreColor =
    score >= 70 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  const progressColor =
    score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Result header */}
      <Card className={`mb-6 border-2 ${passed ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {passed ? (
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-red-400 mx-auto" />
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">Overall score</p>
            <p className={`text-5xl font-bold ${scoreColor}`}>{score.toFixed(1)}</p>
            <p className="text-sm text-muted-foreground mt-1">out of 100 &middot; pass threshold: 70</p>
          </div>

          <Progress value={score} className="h-2 max-w-xs mx-auto" />

          <p className="font-semibold text-lg">
            {passed ? "You passed!" : "Not quite — keep going"}
          </p>

          {passed && credentialId && (
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 rounded-full px-4 py-1.5 text-sm font-medium">
              <Award className="h-4 w-4" />
              W3C Credential issued
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credential card */}
      {passed && credentialId && (
        <Card className="mb-6 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-600" />
              Your Verifiable Credential
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A W3C VC 2.0 credential has been issued to your DID and stored on ProofOS.
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
                onClick={() => navigator.clipboard?.writeText(
                  `${window.location.origin}/credentials/${credentialId}`
                )}
              >
                Copy share link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score breakdown preview */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Score breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your full per-dimension scores, AI rationale, and evidence quotes are stored with
            review ID:
          </p>
          <code className="block mt-2 text-xs bg-muted rounded px-3 py-2 font-mono break-all">
            {reviewId}
          </code>
        </CardContent>
      </Card>

      {/* Appeal section — only shown when failed and submission was persisted */}
      {!passed && submissionId && (
        <Card className="mb-6 border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-amber-500" />
              Disagree with this score?
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
                  A human reviewer will re-examine your submission.
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

      {/* Next steps */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What&apos;s next?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {passed ? (
            <>
              <p className="text-sm text-muted-foreground">
                You passed Level 1. Ready to push further?
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/assess?path=web-dev-frontend&level=2" className={cn(buttonVariants({ size: "sm" }))}>
                  Attempt Level 2 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Link>
                <Link href="/" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Explore other paths</Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                A score of {score.toFixed(1)} means there&apos;s room to grow. Get a personalized
                learning path and come back stronger.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href={`/learn/web-dev-frontend?score=${score}`} className={cn(buttonVariants({ size: "sm" }))}>
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

export default function ResultsPage({ params }: { params: Promise<{ review_id: string }> }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground text-sm">Loading results...</div>}>
        <ResultsContentWrapper params={params} />
      </Suspense>
    </div>
  );
}

async function ResultsContentWrapper({ params }: { params: Promise<{ review_id: string }> }) {
  const { review_id } = await params;
  return <ResultsContent reviewId={review_id} />;
}
