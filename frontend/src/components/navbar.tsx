"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Loader2, LogOut, Menu, Settings, User, ShieldAlert, LayoutDashboard,
  ShieldCheck, Target, WalletCards, Zap, GitBranch, UserCheck, FolderOpen,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { SearchModal } from "@/components/search-modal";
import { MobileDrawer } from "@/components/mobile-drawer";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

export function Navbar() {
  const { session, profile, loading, signOut } = useAuth();
  const isAdmin = !!session?.user.email && ADMIN_EMAILS.has(session.user.email.toLowerCase());
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    <>
    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    <BottomTabBar />
    <header className="glass-nav sticky top-0 z-40 border-b border-border/60 shadow-sm shadow-border/30 sm:hidden">
      <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2">

        {/* Logo */}
        <Link
          href="/"
          className="font-extrabold text-base tracking-tight shrink-0 flex items-center gap-1 mr-1"
        >
          <span className="text-foreground">Maxx</span>
          <span className="text-gradient">Engage</span>
        </Link>

        {/* Global search */}
        <SearchModal />

        {/* Nav links + actions — pushes to the right */}
        <div className="flex items-center gap-1 ml-auto">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-2" />
          ) : session ? (
            <>
              {navLink("/dashboard", "Dashboard", <LayoutDashboard className="h-3.5 w-3.5" />)}
              {navLink("/onboarding", "Start", <Target className="h-3.5 w-3.5" />)}
              {navLink("/identity", "Identity", <ShieldCheck className="h-3.5 w-3.5" />)}
              {navLink("/wallet", "Wallet", <WalletCards className="h-3.5 w-3.5" />)}
              {navLink("/community", "Community", <GitBranch className="h-3.5 w-3.5" />)}
              {navLink("/projects", "Projects", <FolderOpen className="h-3.5 w-3.5" />)}
              {navLink("/review-queue", "Review", <UserCheck className="h-3.5 w-3.5" />)}
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

              <Link
                href="/settings"
                className={cn(
                  "hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors",
                  isActive("/settings") ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>

              <ThemeToggle className="hidden sm:inline-flex" />
              <NotificationBell />

              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="gap-1.5 text-muted-foreground hover:text-foreground ml-1 hidden sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </Button>

              {/* Hamburger — mobile only */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="sm:hidden inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "ml-1 hidden sm:inline-flex")}>
                Sign in
              </Link>

              {/* Hamburger for signed-out mobile */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="sm:hidden inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </>
          )}
        </div>
      </nav>
    </header>
    </>
  );
}
