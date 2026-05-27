"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type LearnPathResponse, type WeekPlan, type MilestoneAssessment, type Resource } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Clock, Target, Calendar, Wifi, WifiOff,
  ExternalLink, ChevronDown, ChevronUp, CheckCircle,
  Loader2, ArrowLeft, ArrowRight, Zap, BarChart3, Flag,
} from "lucide-react";
import { Suspense } from "react";

// ── Loading messages shown while Claude generates the path ─────────────────
const LOADING_MESSAGES = [
  "Analysing your diagnostic score…",
  "Mapping your skill gaps…",
  "Selecting the best free resources…",
  "Designing your week-by-week plan…",
  "Scheduling milestone assessments…",
  "Almost ready…",
];

function LoadingState() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center px-4">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
      <div>
        <p className="font-semibold text-lg mb-1">Building your learning path</p>
        <p className="text-muted-foreground text-sm transition-all">{LOADING_MESSAGES[idx]}</p>
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        Claude is designing a personalised curriculum based on your diagnostic score. This takes 20–40 seconds.
      </p>
    </div>
  );
}

// ── Resource type badge colours ────────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  article: "bg-sky-50 text-sky-700 border-sky-200",
  video: "bg-purple-50 text-purple-700 border-purple-200",
  interactive: "bg-amber-50 text-amber-700 border-amber-200",
  project: "bg-green-50 text-green-700 border-green-200",
  reference: "bg-gray-100 text-gray-700 border-gray-200",
};

function ResourceCard({ r }: { r: Resource }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
    >
      <div className="mt-0.5 shrink-0">
        {r.low_bandwidth_friendly ? (
          <Wifi className="h-4 w-4 text-green-500" aria-label="Low-bandwidth friendly" />
        ) : (
          <WifiOff className="h-4 w-4 text-gray-300" aria-label="Requires good connection" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium group-hover:text-primary transition-colors leading-snug">{r.title}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className={`text-xs border rounded-full px-2 py-0.5 ${TYPE_STYLES[r.type] ?? TYPE_STYLES.reference}`}>
            {r.type}
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {r.estimated_minutes < 60
              ? `${r.estimated_minutes}m`
              : `${Math.round(r.estimated_minutes / 60)}h`}
          </span>
          {r.requires_signup && (
            <span className="text-xs text-muted-foreground">account needed</span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}

function WeekCard({
  week,
  milestoneAfterWeek,
}: {
  week: WeekPlan;
  milestoneAfterWeek: boolean;
}) {
  const [open, setOpen] = useState(week.week <= 2);

  return (
    <div className="relative">
      {/* Timeline connector */}
      <div className="absolute left-5 top-12 bottom-0 w-px bg-border z-0" aria-hidden />

      <div className="relative">
        {/* Week header row */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-start gap-4 text-left group"
          aria-expanded={open ? "true" : "false"}
        >
          {/* Circle indicator */}
          <div className={`shrink-0 h-10 w-10 rounded-full border-2 flex items-center justify-center font-bold text-sm z-10 bg-background
            ${week.is_assessment_week
              ? "border-primary text-primary"
              : "border-border text-muted-foreground group-hover:border-muted-foreground"}`}
          >
            {week.is_assessment_week ? <Flag className="h-4 w-4" /> : week.week}
          </div>

          <div className="flex-1 min-w-0 py-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm leading-tight">{week.theme}</span>
              {week.is_assessment_week && (
                <Badge className="text-xs">Assessment week</Badge>
              )}
              {milestoneAfterWeek && !week.is_assessment_week && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">Checkpoint</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />{week.estimated_hours}h this week
              </span>
              <span>{week.resources.length} resource{week.resources.length !== 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="shrink-0 py-2 text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {/* Expanded content */}
        {open && (
          <div className="ml-14 pb-6 space-y-4">
            {/* Focus areas */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {week.focus_areas.map((f) => (
                <Badge key={f} variant="secondary" className="text-xs font-normal">{f}</Badge>
              ))}
            </div>

            {/* Resources */}
            <div className="space-y-2">
              {week.resources.map((r) => (
                <ResourceCard key={r.url} r={r} />
              ))}
            </div>

            {/* Practice task */}
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Practice task
              </p>
              <p className="text-sm text-green-900 leading-relaxed">{week.practice_task}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MilestonesBar({ milestones }: { milestones: MilestoneAssessment[]; totalWeeks: number }) {
  return (
    <div className="space-y-3">
      {milestones.map((m) => (
        <div key={m.after_week} className="flex gap-4 items-start p-3 rounded-lg border bg-card">
          <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium">After week {m.after_week}</span>
              <Badge variant="outline" className="text-xs">
                Target: {m.expected_score_range[0]}–{m.expected_score_range[1]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Setup form shown before generating the path ────────────────────────────
function SetupForm({
  score,
  focus,
  onGenerate,
  isPending,
}: {
  score: number;
  focus: string;
  onGenerate: (hours: number) => void;
  isPending: boolean;
}) {
  const [hours, setHours] = useState(5);

  const durationLabel = () => {
    if (score < 25) return "12 weeks";
    if (score < 45) return "10 weeks";
    if (score < 60) return "8 weeks";
    if (score < 70) return "6 weeks";
    return "4 weeks";
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-8">
      <div>
        <Badge variant="secondary" className="mb-3">Personalised learning path</Badge>
        <h1 className="text-2xl font-bold mb-2">One last thing before we start</h1>
        <p className="text-muted-foreground text-sm">
          Your score of <strong>{score}/100</strong> puts you on a{" "}
          <strong>{durationLabel()}</strong> path. How many hours can you commit per week?
        </p>
      </div>

      {focus && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">
            Targeting your weakest area
          </p>
          <p className="text-sm font-semibold text-foreground">{focus}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claude will weight resources and practice tasks toward this dimension.
          </p>
        </div>
      )}

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div className="flex justify-between items-center text-sm mb-1">
          <span className="text-muted-foreground">Hours per week</span>
          <span className="font-bold text-lg">{hours}h</span>
        </div>
        <input
          type="range"
          id="hours-per-week"
          aria-label="Hours available per week"
          min={1}
          max={20}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="w-full accent-blue-600"
          disabled={isPending}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1h — casual</span>
          <span>10h — focused</span>
          <span>20h — intensive</span>
        </div>

        <Separator />

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Estimated finish</span>
          <span className="font-medium">{durationLabel()} from today</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total hours</span>
          <span className="font-medium">~{hours * parseInt(durationLabel())}h</span>
        </div>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={() => onGenerate(hours)}
        disabled={isPending}
      >
        {isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
        ) : (
          <>Build my learning path <ArrowRight className="ml-2 h-4 w-4" /></>
        )}
      </Button>

      {isPending && <LoadingState />}
    </div>
  );
}

// ── Main rendered path ─────────────────────────────────────────────────────
function PathView({ data }: { data: LearnPathResponse }) {
  const milestoneWeeks = new Set(data.milestone_assessments.map((m) => m.after_week));

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Overview */}
      <div>
        <Badge variant="secondary" className="mb-2">Your personalised path</Badge>
        <h1 className="text-2xl font-bold mb-1">{data.level_label}</h1>
        <p className="text-muted-foreground text-sm">{data.skill_path_slug.replace(/-/g, " ")}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Target className="h-4 w-4 text-primary" />, label: "Current score", value: `${data.diagnostic_score}/100` },
          { icon: <BarChart3 className="h-4 w-4 text-amber-500" />, label: "Gap to pass", value: data.score_gap_to_pass > 0 ? `+${data.score_gap_to_pass} pts` : "Already passing!" },
          { icon: <Calendar className="h-4 w-4 text-green-600" />, label: "Duration", value: `${data.duration_weeks} weeks` },
          { icon: <Clock className="h-4 w-4 text-purple-600" />, label: "Total hours", value: `~${data.total_estimated_hours}h` },
        ].map((s) => (
          <div key={s.label} className="bg-card border rounded-lg p-3 text-center space-y-1">
            <div className="flex justify-center">{s.icon}</div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-sm font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Score progress */}
      <div className="bg-card border rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Your score: {data.diagnostic_score}</span>
          <span>Pass threshold: 70</span>
        </div>
        <Progress value={data.diagnostic_score} className="h-2" />
        <p className="text-xs text-muted-foreground italic leading-relaxed">{data.path_rationale}</p>
      </div>

      {/* First assessment date */}
      <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 text-sm">
        <Calendar className="h-4 w-4 text-primary shrink-0" />
        <p>
          <span className="font-medium">First checkpoint: </span>
          <span className="text-muted-foreground">
            {new Date(data.next_assessment_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </p>
      </div>

      {/* Week-by-week */}
      <div>
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Week-by-week plan
        </h2>
        <div className="space-y-1">
          {data.weekly_plan.map((week) => (
            <WeekCard
              key={week.week}
              week={week}
              milestoneAfterWeek={milestoneWeeks.has(week.week)}
            />
          ))}
        </div>
      </div>

      {/* Milestones */}
      {data.milestone_assessments.length > 0 && (
        <div>
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Milestone checkpoints
          </h2>
          <MilestonesBar milestones={data.milestone_assessments} totalWeeks={data.duration_weeks} />
        </div>
      )}

      {/* CTA */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
        <h3 className="font-semibold">Studied the material? Ready to prove it?</h3>
        <p className="text-sm text-muted-foreground">
          Take the assessment when you feel confident. Your score and any earned credential are
          stored permanently on Maxx Engage.
        </p>
        <Link href={`/assess/${data.skill_path_slug}`} className={cn(buttonVariants({ size: "lg" }), "mt-2")}>
          Take the assessment <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────
function LearnPageContent({ slug }: { slug: string }) {
  const params = useSearchParams();
  const score = parseFloat(params.get("score") ?? "0");
  const focus = params.get("focus") ?? "";

  const [generated, setGenerated] = useState<LearnPathResponse | null>(null);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (hours: number) =>
      api.learnPath({
        skill_path_slug: slug,
        diagnostic_score: score,
        available_hours_per_week: hours,
        weak_dimensions: focus ? [focus] : undefined,
      }),
    onSuccess: (data) => setGenerated(data),
  });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link
          href={`/assess/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to assessment
        </Link>
      </div>

      {error && (
        <div className="max-w-lg mx-auto px-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error.message}. Please try again.
          </div>
        </div>
      )}

      {generated ? (
        <PathView data={generated} />
      ) : (
        <SetupForm score={score} focus={focus} onGenerate={mutate} isPending={isPending} />
      )}
    </div>
  );
}

export default function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense>
      <LearnPageInner params={params} />
    </Suspense>
  );
}

function LearnPageInner({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ slug }) => setSlug(slug));
  }, [params]);

  if (!slug) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <LearnPageContent slug={slug} />;
}
