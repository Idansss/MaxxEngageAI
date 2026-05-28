"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, type TalentProfile, type TalentCredential } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Bookmark, BookmarkCheck, Briefcase, ChevronLeft, ChevronRight, Download,
  ExternalLink, Loader2, Search, ShieldCheck, Trash2, UserCircle, X,
} from "lucide-react";

const PAGE_SIZE = 20;
const SHORTLIST_KEY = "employer_shortlist";

const DOMAINS = [
  { label: "All domains", value: "" },
  { label: "Technology", value: "technology" },
  { label: "Design", value: "design" },
  { label: "Data", value: "data" },
  { label: "Writing", value: "writing" },
  { label: "Business", value: "business" },
  { label: "Ops", value: "ops" },
  { label: "Science", value: "science" },
] as const;

const COUNTRIES = [
  { label: "All countries", value: "" },
  { label: "Nigeria", value: "NG" },
  { label: "Ghana", value: "GH" },
  { label: "Kenya", value: "KE" },
  { label: "South Africa", value: "ZA" },
  { label: "Ethiopia", value: "ET" },
  { label: "Egypt", value: "EG" },
  { label: "Tanzania", value: "TZ" },
  { label: "Rwanda", value: "RW" },
  { label: "Uganda", value: "UG" },
  { label: "Senegal", value: "SN" },
] as const;

// â”€â”€ Shortlist persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ShortlistEntry {
  user_id: string;
  display_name: string;
  username: string;
  country_code: string | null;
  top_score: number;
  credential_count: number;
  domains: string[];
  avatar_url: string | null;
  saved_at: string;
}

function loadShortlist(): ShortlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveShortlist(list: ShortlistEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(list));
}

function useShortlist() {
  const [list, setList] = useState<ShortlistEntry[]>(loadShortlist);

  const add = useCallback((profile: TalentProfile) => {
    setList((prev) => {
      if (prev.some((e) => e.user_id === profile.user_id)) return prev;
      const next = [...prev, {
        user_id: profile.user_id,
        display_name: profile.display_name,
        username: profile.username,
        country_code: profile.country_code,
        top_score: profile.top_score,
        credential_count: profile.credential_count,
        domains: profile.domains,
        avatar_url: profile.avatar_url,
        saved_at: new Date().toISOString(),
      }];
      saveShortlist(next);
      return next;
    });
  }, []);

  const remove = useCallback((userId: string) => {
    setList((prev) => {
      const next = prev.filter((e) => e.user_id !== userId);
      saveShortlist(next);
      return next;
    });
  }, []);

  const has = useCallback((userId: string) => list.some((e) => e.user_id === userId), [list]);

  const clear = useCallback(() => {
    saveShortlist([]);
    setList([]);
  }, []);

  return { list, add, remove, has, clear };
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maxx-engage-ai.vercel.app";

function exportCsv(list: ShortlistEntry[]) {
  const header = ["Name", "Username", "Profile URL", "Country", "Top Score", "Credentials", "Domains", "Saved At"];
  const rows = list.map((e) => [
    e.display_name,
    `@${e.username}`,
    `${SITE}/u/${e.username}`,
    e.country_code ?? "",
    String(Math.round(e.top_score)),
    String(e.credential_count),
    e.domains.join("|"),
    new Date(e.saved_at).toLocaleDateString("en-GB"),
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "maxx-engage-shortlist.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// â”€â”€ Avatar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Avatar({ name, avatar_url, size = "md" }: { name: string; avatar_url: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-8 w-8 text-xs" : "h-12 w-12 text-sm";
  return (
    <div className={cn(dim, "rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden text-primary font-bold")}>
      {avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name) || <UserCircle className="h-5 w-5" />
      )}
    </div>
  );
}

// â”€â”€ Talent card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TalentCard({
  profile,
  saved,
  onSave,
  onRemove,
}: {
  profile: TalentProfile;
  saved: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={profile.display_name} avatar_url={profile.avatar_url} />

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-snug truncate">{profile.display_name}</p>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            {profile.country_code && (
              <p className="text-xs text-muted-foreground">{profile.country_code}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={cn("text-2xl font-black leading-none", scoreColor(profile.top_score))}>
              {profile.top_score.toFixed(0)}
            </span>
            <p className="text-[10px] text-muted-foreground">top score</p>
          </div>
        </div>

        {profile.bio && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {profile.bio}
          </p>
        )}

        {profile.top_credentials.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {profile.top_credentials.map((cred: TalentCredential) => (
              <div key={cred.credential_id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 shrink-0", domainColor(cred.domain))}>
                    {cred.domain}
                  </Badge>
                  <span className="text-xs text-muted-foreground truncate">{cred.skill_path_name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cred.verified_by_human && (
                    <span title="Human verified" aria-label="Human verified">
                      <ShieldCheck className="h-3 w-3 text-success" aria-hidden="true" />
                    </span>
                  )}
                  <span className={cn("text-xs font-bold tabular-nums", scoreColor(cred.score))}>
                    {cred.score.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t gap-2">
          <p className="text-[10px] text-muted-foreground">
            {profile.credential_count} credential{profile.credential_count !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saved ? onRemove : onSave}
              title={saved ? "Remove from shortlist" : "Save to shortlist"}
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded-lg transition-colors",
                saved
                  ? "text-primary bg-primary/10 hover:bg-primary/20"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10"
              )}
            >
              {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
            <Link
              href={`/u/${profile.username}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              View <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// â”€â”€ Shortlist panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ShortlistPanel({
  list,
  onRemove,
  onClear,
}: {
  list: ShortlistEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-20 text-center">
          <Bookmark className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No candidates saved yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click the bookmark icon on any profile to add them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{list.length} saved candidate{list.length !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCsv(list)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {list.map((entry) => (
          <Card key={entry.user_id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Avatar name={entry.display_name} avatar_url={entry.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{entry.display_name}</p>
                    {entry.country_code && (
                      <span className="text-xs text-muted-foreground shrink-0">{entry.country_code}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {entry.domains.map((d) => (
                      <Badge key={d} variant="secondary" className={cn("text-[10px] px-1.5 py-0", domainColor(d))}>
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                <span className={cn("text-lg font-black tabular-nums shrink-0", scoreColor(entry.top_score))}>
                  {Math.round(entry.top_score)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/u/${entry.username}`}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="View profile"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.user_id)}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Filter bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Filters {
  q: string;
  domain: string;
  country: string;
  minScore: string;
}

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const hasFilters = filters.q || filters.domain || filters.country || filters.minScore;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Name search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Name or username…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          className="text-sm border border-border rounded-lg pl-8 pr-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-44 transition-shadow"
        />
      </div>

      <select
        value={filters.domain}
        onChange={(e) => onChange({ ...filters, domain: e.target.value })}
        className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {DOMAINS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>

      <select
        value={filters.country}
        onChange={(e) => onChange({ ...filters, country: e.target.value })}
        className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {COUNTRIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      <input
        type="number"
        min={0}
        max={100}
        step={5}
        value={filters.minScore}
        onChange={(e) => onChange({ ...filters, minScore: e.target.value })}
        placeholder="Min score"
        className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-28"
      />

      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange({ q: "", domain: "", country: "", minScore: "" })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Tab = "search" | "shortlist";

export default function EmployersPage() {
  const [tab, setTab] = useState<Tab>("search");
  const [filters, setFilters] = useState<Filters>({ q: "", domain: "", country: "", minScore: "" });
  const [page, setPage] = useState(0);
  const shortlist = useShortlist();

  function handleFiltersChange(f: Filters) {
    setFilters(f);
    setPage(0);
  }

  const minScoreNum = filters.minScore ? Number(filters.minScore) : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ["talent-search", filters.q, filters.domain, filters.country, filters.minScore, page],
    queryFn: () => api.talent.search({
      q: filters.q || undefined,
      domain: filters.domain || undefined,
      country_code: filters.country || undefined,
      min_score: minScoreNum,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    placeholderData: (prev) => prev,
    enabled: tab === "search",
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="px-6 py-10">

      {/* Hero */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">For employers</p>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <Briefcase className="h-7 w-7 text-muted-foreground" />
          Find verified talent
        </h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-xl leading-relaxed">
          Every person here has passed an AI-graded skill assessment with a transparent rubric.
          Credentials are cryptographically signed and publicly verifiable.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {[
          { key: "search" as Tab, label: "Search talent" },
          { key: "shortlist" as Tab, label: `Shortlist${shortlist.list.length ? ` (${shortlist.list.length})` : ""}` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "search" ? (
        <>
          <div className="mb-5">
            <FilterBar filters={filters} onChange={handleFiltersChange} />
          </div>

          {!isLoading && (
            <p className="text-xs text-muted-foreground mb-5">
              {total === 0 ? "No results" : `${total} verified professional${total !== 1 ? "s" : ""}`}
              {filters.q ? ` matching "${filters.q}"` : ""}
              {filters.domain ? ` · ${filters.domain}` : ""}
              {filters.country ? ` · ${filters.country}` : ""}
              {filters.minScore ? ` · score ≥ ${filters.minScore}` : ""}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-20 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No verified talent found with these filters.</p>
                <Button variant="ghost" size="sm" className="mt-3"
                  onClick={() => handleFiltersChange({ q: "", domain: "", country: "", minScore: "" })}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((profile) => (
                <TalentCard
                  key={profile.user_id}
                  profile={profile}
                  saved={shortlist.has(profile.user_id)}
                  onSave={() => shortlist.add(profile)}
                  onRemove={() => shortlist.remove(profile.user_id)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-8">
              <button type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <button type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <ShortlistPanel
          list={shortlist.list}
          onRemove={shortlist.remove}
          onClear={shortlist.clear}
        />
      )}

      <div className="mt-12 pt-6 border-t text-xs text-muted-foreground text-center space-y-1">
        <p>Only professionals who have set their proof page to <strong>public</strong> appear here.</p>
        <p>
          Credentials are verified at{" "}
          <Link href="/verify" className="text-primary hover:underline underline-offset-2 font-medium">
            maxx-engage.io/verify
          </Link>
        </p>
      </div>
    </main>
  );
}
