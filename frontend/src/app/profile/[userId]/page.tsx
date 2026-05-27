"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type UserCredential, type PublicSubmissionItem, type VouchItem } from "@/lib/api";
import { ShareCard } from "@/components/share-card";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Award, MapPin, Calendar, Share2, ExternalLink, CheckCircle,
  ShieldCheck, Clock, Loader2, UserCircle, Eye, EyeOff,
  FileText, Users, UserPlus, ChevronLeft, ChevronRight,
} from "lucide-react";

// ── Domain helpers ────────────────────────────────────────────────────────────

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

function scoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-primary";
  return "text-gold";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ── Credential card ───────────────────────────────────────────────────────────

function CredentialCard({ cred, holderName }: { cred: UserCredential; holderName?: string }) {
  const isExpired = cred.valid_until ? new Date(cred.valid_until) < new Date() : false;

  return (
    <Card className={cn("relative overflow-hidden", isExpired && "opacity-60")}>
      <div className={cn("h-1.5 w-full", domainStripe(cred.domain))} />
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-base leading-snug">{cred.skill_path_name}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{cred.level_label}</p>
          </div>
          <span className={cn("text-2xl font-black shrink-0", scoreColor(cred.score))}>
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
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Earned {fmtDate(cred.created_at)}</p>
          {cred.valid_until && (
            <p className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Valid until {fmtDate(cred.valid_until)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Link
            href={`/credentials/${cred.id}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 font-medium"
          >
            Verify <ExternalLink className="h-3 w-3" />
          </Link>
          <ShareCard
            data={{
              credentialId: cred.id,
              skillPathName: cred.skill_path_name,
              levelLabel: cred.level_label,
              domain: cred.domain,
              score: cred.score,
              verifiedByHuman: cred.verified_by_human,
              holderName,
              earnedOn: cred.created_at,
            }}
            trigger={
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium">
                <Share2 className="h-3 w-3" /> Share
              </span>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Submission row ────────────────────────────────────────────────────────────

function SubmissionRow({ item }: { item: PublicSubmissionItem }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={cn("w-1 self-stretch rounded-full shrink-0", domainStripe(item.domain))} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold truncate">{item.skill_path_name}</p>
          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", domainColor(item.domain))}>
            {item.domain}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Lv {item.level}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {fmtDate(item.submitted_at)}
          {item.reviewed_at && ` · reviewed ${fmtDate(item.reviewed_at)}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        {item.score != null ? (
          <p className={cn("text-lg font-black tabular-nums", scoreColor(item.score))}>
            {item.score.toFixed(0)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Pending</p>
        )}
        {item.credential_id && (
          <Link
            href={`/credentials/${item.credential_id}`}
            className="text-[10px] text-primary hover:underline underline-offset-2"
          >
            credential ↗
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Vouch row ─────────────────────────────────────────────────────────────────

function VouchRow({ vouch }: { vouch: VouchItem }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
        {vouch.voucher_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{vouch.voucher_name}</p>
        <p className="text-xs text-muted-foreground">{fmtDate(vouch.created_at)}</p>
      </div>
      <CheckCircle className="h-4 w-4 text-success shrink-0" />
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

type Tab = "credentials" | "submissions" | "vouches";

function TabBtn({ active, label, count, onClick }: {
  active: boolean; label: string; count: number | null; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
      )}
    >
      {label}
      {count != null && (
        <span className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
          active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { profile: myProfile, session } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = myProfile?.id === userId;
  const isLoggedIn = !!session;

  const [activeTab, setActiveTab] = useState<Tab>("credentials");
  const [submPage, setSubmPage] = useState(0);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.users.get(userId),
  });

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ["user-credentials", userId],
    queryFn: () => api.users.credentials(userId),
    enabled: !!userId,
  });

  const { data: myDecayStatus, isLoading: decayLoading } = useQuery({
    queryKey: ["my-credential-visibility"],
    queryFn: () => api.credentials.myDecayStatus(),
    enabled: isOwner,
  });

  const { data: submHistory, isLoading: submLoading } = useQuery({
    queryKey: ["user-submissions", userId, submPage],
    queryFn: () => api.users.submissions(userId, PAGE_SIZE, submPage * PAGE_SIZE),
    enabled: activeTab === "submissions",
  });

  const { data: vouchData, isLoading: vouchLoading } = useQuery({
    queryKey: ["user-vouches", userId],
    queryFn: () => api.users.vouches(userId),
    enabled: activeTab === "vouches",
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { mutate: setCredVisibility, isPending: visibilitySaving } = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      api.credentials.setVisibility(id, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-credential-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["user-credentials", userId] });
    },
  });

  const { mutate: doVouch, isPending: vouchPending, isSuccess: vouchDone, error: vouchError } = useMutation({
    mutationFn: () => api.users.vouch(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-vouches", userId] }),
  });

  // ── Loading / error states ────────────────────────────────────────────────

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

  const totalSubmPages = submHistory ? Math.ceil(submHistory.total / PAGE_SIZE) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">

      {/* Profile header */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 mb-6 flex flex-col sm:flex-row items-start gap-5">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden text-primary font-bold text-lg">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" />
          ) : (
            <UserCircle className="h-9 w-9 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-extrabold truncate">{user.display_name}</h1>
          {user.username && (
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {user.country_code && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {user.country_code}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Joined {fmtMonth(user.created_at.toString())}
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

        <div className="flex flex-wrap gap-2 shrink-0">
          {/* Vouch button (non-owner authenticated users) */}
          {isLoggedIn && !isOwner && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => doVouch()}
              disabled={vouchPending || vouchDone}
            >
              {vouchPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : vouchDone ? (
                <CheckCircle className="h-3.5 w-3.5 text-success" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {vouchDone ? "Vouched!" : "Vouch"}
            </Button>
          )}
          {vouchError && (
            <p className="text-xs text-destructive self-center">{(vouchError as Error).message}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
          {isOwner && (
            <Link href="/assess" className={buttonVariants({ size: "sm" })}>
              Take assessment
            </Link>
          )}
          {user.username && (
            <Link
              href={`/u/${user.username}`}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
            >
              Proof page <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Credential visibility panel (owner only) */}
      {isOwner && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Manage credential visibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decayLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !myDecayStatus?.credentials.length ? (
              <p className="text-sm text-muted-foreground">Earn a credential to control its public visibility.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {myDecayStatus.credentials.map((cred) => (
                  <div key={cred.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{cred.skill_path_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {cred.level} · {cred.level_label} · {cred.raw_score.toFixed(0)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={cred.is_public ? "outline" : "default"}
                      disabled={visibilitySaving}
                      onClick={() => setCredVisibility({ id: cred.id, isPublic: !cred.is_public })}
                      className="gap-1.5 shrink-0"
                    >
                      {cred.is_public
                        ? <><Eye className="h-3.5 w-3.5" /> Public</>
                        : <><EyeOff className="h-3.5 w-3.5" /> Private</>}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b mb-6 flex gap-0 overflow-x-auto">
        <TabBtn
          active={activeTab === "credentials"}
          label="Credentials"
          count={credentials.length}
          onClick={() => setActiveTab("credentials")}
        />
        <TabBtn
          active={activeTab === "submissions"}
          label="Submissions"
          count={submHistory?.total ?? null}
          onClick={() => { setActiveTab("submissions"); setSubmPage(0); }}
        />
        <TabBtn
          active={activeTab === "vouches"}
          label="Vouches"
          count={vouchData?.vouch_count ?? null}
          onClick={() => setActiveTab("vouches")}
        />
      </div>

      {/* ── Credentials tab ─────────────────────────────────────────────── */}
      {activeTab === "credentials" && (
        <>
          {credsLoading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : credentials.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center">
                <Award className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No credentials earned yet.</p>
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
                <CredentialCard key={cred.id} cred={cred} holderName={user.display_name} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Submissions tab ─────────────────────────────────────────────── */}
      {activeTab === "submissions" && (
        <>
          {submLoading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !submHistory?.items.length ? (
            <Card>
              <CardContent className="py-14 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No public submissions yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-0 divide-y divide-border/60">
                {submHistory.items.map((item) => <SubmissionRow key={item.id} item={item} />)}
              </CardContent>
            </Card>
          )}

          {totalSubmPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <button
                type="button"
                onClick={() => setSubmPage((p) => Math.max(0, p - 1))}
                disabled={submPage === 0}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="text-sm text-muted-foreground">Page {submPage + 1} of {totalSubmPages}</span>
              <button
                type="button"
                onClick={() => setSubmPage((p) => Math.min(totalSubmPages - 1, p + 1))}
                disabled={submPage >= totalSubmPages - 1}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Vouches tab ─────────────────────────────────────────────────── */}
      {activeTab === "vouches" && (
        <>
          {vouchLoading ? (
            <div className="flex justify-center py-14"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !vouchData?.vouches.length ? (
            <Card>
              <CardContent className="py-14 text-center">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No vouches yet.</p>
                {isLoggedIn && !isOwner && (
                  <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => doVouch()} disabled={vouchPending || vouchDone}>
                    <UserPlus className="h-3.5 w-3.5" /> Be the first to vouch
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  {vouchData.vouch_count} verified {vouchData.vouch_count === 1 ? "person has" : "people have"} vouched for {user.display_name.split(" ")[0]}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 divide-y divide-border/60">
                {vouchData.vouches.map((v) => <VouchRow key={v.id} vouch={v} />)}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
