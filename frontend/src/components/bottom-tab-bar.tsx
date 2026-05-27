"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  ShieldCheck,
  User,
  WalletCards,
  Zap,
} from "lucide-react";

// ── Tab definition ────────────────────────────────────────────────────────────

interface Tab {
  href: string;
  label: string;
  icon: React.ReactNode;
  cta?: boolean;
}

const SIGNED_IN_TABS: Tab[] = [
  { href: "/dashboard",  label: "Home",     icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/skill-paths",label: "Paths",    icon: <Zap className="h-5 w-5" /> },
  { href: "/assess",     label: "Assess",   icon: <Zap className="h-5 w-5" />, cta: true },
  { href: "/wallet",     label: "Wallet",   icon: <WalletCards className="h-5 w-5" /> },
  { href: "/identity",   label: "Identity", icon: <ShieldCheck className="h-5 w-5" /> },
];

const SIGNED_OUT_TABS: Tab[] = [
  { href: "/",            label: "Home",    icon: <Home className="h-5 w-5" /> },
  { href: "/skill-paths", label: "Paths",   icon: <Zap className="h-5 w-5" /> },
  { href: "/assess",      label: "Assess",  icon: <Zap className="h-5 w-5" />, cta: true },
  { href: "/verify",      label: "Verify",  icon: <ShieldCheck className="h-5 w-5" /> },
  { href: "/login",       label: "Sign in", icon: <User className="h-5 w-5" /> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function BottomTabBar() {
  const { session, profile } = useAuth();
  const pathname = usePathname();

  const tabs = session ? SIGNED_IN_TABS : SIGNED_OUT_TABS;

  // For signed-in users, swap the profile tab dynamically once we have the id
  const resolvedTabs: Tab[] = tabs.map((tab) => {
    if (session && tab.href === "/identity" && profile?.id) {
      return { ...tab, href: `/profile/${profile.id}`, label: "Profile", icon: <User className="h-5 w-5" /> };
    }
    return tab;
  });

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14">
        {resolvedTabs.map((tab) => {
          const active = isActive(tab.href);

          if (tab.cta) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
              >
                <span className="absolute -top-3 h-12 w-12 rounded-full bg-primary shadow-lg shadow-primary/40 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-primary-foreground" />
                </span>
                <span className="mt-6 text-[9px] font-semibold text-primary">{tab.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {tab.icon}
              <span className="text-[9px] font-medium leading-none">{tab.label}</span>
              {active && (
                <span className="absolute bottom-0 w-6 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
