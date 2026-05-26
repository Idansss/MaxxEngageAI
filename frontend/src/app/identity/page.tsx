"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Navbar } from "@/components/navbar";
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
    color: "bg-blue-100 text-blue-700",
  },
  github: {
    label: "GitHub",
    icon: <GitBranch className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-700",
  },
  gitcoin_passport: {
    label: "Gitcoin Passport",
    icon: <ShieldCheck className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-700",
  },
  phone: {
    label: "Phone",
    icon: <Zap className="h-4 w-4" />,
    color: "bg-green-100 text-green-700",
  },
};

function StampBadge({ type, active }: { type: string; active: boolean }) {
  const meta = STAMP_META[type] ?? { label: type, icon: null, color: "bg-gray-100 text-gray-600" };
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", meta.color, !active && "opacity-50 line-through")}>
      {meta.icon}
      {meta.label}
    </div>
  );
}

export default function IdentityPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const qc = useQueryClient();

  const [githubUsername, setGitBranchUsername] = useState("");
  const [ethAddress, setEthAddress] = useState("");
  const [githubMsg, setGitBranchMsg] = useState<{ ok: boolean; text: string } | null>(null);
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

  const githubMutation = useMutation({
    mutationFn: () => api.identity.stampGitHub(githubUsername.trim()),
    onSuccess: (data) => {
      setGitBranchMsg({ ok: true, text: data.message });
      qc.invalidateQueries({ queryKey: ["my-humanity-score"] });
      qc.invalidateQueries({ queryKey: ["my-stamps"] });
    },
    onError: (e: Error) => setGitBranchMsg({ ok: false, text: e.message }),
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const score = scoreData?.humanity_score ?? 0;
  const fullWeight = scoreData?.full_weight_achieved ?? false;
  const stamps = stampsData?.stamps ?? [];
  const earnedTypes = new Set(stamps.filter((s) => s.active).map((s) => s.stamp_type));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-purple-600" />
            Identity verification
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Collect stamps to prove you&apos;re a real person. A humanity score of 50+ gives your credentials full public weight.
          </p>
        </div>

        {/* Humanity score card */}
        <Card className={fullWeight ? "border-green-200" : "border-amber-200"}>
          <CardContent className="pt-6 pb-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Humanity score</p>
                <p className="text-3xl font-bold mt-0.5">{score.toFixed(0)}<span className="text-base font-normal text-muted-foreground">/100</span></p>
              </div>
              {fullWeight ? (
                <div className="flex items-center gap-1.5 text-green-700 bg-green-100 rounded-full px-3 py-1.5 text-sm font-medium">
                  <CheckCircle className="h-4 w-4" /> Full weight
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-100 rounded-full px-3 py-1.5 text-sm font-medium">
                  <AlertCircle className="h-4 w-4" /> Incomplete
                </div>
              )}
            </div>

            <Progress value={score} className="h-3" />

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

        {/* Email stamp — auto-awarded */}
        <Card className={earnedTypes.has("email") ? "border-blue-200 bg-blue-50/20" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Email verification
                <Badge className="bg-blue-100 text-blue-700 text-xs">+10 pts</Badge>
              </span>
              {earnedTypes.has("email") && (
                <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Earned
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Automatically awarded when you sign in via magic link — your email address is verified.
            </p>
          </CardContent>
        </Card>

        {/* GitHub stamp */}
        <Card className={earnedTypes.has("github") ? "border-gray-300 bg-gray-50/30" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                GitHub account
                <Badge className="bg-gray-100 text-gray-700 text-xs">up to +35 pts</Badge>
              </span>
              {earnedTypes.has("github") && (
                <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Earned
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Standard (+25): account ≥ 6 months old, at least 1 public repo or follower</p>
              <p>Senior (+35): account ≥ 2 years old AND ≥ 10 public repos</p>
            </div>

            {stampsLoading ? null : (
              <>
                {earnedTypes.has("github") && (() => {
                  const s = stamps.find((x) => x.stamp_type === "github");
                  const meta = s?.metadata as Record<string, unknown> | undefined;
                  return s ? (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                      <p>Username: <strong>{String(meta?.github_username ?? "")}</strong></p>
                      <p>Account age: {String(meta?.account_age_days ?? "")} days &middot; {String(meta?.public_repos ?? "")} repos &middot; Tier: {String(meta?.tier ?? "")}</p>
                      {s.expires_at && (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(s.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}

                <div className="flex gap-2">
                  <input
                    className="flex-1 text-sm rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                    placeholder="your-github-username"
                    value={githubUsername}
                    onChange={(e) => { setGitBranchUsername(e.target.value); setGitBranchMsg(null); }}
                    disabled={githubMutation.isPending}
                  />
                  <Button
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
                  <p className={cn("text-xs flex items-start gap-1.5", githubMsg.ok ? "text-green-700" : "text-destructive")}>
                    {githubMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                    {githubMsg.text}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Gitcoin Passport stamp */}
        <Card className={earnedTypes.has("gitcoin_passport") ? "border-purple-200 bg-purple-50/20" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                Gitcoin Passport
                <Badge className="bg-purple-100 text-purple-700 text-xs">up to +35 pts</Badge>
              </span>
              {earnedTypes.has("gitcoin_passport") && (
                <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Earned
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Connects Web2 + Web3 stamps. Requires an Ethereum wallet address.</p>
              <p>Tiers: score 1–9 → +5, 10–19 → +15, 20–49 → +25, 50+ → +35. Expires after 90 days.</p>
            </div>

            <a
              href="https://passport.gitcoin.co"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              Create/manage your passport <ExternalLink className="h-3 w-3" />
            </a>

            {stampsLoading ? null : (
              <>
                {earnedTypes.has("gitcoin_passport") && (() => {
                  const s = stamps.find((x) => x.stamp_type === "gitcoin_passport");
                  const meta = s?.metadata as Record<string, unknown> | undefined;
                  return s ? (
                    <div className="bg-purple-50 rounded-lg px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                      <p>Gitcoin score: <strong>{String(meta?.gitcoin_score ?? "")}</strong> &middot; Tier: {String(meta?.tier ?? "")}</p>
                      {s.expires_at && (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {new Date(s.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                  ) : null;
                })()}

                <div className="flex gap-2">
                  <input
                    className="flex-1 text-xs rounded-md border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground font-mono"
                    placeholder="0x..."
                    value={ethAddress}
                    onChange={(e) => { setEthAddress(e.target.value); setGitcoinMsg(null); }}
                    disabled={gitcoinMutation.isPending}
                  />
                  <Button
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
                  <p className={cn("text-xs flex items-start gap-1.5", gitcoinMsg.ok ? "text-green-700" : "text-destructive")}>
                    {gitcoinMsg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                    {gitcoinMsg.text}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Phone — coming soon */}
        <Card className="opacity-60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-600" />
              Phone number
              <Badge variant="outline" className="text-xs">+20 pts — Coming soon</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              SMS OTP verification. Particularly useful for learners without GitHub or ETH wallet.
            </p>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
