"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

export default function AdminHomePage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/admin");
  }, [loading, session, router]);

  const {
    data: queue = [],
    isLoading: queueLoading,
    error: queueError,
    dataUpdatedAt: queueUpdatedAt,
  } = useQuery({
    queryKey: ["admin-queue"],
    queryFn: () => api.admin.queue(),
    enabled: !!session,
    refetchInterval: 30_000,
  });

  const {
    data: calibration = [],
    isLoading: calibrationLoading,
  } = useQuery({
    queryKey: ["admin-calibration-latest"],
    queryFn: () => api.admin.calibrationLatest(),
    enabled: !!session && !queueError,
  });

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const appealed = queue.filter((item) => item.submission_status === "appealed").length;
  const credentialEligible = queue.filter((item) => item.credential_eligible && !item.credential_issued).length;
  const oldestQueueItem = queue
    .map((item) => new Date(item.submitted_at).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const oldestAgeHours = oldestQueueItem
    ? Math.max(0, Math.round(((queueUpdatedAt - oldestQueueItem) / 3_600_000) * 10) / 10)
    : 0;
  const redCalibration = calibration.filter((item) => item.health === "red").length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Admin</Badge>
            <h1 className="text-2xl font-bold">Review operations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Triage human review, appeals, and scoring health from one place.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/admin/analytics" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
              <TrendingUp className="h-3.5 w-3.5" /> Analytics
            </Link>
            <Link href="/admin/queue" className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
              Open queue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {queueError ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
              <p className="font-medium">Admin access required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {queueError instanceof Error ? queueError.message : "Failed to load admin stats."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Clock className="h-5 w-5 text-amber-600" />}
                label="Pending review"
                value={queueLoading ? "..." : String(queue.length)}
                helper={`${oldestAgeHours}h oldest`}
              />
              <StatCard
                icon={<MessageSquare className="h-5 w-5 text-orange-600" />}
                label="Appeals"
                value={queueLoading ? "..." : String(appealed)}
                helper="needs human answer"
              />
              <StatCard
                icon={<CheckCircle className="h-5 w-5 text-green-600" />}
                label="Eligible"
                value={queueLoading ? "..." : String(credentialEligible)}
                helper="can issue credentials"
              />
              <StatCard
                icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
                label="Calibration red"
                value={calibrationLoading ? "..." : String(redCalibration)}
                helper="requires rubric review"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Queue snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {queueLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : queue.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No submissions pending human review.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {queue.slice(0, 5).map((item) => (
                        <div key={item.review_id} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.skill_path_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.display_name} - score {item.overall_score.toFixed(0)} - confidence {(item.confidence * 100).toFixed(0)}%
                              </p>
                            </div>
                            {item.submission_status === "appealed" && (
                              <Badge className="bg-orange-100 text-orange-700">Appeal</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    Calibration health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {calibrationLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : calibration.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No calibration runs ingested yet.
                    </p>
                  ) : (
                    <div className="divide-y">
                      {calibration.slice(0, 5).map((item) => (
                        <div key={`${item.run_id}-${item.skill_path_slug}-${item.level}`} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {item.skill_path_slug} level {item.level}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                MAE {item.mae ?? "n/a"} - in range {item.in_range_rate === null ? "n/a" : `${Math.round(item.in_range_rate * 100)}%`}
                              </p>
                            </div>
                            <Badge className={healthClass(item.health)}>{item.health.replaceAll("_", " ")}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function healthClass(health: string) {
  if (health === "green") return "bg-green-100 text-green-700";
  if (health === "yellow") return "bg-amber-100 text-amber-700";
  if (health === "red") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
}
