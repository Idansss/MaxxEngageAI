"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, CheckCircle, ArrowRight, Zap, Award, ShieldCheck } from "lucide-react";

function LoginForm() {
  const { signInWithEmail, session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const refCode = params.get("ref");

  useEffect(() => {
    if (refCode) localStorage.setItem("pending_ref_code", refCode);
  }, [refCode]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    router.replace(next);
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await signInWithEmail(email);
    setLoading(false);
    if (err) setError(err);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center gap-6 py-4">
        <div className="w-14 h-14 rounded-2xl bg-foreground/5 border border-border flex items-center justify-center">
          <CheckCircle className="h-7 w-7 text-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Check your inbox</h2>
          <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
            We sent a magic link to{" "}
            <strong className="text-foreground">{email}</strong>.
            Click it to sign in — no password needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-semibold mb-2">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={loading}
          className="input-base"
          autoComplete="email"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full h-11 text-base font-semibold gap-2">
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
        ) : (
          <><Mail className="h-4 w-4" /> Send magic link</>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed pt-1">
        No password. We&apos;ll email you a one-click sign-in link.
      </p>
    </form>
  );
}

const FEATURES = [
  { icon: <Zap className="h-4 w-4" />,        text: "AI-graded in minutes, not weeks" },
  { icon: <Award className="h-4 w-4" />,       text: "W3C Verifiable Credentials you truly own" },
  { icon: <ShieldCheck className="h-4 w-4" />, text: "Tamper-proof and shareable anywhere" },
];

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">

      {/* ── Left: brand panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] bg-foreground relative overflow-hidden flex-col justify-between p-12 xl:p-16">
        {/* Subtle orb */}
        <div className="orb w-[500px] h-[500px] top-[-15%] right-[-15%] bg-white/4" />

        {/* Top: logo */}
        <Link href="/" className="relative z-10 flex items-center gap-1 font-extrabold text-xl tracking-tight">
          <span className="text-background">Maxx</span>
          <span className="text-background/60">Engage</span>
        </Link>

        {/* Middle: headline + features */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-background leading-[1.1] mb-4 tracking-tight">
              Your skills deserve<br />
              <span className="text-background/60">real proof.</span>
            </h2>
            <p className="text-background/45 text-base leading-relaxed max-w-xs">
              Sign in to access verified credentials that belong to you — not a platform.
            </p>
          </div>

          <ul className="space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-background/60">
                <div className="w-8 h-8 rounded-xl bg-background/8 flex items-center justify-center text-background/70 shrink-0">
                  {f.icon}
                </div>
                {f.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: tagline */}
        <p className="relative z-10 text-xs text-background/25 tracking-wide uppercase">
          Engine 1 of Civilization OS
        </p>
      </div>

      {/* ── Right: form panel ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Link href="/" className="font-extrabold text-xl flex items-center gap-0.5">
              <span className="text-foreground">Maxx</span>
              <span className="text-gradient">Engage</span>
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight mb-1.5">Welcome back</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in to access your credentials and assessments.
            </p>
          </div>

          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin mx-auto" />}>
            <LoginForm />
          </Suspense>

          {/* Footer link */}
          <div className="mt-8 pt-6 border-t border-border/60 text-center">
            <p className="text-xs text-muted-foreground">
              New here?{" "}
              <Link
                href="/assess"
                className="text-foreground font-semibold hover:underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Take a free assessment <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
