"use client";

import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  levels: { level: number }[];
}

export function MyProgress({ slug, levels }: Props) {
  const { session } = useAuth();

  const { data } = useQuery({
    queryKey: ["my-decay-status"],
    queryFn: () => api.credentials.myDecayStatus(),
    enabled: !!session,
    staleTime: 60_000,
  });

  if (!session || !data) return null;

  const earnedLevels = new Map(
    data.credentials
      .filter((c) => c.skill_path_slug === slug)
      .map((c) => [c.level, c])
  );

  if (earnedLevels.size === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your progress</p>
      {levels.map((lv) => {
        const cred = earnedLevels.get(lv.level);
        if (!cred) return null;
        return (
          <div key={lv.level} className="flex items-center gap-2 text-xs">
            <ShieldCheck className={cn("h-3.5 w-3.5", cred.overdue_for_refresh ? "text-amber-500" : "text-success")} />
            <span className="text-muted-foreground">Level {lv.level}:</span>
            <span className="font-semibold tabular-nums">
              {Math.round(cred.raw_score)}
            </span>
            <span className="text-muted-foreground">raw</span>
            {cred.overdue_for_refresh && (
              <span className="text-amber-600 font-medium">· refresh recommended</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
