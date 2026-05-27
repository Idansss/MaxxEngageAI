import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SkillPathBrowser } from "./skill-path-browser";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Skill Paths",
  description:
    "Browse AI-graded skill paths across technology, design, data, and more. Earn tamper-proof W3C Verifiable Credentials that prove your real competence.",
};

async function getSkillPaths() {
  try {
    return await api.skillPaths.list();
  } catch {
    return [];
  }
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

      <SkillPathBrowser paths={skillPaths} />
    </main>
  );
}
