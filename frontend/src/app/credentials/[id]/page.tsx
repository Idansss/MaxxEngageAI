import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Award, CheckCircle, ExternalLink, ShieldCheck } from "lucide-react";

export default async function CredentialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let credential: Record<string, unknown> | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/credentials/${id}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      credential = await res.json();
    } else if (res.status === 404) {
      error = "Credential not found.";
    } else {
      error = "Failed to load credential.";
    }
  } catch {
    error = "Could not reach the Maxx Engage server.";
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {error ? (
        <Card className="ring-1 ring-destructive/20 overflow-hidden">
          <div className="h-1 bg-destructive" />
          <CardContent className="pt-8 text-center space-y-2">
            <p className="font-semibold text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground">
              Credential ID: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{id}</code>
            </p>
            <Link href="/" className="text-sm text-primary font-medium hover:underline underline-offset-2 inline-block mt-2">
              Go home
            </Link>
          </CardContent>
        </Card>
      ) : credential ? (
        <>
          {/* Credential hero */}
          <div className="text-center mb-10 space-y-4">
            <div className="w-18 h-18 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Award className="h-9 w-9 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">Verified Competence Credential</h1>
              <p className="text-muted-foreground text-sm mt-1.5 max-w-sm mx-auto leading-relaxed">
                This credential was issued by Maxx Engage and is publicly verifiable by anyone.
              </p>
            </div>
          </div>

          {/* Verified status */}
          <Card className="mb-4 ring-1 ring-(--success)/30 overflow-hidden">
            <div className="h-1 bg-success" />
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-success" />
                <CardTitle className="text-base font-bold">Credential verified</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Row label="Credential ID" value={<code className="text-xs font-mono break-all bg-muted px-2 py-0.5 rounded-lg">{id}</code>} />
              <Separator />
              <Row
                label="Type"
                value={
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-success" />
                    Maxx Engage Competence Credential
                  </Badge>
                }
              />
              <Row label="Issuer" value={<span className="font-semibold">Maxx Engage</span>} />
              <Row label="Standard" value="W3C Verifiable Credentials 2.0" />
              {"content_hash" in credential && (
                <Row
                  label="Content hash"
                  value={<code className="text-xs font-mono break-all">{String(credential.content_hash)}</code>}
                />
              )}
              {"anchor_status" in credential && (
                <Row
                  label="Anchor"
                  value={
                    <span className="inline-flex items-center gap-2">
                      <Badge variant="outline">{String(credential.anchor_status)}</Badge>
                      {credential.anchor_url ? (
                        <a
                          href={String(credential.anchor_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </span>
                  }
                />
              )}
              {Boolean(credential.ipfs_cid) && (
                <Row
                  label="IPFS CID"
                  value={<code className="text-xs font-mono break-all">{String(credential.ipfs_cid)}</code>}
                />
              )}
            </CardContent>
          </Card>

          {/* Raw VC document */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Raw VC document</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                The full W3C VC 2.0 JSON-LD document. Import this into any compatible wallet.
              </p>
              <pre className="text-xs bg-muted rounded-xl p-4 overflow-x-auto leading-relaxed">
                {JSON.stringify(credential, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-24 text-muted-foreground text-sm">
          Loading credential…
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
