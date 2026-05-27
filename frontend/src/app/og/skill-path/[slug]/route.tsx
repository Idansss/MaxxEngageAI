import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let description = "";
  let domain = "technology";
  let levelCount = 0;

  try {
    const res = await fetch(`${API}/skill-paths/${slug}`, { cache: "no-store" });
    if (res.ok) {
      const path = await res.json();
      name        = path.name        ?? name;
      description = path.description ?? "";
      domain      = path.domain      ?? "technology";
      levelCount  = path.levels?.length ?? 0;
    }
  } catch { /* render with defaults */ }

  const accentColor = accent(domain);
  const shortDesc   = description.length > 120 ? description.slice(0, 117) + "…" : description;

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
        {/* Ambient orb */}
        <div
          style={{
            position:     "absolute",
            top:          -60,
            right:        -60,
            width:        480,
            height:       480,
            background:   `radial-gradient(circle, ${hexRgba(accentColor, 0.18)} 0%, transparent 70%)`,
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

        {/* MAXX ENGAGE branding */}
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

        {/* Main content */}
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            padding:        "80px 100px 72px 100px",
            flex:           1,
            justifyContent: "space-between",
          }}
        >
          {/* Top */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
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
              <span style={{ color: accentColor, fontSize: 14, fontWeight: 700, letterSpacing: "0.1em" }}>
                {domain.toUpperCase()} PATH
              </span>
            </div>

            {/* Name */}
            <div
              style={{
                display:    "flex",
                color:      "#ffffff",
                fontSize:   name.length > 30 ? 48 : 60,
                fontWeight: 800,
                lineHeight: 1.1,
                maxWidth:   900,
              }}
            >
              {name}
            </div>

            {/* Description */}
            {shortDesc && (
              <div
                style={{
                  display:   "flex",
                  color:     "rgba(255,255,255,0.55)",
                  fontSize:  22,
                  maxWidth:  820,
                  lineHeight: 1.4,
                }}
              >
                {shortDesc}
              </div>
            )}
          </div>

          {/* Bottom — meta pills */}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {levelCount > 0 && (
              <div
                style={{
                  display:      "flex",
                  background:   hexRgba(accentColor, 0.15),
                  borderRadius: 20,
                  padding:      "8px 20px",
                }}
              >
                <span style={{ color: accentColor, fontSize: 16, fontWeight: 600 }}>
                  {levelCount} level{levelCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div
              style={{
                display:      "flex",
                background:   "rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding:      "8px 20px",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: 500 }}>
                W3C Verifiable Credential
              </span>
            </div>
            <div
              style={{
                display:      "flex",
                background:   "rgba(255,255,255,0.06)",
                borderRadius: 20,
                padding:      "8px 20px",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: 500 }}>
                AI-graded assessments
              </span>
            </div>
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
