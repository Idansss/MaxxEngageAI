import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  let displayName   = username;
  let bio: string   = "";
  let countryCode   = "";
  let overallScore  = 0;
  let credCount     = 0;

  try {
    const userRes = await fetch(`${API}/users/by-username/${encodeURIComponent(username)}`, {
      cache: "no-store",
    });
    if (userRes.ok) {
      const user   = await userRes.json();
      displayName  = user.display_name ?? username;
      bio          = user.bio          ?? "";
      countryCode  = user.country_code ?? "";
      overallScore = user.overall_score ?? 0;
    }
  } catch { /* render with defaults */ }

  try {
    const credsRes = await fetch(`${API}/users/by-username/${encodeURIComponent(username)}`, {
      cache: "no-store",
    });
    if (credsRes.ok) {
      const user = await credsRes.json();
      // fetch credential count via the user's credentials list
      const credRes = await fetch(`${API}/users/${user.id}/credentials`, { cache: "no-store" });
      if (credRes.ok) {
        const creds = await credRes.json();
        credCount = Array.isArray(creds) ? creds.length : 0;
      }
    }
  } catch { /* ignore */ }

  const accent     = "#6366f1";
  const shortBio   = bio.length > 100 ? bio.slice(0, 97) + "…" : bio;
  const initials   = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

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
            top:          -80,
            right:        -80,
            width:        500,
            height:       500,
            background:   `radial-gradient(circle, ${hexRgba(accent, 0.15)} 0%, transparent 70%)`,
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
            background:   accent,
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
            display:       "flex",
            flex:          1,
            padding:       "80px 80px 72px 100px",
            alignItems:    "center",
            gap:           60,
          }}
        >
          {/* Avatar circle */}
          <div
            style={{
              display:         "flex",
              alignItems:      "center",
              justifyContent:  "center",
              width:           160,
              height:          160,
              borderRadius:    "50%",
              background:      hexRgba(accent, 0.2),
              border:          `3px solid ${accent}`,
              color:           accent,
              fontSize:        56,
              fontWeight:      800,
              flexShrink:      0,
            }}
          >
            {initials || "?"}
          </div>

          {/* Text */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", color: "#ffffff", fontSize: 52, fontWeight: 800, lineHeight: 1.1 }}>
                {displayName}
              </div>
              <div style={{ display: "flex", color: "rgba(255,255,255,0.45)", fontSize: 22 }}>
                @{username}{countryCode ? ` · ${countryCode}` : ""}
              </div>
            </div>

            {shortBio && (
              <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontSize: 20, lineHeight: 1.45, maxWidth: 700 }}>
                {shortBio}
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
              {overallScore > 0 && (
                <div
                  style={{
                    display:      "flex",
                    background:   hexRgba(accent, 0.15),
                    borderRadius: 20,
                    padding:      "7px 18px",
                  }}
                >
                  <span style={{ color: accent, fontSize: 15, fontWeight: 600 }}>
                    ★ Score {Math.round(overallScore)}
                  </span>
                </div>
              )}
              {credCount > 0 && (
                <div
                  style={{
                    display:      "flex",
                    background:   "rgba(255,255,255,0.07)",
                    borderRadius: 20,
                    padding:      "7px 18px",
                  }}
                >
                  <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 15, fontWeight: 500 }}>
                    {credCount} credential{credCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div
                style={{
                  display:      "flex",
                  background:   "rgba(16,185,129,0.12)",
                  borderRadius: 20,
                  padding:      "7px 18px",
                }}
              >
                <span style={{ color: "#10b981", fontSize: 15, fontWeight: 600 }}>
                  Verified credentials
                </span>
              </div>
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
            background:   accent,
            borderRadius: 2,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
