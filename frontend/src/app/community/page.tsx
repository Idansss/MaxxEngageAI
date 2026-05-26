"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

export default function CommunityPage() {
  const [query, setQuery] = useState("frontend web development accessibility");
  const [submittedQuery, setSubmittedQuery] = useState(query);

  const { data, isLoading } = useQuery({
    queryKey: ["community-github"],
    queryFn: () => api.community.github(),
  });

  const { data: knowledge, isFetching } = useQuery({
    queryKey: ["knowledge", submittedQuery],
    queryFn: () => api.knowledge.search(submittedQuery),
    enabled: submittedQuery.trim().length >= 2,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">
          Open collaboration
        </p>
        <h1 className="text-3xl font-extrabold">Build Maxx Engage in public</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
          GitHub coordinates the work, Discord coordinates the people, and trusted public
          knowledge sources help keep assessment context auditable.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitHub collaboration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{data?.repo.name ?? "Idansss/MaxxEngageAI"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      License {data?.repo.license ?? "AGPL-3.0"} · {data?.repo.open_issues ?? 0} open issues
                    </p>
                  </div>
                  <a
                    href={data?.repo.url ?? "https://github.com/Idansss/MaxxEngageAI"}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                  >
                    Repository <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <GitPullRequest className="h-4 w-4 text-primary" />
                    Open work
                  </p>
                  {!data?.issues.length ? (
                    <p className="text-sm text-muted-foreground">No open public issues found.</p>
                  ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border">
                      {data.issues.map((issue) => (
                        <li key={issue.number} className="p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-sm hover:text-primary transition-colors"
                            >
                              #{issue.number} {issue.title}
                            </a>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {issue.labels.map((label) => (
                                <Badge key={label} variant="secondary" className="text-[11px]">
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Community
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.community.discord_invite_url ? (
              <a
                href={data.community.discord_invite_url}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "w-full justify-center gap-1.5")}
              >
                Join Discord <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">
                Add `DISCORD_INVITE_URL` to the backend environment to show the invite here.
              </p>
            )}
            <div className="space-y-2 pt-2">
              {data?.docs.map((doc) => (
                <a
                  key={doc.url}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    {doc.title}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Trusted public knowledge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Search Wikipedia and Wikidata"
            />
            <button className={cn(buttonVariants({ size: "sm" }), "gap-1.5")} type="submit">
              <Search className="h-3.5 w-3.5" />
              Search
            </button>
          </form>

          <div className="mt-4">
            {isFetching ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !knowledge?.sources.length ? (
              <p className="text-sm text-muted-foreground">No trusted public sources returned.</p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {knowledge.sources.map((source) => (
                  <li key={`${source.source_type}-${source.url}`} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="font-semibold text-sm">{source.title}</p>
                      <Badge variant="outline" className="text-[11px]">{source.source_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {source.summary}
                    </p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
