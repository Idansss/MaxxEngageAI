"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  FileText,
  FolderOpen,
  GitBranch,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  UserCheck,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/lib/theme-context";

const ADMIN_EMAILS = new Set(
  (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase())
);

interface Props {
  open: boolean;
  onClose: () => void;
}

function DrawerNavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
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

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1">
      {label}
    </p>
  );
}

export function MobileDrawer({ open, onClose }: Props) {
  const { session, profile, signOut } = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();

  const isAdmin =
    !!session?.user.email && ADMIN_EMAILS.has(session.user.email.toLowerCase());

  // Close when route changes
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function active(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 sm:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-background border-r shadow-2xl",
          "transition-transform duration-300 ease-in-out sm:hidden flex flex-col",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!open}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
          <Link href="/" className="font-extrabold text-base tracking-tight flex items-center gap-1">
            <span className="text-foreground">Maxx</span>
            <span className="text-gradient">Engage</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {session ? (
            <>
              {/* User pill */}
              {profile && (
                <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-xl bg-muted/60">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {profile.display_name?.slice(0, 1)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{profile.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                </div>
              )}

              <SectionLabel label="Main" />
              <DrawerNavLink href="/dashboard"   label="Dashboard"   icon={<LayoutDashboard className="h-4 w-4" />} active={active("/dashboard")} />
              <DrawerNavLink href="/assess"      label="Assess"      icon={<Zap className="h-4 w-4" />} active={active("/assess")} />
              <DrawerNavLink href="/wallet"      label="Wallet"      icon={<WalletCards className="h-4 w-4" />} active={active("/wallet")} />
              <DrawerNavLink href="/identity"    label="Identity"    icon={<ShieldCheck className="h-4 w-4" />} active={active("/identity")} />
              <DrawerNavLink href="/onboarding"  label="Learning"    icon={<Target className="h-4 w-4" />} active={active("/onboarding")} />
              <DrawerNavLink href="/submissions" label="Submissions" icon={<FileText className="h-4 w-4" />} active={active("/submissions")} />

              <SectionLabel label="Explore" />
              <DrawerNavLink href="/projects"     label="Projects"       icon={<FolderOpen className="h-4 w-4" />} active={active("/projects")} />
              <DrawerNavLink href="/review-queue" label="Review Queue"   icon={<UserCheck className="h-4 w-4" />} active={active("/review-queue")} />
              <DrawerNavLink href="/skill-paths"  label="Skill Paths"    icon={<Zap className="h-4 w-4" />} active={active("/skill-paths")} />
              <DrawerNavLink href="/community"    label="Community"      icon={<GitBranch className="h-4 w-4" />} active={active("/community")} />

              <SectionLabel label="Account" />
              {profile?.id && (
                <DrawerNavLink href={`/profile/${profile.id}`} label="My Profile" icon={<LogIn className="h-4 w-4" />} active={active(`/profile/${profile.id}`)} />
              )}
              <DrawerNavLink href="/settings" label="Settings" icon={<Settings className="h-4 w-4" />} active={active("/settings")} />
              {isAdmin && (
                <DrawerNavLink href="/admin" label="Admin" icon={<ShieldAlert className="h-4 w-4" />} active={active("/admin")} />
              )}
            </>
          ) : (
            <>
              <SectionLabel label="Explore" />
              <DrawerNavLink href="/skill-paths"  label="Skill Paths"   icon={<Zap className="h-4 w-4" />} active={active("/skill-paths")} />
              <DrawerNavLink href="/community"    label="Community"     icon={<GitBranch className="h-4 w-4" />} active={active("/community")} />
              <DrawerNavLink href="/verify"       label="Verify"        icon={<ShieldCheck className="h-4 w-4" />} active={active("/verify")} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t shrink-0" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          {/* Theme row */}
          <div className="flex items-center justify-between px-3 py-2 mb-1">
            <span className="text-sm text-muted-foreground">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </span>
            <ThemeToggle />
          </div>

          {session ? (
            <button
              type="button"
              onClick={() => { signOut(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : (
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
