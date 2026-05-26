"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type UserCredential } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Award, MapPin, Calendar, Share2, ExternalLink,
  ShieldCheck, Clock, Loader2, UserCircle, Eye, EyeOff,
} from "lucide-react";

function domainColor(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-primary/10 text-primary",
    design: "bg-violet-100 text-violet-700",
    data: "bg-emerald-100 text-emerald-700",
    writing: "bg-amber-100 text-amber-700",
    business: "bg-orange-100 text-orange-700",
    ops: "bg-slate-100 text-slate-700",
    science: "bg-teal-100 text-teal-700",
  };
  return map[domain] ?? "bg-muted text-muted-foreground";
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
  return map[domain] ?? "bg-muted-foreground/30";
}

function scoreRingClass(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-primary";
  return "text-gold";
}

function CredentialCard({ cred }: { cred: UserCredential }) {
  const isExpired = cred.valid_until ? new Date(cred.valid_until) < new Date() : false;
  const validUntil = cred.valid_until
    ? new Date(cred.valid_until).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "No expiry";
  const earnedOn = new Date(cred.created_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });

  return (
    <Card className={cn("relative overflow-hidden card-hover", isExpired && "opacity-60")}>
      <div className={cn("h-1.5 w-full", domainStripe(cred.domain))} />
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold leading-snug">{cred.skill_path_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{cred.level_label}</p>
          </div>
          <span className={cn("text-2xl font-black shrink-0", scoreRingClass(cred.score))}>
            {cred.score.toFixed(0)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className={cn("text-xs", domainColor(cred.domain))}>{cred.domain}</Badge>
          <Badge variant="secondary" className="text-xs">Level {cred.level}</Badge>
          {cred.verified_by_human && (
            <Badge variant="secondary" className="bg-success-bg text-success text-xs gap-1">
              <ShieldCheck className="h-3 w-3" /> Human verified
            </Badge>
          )}
          {isExpired && <Badge variant="destructive" className="text-xs">Expired</Badge>}
        </div>

        <div className="text-xs text-muted-foreground flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3 w-3" /> Earned {earnedOn}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Valid until {validUntil}
          </span>
        </div>

        <Link
          href={`/credentials/${cred.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 font-medium"
        >
          Verify credential <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile: myProfile } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = myProfile?.id === userId;

  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.users.get(userId),
  });

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ["user-credentials", userId],
    queryFn: () => api.users.credentials(userId),
    enabled: !!userId,
  });

  const { data: myCredentialStatus, isLoading: ownerCredsLoading } = useQuery({
    queryKey: ["my-credential-visibility"],
    queryFn: () => api.credentials.myDecayStatus(),
    enabled: isOwner,
  });

  const { mutate: setVisibility, isPending: visibilitySaving } = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.credentials.setVisibility(id, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-credential-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["user-credentials", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-credentials", myProfile?.id] });
    },
  });

  const shareProfile = () => {
    navigator.clipboard?.writeText(window.location.href);
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userError || !user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground text-sm">Profile not found.</p>
        <Link href="/" className="text-sm text-primary font-medium hover:underline mt-2 inline-block underline-offset-2">
          Go home
        </Link>
      </div>
    );
  }

  const joinedOn = new Date(user.created_at).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">

      {/* Profile header */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 mb-8 flex flex-col sm:flex-row items-start gap-5">
        <div className="h-18 w-18 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <UserCircle className="h-9 w-9 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{user.display_name}</h1>

          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {user.country_code && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {user.country_code}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Joined {joinedOn}
            </span>
            {user.overall_score > 0 && (
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Award className="h-3.5 w-3.5 text-primary" />
                {user.overall_score.toFixed(0)} overall score
              </span>
            )}
          </div>

          {user.bio && <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{user.bio}</p>}
        </div>

        <div className="flex gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={shareProfile} className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          {isOwner && (
            <Link href="/assess" className={buttonVariants({ size: "sm" })}>Take assessment</Link>
          )}
        </div>
      </div>

      {/* Visibility panel (owner only) */}
      {isOwner && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Credential visibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ownerCredsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !myCredentialStatus?.credentials.length ? (
              <p className="text-sm text-muted-foreground">
                Earn a credential, then choose whether it appears on this public profile.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {myCredentialStatus.credentials.map((cred) => (
                  <div key={cred.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{cred.skill_path_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {cred.level} · {cred.level_label} · score {cred.raw_score.toFixed(0)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={cred.is_public ? "outline" : "default"}
                      disabled={visibilitySaving}
                      onClick={() => setVisibility({ id: cred.id, isPublic: !cred.is_public })}
                      className="gap-1.5 shrink-0"
                    >
                      {cred.is_public ? (
                        <><Eye className="h-3.5 w-3.5" /> Public</>
                      ) : (
                        <><EyeOff className="h-3.5 w-3.5" /> Private</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Credentials */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Verified Credentials
          {credentials.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({credentials.length})</span>
          )}
        </h2>
      </div>

      {credsLoading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : credentials.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Award className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm">No credentials earned yet.</p>
            {isOwner && (
              <Link href="/assess" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                Take your first assessment
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {credentials.map((cred) => (
            <CredentialCard key={cred.id} cred={cred} />
          ))}
        </div>
      )}
    </main>
  );
}
