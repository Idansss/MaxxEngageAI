"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Award, Calendar, Loader2, Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function scoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-primary";
  return "text-gold";
}

export function PrivateProofPage({ username }: { username: string }) {
  const { session, loading: authLoading } = useAuth();
  const { data: user, isLoading: userLoading, error } = useQuery({
    queryKey: ["private-proof-user", username],
    queryFn: () => api.users.byUsername(username),
    enabled: !!session,
    retry: false,
  });
  const { data: credentials = [], isLoading: credentialsLoading } = useQuery({
    queryKey: ["private-proof-credentials", user?.id],
    queryFn: () => api.users.credentials(user!.id),
    enabled: !!user?.id,
  });

  if (authLoading || userLoading || credentialsLoading) {
    return (
      <main className="px-6 py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
      </main>
    );
  }

  if (!session || error || !user) {
    return (
      <main className="px-6 py-16 text-center">
        <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <h1 className="text-xl font-bold">Proof page unavailable</h1>
        <p className="text-sm text-muted-foreground mt-2">
          This profile does not exist or is private.
        </p>
      </main>
    );
  }

  return (
    <main className="px-6 py-10">
      <div className="rounded-2xl border bg-card p-6 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="gap-1 text-xs">
                <Lock className="h-3 w-3" />
                Private preview
              </Badge>
            </div>
            <h1 className="text-2xl font-extrabold">{user.display_name}</h1>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            {user.bio && (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{user.bio}</p>
            )}
          </div>
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Settings
          </Link>
        </div>
      </div>

      <h2 className="font-bold text-xl flex items-center gap-2 mb-5">
        <Award className="h-5 w-5 text-primary" />
        Credentials
      </h2>

      {credentials.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm text-muted-foreground">
              @{username} hasn&apos;t earned any credentials yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {credentials.map((cred) => (
            <Card key={cred.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{cred.skill_path_name}</CardTitle>
                  <span className={cn("text-2xl font-black", scoreColor(cred.score))}>
                    {Math.round(cred.score)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs capitalize">{cred.domain}</Badge>
                  {cred.verified_by_human && (
                    <Badge variant="secondary" className="text-xs gap-1 bg-success-bg text-success">
                      <ShieldCheck className="h-3 w-3" /> Human verified
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Earned {new Date(cred.created_at).toLocaleDateString("en-GB")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
