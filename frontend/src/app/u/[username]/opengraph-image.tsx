import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Maxx Engage proof page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  let displayName = username;
  let credentials: string[] = [];

  try {
    const userRes = await fetch(`${API}/users/by-username/${encodeURIComponent(username)}`, {
      cache: "no-store",
    });
    if (userRes.ok) {
      const user = await userRes.json();
      displayName = user.display_name ?? username;
      const credRes = await fetch(`${API}/users/${user.id}/credentials`, { cache: "no-store" });
      if (credRes.ok) {
        const rows = await credRes.json();
        credentials = Array.isArray(rows)
          ? rows.slice(0, 3).map((cred) => cred.skill_path_name).filter(Boolean)
          : [];
      }
    }
  } catch {
    credentials = [];
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#f8fafc",
          color: "#111827",
          fontFamily: "Arial, sans-serif",
          padding: 64,
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div
              style={{
                display: "flex",
                width: 120,
                height: 120,
                borderRadius: 60,
                background: "#e0e7ff",
                color: "#4338ca",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 42,
                fontWeight: 800,
              }}
            >
              {initials(displayName) || "ME"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 800 }}>{displayName}</div>
              <div style={{ display: "flex", fontSize: 24, color: "#64748b" }}>@{username}</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              border: "2px solid #16a34a",
              color: "#166534",
              borderRadius: 999,
              padding: "12px 22px",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            Verified by Maxx Engage
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(credentials.length ? credentials : ["No credentials earned yet"]).map((name) => (
            <div
              key={name}
              style={{
                display: "flex",
                width: "100%",
                border: "1px solid #cbd5e1",
                borderRadius: 10,
                padding: "18px 22px",
                fontSize: 26,
                fontWeight: 700,
                background: "#ffffff",
              }}
            >
              {name}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: 22 }}>
          <div style={{ display: "flex" }}>maxx-engage-ai.vercel.app/u/{username}</div>
          <div style={{ display: "flex", fontWeight: 700 }}>MAXX ENGAGE</div>
        </div>
      </div>
    ),
    size,
  );
}
