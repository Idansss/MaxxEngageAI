"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type ProjectFile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ArrowRight, Calendar, CheckSquare,
  Plus, Trash2, Loader2, AlertCircle, Sparkles, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import ReactMarkdown from "react-markdown";

const MAX_FILES = 5;
const MAX_CHARS_PER_FILE = 50_000;

interface FileEntry {
  id: string;
  filename: string;
  content: string;
}

function newFile(filename = ""): FileEntry {
  return { id: crypto.randomUUID(), filename, content: "" };
}

function FileEditor({
  file,
  index,
  isCode,
  onFilename,
  onContent,
  onRemove,
  canRemove,
}: {
  file: FileEntry;
  index: number;
  isCode: boolean;
  onFilename: (v: string) => void;
  onContent: (v: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const chars = file.content.length;
  const overLimit = chars > MAX_CHARS_PER_FILE;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={file.filename}
          onChange={(e) => onFilename(e.target.value)}
          placeholder={`filename-${index + 1}.txt`}
          className="flex-1 text-xs font-mono bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
          aria-label={`File ${index + 1} name`}
        />
        <span className={cn("text-xs shrink-0", overLimit ? "text-destructive font-medium" : "text-muted-foreground")}>
          {chars.toLocaleString()}/{MAX_CHARS_PER_FILE.toLocaleString()}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Remove file"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Textarea
        value={file.content}
        onChange={(e) => onContent(e.target.value)}
        placeholder={isCode ? "// Paste your code here…" : "Paste your content here…"}
        className={cn("min-h-[200px] resize-y rounded-none border-0 focus-visible:ring-0", isCode && "font-mono text-xs")}
        aria-label={`File ${index + 1} content`}
      />
    </div>
  );
}

function ProjectDetailContent({ slug }: { slug: string }) {
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();

  const [files, setFiles] = useState<FileEntry[]>([newFile()]);
  const [notes, setNotes] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?next=/projects/${slug}`);
    }
  }, [authLoading, session, router, slug]);

  const { data: brief, isLoading: briefLoading } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => api.projects.get(slug),
    enabled: !!session,
  });

  const isCode = brief ? ["web-dev-html-001", "backend-api-001"].includes(brief.rubric_id) : false;

  // Seed initial filenames from deliverables when brief loads
  useEffect(() => {
    if (!brief) return;
    const required = brief.deliverables.filter((d) => d.required);
    if (required.length > 0) {
      setFiles(required.slice(0, MAX_FILES).map((d) => newFile(d.title)));
    }
  }, [brief]);

  const { mutate: submit, isPending, error } = useMutation({
    mutationFn: async () => {
      const validFiles: ProjectFile[] = files
        .filter((f) => f.filename.trim() && f.content.trim())
        .map((f) => ({ filename: f.filename.trim(), content: f.content }));

      if (validFiles.length === 0) throw new Error("Add at least one file with content before submitting.");
      if (validFiles.some((f) => f.content.length > MAX_CHARS_PER_FILE)) {
        throw new Error(`Each file must be under ${MAX_CHARS_PER_FILE.toLocaleString()} characters.`);
      }

      const res = await api.projects.submit(slug, {
        files: validFiles,
        notes: notes.trim() || undefined,
      });

      // Poll until grading completes
      return new Promise<string>((resolve, reject) => {
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          try {
            const job = await api.projects.pollJob(res.job_id);
            if (job.status === "succeeded" && job.result) {
              clearInterval(pollRef.current!);
              resolve(
                `/results/${job.result.review_id}?score=${job.result.overall_score}&passed=${job.result.passed}&credential=${job.result.credential_id ?? ""}&submission=${job.result.submission_id ?? ""}&path=${slug}`
              );
            } else if (job.status === "failed") {
              clearInterval(pollRef.current!);
              reject(new Error(job.error ?? "Grading failed. Please try again."));
            } else if (attempts >= 90) {
              clearInterval(pollRef.current!);
              reject(new Error("Grading is taking longer than expected. Check your submission history in a few minutes."));
            }
          } catch (e) {
            clearInterval(pollRef.current!);
            reject(e);
          }
        }, 2000);
      });
    },
    onSuccess: (url) => router.push(url),
  });

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const addFile = () => {
    if (files.length < MAX_FILES) setFiles((prev) => [...prev, newFile()]);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const updateFilename = (id: string, v: string) => setFiles((prev) => prev.map((f) => f.id === id ? { ...f, filename: v } : f));
  const updateContent = (id: string, v: string) => setFiles((prev) => prev.map((f) => f.id === id ? { ...f, content: v } : f));

  if (authLoading || !session || briefLoading) {
    return (
      <div className="flex items-center justify-center py-28">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="max-w-2xl px-6 py-16 text-center text-muted-foreground text-sm">
        Project not found.{" "}
        <Link href="/projects" className="text-primary underline underline-offset-2">Browse projects →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl px-6 py-10">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> All projects
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="capitalize">{brief.skill_path_domain}</Badge>
          <Badge variant="outline">Foundations</Badge>
        </div>
        <h1 className="text-3xl font-extrabold">{brief.title}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{brief.summary}</p>
      </div>

      {/* Meta row */}
      <Card className="mb-6 overflow-hidden">
        <div className="h-1 bg-primary" />
        <CardContent className="pt-5 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Estimated time</p>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {brief.estimated_days} day{brief.estimated_days !== 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Pass threshold</p>
            <p className="text-sm font-semibold">{brief.pass_threshold}/100</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Rubric</p>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{brief.rubric_id}</code>
          </div>
        </CardContent>
      </Card>

      {/* Brief */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">The brief</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none text-foreground">
          <ReactMarkdown>{brief.brief_markdown}</ReactMarkdown>
        </CardContent>
      </Card>

      {/* Deliverables checklist */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Deliverables
        </p>
        <div className="space-y-2">
          {brief.deliverables.map((d) => (
            <div key={d.title} className="flex items-start gap-2.5 text-sm">
              <CheckSquare className={cn("h-4 w-4 mt-0.5 shrink-0", d.required ? "text-primary" : "text-muted-foreground/40")} />
              <div>
                <span className="font-medium">{d.title}</span>
                {!d.required && <span className="text-xs text-muted-foreground ml-1.5">(optional)</span>}
                <p className="text-muted-foreground text-xs mt-0.5">{d.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-8" />

      {/* Submission form */}
      <div>
        <h2 className="text-xl font-bold mb-1">Submit your work</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Paste each file below. Use the filename input to label it (e.g. <code className="font-mono bg-muted px-1 rounded text-xs">index.html</code>).
          Up to {MAX_FILES} files, {(MAX_CHARS_PER_FILE / 1000).toFixed(0)}k chars each.
        </p>

        <div className="space-y-4 mb-4">
          {files.map((file, i) => (
            <FileEditor
              key={file.id}
              file={file}
              index={i}
              isCode={isCode}
              onFilename={(v) => updateFilename(file.id, v)}
              onContent={(v) => updateContent(file.id, v)}
              onRemove={() => removeFile(file.id)}
              canRemove={files.length > 1}
            />
          ))}
        </div>

        {files.length < MAX_FILES && (
          <button
            type="button"
            onClick={addFile}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mb-6"
          >
            <Plus className="h-3.5 w-3.5" /> Add another file
          </button>
        )}

        {/* Optional cover note */}
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block" htmlFor="cover-note">
            Cover note <span className="font-normal">(optional — explain any decisions or context)</span>
          </label>
          <Textarea
            id="cover-note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. I chose SQLite for persistence because…"
            className="resize-none min-h-[80px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1">{notes.length}/500</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {(error as Error).message}
          </div>
        )}

        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto h-11 px-8 text-base font-semibold gap-2"
          onClick={() => submit()}
          disabled={isPending}
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Queued for AI review…</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Submit project</>
          )}
        </Button>

        {isPending && (
          <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
            AI grading runs in the background — usually 30–60 seconds.
            This page will navigate to your results automatically.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <Suspense fallback={
        <div className="flex items-center justify-center py-28">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <ProjectDetailContent slug={slug} />
      </Suspense>
    </div>
  );
}
