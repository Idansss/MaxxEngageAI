"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type UserCredential } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Award, MapPin, Calendar, Share2, ExternalLink,
  ShieldCheck, Clock, Loader2, UserCircle
} from "lucide-react";

function domainColor(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-blue-100 text-blue-700",
    design: "bg-purple-100 text-purple-700",
    data: "bg-green-100 text-green-700",
    writing: "bg-yellow-100 text-yellow-700",
    business: "bg-orange-100 text-orange-700",
    ops: "bg-slate-100 text-slate-700",
    science: "bg-teal-100 text-teal-700",
  };
  return map[domain] ?? "bg-gray-100 text-gray-700";
}

function scoreRing(score: number) {
  if (score >= 85) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  return "text-amber-600";
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
    <Card className={`relative overflow-hidden transition-shadow hover:shadow-md ${isExpired ? "opacity-60" : ""}`}>
      {/* coloured top stripe by domain */}
      <div className={`h-1 w-full ${cred.domain === "technology" ? "bg-blue-500" : cred.domain === "design" ? "bg-purple-500" : cred.domain === "data" ? "bg-green-500" : "bg-gray-400"}`} />

      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base leading-snug">{cred.skill_path_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{cred.level_label}</p>
          </div>
          <span className={`text-2xl font-bold shrink-0 ${scoreRing(cred.score)}`}>
            {cred.score.toFixed(0)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className={domainColor(cred.domain)}>{cred.domain}</Badge>
          <Badge variant="secondary">Level {cred.level}</Badge>
          {cred.verified_by_human && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
              <ShieldCheck className="h-3 w-3" /> Human verified
            </Badge>
          )}
          {isExpired && <Badge variant="destructive">Expired</Badge>}
        </div>

        <div className="text-xs text-muted-foreground flex flex-col gap-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Earned {earnedOn}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Valid until {validUntil}
          </span>
        </div>

        <Link
          href={`/credentials/${cred.id}`}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
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
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Profile not found.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline mt-2 inline-block">Go home</Link>
      </div>
    );
  }

  const joinedOn = new Date(user.created_at).toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-10">

        {/* Profile header */}
        <div className="bg-white rounded-xl border p-6 mb-8 flex flex-col sm:flex-row items-start gap-5">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <UserCircle className="h-8 w-8 text-blue-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{user.display_name}</h1>

            <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
              {user.country_code && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {user.country_code}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Joined {joinedOn}
              </span>
              {user.overall_score > 0 && (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Award className="h-3.5 w-3.5 text-blue-600" />
                  {user.overall_score.toFixed(0)} overall score
                </span>
              )}
            </div>

            {user.bio && <p className="mt-3 text-sm text-muted-foreground">{user.bio}</p>}
          </div>

          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={shareProfile} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            {isOwner && (
              <Button asChild size="sm">
                <Link href="/assess">Take assessment</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Credentials section */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-blue-600" />
            Verified Credentials
            {credentials.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({credentials.length})</span>
            )}
          </h2>
        </div>

        {credsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No credentials earned yet.</p>
              {isOwner && (
                <Button asChild size="sm" className="mt-4">
                  <Link href="/assess">Take your first assessment</Link>
                </Button>
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
    </div>
  );
}
