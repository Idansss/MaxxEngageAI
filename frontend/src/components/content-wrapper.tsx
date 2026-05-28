"use client";

import { usePathname } from "next/navigation";
import { useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

export function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <div className={cn(
      "transition-all duration-200",
      pathname !== "/" && (collapsed ? "sm:pl-14" : "sm:pl-56")
    )}>
      {children}
    </div>
  );
}
