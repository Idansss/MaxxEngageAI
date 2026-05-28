"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight,
  FolderOpen, GitBranch, LayoutDashboard, LogOut, Moon, Settings,
  ShieldAlert, ShieldCheck, Sun, Target, User, UserCheck, WalletCards, Zap,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

function NavLink({
  href, label, icon, pathname, collapsed,
}: {
  href: string; label: string; icon: React.ReactNode; pathname: string; collapsed: boolean;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-lg text-sm font-medium transition-colors",
        collapsed
          ? "justify-center h-9 w-9 mx-auto"
          : "gap-3 px-3 py-2 w-full",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {icon}
      {!collapsed && label}
    </Link>
  );
}

function Divider() {
  return <div className="my-1 mx-3 h-px bg-border/60" />;
}

export function Sidebar() {
  const { session, profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();

  if (pathname === "/") return null;

  const isAdmin =
    !!session?.user.email &&
    ADMIN_EMAILS.has(session.user.email.toLowerCase());

  return (
    <aside className={cn(
      "hidden sm:flex flex-col fixed inset-y-0 left-0 border-r border-border/60 bg-background z-30 transition-all duration-200",
      collapsed ? "w-14" : "w-56"
    )}>
      {/* Header: logo + toggle */}
      <div className={cn(
        "h-14 flex items-center border-b border-border/60 shrink-0",
        collapsed ? "justify-center" : "px-4 justify-between"
      )}>
        {!collapsed && (
          <Link
            href="/"
            className="font-extrabold text-base tracking-tight flex items-center gap-0.5"
          >
            <span className="text-foreground">Maxx</span>
            <span className="text-gradient">Engage</span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav links */}
      <nav className={cn(
        "flex-1 overflow-y-auto py-3 space-y-0.5",
        collapsed ? "px-2" : "px-2"
      )}>
        {!loading && session ? (
          <>
            <NavLink href="/dashboard"    label="Dashboard"  icon={<LayoutDashboard className="h-4 w-4 shrink-0" />} pathname={pathname} collapsed={collapsed} />
            <NavLink href="/onboarding"   label="Start"      icon={<Target className="h-4 w-4 shrink-0" />}          pathname={pathname} collapsed={collapsed} />
            <NavLink href="/identity"     label="Identity"   icon={<ShieldCheck className="h-4 w-4 shrink-0" />}     pathname={pathname} collapsed={collapsed} />
            <NavLink href="/wallet"       label="Wallet"     icon={<WalletCards className="h-4 w-4 shrink-0" />}     pathname={pathname} collapsed={collapsed} />
            <NavLink href="/community"    label="Community"  icon={<GitBranch className="h-4 w-4 shrink-0" />}       pathname={pathname} collapsed={collapsed} />
            <NavLink href="/projects"     label="Projects"   icon={<FolderOpen className="h-4 w-4 shrink-0" />}      pathname={pathname} collapsed={collapsed} />
            <NavLink href="/review-queue" label="Review"     icon={<UserCheck className="h-4 w-4 shrink-0" />}       pathname={pathname} collapsed={collapsed} />
          </>
        ) : !loading ? (
          <>
            <NavLink href="/skill-paths" label="Skill Paths" icon={<Zap className="h-4 w-4 shrink-0" />}         pathname={pathname} collapsed={collapsed} />
            <NavLink href="/community"   label="Community"   icon={<GitBranch className="h-4 w-4 shrink-0" />}    pathname={pathname} collapsed={collapsed} />
            <NavLink href="/verify"      label="Verify"      icon={<ShieldCheck className="h-4 w-4 shrink-0" />}  pathname={pathname} collapsed={collapsed} />
          </>
        ) : null}
      </nav>

      {/* Assess CTA */}
      {session && (
        <div className={cn("pb-3", collapsed ? "px-2" : "px-3")}>
          <Link
            href="/assess"
            title={collapsed ? "Assess" : undefined}
            className={cn(
              buttonVariants({ size: "sm" }),
              collapsed
                ? "justify-center h-9 w-9 mx-auto p-0"
                : "w-full justify-center gap-1.5"
            )}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && "Assess"}
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className={cn(
        "border-t border-border/60 py-3 space-y-0.5",
        collapsed ? "px-2" : "px-2"
      )}>
        {session ? (
          <>
            {profile?.id && (
              <NavLink
                href={`/profile/${profile.id}`}
                label={profile.display_name?.slice(0, 18) || "Profile"}
                icon={<User className="h-4 w-4 shrink-0" />}
                pathname={pathname}
                collapsed={collapsed}
              />
            )}
            <NavLink href="/settings" label="Settings" icon={<Settings className="h-4 w-4 shrink-0" />} pathname={pathname} collapsed={collapsed} />
            {isAdmin && (
              <NavLink href="/admin" label="Admin" icon={<ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />} pathname={pathname} collapsed={collapsed} />
            )}

            <div className={cn("flex items-center gap-1 pt-1", collapsed && "flex-col gap-1")}>
              <button
                type="button"
                onClick={signOut}
                title={collapsed ? "Sign out" : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors",
                  collapsed ? "justify-center h-9 w-9" : "flex-1 gap-3 px-3 py-2"
                )}
              >
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && "Sign out"}
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
              title={collapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                collapsed ? "justify-center h-9 w-9 mx-auto" : "w-full gap-3 px-3 py-2"
              )}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
            </button>
            <Link
              href="/login"
              title={collapsed ? "Sign in" : undefined}
              className={cn(
                buttonVariants({ size: "sm" }),
                collapsed ? "w-9 h-9 mx-auto justify-center p-0 mt-1" : "w-full justify-center mt-1"
              )}
            >
              {collapsed ? <User className="h-4 w-4" /> : "Sign in"}
            </Link>
          </>
        ) : null}
      </div>
    </aside>
  );
}
