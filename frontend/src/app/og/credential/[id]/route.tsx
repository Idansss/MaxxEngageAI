import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://maxx-engage.io";

const DOMAIN_HEX: Record<string, string> = {
  technology: "#6366f1",
  design:     "#8b5cf6",
  data:       "#10b981",
  writing:    "#f59e0b",
  business:   "#f97316",
  ops:        "#64748b",
  science:    "#14b8a6",
};

function accent(domain: string): string {
  return DOMAIN_HEX[domain] ?? "#6366f1";
}

function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";
  if (score >= 70) return "#6366f1";
  return "#f59e0b";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch credential data (best-effort)
  let skillPath = "Skill Assessment";
  let level = "Level 1";
  let domain = "technology";
  let score = 0;
  let verifiedByHuman = false;
  let holderName: string | null = null;

  try {
    const res = await fetch(`${API}/credentials/${id}`, { cache: "no-store" });
    if (res.ok) {
      const cred = await res.json();
      const cs = cred?.credentialSubject ?? {};
      skillPath       = cs.skillPath    ?? "Skill Assessment";
      level           = cs.levelLabel   ?? "Level 1";
      domain          = cs.domain       ?? "technology";
      score           = typeof cs.score === "number" ? cs.score : 0;
      verifiedByHuman = cs.verifiedByHuman === true;
      holderName      = cs.holderName   ?? null;
    }
  } catch { /* render with defaults */ }

  const accentColor  = accent(domain);
  const verifyUrl    = `${APP_URL}/credentials/${id}`;
  const roundedScore = Math.round(score);

  return new ImageResponse(
    (
      <div
        style={{
          display:         "flex",
          width:           1200,
          height:          630,
          backgroundImage: "linear-gradient(135deg, #0f0f1a 0%, #1c1c2e 100%)",
          position:        "relative",
          fontFamily:      "system-ui, sans-serif",
          overflow:        "hidden",
        }}
      >
        {/* Ambient orb — top-right glow */}
        <div
          style={{
            position:  "absolute",
            top:       -80,
            right:     -80,
            width:     500,
            height:    500,
            background: `radial-gradient(circle, ${hexRgba(accentColor, 0.18)} 0%, transparent 70%)`,
            borderRadius: "50%",
          }}
        />

        {/* Left accent stripe */}
        <div
          style={{
            position:     "absolute",
            left:         60,
            top:          60,
            bottom:       60,
            width:        8,
            background:   accentColor,
            borderRadius: 4,
          }}
        />

        {/* MAXX ENGAGE branding — top right */}
        <div
          style={{
            position:      "absolute",
            top:           62,
            right:         60,
            display:       "flex",
            color:         "rgba(255,255,255,0.35)",
            fontSize:      18,
            fontWeight:    700,
            letterSpacing: "0.12em",
          }}
        >
          MAXX ENGAGE
        </div>

        {/* Left content column */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            flex:           1,
            padding:        "80px 60px 72px 100px",
            justifyContent: "space-between",
          }}
        >
          {/* Top section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Domain chip */}
            <div
              style={{
                display:      "flex",
                alignSelf:    "flex-start",
                background:   hexRgba(accentColor, 0.2),
                borderRadius: 20,
                padding:      "6px 18px",
              }}
            >
              <span
                style={{
                  color:         accentColor,
                  fontSize:      14,
                  fontWeight:    700,
                  letterSpacing: "0.1em",
                }}
              >
                {domain.toUpperCase()}
              </span>
            </div>

            {/* Skill path name */}
            <div
              style={{
                display:    "flex",
                color:      "#ffffff",
                fontSize:   skillPath.length > 28 ? 42 : 52,
                fontWeight: 800,
                lineHeight: 1.1,
                maxWidth:   640,
              }}
            >
              {skillPath}
            </div>

            {/* Level label */}
            <div style={{ display: "flex", color: "rgba(255,255,255,0.5)", fontSize: 24 }}>
              {level}
            </div>
          </div>

          {/* Bottom section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Holder name */}
            {holderName && (
              <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontSize: 20 }}>
                Earned by {holderName}
              </div>
            )}

            {/* Human verified badge */}
            {verifiedByHuman && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    display:      "flex",
                    background:   hexRgba("#10b981", 0.15),
                    borderRadius: 20,
                    padding:      "5px 14px",
                  }}
                >
                  <span style={{ color: "#10b981", fontSize: 14, fontWeight: 600 }}>
                    ✓ Human verified
                  </span>
                </div>
              </div>
            )}

            {/* Verify URL */}
            <div
              style={{
                display:    "flex",
                color:      "rgba(255,255,255,0.2)",
                fontSize:   13,
                fontFamily: "monospace",
              }}
            >
              {verifyUrl}
            </div>
          </div>
        </div>

        {/* Right score panel */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            justifyContent: "center",
            width:          260,
            padding:        "0 20px 0 0",
            gap:            4,
          }}
        >
          <div style={{ display: "flex", color: scoreColor(score), fontSize: 130, fontWeight: 900, lineHeight: 1 }}>
            {roundedScore}
          </div>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.3)", fontSize: 22 }}>
            / 100
          </div>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position:     "absolute",
            bottom:       50,
            left:         60,
            right:        60,
            height:       3,
            background:   accentColor,
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
