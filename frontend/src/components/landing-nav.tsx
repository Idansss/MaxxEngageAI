"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight } from "lucide-react";

export function LandingNav() {
  const { session, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex justify-center px-4 pt-4 pb-2 pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-2 px-3 py-2.5 w-full"
        style={{
          maxWidth: "760px",
          background: "rgba(255, 255, 255, 0.72)",
          border: "1.5px solid rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(28px) saturate(200%)",
          WebkitBackdropFilter: "blur(28px) saturate(200%)",
          borderRadius: "9999px",
          boxShadow:
            "0 4px 28px rgba(99, 102, 241, 0.10), 0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        {/* Wordmark */}
        <Link href="/" className="flex items-center shrink-0 px-3 font-extrabold text-base tracking-tight">
          <span className="text-gray-800">Maxx</span>
          <span className="text-gradient">Engage</span>
        </Link>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" />

        {/* Nav links */}
        <nav className="hidden sm:flex items-center gap-0.5 flex-1">
          {[
            { label: "Skill Paths",  href: "/skill-paths" },
            { label: "How It Works", href: "/#how-it-works" },
            { label: "Community",    href: "/community" },
            { label: "Verify",       href: "/verify" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-white/80 transition-all whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Spacer on mobile */}
        <div className="flex-1 sm:hidden" />

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-gray-200 mx-1 shrink-0" />

        {/* Auth buttons */}
        {!loading && (
          <div className="flex items-center gap-2 shrink-0">
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-sm font-bold text-white transition-all hover:opacity-88"
                style={{
                  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  boxShadow: "0 3px 10px rgba(99,102,241,0.30)",
                }}
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center h-8 px-4 rounded-full text-sm font-semibold leading-none text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 transition-all"
                >
                  Sign in
                </Link>
                <Link
                  href="/assess"
                  className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-sm font-bold text-white transition-all hover:opacity-88"
                  style={{
                    background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                    boxShadow: "0 3px 10px rgba(99,102,241,0.30)",
                  }}
                >
                  Start Free <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
