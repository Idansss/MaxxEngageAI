"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2, LogOut, User, ShieldAlert, LayoutDashboard, ShieldCheck, Target, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

export function Navbar() {
  const { session, profile, loading, signOut } = useAuth();
  const isAdmin = !!session?.user.email && ADMIN_EMAILS.has(session.user.email.toLowerCase());
  const pathname = usePathname();

  function navLink(href: string) {
    return cn(
      "hidden sm:flex items-center gap-1.5 text-sm transition-colors",
      pathname === href
        ? "text-foreground font-medium"
        : "text-muted-foreground hover:text-foreground"
    );
  }

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight text-base shrink-0">
          Maxx<span className="text-blue-600"> Engage</span>
        </Link>

        <div className="flex items-center gap-4">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : session ? (
            <>
              <Link href="/dashboard" className={navLink("/dashboard")}>
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
              <Link href="/onboarding" className={navLink("/onboarding")}>
                <Target className="h-3.5 w-3.5" />
                Start
              </Link>
              <Link href="/identity" className={navLink("/identity")}>
                <ShieldCheck className="h-3.5 w-3.5" />
                Identity
              </Link>
              <Link href="/wallet" className={navLink("/wallet")}>
                <WalletCards className="h-3.5 w-3.5" />
                Wallet
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}
              {profile?.id && (
                <Link href={`/profile/${profile.id}`} className={navLink(`/profile/${profile.id}`)}>
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] truncate">{profile.display_name}</span>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
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
