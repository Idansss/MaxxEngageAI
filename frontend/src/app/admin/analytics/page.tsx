"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type AdminAnalytics } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart3,
  Globe,
  Loader2,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Submission volume chart ───────────────────────────────────────────────────

function VolumeChart({ data }: { data: AdminAnalytics["submissions_by_day"] }) {
  const last14 = data.slice(-14);
  const max = Math.max(...last14.map((d) => d.total), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-36">
        {last14.map((d) => {
          const totalPct = Math.round((d.total / max) * 100);
          const passPct = d.total > 0 ? Math.round((d.passed / d.total) * 100) : 0;
          const label = d.date.slice(5); // MM-DD
          return (
            <div
              key={d.date}
              className="group relative flex-1 flex flex-col justify-end"
              title={`${d.date}: ${d.total} submissions, ${d.passed} passed`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-popover border shadow-md rounded-md px-2 py-1 text-[10px] whitespace-nowrap">
                  <p className="font-semibold">{d.date.slice(5)}</p>
                  <p>{d.total} total</p>
                  <p className="text-primary">{d.passed} passed</p>
                </div>
                <div className="w-1.5 h-1.5 bg-popover border-b border-r rotate-45 -mt-1" />
              </div>

              {/* Bar */}
              <div
                className="relative w-full rounded-t-sm bg-primary/15 min-h-[3px]"
                style={{ height: `${totalPct}%` }}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-sm bg-primary"
                  style={{ height: `${passPct}%` }}
                />
              </div>

              {/* Date label — show only every other */}
              {last14.indexOf(d) % 2 === 0 && (
                <p className="text-[9px] text-muted-foreground text-center mt-1 truncate">{label}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary/15" /> Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary" /> Passed (credential eligible)
        </span>
      </div>
    </div>
  );
}

// ── Pass rate bars ─────────────────────────────────────────────────────────────

function PassRateChart({ data }: { data: AdminAnalytics["pass_rate_by_path"] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No submissions in the last 30 days.</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((row) => {
        const pct = Math.round(row.pass_rate * 100);
        const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
        return (
          <div key={row.slug}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <p className="text-sm font-medium truncate flex-1">{row.name}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {row.passed}/{row.total} ({pct}%)
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top countries ─────────────────────────────────────────────────────────────

function CountryChart({ data }: { data: AdminAnalytics["top_countries"] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No data yet.</p>;
  }

  const max = data[0].submission_count;
  return (
    <div className="space-y-3">
      {data.map((row) => {
        const pct = Math.round((row.submission_count / max) * 100);
        return (
          <div key={row.country_code}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <p className="text-sm font-medium">{row.country_code}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {row.submission_count} submissions · {row.user_count} users
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/admin/analytics");
  }, [loading, session, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api.admin.analytics(),
    enabled: !!session,
    refetchInterval: 60_000,
  });

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Admin
            </Link>
            <span className="text-muted-foreground">/</span>
            <Badge variant="secondary">Analytics</Badge>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Platform Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Last 30 days · auto-refreshes every minute</p>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <p className="font-medium">Admin access required</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load analytics."}
            </p>
          </CardContent>
        </Card>
      ) : isLoading || !data ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stat pills */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="Submissions (30d)"
              value={data.totals.submissions_30d}
            />
            <StatCard
              icon={<Award className="h-4 w-4" />}
              label="Credentials issued (30d)"
              value={data.totals.credentials_30d}
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Active users (30d)"
              value={data.totals.active_users_30d}
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Queue depth"
              value={data.totals.queue_depth}
              sub="awaiting human review"
            />
          </div>

          {/* Volume chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Submission volume — last 14 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VolumeChart data={data.submissions_by_day} />
            </CardContent>
          </Card>

          {/* Pass rate + countries — 2 col */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Award className="h-4 w-4 text-emerald-600" /> Pass rate by skill path
                </CardTitle>
                <p className="text-xs text-muted-foreground">Credential-eligible / total submissions</p>
              </CardHeader>
              <CardContent>
                <PassRateChart data={data.pass_rate_by_path} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-600" /> Top countries
                </CardTitle>
                <p className="text-xs text-muted-foreground">By submission volume</p>
              </CardHeader>
              <CardContent>
                <CountryChart data={data.top_countries} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
