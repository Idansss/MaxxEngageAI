"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Supabase detects the token/code in the URL and exchanges it automatically.
    // We just listen for the session to appear, then redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        subscription.unsubscribe();
        // New users → onboarding; returning users → dashboard
        const dest = event === "SIGNED_IN" ? "/dashboard" : "/dashboard";
        router.replace(dest);
      }
    });

    // Fallback: if a session already exists (token already in localStorage)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        router.replace("/dashboard");
      }
    });

    // Hard timeout — if nothing happens in 8s, send to login
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace("/login");
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* Animated logo mark */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 animate-pulse" />
        <div className="absolute inset-2 rounded-xl bg-primary/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-primary" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <div className="text-center space-y-1.5">
        <p className="font-bold text-lg">Signing you in…</p>
        <p className="text-sm text-muted-foreground">Just a moment, we&apos;re verifying your link.</p>
      </div>

      {/* Progress bar */}
      <div className="w-48 h-1 rounded-full bg-border overflow-hidden">
        <div className="h-full bg-primary rounded-full animate-[progress_2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
