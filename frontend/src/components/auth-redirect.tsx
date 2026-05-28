"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AuthRedirect() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.replace("/dashboard");
    }
  }, [loading, session, router]);

  // While auth is still resolving, or a session exists (redirect pending),
  // block the landing page from showing with a solid background overlay.
  if (loading || session) {
    return <div className="fixed inset-0 z-50 bg-background" />;
  }

  return null;
}
