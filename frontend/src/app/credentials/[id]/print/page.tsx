import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PrintButton } from "./print-button";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://maxx-engage-ai.vercel.app";

async function fetchCredential(id: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${API}/credentials/${id}`, { cache: "no-store" });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const cred = await fetchCredential(id);
  if (!cred) return { title: "Certificate — Maxx Engage" };
  const name = String(cred.skill_path_name ?? "Skill Assessment");
  const level = String(cred.level_label ?? "Level 1");
  return {
    title: `${name} · ${level} Certificate`,
    robots: "noindex",
  };
}

function domainAccent(domain: string) {
  const map: Record<string, string> = {
    technology: "#6366f1",
    design:     "#8b5cf6",
    data:       "#10b981",
    writing:    "#f59e0b",
    business:   "#f97316",
    ops:        "#64748b",
    science:    "#14b8a6",
  };
  return map[domain] ?? "#6366f1";
}

function scoreLabel(score: number) {
  if (score >= 90) return "Outstanding";
  if (score >= 80) return "Excellent";
  if (score >= 70) return "Proficient";
  return "Competent";
}

export default async function PrintPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cred = await fetchCredential(id);
  if (!cred) notFound();

  const vc = cred.vc_document as Record<string, unknown> | null | undefined;
  const cs = vc?.credentialSubject as Record<string, unknown> | undefined;
  const holderName = (cs?.holderName as string | undefined) ?? null;

  const skillPath  = String(cred.skill_path_name ?? "Skill Assessment");
  const levelLabel = String(cred.level_label ?? "Level 1");
  const domain     = String(cred.domain ?? "technology");
  const score      = typeof cred.score === "number" ? Math.round(cred.score) : 0;
  const vhuman     = cred.verified_by_human === true;
  const accent     = domainAccent(domain);

  const issuedOn = cred.valid_from
    ? new Date(String(cred.valid_from)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : cred.created_at
      ? new Date(String(cred.created_at)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : null;

  const validUntil = cred.valid_until
    ? new Date(String(cred.valid_until)).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : null;

  const verifyUrl = `${SITE}/verify?id=${id}`;

  return (
    <>
      {/* Print-specific global styles */}
      <style>{`
        @media print {
          body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .no-print { display: none !important; }
          .cert-page {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid;
          }
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
      <div className="no-print flex items-center justify-between max-w-[820px] mx-auto px-6 py-4">
        <Link
          href={`/credentials/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to credential
        </Link>
        <PrintButton />
      </div>

      {/* Certificate */}
      <div
        className="cert-page mx-auto bg-white text-gray-900 relative overflow-hidden"
        style={{
          width: "794px",
          minHeight: "1123px",
          borderRadius: "16px",
          boxShadow: "0 4px 40px rgba(0,0,0,0.12)",
          border: "1px solid #e5e7eb",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: "8px", background: accent }} />

        {/* Corner flourish (top-right) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "220px",
            height: "220px",
            borderRadius: "0 0 0 100%",
            background: `${accent}12`,
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "160px",
            height: "160px",
            borderRadius: "0 100% 0 0",
            background: `${accent}0a`,
            pointerEvents: "none",
          }}
        />

        {/* Inner content */}
        <div style={{ padding: "56px 72px 48px", position: "relative" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "48px" }}>
            <div>
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.12em", color: "#6b7280", marginBottom: "4px" }}>
                Certificate of Competence
              </p>
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "22px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
                Maxx<span style={{ color: accent }}>Engage</span>
              </p>
            </div>
            {/* Score medallion */}
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                border: `3px solid ${accent}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: `${accent}10`,
              }}>
                <span style={{ fontFamily: "system-ui, sans-serif", fontSize: "26px", fontWeight: 900, color: accent, lineHeight: 1 }}>{score}</span>
                <span style={{ fontFamily: "system-ui, sans-serif", fontSize: "9px", color: "#6b7280", marginTop: "2px" }}>/ 100</span>
              </div>
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#6b7280", marginTop: "6px", textAlign: "center" }}>{scoreLabel(score)}</p>
            </div>
          </div>

          {/* Main body */}
          <div style={{ textAlign: "center", marginBottom: "52px" }}>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "16px" }}>
              This certifies that
            </p>
            <p style={{ fontSize: "40px", fontStyle: "italic", color: "#111827", marginBottom: "16px", lineHeight: 1.2 }}>
              {holderName ?? "the credential holder"}
            </p>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#6b7280", marginBottom: "28px" }}>
              has successfully demonstrated verified competency in
            </p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#111827", marginBottom: "8px", lineHeight: 1.2 }}>
              {skillPath}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
              <span style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "12px",
                padding: "4px 14px",
                borderRadius: "9999px",
                background: `${accent}15`,
                color: accent,
                fontWeight: 600,
                textTransform: "capitalize",
              }}>
                {domain}
              </span>
              <span style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "12px",
                padding: "4px 14px",
                borderRadius: "9999px",
                background: "#f3f4f6",
                color: "#374151",
                fontWeight: 600,
              }}>
                {levelLabel}
              </span>
              {vhuman && (
                <span style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "12px",
                  padding: "4px 14px",
                  borderRadius: "9999px",
                  background: "#d1fae5",
                  color: "#065f46",
                  fontWeight: 600,
                }}>
                  ✓ Human verified
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "#e5e7eb", margin: "0 0 36px" }} />

          {/* Date row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "48px" }}>
            <div>
              {issuedOn && (
                <>
                  <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                    Issued on
                  </p>
                  <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#374151", fontWeight: 600 }}>{issuedOn}</p>
                </>
              )}
            </div>
            {validUntil && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Valid until
                </p>
                <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#374151", fontWeight: 600 }}>{validUntil}</p>
              </div>
            )}
          </div>

          {/* Signature area */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "56px" }}>
            <div>
              <div style={{ width: "180px", height: "1px", background: "#d1d5db", marginBottom: "6px" }} />
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#6b7280" }}>Maxx Engage Platform</p>
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#9ca3af" }}>AI-graded · W3C VC 2.0</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ width: "180px", height: "1px", background: "#d1d5db", marginBottom: "6px", marginLeft: "auto" }} />
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#6b7280" }}>Tamper-proof credential</p>
              <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#9ca3af" }}>Publicly verifiable</p>
            </div>
          </div>

          {/* Footer — verify URL + credential ID */}
          <div style={{
            background: "#f9fafb",
            borderRadius: "10px",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#6b7280" }}>
              <strong style={{ color: "#374151" }}>Verify online:</strong>{" "}
              <span style={{ color: accent }}>{verifyUrl}</span>
            </p>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "10px", color: "#9ca3af" }}>
              <strong style={{ color: "#6b7280" }}>Credential ID:</strong>{" "}
              <span style={{ fontFamily: "monospace" }}>{id}</span>
            </p>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "4px", background: accent }} />
      </div>

      {/* Bottom padding for screen view */}
      <div className="no-print h-12" />
    </>
  );
}
