"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  CheckCircle, Copy, Gift, Loader2, Share2, ShieldCheck, Users,
} from "lucide-react";

export default function ReferralPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["referral-status"],
    queryFn: () => api.referrals.my(),
    enabled: !!session,
  });

  function copyLink() {
    if (!data?.invite_url) return;
    navigator.clipboard.writeText(data.invite_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareLink() {
    if (!data?.invite_url) return;
    if (navigator.share) {
      navigator.share({
        title: "Join me on Maxx Engage",
        text: "Prove your skills and earn tamper-proof credentials. Use my invite link:",
        url: data.invite_url,
      }).catch(() => { /* user cancelled */ });
    } else {
      copyLink();
    }
  }

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = data ? Math.min(data.referral_count / data.stamp_threshold, 1) : 0;
  const pct = Math.round(progress * 100);

  return (
    <main className="px-6 py-10">

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">Referrals</p>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <Gift className="h-7 w-7 text-primary" />
          Invite friends
        </h1>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          Share your invite link. When {data?.stamp_threshold ?? 3} friends sign up and get started,
          you earn a <strong className="text-foreground">+{data?.stamp_points ?? 15}</strong> humanity score stamp.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <div className="space-y-5">

          {/* Invite link card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Share2 className="h-4 w-4 text-muted-foreground" />
                Your invite link
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
                <p className="flex-1 text-sm font-mono truncate text-foreground/80 select-all">
                  {data.invite_url}
                </p>
                <button
                  type="button"
                  onClick={copyLink}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors",
                    copied
                      ? "bg-success/10 text-success"
                      : "bg-background border border-border text-foreground hover:bg-muted"
                  )}
                >
                  {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                type="button"
                onClick={shareLink}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Share2 className="h-4 w-4" />
                Share invite link
              </button>
              <p className="text-xs text-muted-foreground text-center">
                Referral code: <span className="font-mono font-bold text-foreground">{data.referral_code}</span>
              </p>
            </CardContent>
          </Card>

          {/* Progress card */}
          <Card className={cn(data.stamp_awarded && "ring-1 ring-success/30")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className={cn("h-4 w-4", data.stamp_awarded ? "text-success" : "text-muted-foreground")} />
                Stamp progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.stamp_awarded ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success-bg">
                  <CheckCircle className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-success">Stamp earned!</p>
                    <p className="text-xs text-success/70 mt-0.5">
                      +{data.stamp_points} points added to your humanity score.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {data.referral_count} / {data.stamp_threshold} friends joined
                    </span>
                    <span className="font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.stamp_threshold - data.referral_count} more friend{data.stamp_threshold - data.referral_count !== 1 ? "s" : ""} needed to earn{" "}
                    <strong className="text-foreground">+{data.stamp_points} humanity score</strong>.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* How it works */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {[
                  { n: "1", text: "Share your invite link with anyone — no limit." },
                  { n: "2", text: "They sign up and create their Maxx Engage account." },
                  { n: "3", text: `Once ${data.stamp_threshold} friends join, you automatically earn +${data.stamp_points} humanity score — no action needed.` },
                ].map((step) => (
                  <li key={step.n} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.n}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.text}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

        </div>
      ) : null}
    </main>
  );
}
