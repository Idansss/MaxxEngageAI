import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Layers, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getSkillPaths() {
  try {
    return await api.skillPaths.list();
  } catch {
    return [];
  }
}

function domainStripe(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology",
    design: "stripe-design",
    data: "stripe-data",
    writing: "stripe-writing",
    business: "stripe-business",
    ops: "stripe-ops",
    science: "stripe-science",
  };
  return map[domain] ?? "bg-muted-foreground/40";
}

export default async function SkillPathsPage() {
  const skillPaths = await getSkillPaths();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary/60">
            Skill paths
          </p>
          <h1 className="text-3xl font-extrabold">Choose what to prove next</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pick a path, start a diagnostic, and build toward a credential backed by a transparent rubric.
          </p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
          Back to dashboard
        </Link>
      </div>

      {skillPaths.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">No skill paths loaded</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The API did not return any paths. Check that the backend is running and seeded.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {skillPaths.map((path) => (
            <Card key={path.id} className="overflow-hidden p-0">
              <div className={cn("h-1.5 w-full", domainStripe(path.domain))} />
              <CardHeader className="pb-3 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">{path.name}</CardTitle>
                  <Badge variant="secondary" className="shrink-0 text-xs capitalize">
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
                    <p className="font-bold text-foreground">{path.decay_half_life_months} months</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {path.tags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-2 pt-1">
                  <Link
                    href={`/assess?path=${path.slug}`}
                    className={cn(buttonVariants({ size: "sm" }), "w-full justify-center gap-1.5")}
                  >
                    Start assessment <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={`/learn/${path.slug}`}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-full justify-center gap-1.5")}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    View learning path
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
