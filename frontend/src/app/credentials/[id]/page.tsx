import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Award, CheckCircle, ExternalLink } from "lucide-react";

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
    error = "Could not reach the ProofOS server.";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <nav className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="font-bold tracking-tight">
            Proof<span className="text-blue-600">OS</span>
          </Link>
        </nav>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-8 text-center space-y-2">
              <p className="font-semibold text-red-600">{error}</p>
              <p className="text-sm text-muted-foreground">
                Credential ID: <code className="font-mono text-xs">{id}</code>
              </p>
            </CardContent>
          </Card>
        ) : credential ? (
          <>
            <div className="text-center mb-8 space-y-3">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mx-auto">
                <Award className="h-8 w-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold">Verified Competence Credential</h1>
              <p className="text-muted-foreground text-sm">
                This credential was issued by ProofOS and is verifiable by anyone.
              </p>
            </div>

            <Card className="mb-4 border-green-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <CardTitle className="text-base">Credential verified</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row label="Credential ID" value={<code className="text-xs font-mono break-all">{id}</code>} />
                <Separator />
                <Row label="Type" value={
                  <Badge variant="secondary">ProofOS Competence Credential</Badge>
                } />
                <Row label="Issuer" value="ProofOS (did:web:proofos.io)" />
                <Row label="Standard" value="W3C Verifiable Credentials 2.0" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Raw VC document</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  The full W3C VC 2.0 JSON document. Import this into any compatible wallet.
                </p>
                <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto leading-relaxed">
                  {JSON.stringify(credential, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-20 text-muted-foreground text-sm">Loading...</div>
        )}
      </div>
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
