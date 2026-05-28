import Link from "next/link";
import type { Metadata } from "next";
import { api, type PendingCredential, type UserResponse, type UserCredential } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Award, Calendar, Clock, ExternalLink, MapPin,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyLinkButton } from "./copy-link-button";
import { PrivateProofPage } from "./private-proof-page";

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchUser(username: string): Promise<UserResponse | null> {
  try {
    return await api.users.byUsername(username);
  } catch {
    return null;
  }
}

async function fetchCredentials(userId: string): Promise<UserCredential[]> {
  try {
    return await api.users.credentials(userId);
  } catch {
    return [];
  }
}

async function fetchPendingCredentials(userId: string): Promise<PendingCredential[]> {
  try {
    return await api.users.pendingCredentials(userId);
  } catch {
    return [];
  }
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  const user = await fetchUser(username);
  if (!user) {
    return { title: "Profile not found — Maxx Engage" };
  }
  const noIndex = user.proof_page_visibility === "unlisted";
  const ogTitle       = `${user.display_name} (@${username})`;
  const ogDescription = user.bio ?? `Verified skill credentials for ${user.display_name} on Maxx Engage.`;
  const ogImage       = `/u/${username}/opengraph-image`;
  return {
    title: `${user.display_name} (@${username})`,
    description: ogDescription,
    robots: noIndex ? "noindex, nofollow" : "index, follow",
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: `/u/${username}`,
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: ogTitle,
      description: ogDescription,
      images: [ogImage],
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// ── Credential card ─────────────────────────────────────────────────────────

function CredentialCard({ cred }: { cred: UserCredential }) {
  const earnedOn = new Date(cred.created_at).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  const validUntil = cred.valid_until
    ? new Date(cred.valid_until).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : null;
  const isExpired = cred.valid_until ? new Date(cred.valid_until) < new Date() : false;

  return (
    <Card className={cn("relative overflow-hidden", isExpired && "opacity-60")}>
      <div className={cn("h-1.5 w-full", domainStripe(cred.domain))} />
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-bold leading-snug truncate">{cred.skill_path_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{cred.level_label}</p>
          </div>
          <span className={cn("text-2xl font-black shrink-0", scoreColor(cred.score))}>
            {Math.round(cred.score)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
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
          {validUntil && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Valid until {validUntil}
            </span>
          )}
        </div>

        <Link
          href={`/verify?id=${cred.id}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 font-medium"
        >
          Verify credential <ExternalLink className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function PendingCredentialCard({ item }: { item: PendingCredential }) {
  const reviewedOn = item.reviewed_at
    ? new Date(item.reviewed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Card className="relative overflow-hidden opacity-75">
      <div className="h-1.5 w-full bg-muted-foreground/30" />
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-bold leading-snug truncate">{item.skill_path_name}</CardTitle>
        <p className="text-sm text-muted-foreground mt-0.5">Pending human review</p>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className={cn("text-xs", domainColor(item.domain))}>{item.domain}</Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="h-3 w-3" /> Review within 48 hours
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground flex flex-col gap-1">
          <span className="flex items-center gap-1.5">
            <Award className="h-3 w-3" /> AI score {Math.round(item.score)}/100
          </span>
          {reviewedOn && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Submitted {reviewedOn}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function UserProofPage(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const user = await fetchUser(username);

  if (!user) return <PrivateProofPage username={username} />;

  const [credentials, pendingCredentials] = await Promise.all([
    fetchCredentials(user.id),
    fetchPendingCredentials(user.id),
  ]);
  const joinedOn = new Date(user.created_at).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });

  const proofPageUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://maxx-engage-ai.vercel.app"}/u/${username}`;

  return (
    <main className="max-w-3xl px-6 py-10">

      {/* Profile header */}
      <div className="bg-card rounded-2xl border shadow-sm p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-black text-primary">{initials(user.display_name) || "ME"}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold truncate">{user.display_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">@{username}</p>

            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              {user.location ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {user.location}
                </span>
              ) : user.country_code ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {user.country_code}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Joined {joinedOn}
              </span>
            </div>

            {user.bio && (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0 sm:self-start">
            <Link
              href={`/verify?user=${username}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Verify
            </Link>
          </div>
        </div>

        {/* Credential count summary */}
        {credentials.length > 0 && (
          <div className="mt-5 pt-5 border-t flex items-center gap-2 text-sm">
            <Award className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{credentials.length}</span>
            <span className="text-muted-foreground">
              verified credential{credentials.length !== 1 ? "s" : ""}
            </span>
            {user.overall_score > 0 && (
              <span className="ml-auto text-xs text-muted-foreground">
                overall score: <strong className="text-foreground">{Math.round(user.overall_score)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="mb-5">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          Verified Credentials
        </h2>
      </div>

      {credentials.length === 0 && pendingCredentials.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Award className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground text-sm">
              @{username} hasn&apos;t earned any credentials yet. They&apos;re working on it.
            </p>
            <Link
              href="/assess"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-4")}
            >
              Try a skill assessment yourself
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {credentials.map((cred) => (
            <CredentialCard key={cred.id} cred={cred} />
          ))}
          {pendingCredentials.map((item) => (
            <PendingCredentialCard key={item.review_id} item={item} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 pt-6 border-t text-center text-xs text-muted-foreground">
        <p>
          Credentials verified by{" "}
          <Link href="/" className="text-primary font-medium hover:underline underline-offset-2">
            Maxx Engage
          </Link>{" "}
          &middot; AI-graded against transparent rubrics
        </p>
        <p className="mt-1">
          <CopyLinkButton url={proofPageUrl} />
        </p>
      </div>

    </main>
  );
}
