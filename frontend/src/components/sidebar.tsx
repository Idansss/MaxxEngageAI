"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  FolderOpen, GitBranch, LayoutDashboard, LogOut, Moon, Settings,
  ShieldAlert, ShieldCheck, Sun, Target, User, UserCheck, WalletCards, Zap,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

function NavLink({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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

function Divider() {
  return <div className="my-1 mx-3 h-px bg-border/60" />;
}

export function Sidebar() {
  const { session, profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  if (pathname === "/") return null;

  const isAdmin =
    !!session?.user.email &&
    ADMIN_EMAILS.has(session.user.email.toLowerCase());

  return (
    <aside className="hidden sm:flex flex-col fixed inset-y-0 left-0 w-56 border-r border-border/60 bg-background z-30">
      {/* Logo */}
      <Link
        href="/"
        className="h-14 flex items-center px-4 border-b border-border/60 font-extrabold text-base tracking-tight shrink-0 gap-0.5"
      >
        <span className="text-foreground">Maxx</span>
        <span className="text-gradient">Engage</span>
      </Link>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {!loading && session ? (
          <>
            <NavLink href="/dashboard"    label="Dashboard"  icon={<LayoutDashboard className="h-4 w-4" />} pathname={pathname} />
            <NavLink href="/onboarding"   label="Start"      icon={<Target className="h-4 w-4" />}          pathname={pathname} />
            <NavLink href="/identity"     label="Identity"   icon={<ShieldCheck className="h-4 w-4" />}     pathname={pathname} />
            <NavLink href="/wallet"       label="Wallet"     icon={<WalletCards className="h-4 w-4" />}     pathname={pathname} />
            <NavLink href="/community"    label="Community"  icon={<GitBranch className="h-4 w-4" />}       pathname={pathname} />
            <NavLink href="/projects"     label="Projects"   icon={<FolderOpen className="h-4 w-4" />}      pathname={pathname} />
            <NavLink href="/review-queue" label="Review"     icon={<UserCheck className="h-4 w-4" />}       pathname={pathname} />

          </>
        ) : !loading ? (
          <>
            <NavLink href="/skill-paths" label="Skill Paths" icon={<Zap className="h-4 w-4" />}         pathname={pathname} />
            <NavLink href="/community"   label="Community"   icon={<GitBranch className="h-4 w-4" />}    pathname={pathname} />
            <NavLink href="/verify"      label="Verify"      icon={<ShieldCheck className="h-4 w-4" />}  pathname={pathname} />
          </>
        ) : null}
      </nav>

      {/* Assess CTA */}
      {session && (
        <div className="px-3 pb-3">
          <Link
            href="/assess"
            className={cn(buttonVariants({ size: "sm" }), "w-full justify-center gap-1.5")}
          >
            <Zap className="h-3.5 w-3.5" />
            Assess
          </Link>
        </div>
      )}

      {/* Footer: profile, settings, admin, theme + sign out */}
      <div className="border-t border-border/60 px-2 py-3 space-y-0.5">
        {session ? (
          <>
            {profile?.id && (
              <NavLink
                href={`/profile/${profile.id}`}
                label={profile.display_name?.slice(0, 18) || "Profile"}
                icon={<User className="h-4 w-4" />}
                pathname={pathname}
              />
            )}
            <NavLink href="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} pathname={pathname} />
            {isAdmin && (
              <NavLink href="/admin" label="Admin" icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} pathname={pathname} />
            )}

            {/* Theme toggle + Sign out row */}
            <div className="flex items-center gap-1 pt-1">
              <button
                type="button"
                onClick={signOut}
                className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </>
        ) : !loading ? (
          <>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "sm" }), "w-full justify-center mt-1")}
            >
              Sign in
            </Link>
          </>
        ) : null}
      </div>
    </aside>
  );
}
