"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api, type CredentialDecayItem } from "@/lib/api";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ShieldCheck, Key, Download, Trash2, Copy, CheckCircle,
  AlertTriangle, Loader2, Award, ExternalLink, Lock, Unlock,
} from "lucide-react";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/ld+json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function WalletPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const qc = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportingCredentialId, setExportingCredentialId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) router.replace("/login?next=/wallet");
  }, [loading, session, router]);

  const { data: keyMaterial, isLoading: keyLoading } = useQuery({
    queryKey: ["wallet-key-material"],
    queryFn: () => api.wallet.keyMaterial(),
    enabled: !!session,
  });

  const { data: credentialStatus, isLoading: credsLoading } = useQuery({
    queryKey: ["credential-decay-status"],
    queryFn: () => api.credentials.myDecayStatus(),
    enabled: !!session,
  });

  const { mutate: deleteKey, isPending: deleting } = useMutation({
    mutationFn: () => api.wallet.deleteKey(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-key-material"] });
      setConfirmDelete(false);
    },
  });

  function copyDid() {
    if (!keyMaterial?.did) return;
    navigator.clipboard.writeText(keyMaterial.did);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadKeyMaterial() {
    if (!keyMaterial) return;
    downloadJson("maxx-engage-key-material.json", keyMaterial);
  }

  async function downloadCredential(credential: CredentialDecayItem) {
    setExportingCredentialId(credential.id);
    try {
      const document = await api.wallet.exportCredentialDocument(credential.id);
      downloadJson(`maxx-engage-credential-${credential.id}.jsonld`, document);
    } finally {
      setExportingCredentialId(null);
    }
  }

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inCustody = keyMaterial?.platform_custody ?? true;
  const credentials = credentialStatus?.credentials ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        <div>
          <Badge variant="secondary" className="mb-3">Self-sovereign identity</Badge>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Key className="h-6 w-6 text-muted-foreground" />
            Your wallet
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your DID and credentials belong to you — not to Maxx Engage. Download them and import into any W3C-compatible wallet.
          </p>
        </div>

        {/* DID + custody status */}
        <Card className={inCustody ? "border-amber-200" : "border-green-200"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {inCustody ? (
                <><Lock className="h-4 w-4 text-amber-500" /> Platform custody</>
              ) : (
                <><Unlock className="h-4 w-4 text-green-600" /> Fully self-sovereign</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {keyLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : keyMaterial ? (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Your Decentralized Identifier (DID)
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-xs bg-muted rounded px-3 py-2 font-mono break-all leading-relaxed">
                      {keyMaterial.did}
                    </code>
                    <button
                      type="button"
                      onClick={copyDid}
                      className="shrink-0 rounded-md border p-2 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy DID"
                    >
                      {copied
                        ? <CheckCircle className="h-4 w-4 text-green-600" />
                        : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Key type: {keyMaterial.key_type} &middot; Method: {keyMaterial.did_method}
                  </p>
                </div>

                <Separator />

                {inCustody ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <p>
                        Maxx Engage currently holds your private key. Download it, import into your
                        wallet, then delete it from our servers to become fully self-sovereign.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={downloadKeyMaterial} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" /> Download key material
                      </Button>
                      {!confirmDelete ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-destructive hover:text-destructive border-destructive/30"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete from Maxx Engage
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-destructive font-medium">
                            Irreversible — saved your key?
                          </span>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteKey()}
                            disabled={deleting}
                            className="gap-1.5"
                          >
                            {deleting
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                            Yes, delete it
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                    Your private key has been removed from Maxx Engage. You hold full control.
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load key material.</p>
            )}
          </CardContent>
        </Card>

        {/* Compatible wallets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              Compatible wallets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Your credentials follow the W3C VC 2.0 standard. Import into any of these:
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              {["Spruce DIDKit", "Walt.id", "Trinsic", "Talao", "Veramo"].map((w) => (
                <Badge key={w} variant="outline">{w}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Credentials list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-blue-600" />
              Your credentials
              {!credsLoading && (
                <Badge variant="secondary" className="ml-1">{credentials.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {credsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : credentials.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <Award className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">No credentials yet.</p>
                <a href="/assess" className={cn(buttonVariants({ size: "sm" }))}>
                  Take your first assessment
                </a>
              </div>
            ) : (
              <ul className="divide-y">
                {credentials.map((c) => (
                  <li key={c.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.skill_path_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {c.level} &middot; {c.level_label} &middot; Score {c.raw_score.toFixed(0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        title="Download W3C VC JSON-LD"
                        disabled={exportingCredentialId === c.id}
                        onClick={() => downloadCredential(c)}
                      >
                        {exportingCredentialId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">Download VC</span>
                      </Button>
                      <a
                        href={`/credentials/${c.id}`}
                        className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "gap-1.5")}
                        title="View credential"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
