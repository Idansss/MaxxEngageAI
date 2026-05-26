"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Clock, Award, ArrowRight, Loader2, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle,
} from "lucide-react";

const PAGE_SIZE = 20;

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    ai_reviewed:           { label: "Reviewed",       className: "bg-primary/10 text-primary" },
    pending_ai_review:     { label: "In review",      className: "bg-yellow-100 text-yellow-700" },
    pending_human_review:  { label: "Human review",   className: "bg-amber-100 text-amber-700" },
    human_reviewed:        { label: "Human reviewed", className: "bg-green-100 text-green-700" },
    appealed:              { label: "Appealed",        className: "bg-purple-100 text-purple-700" },
    final:                 { label: "Final",           className: "bg-muted text-muted-foreground" },
  };
  const v = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={cn("text-xs", v.className)}>{v.label}</Badge>;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-gold";
  return "text-destructive";
}

function domainDot(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology",
    design: "stripe-design",
    data: "stripe-data",
    writing: "stripe-writing",
    business: "stripe-business",
  };
  return map[domain] ?? "bg-muted-foreground/40";
}

export default function SubmissionsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-submissions", page],
    queryFn: () => api.submissions.my(PAGE_SIZE, page * PAGE_SIZE),
    enabled: !!session,
  });

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">

      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">History</p>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <Clock className="h-6 w-6 text-muted-foreground" />
            Submission history
          </h1>
          {!isLoading && (
            <p className="text-muted-foreground text-sm mt-1">
              {total} submission{total !== 1 ? "s" : ""} total
            </p>
          )}
        </div>
        <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "gap-1.5 shrink-0")}>
          New assessment <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

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
            <p className="text-muted-foreground text-sm mb-4">No submissions yet.</p>
            <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              Take your first assessment
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="card-hover overflow-hidden">
                {/* Domain top stripe */}
                <div className={cn("h-0.5 w-full", domainDot(item.domain))} />
                <CardContent className="py-4 px-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {item.skill_path_name}
                            <span className="text-muted-foreground font-normal"> — Level {item.level}</span>
                          </p>
                          {item.task_title && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.task_title}</p>
                          )}
                        </div>
                        {item.score !== null && (
                          <span className={cn("text-xl font-black shrink-0", scoreColor(item.score))}>
                            {item.score.toFixed(0)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        {statusBadge(item.status)}

                        {item.credential_eligible && (
                          <span className="inline-flex items-center gap-1 text-xs text-success bg-success-bg rounded-full px-2 py-0.5">
                            <CheckCircle className="h-3 w-3" /> Credential eligible
                          </span>
                        )}
                        {item.human_review_requested && (
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

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>
                          {new Date(item.submitted_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                        {item.attempt_number > 1 && <span>Attempt #{item.attempt_number}</span>}
                        <span className="capitalize">{item.task_type}</span>
                      </div>
                    </div>

                    {item.review_id && (
                      <Link
                        href={`/results/${item.review_id}?score=${item.score ?? 0}&passed=${(item.score ?? 0) >= 70}&credential=${item.credential_id ?? ""}&submission=${item.id}`}
                        className="shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                        title="View results"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
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
