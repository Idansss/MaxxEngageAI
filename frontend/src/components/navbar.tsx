"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2, LogOut, User, ShieldAlert } from "lucide-react";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

export function Navbar() {
  const { session, profile, loading, signOut } = useAuth();
  const isAdmin = !!session?.user.email && ADMIN_EMAILS.has(session.user.email.toLowerCase());

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight text-base">
          Proof<span className="text-blue-600">OS</span>
        </Link>

        <div className="flex items-center gap-3">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : session ? (
            <>
              {isAdmin && (
                <Link
                  href="/admin/queue"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Review queue
                </Link>
              )}
              {profile?.id && (
                <Link
                  href={`/profile/${profile.id}`}
                  className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  {profile.display_name}
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
