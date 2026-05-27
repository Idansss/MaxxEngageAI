"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Layers, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SkillPath } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Domain helpers ─────────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  technology: "bg-primary/10 text-primary border-primary/30",
  design:     "bg-violet-100 text-violet-700 border-violet-300",
  data:       "bg-emerald-100 text-emerald-700 border-emerald-300",
  writing:    "bg-amber-100 text-amber-700 border-amber-300",
  business:   "bg-orange-100 text-orange-700 border-orange-300",
  ops:        "bg-slate-100 text-slate-700 border-slate-300",
  science:    "bg-teal-100 text-teal-700 border-teal-300",
};

const DOMAIN_STRIPES: Record<string, string> = {
  technology: "stripe-technology",
  design:     "stripe-design",
  data:       "stripe-data",
  writing:    "stripe-writing",
  business:   "stripe-business",
  ops:        "stripe-ops",
  science:    "stripe-science",
};

function domainStripe(d: string) { return DOMAIN_STRIPES[d] ?? "bg-muted-foreground/40"; }
function domainBadge(d: string) { return DOMAIN_COLORS[d] ?? "bg-muted text-muted-foreground border-border"; }

// ── Component ──────────────────────────────────────────────────────────────────

export function SkillPathBrowser({ paths }: { paths: SkillPath[] }) {
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const domains = useMemo(
    () => Array.from(new Set(paths.map((p) => p.domain))).sort(),
    [paths]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return paths.filter((p) => {
      if (activeDomain && p.domain !== activeDomain) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [paths, activeDomain, query]);

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search paths…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 h-9 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
          />
        </div>

        {/* Domain chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveDomain(null)}
            className={cn(
              "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
              activeDomain === null
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
            )}
          >
            All
          </button>
          {domains.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDomain(activeDomain === d ? null : d)}
              className={cn(
                "px-3 py-1 rounded-full border text-xs font-medium capitalize transition-colors",
                activeDomain === d
                  ? domainBadge(d)
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} path{filtered.length !== 1 ? "s" : ""}
        {activeDomain ? ` in ${activeDomain}` : ""}
        {query ? ` matching "${query}"` : ""}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="font-semibold">No paths match</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different domain or clear the search.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setActiveDomain(null); setQuery(""); }}
              className="text-xs text-primary hover:underline underline-offset-2"
            >
              Clear filters
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((path) => (
            <Card key={path.id} className="overflow-hidden p-0 hover:shadow-md transition-shadow">
              <div className={cn("h-1.5 w-full", domainStripe(path.domain))} />
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">{path.name}</CardTitle>
                  <Badge variant="secondary" className={cn("shrink-0 text-xs capitalize", domainBadge(path.domain))}>
                    {path.domain}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pb-5">
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {path.description}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                      <Layers className="h-3.5 w-3.5" />
                      Levels
                    </div>
                    <p className="font-bold text-foreground">{path.levels.length}</p>
                  </div>
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Refresh
                    </div>
                    <p className="font-bold text-foreground">{path.decay_half_life_months} mo</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {path.tags.slice(0, 4).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {path.tags.length > 4 && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      +{path.tags.length - 4}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2 pt-1">
                  <Link
                    href={`/skill-paths/${path.slug}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-center gap-1.5")}
                  >
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={`/assess/${path.slug}`}
                    className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}
                  >
                    Start assessment
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
