"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, type ProjectBriefSummary } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowRight, Loader2, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const DOMAIN_LABELS: Record<string, string> = {
  technology: "Technology",
  writing:    "Writing",
  design:     "Design",
  data:       "Data",
  business:   "Business",
};

const DOMAIN_STRIPE: Record<string, string> = {
  technology: "stripe-technology",
  writing:    "stripe-writing",
  design:     "stripe-design",
  data:       "stripe-data",
  business:   "stripe-business",
};

function ProjectCard({ brief }: { brief: ProjectBriefSummary }) {
  const requiredCount = brief.deliverables.filter((d) => d.required).length;

  return (
    <Card className="overflow-hidden p-0 flex flex-col card-hover">
      <div className={cn("h-1.5 w-full shrink-0", DOMAIN_STRIPE[brief.skill_path_domain] ?? "bg-muted-foreground/30")} />
      <CardHeader className="pb-2 pt-5">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{brief.title}</CardTitle>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          <Badge variant="secondary" className="text-xs">
            {DOMAIN_LABELS[brief.skill_path_domain] ?? brief.skill_path_domain}
          </Badge>
          <Badge variant="outline" className="text-xs">Foundations</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pb-5 gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
          {brief.summary}
        </p>

        {/* Deliverables preview */}
        <div className="space-y-1.5">
          {brief.deliverables.slice(0, 3).map((d) => (
            <div key={d.title} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckSquare className={cn("h-3 w-3 shrink-0", d.required ? "text-primary" : "text-muted-foreground/50")} />
              <span className="truncate">{d.title}</span>
              {!d.required && <span className="shrink-0 text-muted-foreground/50">(optional)</span>}
            </div>
          ))}
          {brief.deliverables.length > 3 && (
            <p className="text-xs text-muted-foreground/60 pl-5">
              +{brief.deliverables.length - 3} more deliverable{brief.deliverables.length - 3 > 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {brief.estimated_days} day{brief.estimated_days !== 1 ? "s" : ""}
            <span className="text-muted-foreground/40 mx-1">Â·</span>
            {requiredCount} required file{requiredCount !== 1 ? "s" : ""}
          </div>
        </div>

        <Link
          href={`/projects/${brief.slug}`}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium h-9 px-4",
            "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full"
          )}
        >
          View brief <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ProjectsPage() {
  const { data: briefs = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.projects.list(),
  });

  return (
    <main className="max-w-5xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">
          Real-world projects
        </p>
        <h1 className="text-3xl font-extrabold">Projects</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Multi-day briefs modelled on real client work. Submit your deliverables,
          get AI-graded feedback, and earn a verifiable credential. Work at your own pace.
        </p>
      </div>

      {/* Difference from diagnostics */}
      <div className="mb-8 rounded-xl border bg-primary/5 border-primary/15 p-4 text-sm text-foreground/80 leading-relaxed">
        <span className="font-semibold text-foreground">Projects vs Diagnostics â€”</span>{" "}
        Diagnostics are timed tasks that test a specific skill in one sitting.
        Projects are multi-day briefs with multiple deliverables â€” closer to real client work.
        Both award the same verifiable credential.
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : briefs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No project briefs available yet.{" "}
          <Link href="/assess" className="text-primary underline underline-offset-2">
            Try a diagnostic instead â†’
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefs.map((brief) => (
            <ProjectCard key={brief.id} brief={brief} />
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="text-xs text-muted-foreground mb-3">
          Want a quicker assessment first?
        </p>
        <Link href="/assess">
          <Button variant="outline" size="sm" className="gap-1.5">
            Browse skill diagnostics <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </main>
  );
}
