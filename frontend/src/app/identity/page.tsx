"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api, type Stamp } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, GitBranch, CheckCircle, XCircle, Loader2,
  AlertCircle, ExternalLink, Clock, Zap, Mail, Phone, AtSign,
} from "lucide-react";

/* ── Stamp card definitions ─────────────────────────────────────────────── */

interface StampDef {
  type: string;
  label: string;
  pts: string;
  ptsMax: number;
  icon: React.ReactNode;
  iconBg: string;
  ptsBadge: string;
  description: string;
  inputType?: "github" | "gitcoin";
  comingSoon?: boolean;
  externalLink?: string;
}

const STAMPS: StampDef[] = [
  {
    type: "email",
    label: "Email",
    pts: "+10",
    ptsMax: 10,
    icon: <Mail className="h-7 w-7" />,
    iconBg: "bg-indigo-100 text-indigo-600",
    ptsBadge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    description: "Verified automatically when you sign in via magic link.",
  },
  {
    type: "github",
    label: "GitHub",
    pts: "up to +35",
    ptsMax: 35,
    icon: <GitBranch className="h-7 w-7" />,
    iconBg: "bg-gray-100 text-gray-700",
    ptsBadge: "bg-gray-50 text-gray-700 border-gray-200",
    description: "Account ≥ 6 months with at least 1 repo. Senior tier (+35) needs 2 yrs & 10 repos.",
    inputType: "github",
  },
  {
    type: "gitcoin_passport",
    label: "Gitcoin Passport",
    pts: "up to +35",
    ptsMax: 35,
    icon: <ShieldCheck className="h-7 w-7" />,
    iconBg: "bg-violet-100 text-violet-600",
    ptsBadge: "bg-violet-50 text-violet-700 border-violet-200",
    description: "Connect Web2 + Web3 stamps via your Ethereum wallet. Score ≥ 1 to qualify.",
    inputType: "gitcoin",
    externalLink: "https://app.passport.xyz",
  },
  {
    type: "phone",
    label: "Phone",
    pts: "+20",
    ptsMax: 20,
    icon: <Phone className="h-7 w-7" />,
    iconBg: "bg-emerald-100 text-emerald-600",
    ptsBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "SMS OTP verification. Great for learners without GitHub or ETH wallet.",
    comingSoon: true,
  },
];

/* ── Main page ──────────────────────────────────────────────────────────── */

export default function IdentityPage() {
  const router = useRouter();
  const { session, profile, loading, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const [githubInput, setGithubInput] = useState("");
  const [gitcoinInput, setGitcoinInput] = useState("");
  const [githubMsg, setGithubMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gitcoinMsg, setGitcoinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameMsg, setUsernameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const { data: scoreData } = useQuery({
    queryKey: ["my-humanity-score"],
    queryFn: () => api.identity.myScore(),
    enabled: !!session,
  });

  const { data: stampsData, isLoading: stampsLoading } = useQuery({
    queryKey: ["my-stamps"],
    queryFn: () => api.identity.myStamps(),
    enabled: !!session,
  });

  // Auto-claim email stamp — user is already verified by magic link sign-in
  useEffect(() => {
    if (!session || stampsLoading || !stampsData) return;
    const hasEmail = stampsData.stamps.some((s) => s.stamp_type === "email" && s.active);
    if (hasEmail) return;
    api.identity.stampEmail()
      .then(() => {
        qc.invalidateQueries({ queryKey: ["my-humanity-score"] });
        qc.invalidateQueries({ queryKey: ["my-stamps"] });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stampsLoading, stampsData]);

  function parseGithubUsername(raw: string): string {
    const match = raw.trim().match(/github\.com\/([^/?#]+)/);
    return match ? match[1] : raw.trim();
  }

  const githubMutation = useMutation({
    mutationFn: () => api.identity.stampGitHub(parseGithubUsername(githubInput)),
    onSuccess: (data) => {
      setGithubMsg({ ok: true, text: data.message });
      qc.invalidateQueries({ queryKey: ["my-humanity-score"] });
      qc.invalidateQueries({ queryKey: ["my-stamps"] });
    },
    onError: (e: Error) => setGithubMsg({ ok: false, text: e.message }),
  });

  const gitcoinMutation = useMutation({
    mutationFn: () => api.identity.stampGitcoin(gitcoinInput.trim()),
    onSuccess: (data) => {
      setGitcoinMsg({ ok: true, text: data.message });
      qc.invalidateQueries({ queryKey: ["my-humanity-score"] });
      qc.invalidateQueries({ queryKey: ["my-stamps"] });
    },
    onError: (e: Error) => setGitcoinMsg({ ok: false, text: e.message }),
  });

  const usernameMutation = useMutation({
    mutationFn: () => api.users.setUsername(usernameInput.trim().toLowerCase()),
    onSuccess: async (data) => {
      setUsernameMsg({ ok: true, text: `Username set! Your proof page is now live at /u/${data.username}` });
      setUsernameInput("");
      await refreshProfile();
    },
    onError: (e: Error) => setUsernameMsg({ ok: false, text: e.message }),
  });

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const score = scoreData?.humanity_score ?? 0;
  const fullWeight = scoreData?.full_weight_achieved ?? false;
  const stamps = stampsData?.stamps ?? [];
  const earnedTypes = new Set(stamps.filter((s) => s.active).map((s) => s.stamp_type));
  const pointsNeeded = Math.max(0, 50 - score);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">Proof of personhood</p>
        <h1 className="text-3xl font-extrabold">Identity verification</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-lg leading-relaxed">
          Collect stamps to prove you&apos;re a real person. Reach 50 points to give your credentials full public weight.
        </p>
      </div>

      {/* ── Score banner ───────────────────────────────────────────────── */}
      <div className={cn(
        "rounded-2xl border p-6 mb-8 flex flex-col sm:flex-row sm:items-center gap-6",
        fullWeight ? "bg-success-bg border-success/20" : "bg-amber-50 border-amber-200/60"
      )}>
        {/* Score display */}
        <div className="flex items-center gap-5 flex-1">
          <div className={cn(
            "w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm",
            fullWeight ? "bg-success text-white" : "bg-gold text-white"
          )}>
            <span className="text-3xl font-black leading-none">{score.toFixed(0)}</span>
            <span className="text-xs font-medium opacity-80">/ 100</span>
          </div>
          <div>
            <p className="font-bold text-lg leading-tight">Unique Humanity Score</p>
            {fullWeight ? (
              <p className="text-sm text-success font-medium mt-1 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" /> Full credential weight achieved
              </p>
            ) : (
              <p className="text-sm text-amber-700 mt-1">
                {pointsNeeded} more points to reach full weight
              </p>
            )}
            <div className="mt-3 w-48">
              <Progress value={score} className="h-2" />
            </div>
          </div>
        </div>

        {/* Earned stamps */}
        {earnedTypes.size > 0 && (
          <div className="flex flex-wrap gap-2">
            {stamps.filter(s => s.active).map((s) => {
              const def = STAMPS.find(d => d.type === s.stamp_type);
              return (
                <div key={s.stamp_type} className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border",
                  def?.ptsBadge ?? "bg-muted text-muted-foreground border-border"
                )}>
                  <CheckCircle className="h-3 w-3" />
                  {def?.label ?? s.stamp_type}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Username / Proof page ──────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <AtSign className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">Public proof page</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set a username to get your shareable proof page at <span className="font-mono">/u/your-username</span>
            </p>
          </div>
        </div>

        {profile?.username ? (
          <div className="mb-3 rounded-xl bg-success-bg border border-success/20 px-4 py-3 text-sm text-success font-medium flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Your proof page:{" "}
            <a
              href={`/u/${profile.username}`}
              className="underline underline-offset-2 hover:text-success/80"
              target="_blank"
              rel="noopener noreferrer"
            >
              /u/{profile.username}
            </a>
          </div>
        ) : null}

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
            <input
              className="input-base w-full pl-7 text-sm font-mono"
              placeholder={profile?.username ?? "your-username"}
              value={usernameInput}
              onChange={(e) => { setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); setUsernameMsg(null); }}
              disabled={usernameMutation.isPending}
              maxLength={20}
              aria-label="Username"
            />
          </div>
          <Button
            type="button"
            disabled={!usernameInput.trim() || usernameInput.trim().length < 3 || usernameMutation.isPending}
            onClick={() => usernameMutation.mutate()}
            variant={profile?.username ? "outline" : "default"}
          >
            {usernameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : profile?.username ? "Change" : "Set username"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">3–20 characters, lowercase letters, numbers, and underscores only.</p>

        {usernameMsg && (
          <p className={cn("text-xs flex items-start gap-1.5 mt-2", usernameMsg.ok ? "text-success" : "text-destructive")}>
            {usernameMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
            {usernameMsg.text}
          </p>
        )}
      </div>

      {/* ── Stamp cards grid ───────────────────────────────────────────── */}
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Add Stamps</p>

      <div className="grid sm:grid-cols-2 gap-4">
        {STAMPS.map((def) => {
          const earned = earnedTypes.has(def.type);
          const stamp = stamps.find(s => s.stamp_type === def.type);
          const meta = stamp?.metadata as Record<string, unknown> | undefined;

          return (
            <StampCard
              key={def.type}
              def={def}
              earned={earned}
              stamp={stamp}
              meta={meta}
              stampsLoading={stampsLoading}
              /* GitHub props */
              githubInput={githubInput}
              onGithubInput={(v) => { setGithubInput(v); setGithubMsg(null); }}
              githubPending={githubMutation.isPending}
              onGithubVerify={() => githubMutation.mutate()}
              githubMsg={githubMsg}
              /* Gitcoin props */
              gitcoinInput={gitcoinInput}
              onGitcoinInput={(v) => { setGitcoinInput(v); setGitcoinMsg(null); }}
              gitcoinPending={gitcoinMutation.isPending}
              onGitcoinVerify={() => gitcoinMutation.mutate()}
              gitcoinMsg={gitcoinMsg}
            />
          );
        })}
      </div>
    </main>
  );
}

/* ── Stamp card component ───────────────────────────────────────────────── */

function StampCard({
  def, earned, stamp, meta, stampsLoading,
  githubInput, onGithubInput, githubPending, onGithubVerify, githubMsg,
  gitcoinInput, onGitcoinInput, gitcoinPending, onGitcoinVerify, gitcoinMsg,
}: {
  def: StampDef;
  earned: boolean;
  stamp: Stamp | undefined;
  meta: Record<string, unknown> | undefined;
  stampsLoading: boolean;
  githubInput: string; onGithubInput: (v: string) => void;
  githubPending: boolean; onGithubVerify: () => void;
  githubMsg: { ok: boolean; text: string } | null;
  gitcoinInput: string; onGitcoinInput: (v: string) => void;
  gitcoinPending: boolean; onGitcoinVerify: () => void;
  gitcoinMsg: { ok: boolean; text: string } | null;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card flex flex-col overflow-hidden transition-shadow hover:shadow-md",
      earned && "ring-1 ring-success/30",
      def.comingSoon && "opacity-60"
    )}>
      {/* Card top */}
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between mb-4">
          {/* Icon */}
          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", def.iconBg)}>
            {def.icon}
          </div>

          {/* Points badge */}
          <div className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border",
            earned ? "bg-success-bg text-success border-success/20" : def.ptsBadge
          )}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {earned ? `+${stamp?.score_contribution?.toFixed(0) ?? def.pts.replace("up to ", "")}` : def.pts}
          </div>
        </div>

        <h3 className="font-bold text-base mb-1 flex items-center gap-2">
          {def.label}
          {earned && <CheckCircle className="h-4 w-4 text-success" />}
          {def.comingSoon && (
            <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming soon</span>
          )}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{def.description}</p>

        {/* Earned details */}
        {earned && stamp && !stampsLoading && (
          <div className="mt-3 bg-success-bg rounded-xl px-3 py-2.5 text-xs text-success space-y-1">
            {def.type === "github" && (
              <>
                <p className="font-semibold">{String(meta?.github_username ?? "")}</p>
                <p className="text-success/70">{String(meta?.account_age_days ?? "")} days · {String(meta?.public_repos ?? "")} repos · {String(meta?.tier ?? "")} tier</p>
              </>
            )}
            {def.type === "gitcoin_passport" && (
              <p className="font-semibold">Score {String(meta?.gitcoin_score ?? "")} · {String(meta?.tier ?? "")} tier</p>
            )}
            {def.type === "email" && (
              <p className="font-semibold">Email verified via magic link</p>
            )}
            {stamp.expires_at && (
              <p className="flex items-center gap-1 text-success/70">
                <Clock className="h-3 w-3" />
                Expires {new Date(stamp.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
              </p>
            )}
          </div>
        )}

        {/* External link */}
        {def.externalLink && !earned && (
          <a
            href={def.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 font-medium mt-3"
          >
            Create/manage your passport <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Card bottom — action area */}
      {!def.comingSoon && !stampsLoading && (
        <div className="px-5 pb-5 space-y-2.5">
          {def.inputType === "github" && (
            <>
              <input
                className="input-base w-full text-sm"
                placeholder="username or https://github.com/username"
                value={githubInput}
                onChange={(e) => onGithubInput(e.target.value)}
                disabled={githubPending}
              />
              {githubMsg && (
                <p className={cn("text-xs flex items-start gap-1.5", githubMsg.ok ? "text-success" : "text-destructive")}>
                  {githubMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {githubMsg.text}
                </p>
              )}
              <Button
                type="button"
                className="w-full"
                variant={earned ? "outline" : "default"}
                disabled={!githubInput.trim() || githubPending}
                onClick={onGithubVerify}
              >
                {githubPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitBranch className="h-4 w-4 mr-2" />}
                {earned ? "Re-verify" : "Connect GitHub"}
              </Button>
            </>
          )}

          {def.inputType === "gitcoin" && (
            <>
              <input
                className="input-base w-full text-sm font-mono"
                placeholder="0x..."
                value={gitcoinInput}
                onChange={(e) => onGitcoinInput(e.target.value)}
                disabled={gitcoinPending}
              />
              {gitcoinMsg && (
                <p className={cn("text-xs flex items-start gap-1.5", gitcoinMsg.ok ? "text-success" : "text-destructive")}>
                  {gitcoinMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {gitcoinMsg.text}
                </p>
              )}
              <Button
                type="button"
                className="w-full"
                variant={earned ? "outline" : "default"}
                disabled={!gitcoinInput.trim() || gitcoinPending}
                onClick={onGitcoinVerify}
              >
                {gitcoinPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                {earned ? "Refresh" : "Connect Passport"}
              </Button>
            </>
          )}

          {def.type === "email" && (
            <div className={cn(
              "w-full h-10 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold",
              earned
                ? "bg-success-bg text-success"
                : "bg-muted text-muted-foreground"
            )}>
              {earned ? (
                <><CheckCircle className="h-4 w-4" /> Verified automatically</>
              ) : (
                <><AlertCircle className="h-4 w-4" /> Sign in via magic link to earn</>
              )}
            </div>
          )}
        </div>
      )}

      {def.comingSoon && (
        <div className="px-5 pb-5">
          <div className="w-full h-10 rounded-xl bg-muted flex items-center justify-center text-sm text-muted-foreground font-medium">
            <Zap className="h-4 w-4 mr-2" /> Coming soon
          </div>
        </div>
      )}
    </div>
  );
}
