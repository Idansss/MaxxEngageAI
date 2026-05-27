import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;

  let displayName: string | null = null;
  let bio: string | null = null;

  try {
    const res = await fetch(`${API}/users/${userId}`, { cache: "no-store" });
    if (res.ok) {
      const user = await res.json();
      displayName = user.display_name ?? null;
      bio = user.bio ?? null;
    }
  } catch { /* ignore */ }

  const name = displayName ?? "Talent Profile";
  const title = `${name}'s Skills & Credentials`;
  const description = bio
    ? `${bio.slice(0, 140)}${bio.length > 140 ? "…" : ""}`
    : `View ${name}'s verified skill credentials, assessment history, and vouches on Maxx Engage.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/profile/${userId}`,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
