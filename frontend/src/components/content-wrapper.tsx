"use client";

import { usePathname } from "next/navigation";

export function ContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={pathname === "/" ? "" : "sm:pl-56"}>
      {children}
    </div>
  );
}
