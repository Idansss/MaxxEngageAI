"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, type LeaderboardItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Trophy, ShieldCheck, ChevronLeft, ChevronRight,
  Loader2, Award, ExternalLink,
} from "lucide-react";

const PAGE_SIZE = 50;

const DOMAINS = [
  { label: "All", value: "" },
  { label: "Technology", value: "technology" },
  { label: "Design", value: "design" },
  { label: "Data", value: "data" },
  { label: "Writing", value: "writing" },
  { label: "Business", value: "business" },
  { label: "Ops", value: "ops" },
  { label: "Science", value: "science" },
] as const;

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
  return map[domain] ?? "bg-muted-foreground/30";
}

function domainColor(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-primary/10 text-primary",
    design:     "bg-violet-100 text-violet-700",
    data:       "bg-emerald-100 text-emerald-700",
    writing:    "bg-amber-100 text-amber-700",
    business:   "bg-orange-100 text-orange-700",
    ops:        "bg-slate-100 text-slate-700",
    science:    "bg-teal-100 text-teal-700",
  };
  return map[domain] ?? "bg-muted text-muted-foreground";
}

function scoreColor(score: number) {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-primary";
  return "text-gold";
}

function rankMedal(rank: number) {
  if (rank === 1) return <span className="text-lg" title="1st place">🥇</span>;
  if (rank === 2) return <span className="text-lg" title="2nd place">🥈</span>;
  if (rank === 3) return <span className="text-lg" title="3rd place">🥉</span>;
  return (
    <span className="text-sm font-bold text-muted-foreground tabular-nums w-8 text-center">
      #{rank}
    </span>
  );
}

function percentileBand(p: number): string {
  if (p >= 95) return "Top 5%";
  if (p >= 90) return "Top 10%";
  if (p >= 75) return "Top 25%";
  if (p >= 50) return "Top 50%";
  return "";
}

function LeaderboardRow({ item, isMe }: { item: LeaderboardItem; isMe: boolean }) {
  const band = item.percentile != null ? percentileBand(item.percentile) : "";

  return (
    <div className={cn(
      "flex items-center gap-4 px-4 py-3.5 border-b last:border-0 hover:bg-muted/30 transition-colors",
      isMe && "bg-primary/5 hover:bg-primary/8"
    )}>
      {/* Rank */}
      <div className="w-10 flex items-center justify-center shrink-0">
        {rankMedal(item.rank)}
      </div>

      {/* Domain stripe + name */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className={cn("w-1 h-10 rounded-full shrink-0", domainStripe(item.domain))} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {item.display_name}
              {isMe && <span className="ml-1.5 text-xs text-primary font-normal">(you)</span>}
            </span>
            {item.country_code && (
              <span className="text-xs text-muted-foreground shrink-0">{item.country_code}</span>
            )}
          </div>
          {item.username && (
            <Link
              href={`/u/${item.username}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-0.5"
            >
              @{item.username}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", domainColor(item.domain))}>
              {item.skill_path_name}
            </Badge>
            <span className="text-[10px] text-muted-foreground">Lv.{item.level}</span>
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {item.verified_by_human && (
          <Badge variant="secondary" className="text-[10px] bg-success-bg text-success gap-0.5 px-1.5 py-0">
            <ShieldCheck className="h-2.5 w-2.5" /> Human
          </Badge>
        )}
        {band && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            {band}
          </Badge>
        )}
      </div>

      {/* Score */}
      <div className="shrink-0 text-right">
        <span className={cn("text-xl font-black", scoreColor(item.score))}>
          {item.score.toFixed(0)}
        </span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>

      {/* View credential link */}
      <Link
        href={`/credentials/${item.credential_id}`}
        className="shrink-0 w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        title="View credential"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [domain, setDomain] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", domain, page],
    queryFn: () => api.leaderboard.get({
      domain: domain || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleDomainChange(val: string) {
    setDomain(val);
    setPage(0);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Rankings</p>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <Trophy className="h-7 w-7 text-gold" />
          Leaderboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1.5 max-w-lg leading-relaxed">
          Top scores across all skill assessments. Each person appears once per skill — their best result.
        </p>
      </div>

      {/* Domain filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {DOMAINS.map((d) => (
          <button
            key={d.value}
            type="button"
            onClick={() => handleDomainChange(d.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all border",
              domain === d.value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {!isLoading && total > 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          {total} credential{total !== 1 ? "s" : ""} on the board
          {domain ? ` · ${domain} domain` : ""}
        </p>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Column headers */}
        <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/40">
          <div className="w-10 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Rank
          </div>
          <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Learner
          </div>
          <div className="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            Badges
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            Score
          </div>
          <div className="w-7" />
        </div>

        {isLoading ? (
          <CardContent className="py-20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        ) : items.length === 0 ? (
          <CardContent className="py-20 text-center">
            <Award className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No public credentials yet in this category.</p>
          </CardContent>
        ) : (
          <div>
            {items.map((item) => (
              <LeaderboardRow
                key={item.credential_id}
                item={item}
                isMe={!!profile?.id && item.username === profile?.username}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
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
    </main>
  );
}
