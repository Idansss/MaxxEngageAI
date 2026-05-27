"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type AdminQueueItem } from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  Loader2, ShieldAlert, Award, User, Clock, MessageSquare
} from "lucide-react";

// ── Queue item card ───────────────────────────────────────────────────────────

function QueueCard({ item, onDecide }: {
  item: AdminQueueItem;
  onDecide: (id: string, d: "approve" | "reject", note: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  const scoreColor = item.overall_score >= 70
    ? "text-green-600"
    : item.overall_score >= 55
    ? "text-amber-600"
    : "text-red-600";
  const submittedAt = new Date(item.submitted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{item.skill_path_name}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{item.display_name} ({item.country_code})</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{submittedAt}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className={`text-2xl font-bold ${scoreColor}`}>{item.overall_score.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">confidence {(item.confidence * 100).toFixed(0)}%</p>
            </div>
            <div className="flex flex-col gap-1">
              {item.submission_status === "appealed" && (
                <Badge className="text-xs bg-orange-100 text-orange-700 border-orange-300 gap-1">
                  <MessageSquare className="h-3 w-3" /> Appeal
                </Badge>
              )}
              {item.credential_issued && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Award className="h-3 w-3" />
                  {item.credential_verified_by_human ? "Verified" : "Credential issued"}
                </Badge>
              )}
              {item.credential_eligible && !item.credential_issued && (
                <Badge className="text-xs bg-blue-100 text-blue-700">Eligible for credential</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {item.submission_status === "appealed" && item.appeal_reason && (
          <div className="rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-orange-700 mb-1 flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" /> Learner&apos;s appeal
            </p>
            <p className="text-sm text-orange-900">{item.appeal_reason}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">{item.feedback.summary}</p>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide" : "Show"} submission + AI reasoning
        </button>

        {expanded && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Submission ({item.submission_content.type})
              </p>
              <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-64 font-mono whitespace-pre-wrap break-all">
                {item.submission_content.body}
              </pre>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Dimension scores
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {item.scores.map((s) => (
                  <div key={s.dimension} className="rounded-md border p-2.5 text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium">{s.dimension}</span>
                      <span className="font-mono text-muted-foreground">{s.score}/{s.max_score}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.rationale}</p>
                    {s.evidence_quotes.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {s.evidence_quotes.map((q, i) => (
                          <li key={i} className="text-xs italic text-muted-foreground truncate">&ldquo;{q}&rdquo;</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1">Strengths</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  {item.feedback.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Improvements needed</p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  {item.feedback.improvements.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {confirming ? (
          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">
              {confirming === "approve" ? "Approve this submission?" : "Reject this submission?"}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={confirming === "approve" ? "Optional note for the record" : "Reason for rejection (shown in logs)"}
              className="w-full text-sm rounded-md border px-3 py-2 resize-none h-16 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={confirming === "approve" ? "default" : "destructive"}
                onClick={() => { onDecide(item.review_id, confirming, note); setConfirming(null); }}
              >
                Confirm {confirming}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 border-t pt-3">
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => setConfirming("approve")}>
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setConfirming("reject")}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
            <Link
              href={`/profile/${item.user_id}`}
              className="text-xs text-muted-foreground hover:text-foreground ml-auto self-center"
            >
              View profile →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminQueuePage() {
  const { session, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading, error } = useQuery({
    queryKey: ["admin-queue"],
    queryFn: () => api.admin.queue(),
    enabled: !!session,
    refetchInterval: 30_000,
  });

  const { mutate: decide, isPending: deciding } = useMutation({
    mutationFn: ({ reviewId, decision, note }: { reviewId: string; decision: "approve" | "reject"; note: string }) =>
      api.admin.decide(reviewId, decision, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-queue"] }),
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Sign in required.</p>
        <Link href="/login?next=/admin/queue" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-amber-500" />
              Human Review Queue
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Submissions the AI flagged for human judgement. Approve to verify the credential; reject to decline.
            </p>
          </div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            Admin dashboard
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load queue. Are you an admin?"}
            </CardContent>
          </Card>
        ) : queue.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <p className="font-medium">Queue is empty</p>
              <p className="text-sm text-muted-foreground mt-1">No submissions pending human review right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{queue.length} submission{queue.length !== 1 ? "s" : ""} pending</p>
            {queue.map((item) => (
              <QueueCard
                key={item.review_id}
                item={item}
                onDecide={(reviewId, decision, note) => decide({ reviewId, decision, note })}
              />
            ))}
          </div>
        )}

        {deciding && (
          <div className="fixed bottom-4 right-4 bg-white border shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Saving decision…
          </div>
        )}
      </main>
    </div>
  );
}
