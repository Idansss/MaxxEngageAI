"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, CheckCircle, ArrowRight, Award, Zap, ShieldCheck } from "lucide-react";

function LoginForm() {
  const { signInWithEmail, session } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/onboarding";
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
      <div className="flex flex-col items-center text-center gap-5 py-6">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Check your email</h2>
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
    <form onSubmit={handleSubmit} className="space-y-5">
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
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending link…</>
        ) : (
          <><Mail className="h-4 w-4" /> Send magic link</>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        No password needed. We&apos;ll email you a one-click sign-in link.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">

      {/* Left: Brand panel */}
      <div className="hidden lg:flex lg:w-[45%] hero-bg dot-grid relative overflow-hidden flex-col justify-center p-14">
        {/* Orbs */}
        <div className="orb w-80 h-80 top-[-10%] left-[-5%] bg-indigo-600/25" />
        <div className="orb w-64 h-64 bottom-[-8%] right-[-5%] bg-violet-500/20" />
        <div className="orb w-48 h-48 top-[50%] left-[60%] bg-amber-500/15" />

        <div className="relative z-10">
          <Link href="/" className="font-extrabold text-2xl text-white tracking-tight block mb-12">
            Maxx<span className="bg-linear-to-r from-indigo-300 via-violet-300 to-amber-300 bg-clip-text text-transparent">Engage</span>
          </Link>

          <h2 className="text-4xl font-extrabold text-white leading-tight mb-5">
            Your skills deserve{" "}
            <span className="bg-linear-to-r from-amber-300 to-amber-200 bg-clip-text text-transparent">
              real proof.
            </span>
          </h2>
          <p className="text-indigo-200/70 text-base leading-relaxed mb-12 max-w-sm">
            Sign in to access your verified credentials — credentials that belong to you, not to us.
          </p>

          <ul className="space-y-4">
            {[
              { icon: <Zap className="h-4 w-4" />, text: "AI-graded in minutes, not weeks" },
              { icon: <Award className="h-4 w-4" />, text: "W3C Verifiable Credentials you truly own" },
              { icon: <ShieldCheck className="h-4 w-4" />, text: "Tamper-proof and shareable anywhere" },
            ].map((f) => (
              <li key={f.text} className="flex items-center gap-3 text-sm text-indigo-200/80">
                <div className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-amber-300 shrink-0">
                  {f.icon}
                </div>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <Link href="/" className="font-extrabold text-2xl inline-flex items-center gap-0.5">
              <span>Maxx</span>
              <span className="text-gradient">Engage</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-extrabold mb-1.5">Welcome back</h1>
            <p className="text-muted-foreground text-sm">Sign in to access your credentials and assessments.</p>
          </div>

          <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin mx-auto" />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            New here?{" "}
            <Link href="/assess" className="text-primary font-medium hover:underline underline-offset-2 inline-flex items-center gap-0.5">
              Take a free assessment <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
