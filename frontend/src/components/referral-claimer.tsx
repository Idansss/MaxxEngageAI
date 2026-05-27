"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const STORAGE_KEY = "pending_ref_code";

export function ReferralClaimer() {
  const { session } = useAuth();
  const claimed = useRef(false);

  useEffect(() => {
    if (!session || claimed.current) return;
    const code = localStorage.getItem(STORAGE_KEY);
    if (!code) return;

    claimed.current = true;
    localStorage.removeItem(STORAGE_KEY);

    api.referrals.claim(code).catch(() => {
      // Non-fatal — invalid/expired codes silently ignored
    });
  }, [session]);

  return null;
}
