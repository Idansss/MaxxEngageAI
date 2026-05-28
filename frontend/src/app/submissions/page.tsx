"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api, type SubmissionHistoryItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertCircle, ArrowRight, Award, CheckCircle, ChevronLeft, ChevronRight,
  Clock, Loader2, RefreshCw, Send,
} from "lucide-react";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { key: "all",     label: "All" },
  { key: "passed",  label: "Passed" },
  { key: "pending", label: "Pending" },
  { key: "appealed",label: "Appealed" },
] as const;

type FilterKey = typeof STATUS_FILTERS[number]["key"];

const APPEALABLE = new Set(["ai_reviewed", "pending_human_review"]);

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function matchesFilter(item: SubmissionHistoryItem, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "passed") return (item.score ?? 0) >= 70 && item.credential_eligible;
  if (filter === "pending") return item.status === "pending_human_review" || item.status === "pending_ai_review";
  if (filter === "appealed") return item.status === "appealed";
  return true;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    ai_reviewed:           { label: "AI reviewed",     cls: "bg-primary/10 text-primary" },
    pending_ai_review:     { label: "In review",       cls: "bg-yellow-100 text-yellow-700" },
    pending_human_review:  { label: "Human review",    cls: "bg-amber-100 text-amber-700" },
    human_reviewed:        { label: "Human reviewed",  cls: "bg-green-100 text-green-700" },
    appealed:              { label: "Appealed",         cls: "bg-purple-100 text-purple-700" },
    final:                 { label: "Final",            cls: "bg-muted text-muted-foreground" },
  };
  const v = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <Badge className={cn("text-xs shrink-0", v.cls)}>{v.label}</Badge>;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-gold";
  return "text-destructive";
}

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
  return map[domain] ?? "bg-muted-foreground/40";
}

// â”€â”€ Appeal inline form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AppealForm({ submissionId, onDone }: { submissionId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 20) {
      setError("Please write at least 20 characters explaining why you're appealing.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.submissions.appeal(submissionId, reason.trim());
      onDone();
    } catch {
      setError("Failed to submit appeal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Why should this score be reviewed?</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explain why you believe this score is incorrect (min 20 characters)…"
        rows={3}
        className="w-full text-xs rounded-lg border bg-background p-2.5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-shadow"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={submit}
          disabled={submitting}
          className="gap-1.5 text-xs h-7"
        >
          {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Submit appeal
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Submission card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SubmissionCard({ item }: { item: SubmissionHistoryItem }) {
  const queryClient = useQueryClient();
  const [appealing, setAppealing] = useState(false);

  const canAppeal = APPEALABLE.has(item.status);

  function handleAppealDone() {
    setAppealing(false);
    queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
  }

  const resultsHref = item.review_id
    ? `/results/${item.review_id}?score=${item.score ?? 0}&passed=${(item.score ?? 0) >= 70}&credential=${item.credential_id ?? ""}&submission=${item.id}&path=${item.skill_path_slug}`
    : null;

  return (
    <Card className="overflow-hidden">
      <div className={cn("h-0.5 w-full", domainStripe(item.domain))} />
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">

            {/* Top row: path + level + score */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {item.skill_path_name}
                  <span className="text-muted-foreground font-normal"> · Level {item.level}</span>
                </p>
                {item.task_title && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.task_title}</p>
                )}
              </div>
              {item.score !== null && (
                <span className={cn("text-xl font-black tabular-nums shrink-0", scoreColor(item.score))}>
                  {item.score.toFixed(0)}
                </span>
              )}
            </div>

            {/* Status + badges row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {statusBadge(item.status)}

              {item.credential_eligible && (
                <span className="inline-flex items-center gap-1 text-xs text-success bg-success-bg rounded-full px-2 py-0.5">
                  <CheckCircle className="h-3 w-3" /> Credential eligible
                </span>
              )}
              {item.human_review_requested && item.status !== "appealed" && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                  <AlertCircle className="h-3 w-3" /> Needs human review
                </span>
              )}
              {item.credential_id && (
                <Link
                  href={`/credentials/${item.credential_id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary bg-primary/8 rounded-full px-2 py-0.5 hover:bg-primary/12 transition-colors"
                >
                  <Award className="h-3 w-3" /> View credential
                </Link>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
              <span>
                {new Date(item.submitted_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </span>
              {item.attempt_number > 1 && <span>Attempt #{item.attempt_number}</span>}
              <span className="capitalize">{item.task_type}</span>
            </div>

            {/* Action links */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {resultsHref && (
                <Link
                  href={resultsHref}
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline underline-offset-2"
                >
                  View feedback <ArrowRight className="h-3 w-3" />
                </Link>
              )}
              <Link
                href={`/assess/${item.skill_path_slug}?level=${item.level}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </Link>
              {canAppeal && !appealing && (
                <button
                  type="button"
                  onClick={() => setAppealing(true)}
                  className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 transition-colors"
                >
                  <AlertCircle className="h-3 w-3" /> Appeal score
                </button>
              )}
            </div>

            {/* Appeal form */}
            {appealing && (
              <AppealForm submissionId={item.id} onDone={handleAppealDone} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SubmissionsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-submissions", page],
    queryFn: () => api.submissions.my(PAGE_SIZE, page * PAGE_SIZE),
    enabled: !!session,
  });

  const resetPage = useCallback(() => setPage(0), []);

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const allItems = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const items = allItems.filter((i) => matchesFilter(i, filter));

  return (
    <main className="max-w-4xl px-6 py-10">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">History</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <Clock className="h-6 w-6 text-muted-foreground" />
            Submissions
          </h1>
          {!isLoading && (
            <p className="text-muted-foreground text-sm mt-1">
              {total} submission{total !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "gap-1.5 shrink-0 mt-1")}>
          New assessment <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setFilter(f.key); resetPage(); }}
            className={cn(
              "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
              filter === f.key
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Clock className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              {filter === "all" ? "No submissions yet." : `No ${filter} submissions.`}
            </p>
            {filter !== "all" ? (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="text-xs text-primary hover:underline underline-offset-2"
              >
                View all
              </button>
            ) : (
              <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                Take your first assessment
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <SubmissionCard key={item.id} item={item} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
