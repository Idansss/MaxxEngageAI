"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type PeerReviewQueueItem } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle, Clock,
  ArrowRight, UserCheck, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RUBRIC_LABEL: Record<string, string> = {
  "translate-yo-en-001": "Yoruba → English Translation",
};

// â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusBadge({ status }: { status: PeerReviewQueueItem["status"] }) {
  if (status === "pending")  return <Badge variant="secondary">Pending</Badge>;
  if (status === "claimed")  return <Badge className="bg-amber-100 text-amber-800 border border-amber-200/60">In review</Badge>;
  if (status === "approved") return <Badge className="bg-green-100 text-green-800 border border-green-200/60">Approved</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// â”€â”€ Claimable card (queue tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ClaimableCard({ item }: { item: PeerReviewQueueItem }) {
  const queryClient = useQueryClient();

  const { mutate: claim, isPending } = useMutation({
    mutationFn: () => api.peerReview.claim(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prq-open"] });
      queryClient.invalidateQueries({ queryKey: ["prq-claims"] });
    },
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 pb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground mb-0.5">
            {RUBRIC_LABEL[item.rubric_id] ?? item.rubric_id}
          </p>
          <p className="text-sm font-semibold">{item.skill_path_slug}</p>
          {item.ai_score !== null && (
            <p className="text-xs text-muted-foreground mt-0.5">
              AI score: <span className="font-mono">{item.ai_score.toFixed(1)}</span>
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => claim()}
          disabled={isPending}
          className="shrink-0 gap-1.5"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
          Claim
        </Button>
      </CardContent>
    </Card>
  );
}

// â”€â”€ Reviewer verdict card (my claims tab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VerdictCard({ item }: { item: PeerReviewQueueItem }) {
  const queryClient = useQueryClient();
  const [verdict, setVerdict] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");

  const expiresAt = item.claim_expires_at ? new Date(item.claim_expires_at) : null;
  const hoursLeft = expiresAt
    ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 3_600_000))
    : null;

  const { mutate: release, isPending: releasing } = useMutation({
    mutationFn: () => api.peerReview.release(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prq-open"] });
      queryClient.invalidateQueries({ queryKey: ["prq-claims"] });
    },
  });

  const { mutate: submitVerdict, isPending: submitting, error: verdictError } = useMutation({
    mutationFn: () =>
      api.peerReview.submitVerdict(item.id, { verdict: verdict!, verdict_notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prq-claims"] });
      queryClient.invalidateQueries({ queryKey: ["prq-reputation"] });
    },
  });

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {RUBRIC_LABEL[item.rubric_id] ?? item.rubric_id}
            </p>
            <CardTitle className="text-sm">{item.skill_path_slug}</CardTitle>
          </div>
          {item.ai_score !== null && (
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              AI: {item.ai_score.toFixed(1)}
            </span>
          )}
        </div>
        {hoursLeft !== null && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 mt-1">
            <Clock className="h-3 w-3" />
            {hoursLeft > 0 ? `${hoursLeft}h left to submit verdict` : "Claim expiring soon"}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Verdict buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVerdict("approve")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors",
              verdict === "approve"
                ? "border-green-500 bg-green-50 text-green-800"
                : "border-border hover:border-green-400 text-muted-foreground"
            )}
          >
            <CheckCircle2 className="h-4 w-4" /> Approve
          </button>
          <button
            type="button"
            onClick={() => setVerdict("reject")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors",
              verdict === "reject"
                ? "border-destructive bg-destructive/5 text-destructive"
                : "border-border hover:border-destructive/50 text-muted-foreground"
            )}
          >
            <XCircle className="h-4 w-4" /> Reject
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Feedback{verdict === "reject" ? " (required)" : " (optional)"}
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              verdict === "reject"
                ? "Explain why this translation should not be approved…"
                : "Optional: any notes for the submitter"
            }
            className="resize-none min-h-[80px] text-sm"
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{notes.length}/1000</p>
        </div>

        {verdictError && (
          <div className="flex items-start gap-2 text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {(verdictError as Error).message}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => submitVerdict()}
            disabled={submitting || !verdict || (verdict === "reject" && !notes.trim())}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit verdict"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => release()}
            disabled={releasing}
          >
            {releasing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Release"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// â”€â”€ My submission status card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SubmissionStatusCard({ item }: { item: PeerReviewQueueItem }) {
  return (
    <Card className={cn("overflow-hidden", item.status === "pending" || item.status === "claimed" ? "border-amber-200/60" : "")}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {RUBRIC_LABEL[item.rubric_id] ?? item.rubric_id}
            </p>
            <p className="text-sm font-semibold">{item.skill_path_slug}</p>
          </div>
          <StatusBadge status={item.status} />
        </div>

        {(item.status === "pending" || item.status === "claimed") && (
          <p className="text-xs text-muted-foreground">
            {item.status === "pending"
              ? "Waiting for a reviewer to claim your submission."
              : "A reviewer has claimed your submission. Expect a decision within 48 hours."}
          </p>
        )}

        {item.status === "approved" && (
          <div className="flex items-center gap-2 text-xs text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Approved — your credential has been issued.{" "}
            <Link href="/identity" className="underline underline-offset-2">View credentials →</Link>
          </div>
        )}

        {item.status === "rejected" && (
          <div className="text-xs text-destructive space-y-1">
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              Not approved.
            </div>
            {item.verdict_notes && (
              <p className="text-muted-foreground pl-5">{item.verdict_notes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Tab = "queue" | "reviewing" | "submissions";

export default function ReviewQueuePage() {
  const { session, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("queue");

  const { data: openQueue = [], isLoading: queueLoading } = useQuery({
    queryKey: ["prq-open"],
    queryFn: () => api.peerReview.listQueue(),
    enabled: !!session,
    refetchInterval: 30_000,
  });

  const { data: myClaims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ["prq-claims"],
    queryFn: () => api.peerReview.myClaims(),
    enabled: !!session,
  });

  const { data: mySubmissions = [], isLoading: subsLoading } = useQuery({
    queryKey: ["prq-my-items"],
    queryFn: () => api.peerReview.myItems(),
    enabled: !!session,
  });

  const { data: reputation } = useQuery({
    queryKey: ["prq-reputation"],
    queryFn: () => api.peerReview.myReputation(),
    enabled: !!session,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-muted-foreground text-sm mb-4">Sign in to access the peer review queue.</p>
        <Link href="/login?next=/review-queue">
          <Button size="sm" className="gap-1.5">Sign in <ArrowRight className="h-3.5 w-3.5" /></Button>
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "queue",       label: "Open queue",     count: openQueue.length },
    { id: "reviewing",   label: "My reviews",     count: myClaims.length },
    { id: "submissions", label: "My submissions", count: mySubmissions.length },
  ];

  const isLoading =
    tab === "queue"       ? queueLoading :
    tab === "reviewing"   ? claimsLoading :
    subsLoading;

  return (
    <main className="px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">Human review</p>
        <h1 className="text-3xl font-extrabold">Review queue</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
          Translation submissions that passed AI grading await human verification before
          a credential is issued. Claim an item and submit a verdict within 48 hours.
        </p>
      </div>

      {/* Reviewer reputation */}
      {reputation && reputation.reviews_completed > 0 && (
        <div className="mb-6 rounded-xl border bg-card p-4 flex items-center gap-5">
          <Star className="h-5 w-5 text-primary shrink-0" />
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="font-bold">{reputation.reviews_completed}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="font-bold text-green-700">{reputation.reviews_approved}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rejected</p>
              <p className="font-bold text-destructive">{reputation.reviews_rejected}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {tab === "queue" && (
            openQueue.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                No submissions awaiting review right now. Check back later.
              </div>
            ) : (
              <div className="space-y-3">
                {openQueue.map((item) => (
                  <ClaimableCard key={item.id} item={item} />
                ))}
              </div>
            )
          )}

          {tab === "reviewing" && (
            myClaims.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                You haven&apos;t claimed any reviews yet.{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2"
                  onClick={() => setTab("queue")}
                >
                  Browse the open queue →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myClaims.map((item) => (
                  <VerdictCard key={item.id} item={item} />
                ))}
              </div>
            )
          )}

          {tab === "submissions" && (
            mySubmissions.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                None of your submissions are currently in the review queue.
              </div>
            ) : (
              <div className="space-y-3">
                {mySubmissions.map((item) => (
                  <SubmissionStatusCard key={item.id} item={item} />
                ))}
              </div>
            )
          )}
        </>
      )}
    </main>
  );
}
