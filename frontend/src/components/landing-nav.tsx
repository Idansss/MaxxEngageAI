"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export function LandingNav() {
  const { session, loading } = useAuth();

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        background: "rgba(248,249,255,0.80)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid rgba(99,102,241,0.10)",
        boxShadow: "0 1px 16px rgba(99,102,241,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">

        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logo.png"
            alt="Maxx Engage"
            width={48}
            height={48}
            className="rounded-xl"
            style={{ filter: "invert(1)", mixBlendMode: "multiply" }}
            priority
          />
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {[
            { label: "Skill Paths",   href: "/skill-paths" },
            { label: "How It Works",  href: "/#how-it-works" },
            { label: "Community",     href: "/community" },
            { label: "Verify",        href: "/verify" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-white/80 transition-all"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Auth buttons */}
        {!loading && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-88"
                style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", boxShadow: "0 4px 14px rgba(99,102,241,0.30)" }}
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="h-9 px-5 rounded-xl text-sm font-semibold text-gray-600 bg-white/70 border border-gray-200 hover:bg-white hover:border-indigo-200 transition-all"
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
                >
                  Sign in
                </Link>
                <Link
                  href="/assess"
                  className="inline-flex items-center gap-1.5 h-9 px-5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-88"
                  style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)", boxShadow: "0 4px 14px rgba(99,102,241,0.30)" }}
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
