"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SearchModal } from "@/components/search-modal";
import { NotificationBell } from "@/components/notification-bell";

export function DesktopTopBar() {
  const pathname = usePathname();
  const { session, loading } = useAuth();

  if (pathname === "/" || loading || !session) return null;

  return (
    <header className="hidden sm:flex sticky top-0 z-40 h-12 items-center justify-end gap-1 px-4 border-b border-border/60 bg-background/95 backdrop-blur-sm">
      <SearchModal />
      <NotificationBell />
    </header>
  );
}
