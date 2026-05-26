"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Loader2, LogOut, User, ShieldAlert, LayoutDashboard,
  ShieldCheck, Target, WalletCards, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

export function Navbar() {
  const { session, profile, loading, signOut } = useAuth();
  const isAdmin = !!session?.user.email && ADMIN_EMAILS.has(session.user.email.toLowerCase());
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function navLink(href: string, label: string, icon: React.ReactNode) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={cn(
          "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <header className="glass-nav sticky top-0 z-50 border-b border-border/60 shadow-sm shadow-border/30">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link
          href="/"
          className="font-extrabold text-base tracking-tight shrink-0 flex items-center gap-1"
        >
          <span className="text-foreground">Maxx</span>
          <span className="text-gradient">Engage</span>
        </Link>

        {/* Nav links + actions */}
        <div className="flex items-center gap-1">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-2" />
          ) : session ? (
            <>
              {navLink("/dashboard", "Dashboard", <LayoutDashboard className="h-3.5 w-3.5" />)}
              {navLink("/onboarding", "Start", <Target className="h-3.5 w-3.5" />)}
              {navLink("/identity", "Identity", <ShieldCheck className="h-3.5 w-3.5" />)}
              {navLink("/wallet", "Wallet", <WalletCards className="h-3.5 w-3.5" />)}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50 transition-all"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Admin
                </Link>
              )}

              {profile?.id && (
                <Link
                  href={`/profile/${profile.id}`}
                  className={cn(
                    "hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    isActive(`/profile/${profile.id}`)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[100px] truncate">{profile.display_name}</span>
                </Link>
              )}

              {/* Assess CTA */}
              <Link
                href="/assess"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "ml-1 gap-1.5 hidden sm:inline-flex"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Assess
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-1.5 text-muted-foreground hover:text-foreground ml-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
