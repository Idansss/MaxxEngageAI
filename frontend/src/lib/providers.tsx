"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "./auth-context";
import { ThemeProvider } from "./theme-context";
import { ReferralClaimer } from "@/components/referral-claimer";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,      // data stays fresh for 5 minutes
        gcTime: 10 * 60_000,        // keep unused cache for 10 minutes
        refetchOnWindowFocus: false, // don't refetch just because user switched tabs
        retry: 1,
      },
    },
  }));
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AuthProvider>
          <ReferralClaimer />
          {children}
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
