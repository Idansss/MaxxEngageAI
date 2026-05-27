"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Search, Users, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Domain colour chip ────────────────────────────────────────────────────────

const DOMAIN_CLASSES: Record<string, string> = {
  technology: "bg-primary/10 text-primary",
  design:     "bg-violet-100 text-violet-700",
  data:       "bg-emerald-100 text-emerald-700",
  writing:    "bg-amber-100 text-amber-700",
  business:   "bg-orange-100 text-orange-700",
  ops:        "bg-slate-100 text-slate-700",
  science:    "bg-teal-100 text-teal-700",
};

function domainChip(domain: string) {
  return DOMAIN_CLASSES[domain] ?? "bg-muted text-muted-foreground";
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchModal({ sidebar = false }: { sidebar?: boolean }) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [debQ, setDebQ]       = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);

  const router       = useRef(useRouter()).current;
  const inputRef     = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce query → debQ
  useEffect(() => {
    const t = setTimeout(() => setDebQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Cmd/Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openSearch() {
    setQuery("");
    setDebQ("");
    setFocusIdx(-1);
    setOpen(true);
  }

  // Auto-focus input on open.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  // Click-outside → close
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Fetch results
  const { data, isFetching } = useQuery({
    queryKey: ["search", debQ],
    queryFn:  () => api.search(debQ),
    enabled:  debQ.length >= 2,
    staleTime: 30_000,
  });

  const paths = data?.skill_paths ?? [];
  const users = data?.users ?? [];
  const total = paths.length + users.length;

  // Flat list for keyboard navigation
  type Item = { href: string };
  const allItems: Item[] = [
    ...paths.map((p) => ({ href: `/skill-paths/${p.slug}` })),
    ...users.map((u) => ({ href: `/u/${u.username}` })),
  ];

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, total - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, -1));
    }
    if (e.key === "Enter" && focusIdx >= 0 && allItems[focusIdx]) {
      navigate(allItems[focusIdx].href);
    }
  }

  // ── Trigger button (when closed) ──────────────────────────────────────────

  if (!open) {
    if (sidebar) {
      return (
        <button
          type="button"
          onClick={openSearch}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 leading-none">
            ⌘K
          </kbd>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={openSearch}
        className="inline-flex items-center gap-1.5 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        aria-label="Search"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden lg:inline text-xs">Search</span>
        <kbd className="hidden xl:inline text-[10px] font-mono bg-muted border border-border rounded px-1 py-0.5 leading-none">
          ⌘K
        </kbd>
      </button>
    );
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  const hasResults = total > 0;
  const noResults  = debQ.length >= 2 && !isFetching && !hasResults;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

      {/* Modal shell */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4">
        <div
          ref={containerRef}
          className="w-full max-w-xl bg-background border shadow-2xl rounded-2xl overflow-hidden"
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            {isFetching
              ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
              : <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setFocusIdx(-1); }}
              placeholder="Search skill paths, people…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close search"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[52vh] overflow-y-auto overscroll-contain">
            {debQ.length < 2 && (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                <Search className="h-7 w-7 opacity-30" />
                <p className="text-sm">Type to search skill paths and people</p>
              </div>
            )}

            {noResults && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No results for <span className="font-medium text-foreground">&quot;{debQ}&quot;</span>
              </div>
            )}

            {hasResults && (
              <div>
                {/* Skill paths section */}
                {paths.length > 0 && (
                  <>
                    <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b">
                      <Zap className="h-3 w-3" /> Skill Paths
                    </div>
                    {paths.map((path, i) => (
                      <button
                        key={path.slug}
                        type="button"
                        onClick={() => navigate(`/skill-paths/${path.slug}`)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors",
                          focusIdx === i && "bg-muted"
                        )}
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{path.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{path.description}</p>
                        </div>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded capitalize shrink-0", domainChip(path.domain))}>
                          {path.domain}
                        </span>
                      </button>
                    ))}
                  </>
                )}

                {/* People section */}
                {users.length > 0 && (
                  <>
                    <div className={cn(
                      "flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-b",
                      paths.length > 0 && "border-t"
                    )}>
                      <Users className="h-3 w-3" /> People
                    </div>
                    {users.map((user, i) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => navigate(`/u/${user.username}`)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors",
                          focusIdx === paths.length + i && "bg-muted"
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                          {user.display_name?.slice(0, 1)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            @{user.username}
                            {user.country_code && ` · ${user.country_code}`}
                          </p>
                        </div>
                        {user.overall_score > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0 font-mono">
                            {Math.round(user.overall_score)}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer keyboard hints */}
          <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="font-mono">↵</kbd> Open</span>
            <span className="flex items-center gap-1"><kbd className="font-mono">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </>
  );
}
