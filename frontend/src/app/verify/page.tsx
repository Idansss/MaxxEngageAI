"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, type VerifyCredential } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle, Award, Calendar, CheckCircle, Clock,
  ExternalLink, FileJson, Loader2, Search, ShieldCheck,
  ShieldAlert, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// â"€â"€ Types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface SigResult {
  valid: boolean;
  reason: string;
  issuer: string | null;
  subject_did: string | null;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "credential"; data: VerifyCredential; user: { display_name: string; username: string | null; id: string } | null; sig: SigResult | null }
  | { kind: "user"; username: string; credentials: VerifyCredential[] }
  | { kind: "not_found"; input: string }
  | { kind: "error"; message: string };

type JsonVerifyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; sig: SigResult }
  | { kind: "error"; message: string };

// â"€â"€ Parsers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const CRED_RE = /cred_[A-Za-z0-9_-]{10,32}/;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function parseInput(raw: string): { kind: "credential_id"; id: string } | { kind: "username"; username: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const credMatch = trimmed.match(CRED_RE);
  if (credMatch) {
    return { kind: "credential_id", id: credMatch[0] };
  }

  const uuidMatch = trimmed.match(UUID_RE);
  if (uuidMatch) {
    return { kind: "credential_id", id: uuidMatch[0] };
  }

  const usernameFromUrl = trimmed.match(/\/u\/([a-z0-9_]{3,20})/i);
  if (usernameFromUrl) {
    return { kind: "username", username: usernameFromUrl[1].toLowerCase() };
  }

  if (/^[a-z0-9_]{3,20}$/i.test(trimmed) && !trimmed.includes(".")) {
    return { kind: "username", username: trimmed.toLowerCase() };
  }

  return null;
}

// â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function scoreColor(score: number) {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-primary";
  return "text-gold";
}

function domainStripe(domain: string) {
  const map: Record<string, string> = {
    technology: "stripe-technology",
    writing: "stripe-writing",
    design: "stripe-design",
    data: "stripe-data",
    business: "stripe-business",
    ops: "stripe-ops",
    science: "stripe-science",
  };
  return map[domain] ?? "bg-muted-foreground/30";
}

function domainColor(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-primary/10 text-primary",
    design: "bg-violet-100 text-violet-700",
    data: "bg-emerald-100 text-emerald-700",
    writing: "bg-amber-100 text-amber-700",
    business: "bg-orange-100 text-orange-700",
    ops: "bg-slate-100 text-slate-700",
    science: "bg-teal-100 text-teal-700",
  };
  return map[domain] ?? "bg-muted text-muted-foreground";
}

// â"€â"€ Signature status badge â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function SigBadge({ sig }: { sig: SigResult | null }) {
  if (!sig) return null;
  return (
    <div className={cn(
      "rounded-lg border px-3 py-2.5 flex items-start gap-2.5 text-sm",
      sig.valid
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-red-200 bg-red-50 text-red-800"
    )}>
      {sig.valid
        ? <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
        : <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />}
      <div className="min-w-0">
        <p className="font-semibold text-xs uppercase tracking-wider mb-0.5">
          {sig.valid ? "Signature verified" : "Signature invalid"}
        </p>
        <p className="text-xs opacity-80 leading-relaxed">{sig.reason}</p>
        {sig.issuer && (
          <p className="text-xs opacity-60 mt-1 font-mono break-all">{sig.issuer}</p>
        )}
      </div>
    </div>
  );
}

// â"€â"€ Credential card (verified view) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function VerifiedCredentialCard({ cred, user, sig }: {
  cred: VerifyCredential;
  user: { display_name: string; username: string | null; id: string } | null;
  sig: SigResult | null;
}) {
  const issuedOn = cred.issued_at
    ? new Date(cred.issued_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "Unknown date";
  const subject = (cred.vc_document as Record<string, Record<string, unknown>>)?.credentialSubject ?? {};
  const domain = cred.domain || (typeof subject.domain === "string" ? subject.domain : "");

  return (
    <Card className="overflow-hidden">
      <div className={cn(
        "flex items-center gap-3 px-5 py-3 text-sm font-semibold",
        cred.revoked ? "bg-destructive/10 text-destructive" : "bg-success-bg text-success"
      )}>
        {cred.revoked ? (
          <><XCircle className="h-4 w-4" /> Revoked credential</>
        ) : (
          <><CheckCircle className="h-4 w-4" /> Verified credential</>
        )}
      </div>

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-xl font-extrabold">{cred.skill_name || cred.skill_path_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{cred.level_label}</p>
          </div>
          <span className={cn("text-3xl font-black shrink-0", scoreColor(cred.score))}>
            {Math.round(cred.score)}<span className="text-base font-semibold text-muted-foreground">/{Math.round(cred.max_score)}</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-5">
        <div className="flex flex-wrap gap-1.5">
          {domain && (
            <Badge variant="secondary" className={cn("text-xs", domainColor(domain))}>{domain}</Badge>
          )}
          <Badge variant="secondary" className="text-xs">Level {cred.level}</Badge>
          {cred.verified_by_human && (
            <Badge variant="secondary" className="bg-success-bg text-success text-xs gap-1">
              <ShieldCheck className="h-3 w-3" /> Human verified
            </Badge>
          )}
          {cred.revoked && <Badge variant="destructive" className="text-xs">Revoked</Badge>}
        </div>

        {user && (
          <div className="rounded-xl bg-muted/50 border p-3 text-sm">
            <p className="font-semibold text-foreground">{user.display_name}</p>
            {user.username && (
              <Link
                href={`/u/${user.username}`}
                className="text-xs text-primary hover:underline underline-offset-2 inline-flex items-center gap-1 mt-0.5"
              >
                @{user.username} <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {/* Cryptographic signature status */}
        <SigBadge sig={sig} />

        <div className="text-xs text-muted-foreground flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Issued {issuedOn}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Rubric {cred.rubric_id} v{cred.rubric_version ?? "1"}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] mt-1 text-muted-foreground/60">
            ID: {cred.id}
          </span>
        </div>

        {cred.revoked && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            This credential was revoked{cred.revoked_at ? ` on ${new Date(cred.revoked_at).toLocaleDateString("en-GB")}` : ""}.
            {cred.revoked_reason ? ` Reason: ${cred.revoked_reason}` : ""}
          </div>
        )}

        <details className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">What does this mean?</summary>
          <p className="mt-2 leading-relaxed">
            This credential was issued by Maxx Engage after an assessment was graded against rubric {cred.rubric_id} v{cred.rubric_version ?? "1"}.
            The score, rubric, issue date, and content hash are stored in the credential registry.
          </p>
        </details>

        <div className="pt-2 border-t text-xs text-muted-foreground">
          Issued by{" "}
          <Link href="/" className="text-primary font-medium hover:underline underline-offset-2">
            Maxx Engage
          </Link>{" "}
          · AI-graded against a transparent rubric
        </div>
      </CardContent>
    </Card>
  );
}

// â"€â"€ Small credential row (for user-level verify) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function CredentialRow({ cred }: { cred: VerifyCredential }) {
  const earnedOn = cred.issued_at
    ? new Date(cred.issued_at).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "Unknown date";
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0">
      <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 mt-0.5", domainStripe(cred.domain))} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{cred.skill_name || cred.skill_path_name}</p>
        <p className="text-xs text-muted-foreground">{cred.level_label} · Earned {earnedOn}</p>
      </div>
      <span className={cn("font-black text-lg shrink-0", scoreColor(cred.score))}>
        {Math.round(cred.score)}
      </span>
      <Link
        href={`/verify?id=${cred.id}`}
        className="text-xs text-primary hover:underline underline-offset-2 shrink-0"
      >
        View
      </Link>
    </div>
  );
}

// â"€â"€ Tab: Verify by ID / URL â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function VerifyByIdTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [input, setInput] = useState(searchParams.get("id") ?? searchParams.get("user") ?? "");
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const [isRunning, setIsRunning] = useState(false);

  async function runVerify(raw: string) {
    const parsed = parseInput(raw);
    if (!parsed) {
      setState({ kind: "not_found", input: raw });
      return;
    }

    setIsRunning(true);
    setState({ kind: "loading" });

    try {
      if (parsed.kind === "credential_id") {
        const result = await api.verify.lookup(parsed.id);
        if (result.kind !== "credential") throw new Error("Credential not found.");
        const cred = result.credential;
        const user = result.user;

        // Verify cryptographic signature (non-critical)
        let sig: SigResult | null = null;
        try {
          const vc = cred.vc_document as Record<string, unknown>;
          if (vc?.proof) {
            const result = await api.wallet.verifyVC(vc);
            sig = { valid: result.valid, reason: result.reason, issuer: result.issuer, subject_did: result.subject_did };
          }
        } catch {
          // ignored — sig stays null
        }

        setState({ kind: "credential", data: cred, user, sig });
        router.replace(`/verify?id=${parsed.id}`, { scroll: false });
      } else {
        const result = await api.verify.lookup(parsed.username);
        if (result.kind !== "user") throw new Error("User not found.");
        const creds = result.credentials;
        setState({ kind: "user", username: parsed.username, credentials: creds });
        router.replace(`/verify?user=${parsed.username}`, { scroll: false });
      }
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.toLowerCase().includes("not found") || msg.includes("404")) {
        setState({ kind: "not_found", input: raw });
      } else {
        setState({ kind: "error", message: msg });
      }
    } finally {
      setIsRunning(false);
    }
  }

  const didAutoRun = useRef(false);
  useEffect(() => {
    if (didAutoRun.current) return;
    const initialInput = searchParams.get("id") ?? searchParams.get("user");
    if (initialInput) {
      didAutoRun.current = true;
      setTimeout(() => runVerify(initialInput), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runVerify(input);
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (state.kind !== "idle") setState({ kind: "idle" });
            }}
            placeholder="maxx-engage-ai.vercel.app/u/username or cred_abc123xyz"
            className="input-base flex-1 text-sm"
            aria-label="Credential link or ID"
            disabled={isRunning}
          />
          <Button type="submit" disabled={isRunning || !input.trim()} className="gap-2 shrink-0">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Verify
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Accepts: a credential ID, a full credential URL, or a proof page URL (/u/username)
        </p>
      </form>

      {state.kind === "loading" && (
        <div className="flex items-center justify-center py-14">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking…</p>
          </div>
        </div>
      )}

      {state.kind === "credential" && (
        <VerifiedCredentialCard cred={state.data} user={state.user} sig={state.sig} />
      )}

      {state.kind === "user" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-success" />
            <h2 className="font-bold text-lg">
              Credentials for{" "}
              <Link href={`/u/${state.username}`} className="text-primary hover:underline underline-offset-2">
                @{state.username}
              </Link>
            </h2>
          </div>
          {state.credentials.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Award className="h-7 w-7 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No public credentials yet.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-0 divide-y divide-border/60">
                {state.credentials.map((cred) => (
                  <CredentialRow key={cred.id} cred={cred} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {state.kind === "not_found" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Credential not found</p>
            <p className="text-sm text-destructive/80 mt-1">
              We couldn&apos;t find a credential matching that link or ID.
              Double-check the URL, or{" "}
              <Link href="/assess" className="underline underline-offset-2 font-medium">
                browse our assessments
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">Something went wrong</p>
            <p className="text-sm text-destructive/80 mt-1">{state.message}</p>
          </div>
        </div>
      )}
    </>
  );
}

// â"€â"€ Tab: Verify by pasting VC JSON â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function VerifyByJsonTab() {
  const [jsonText, setJsonText] = useState("");
  const [state, setVerifyState] = useState<JsonVerifyState>({ kind: "idle" });

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyState({ kind: "loading" });

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch {
      setVerifyState({ kind: "error", message: "Invalid JSON — paste the full W3C VC JSON-LD document." });
      return;
    }

    try {
      const result = await api.wallet.verifyVC(parsed);
      setVerifyState({ kind: "result", sig: { valid: result.valid, reason: result.reason, issuer: result.issuer, subject_did: result.subject_did } });
    } catch (err) {
      setVerifyState({ kind: "error", message: (err as Error).message ?? "Verification failed." });
    }
  }

  return (
    <>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        Received a <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">.jsonld</code> credential file?
        Paste the full JSON below to check its cryptographic signature independently.
      </p>
      <form onSubmit={handleVerify} className="space-y-3 mb-6">
        <textarea
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            if (state.kind !== "idle") setVerifyState({ kind: "idle" });
          }}
          placeholder={'{\n  "@context": ["https://www.w3.org/ns/credentials/v2", ...],\n  "id": "urn:uuid:...",\n  "proof": { ... }\n}'}
          className="w-full text-xs font-mono bg-muted rounded-xl px-4 py-3.5 resize-none h-48 focus:outline-none focus:ring-2 focus:ring-ring border border-transparent focus:border-input"
          spellCheck={false}
        />
        <Button type="submit" disabled={state.kind === "loading" || !jsonText.trim()} className="gap-2">
          {state.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Check signature
        </Button>
      </form>

      {state.kind === "result" && (
        <div className="space-y-3">
          <SigBadge sig={state.sig} />
          {state.sig.subject_did && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-xs font-mono text-muted-foreground break-all">
              <span className="font-semibold text-foreground mr-2">Holder DID:</span>
              {state.sig.subject_did}
            </div>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      )}
    </>
  );
}

// â"€â"€ Main verify page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type Tab = "id" | "json";

function VerifyForm() {
  const searchParams = useSearchParams();
  const hasInitialQuery = !!(searchParams.get("id") ?? searchParams.get("user"));
  const [tab, setTab] = useState<Tab>(hasInitialQuery ? "id" : "id");

  return (
    <main className="px-6 py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-5">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold">Verify a credential</h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed">
          Confirm a credential is real and cryptographically signed by Maxx Engage.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-8">
        <button
          type="button"
          onClick={() => setTab("id")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "id"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="h-4 w-4" />
          By link or ID
        </button>
        <button
          type="button"
          onClick={() => setTab("json")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "json"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileJson className="h-4 w-4" />
          Paste VC JSON
        </button>
      </div>

      {tab === "id" ? <VerifyByIdTab /> : <VerifyByJsonTab />}

      {/* Footer */}
      <div className="mt-16 text-center text-xs text-muted-foreground">
        <p>
          Powered by{" "}
          <Link href="/" className="text-primary font-medium hover:underline underline-offset-2">
            Maxx Engage
          </Link>{" "}
          &middot; Proving what people can do, regardless of where they&apos;re from.
        </p>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-28">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <VerifyForm />
      </Suspense>
    </div>
  );
}
