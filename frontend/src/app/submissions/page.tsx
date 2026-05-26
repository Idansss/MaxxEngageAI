"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Clock, Award, ArrowRight, Loader2, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, ShieldCheck,
} from "lucide-react";

const PAGE_SIZE = 20;

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    ai_reviewed:           { label: "Reviewed",       className: "bg-blue-100 text-blue-700" },
    pending_ai_review:     { label: "In review",      className: "bg-yellow-100 text-yellow-700" },
    pending_human_review:  { label: "Human review",   className: "bg-amber-100 text-amber-700" },
    human_reviewed:        { label: "Human reviewed", className: "bg-green-100 text-green-700" },
    appealed:              { label: "Appealed",        className: "bg-purple-100 text-purple-700" },
    final:                 { label: "Final",           className: "bg-gray-100 text-gray-700" },
  };
  const v = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return <Badge className={cn("text-xs", v.className)}>{v.label}</Badge>;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function domainDot(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-blue-500",
    design: "bg-purple-500",
    data: "bg-green-500",
    writing: "bg-yellow-500",
    business: "bg-orange-500",
  };
  return map[domain] ?? "bg-gray-400";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-muted-foreground" />
              Submission history
            </h1>
            {!isLoading && (
              <p className="text-muted-foreground text-sm mt-1">
                {total} submission{total !== 1 ? "s" : ""} total
              </p>
            )}
          </div>
          <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            New assessment <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No submissions yet.</p>
              <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                Take your first assessment
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <Card key={item.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-4">
                      {/* Domain dot */}
                      <div className={cn("h-2.5 w-2.5 rounded-full mt-1.5 shrink-0", domainDot(item.domain))} />

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.skill_path_name}
                              <span className="text-muted-foreground font-normal"> — Level {item.level}</span>
                            </p>
                            {item.task_title && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.task_title}</p>
                            )}
                          </div>

                          {/* Score */}
                          {item.score !== null && (
                            <span className={cn("text-xl font-bold shrink-0", scoreColor(item.score))}>
                              {item.score.toFixed(0)}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {statusBadge(item.status)}

                          {item.credential_eligible && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 rounded-full px-2 py-0.5">
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
                              className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 hover:bg-blue-100 transition-colors"
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
                          {item.attempt_number > 1 && (
                            <span>Attempt #{item.attempt_number}</span>
                          )}
                          <span className="capitalize">{item.task_type}</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      {item.review_id && (
                        <Link
                          href={`/results/${item.review_id}?score=${item.score ?? 0}&passed=${(item.score ?? 0) >= 70}&credential=${item.credential_id ?? ""}&submission=${item.id}`}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
