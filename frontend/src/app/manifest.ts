import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             "Maxx Engage — Prove Your Skills",
    short_name:       "Maxx Engage",
    description:
      "AI-graded skill assessments that issue tamper-proof W3C Verifiable Credentials. For every talent on Earth.",
    start_url:        "/",
    scope:            "/",
    display:          "standalone",
    orientation:      "portrait",
    background_color: "#0f0f1a",
    theme_color:      "#6366f1",
    lang:             "en",
    categories:       ["education", "productivity"],
    icons: [
      {
        src:     "/icon.svg",
        type:    "image/svg+xml",
        sizes:   "any",
        purpose: "any",
      },
      {
        src:     "/icon.svg",
        type:    "image/svg+xml",
        sizes:   "any",
        purpose: "maskable",
      },
    ],
  };
}
