"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, GitBranch, CheckCircle, XCircle, Loader2,
  AlertCircle, ExternalLink, Clock, Zap,
} from "lucide-react";

const STAMP_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  email: {
    label: "Email",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-primary/10 text-primary",
  },
  github: {
    label: "GitHub",
    icon: <GitBranch className="h-4 w-4" />,
    color: "bg-muted text-muted-foreground",
  },
  gitcoin_passport: {
    label: "Gitcoin Passport",
    icon: <ShieldCheck className="h-4 w-4" />,
    color: "bg-violet-100 text-violet-700",
  },
  phone: {
    label: "Phone",
    icon: <Zap className="h-4 w-4" />,
    color: "bg-success-bg text-success",
  },
};

function StampBadge({ type, active }: { type: string; active: boolean }) {
  const meta = STAMP_META[type] ?? { label: type, icon: null, color: "bg-muted text-muted-foreground" };
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
      meta.color,
      !active && "opacity-40 line-through"
    )}>
      {meta.icon}
      {meta.label}
    </div>
  );
}

export default function IdentityPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const qc = useQueryClient();

  const [githubUsername, setGithubUsername] = useState("");
  const [ethAddress, setEthAddress] = useState("");
  const [githubMsg, setGithubMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [gitcoinMsg, setGitcoinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const { data: scoreData, isLoading: scoreLoading } = useQuery({
    queryKey: ["my-humanity-score"],
    queryFn: () => api.identity.myScore(),
    enabled: !!session,
  });

  const { data: stampsData, isLoading: stampsLoading } = useQuery({
    queryKey: ["my-stamps"],
    queryFn: () => api.identity.myStamps(),
    enabled: !!session,
  });

  function parseGithubUsername(raw: string): string {
    const trimmed = raw.trim();
    // Accept full URLs like https://github.com/username
    const match = trimmed.match(/github\.com\/([^/?#]+)/);
    return match ? match[1] : trimmed;
  }

  const githubMutation = useMutation({
    mutationFn: () => api.identity.stampGitHub(parseGithubUsername(githubUsername)),
    onSuccess: (data) => {
      setGithubMsg({ ok: true, text: data.message });
      qc.invalidateQueries({ queryKey: ["my-humanity-score"] });
      qc.invalidateQueries({ queryKey: ["my-stamps"] });
    },
    onError: (e: Error) => setGithubMsg({ ok: false, text: e.message }),
  });

  const gitcoinMutation = useMutation({
    mutationFn: () => api.identity.stampGitcoin(ethAddress.trim()),
    onSuccess: (data) => {
      setGitcoinMsg({ ok: true, text: data.message });
      qc.invalidateQueries({ queryKey: ["my-humanity-score"] });
      qc.invalidateQueries({ queryKey: ["my-stamps"] });
    },
    onError: (e: Error) => setGitcoinMsg({ ok: false, text: e.message }),
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

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-2">Proof of personhood</p>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Identity verification
        </h1>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed max-w-lg">
          Collect stamps to prove you&apos;re a real person. A humanity score of 50+ gives your credentials full public weight.
        </p>
      </div>

      {/* Humanity score card */}
      <Card className={cn("overflow-hidden", fullWeight ? "ring-1 ring-(--success)/30" : "ring-1 ring-amber-300/30")}>
        <div className={cn("h-1.5 w-full", fullWeight ? "bg-success" : "bg-gold")} />
        <CardContent className="pt-6 pb-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Humanity score</p>
              <p className="text-4xl font-black mt-0.5">
                {score.toFixed(0)}
                <span className="text-base font-normal text-muted-foreground">/100</span>
              </p>
            </div>
            {fullWeight ? (
              <div className="flex items-center gap-1.5 text-success bg-success-bg rounded-full px-4 py-1.5 text-sm font-semibold">
                <CheckCircle className="h-4 w-4" /> Full weight
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-700 bg-amber-100 rounded-full px-4 py-1.5 text-sm font-semibold">
                <AlertCircle className="h-4 w-4" /> Incomplete
              </div>
            )}
          </div>

          <Progress value={score} className="h-2.5" />

          <div className="flex flex-wrap gap-2">
            {scoreLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : stamps.length > 0 ? (
              stamps.map((s) => <StampBadge key={s.stamp_type} type={s.stamp_type} active={s.active} />)
            ) : (
              <p className="text-xs text-muted-foreground">No stamps yet — earn your first one below.</p>
            )}
          </div>

          {!fullWeight && (
            <p className="text-xs text-muted-foreground">
              Need {Math.max(0, 50 - score).toFixed(0)} more points to reach full credential weight.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Email stamp */}
      <Card className={cn("overflow-hidden", earnedTypes.has("email") && "ring-1 ring-(--success)/20")}>
        {earnedTypes.has("email") && <div className="h-0.5 bg-success" />}
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Email verification
              <Badge className="bg-primary/10 text-primary text-xs">+10 pts</Badge>
            </span>
            {earnedTypes.has("email") && (
              <span className="text-xs font-semibold text-success flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Earned
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Automatically awarded when you sign in via magic link — your email address is verified.
          </p>
        </CardContent>
      </Card>

      {/* GitHub stamp */}
      <Card className={cn("overflow-hidden", earnedTypes.has("github") && "ring-1 ring-(--success)/20")}>
        {earnedTypes.has("github") && <div className="h-0.5 bg-success" />}
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitHub account
              <Badge variant="secondary" className="text-xs">up to +35 pts</Badge>
            </span>
            {earnedTypes.has("github") && (
              <span className="text-xs font-semibold text-success flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Earned
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
            <p>Standard (+25): account ≥ 6 months old, at least 1 public repo or follower</p>
            <p>Senior (+35): account ≥ 2 years old AND ≥ 10 public repos</p>
          </div>

          {!stampsLoading && (
            <>
              {earnedTypes.has("github") && (() => {
                const s = stamps.find((x) => x.stamp_type === "github");
                const meta = s?.metadata as Record<string, unknown> | undefined;
                return s ? (
                  <div className="bg-muted rounded-xl px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
                    <p>Username: <strong className="text-foreground">{String(meta?.github_username ?? "")}</strong></p>
                    <p>{String(meta?.account_age_days ?? "")} days old &middot; {String(meta?.public_repos ?? "")} repos &middot; Tier: {String(meta?.tier ?? "")}</p>
                    {s.expires_at && (
                      <p className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(s.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                ) : null;
              })()}

              <div className="flex gap-2">
                <input
                  className="input-base flex-1"
                  placeholder="username or https://github.com/username"
                  value={githubUsername}
                  onChange={(e) => { setGithubUsername(e.target.value); setGithubMsg(null); }}
                  disabled={githubMutation.isPending}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={earnedTypes.has("github") ? "outline" : "default"}
                  disabled={!githubUsername.trim() || githubMutation.isPending}
                  onClick={() => githubMutation.mutate()}
                  className="gap-1.5 shrink-0"
                >
                  {githubMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                  {earnedTypes.has("github") ? "Re-verify" : "Verify"}
                </Button>
              </div>

              {githubMsg && (
                <p className={cn("text-xs flex items-start gap-1.5", githubMsg.ok ? "text-success" : "text-destructive")}>
                  {githubMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {githubMsg.text}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Gitcoin stamp */}
      <Card className={cn("overflow-hidden", earnedTypes.has("gitcoin_passport") && "ring-1 ring-(--success)/20")}>
        {earnedTypes.has("gitcoin_passport") && <div className="h-0.5 bg-success" />}
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-violet-600" />
              Gitcoin Passport
              <Badge variant="secondary" className="text-xs">up to +35 pts</Badge>
            </span>
            {earnedTypes.has("gitcoin_passport") && (
              <span className="text-xs font-semibold text-success flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Earned
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-0.5 leading-relaxed">
            <p>Connects Web2 + Web3 stamps. Requires an Ethereum wallet address.</p>
            <p>Tiers: score 1–9 → +5, 10–19 → +15, 20–49 → +25, 50+ → +35. Expires after 90 days.</p>
          </div>

          <a
            href="https://passport.gitcoin.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 font-medium"
          >
            Create/manage your passport <ExternalLink className="h-3 w-3" />
          </a>

          {!stampsLoading && (
            <>
              {earnedTypes.has("gitcoin_passport") && (() => {
                const s = stamps.find((x) => x.stamp_type === "gitcoin_passport");
                const meta = s?.metadata as Record<string, unknown> | undefined;
                return s ? (
                  <div className="bg-violet-50 rounded-xl px-3 py-2.5 text-xs text-muted-foreground space-y-0.5">
                    <p>Gitcoin score: <strong>{String(meta?.gitcoin_score ?? "")}</strong> &middot; Tier: {String(meta?.tier ?? "")}</p>
                    {s.expires_at && (
                      <p className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(s.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>
                ) : null;
              })()}

              <div className="flex gap-2">
                <input
                  className="input-base flex-1 font-mono text-xs"
                  placeholder="0x..."
                  value={ethAddress}
                  onChange={(e) => { setEthAddress(e.target.value); setGitcoinMsg(null); }}
                  disabled={gitcoinMutation.isPending}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={earnedTypes.has("gitcoin_passport") ? "outline" : "default"}
                  disabled={!ethAddress.trim() || gitcoinMutation.isPending}
                  onClick={() => gitcoinMutation.mutate()}
                  className="gap-1.5 shrink-0"
                >
                  {gitcoinMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {earnedTypes.has("gitcoin_passport") ? "Refresh" : "Verify"}
                </Button>
              </div>

              {gitcoinMsg && (
                <p className={cn("text-xs flex items-start gap-1.5", gitcoinMsg.ok ? "text-success" : "text-destructive")}>
                  {gitcoinMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {gitcoinMsg.text}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Phone — coming soon */}
      <Card className="opacity-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-success" />
            Phone number
            <Badge variant="outline" className="text-xs">+20 pts — Coming soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            SMS OTP verification. Particularly useful for learners without GitHub or ETH wallet.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
