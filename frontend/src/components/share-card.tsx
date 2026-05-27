"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { CheckCircle, Copy, Download, ExternalLink, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShareCardData {
  credentialId: string;
  skillPathName: string;
  levelLabel: string;
  domain: string;
  score: number;
  verifiedByHuman: boolean;
  holderName?: string;
  earnedOn?: string;
}

// ── Domain colours (must be hex for Canvas) ───────────────────────────────────

const DOMAIN_HEX: Record<string, string> = {
  technology: "#6366f1",
  design:     "#8b5cf6",
  data:       "#10b981",
  writing:    "#f59e0b",
  business:   "#f97316",
  ops:        "#64748b",
  science:    "#14b8a6",
};

function domainHex(domain: string) {
  return DOMAIN_HEX[domain] ?? "#6366f1";
}

function domainBgClass(domain: string) {
  const map: Record<string, string> = {
    technology: "bg-primary/10 text-primary",
    design:     "bg-violet-100 text-violet-700",
    data:       "bg-emerald-100 text-emerald-700",
    writing:    "bg-amber-100 text-amber-700",
    business:   "bg-orange-100 text-orange-700",
    ops:        "bg-slate-100 text-slate-700",
    science:    "bg-teal-100 text-teal-700",
  };
  return map[domain] ?? "bg-muted text-muted-foreground";
}

function scoreTextClass(score: number) {
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-indigo-600";
  return "text-amber-600";
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

function drawCard(canvas: HTMLCanvasElement, data: ShareCardData, verifyUrl: string) {
  const W = 1200, H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const accent = domainHex(data.domain);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0,   "#0f0f1a");
  grad.addColorStop(1,   "#1c1c2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid dots
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let x = 0; x < W; x += 32) {
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ambient orb
  const orb = ctx.createRadialGradient(W * 0.8, H * 0.2, 0, W * 0.8, H * 0.2, 350);
  orb.addColorStop(0, `${accent}30`);
  orb.addColorStop(1, "transparent");
  ctx.fillStyle = orb;
  ctx.fillRect(0, 0, W, H);

  // Left accent stripe
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(60, 60, 8, H - 120, 4);
  ctx.fill();

  // Domain chip
  ctx.fillStyle = `${accent}30`;
  ctx.beginPath();
  ctx.roundRect(88, 60, 150, 36, 18);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(data.domain.toUpperCase(), 108, 84);

  // Branding (top right)
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("MAXX ENGAGE", W - 60, 84);

  // Skill path name
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.textAlign = "left";
  // Word-wrap if too long
  const words = data.skillPathName.split(" ");
  let line = "";
  let y = 200;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > W - 360 && line) {
      ctx.fillText(line, 88, y);
      line = word;
      y += 62;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, 88, y);

  // Level label
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 24px system-ui, sans-serif";
  ctx.fillText(data.levelLabel, 88, y + 44);

  // Score (large, right side)
  const scoreX = W - 200;
  const scoreY = H / 2 - 30;
  ctx.fillStyle = accent;
  ctx.font = "black 130px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(Math.round(data.score)), scoreX, scoreY);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText("/ 100", scoreX, scoreY + 36);

  // Human verified badge
  if (data.verifiedByHuman) {
    ctx.fillStyle = "#10b98120";
    ctx.beginPath();
    ctx.roundRect(88, H - 185, 220, 38, 19);
    ctx.fill();
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("✓  Human verified", 108, H - 161);
  }

  // Holder name
  if (data.holderName) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "500 22px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Earned by ${data.holderName}`, 88, H - 120);
  }

  // Verification URL
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "16px monospace";
  ctx.textAlign = "left";
  ctx.fillText(verifyUrl, 88, H - 72);

  // Bottom accent line
  ctx.fillStyle = accent;
  ctx.fillRect(60, H - 50, W - 120, 3);
}

// ── Share modal ───────────────────────────────────────────────────────────────

interface ShareCardProps {
  data: ShareCardData;
  trigger?: React.ReactNode;
}

export function ShareCard({ data, trigger }: ShareCardProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const verifyUrl = typeof window !== "undefined"
    ? `${window.location.origin}/credentials/${data.credentialId}`
    : `https://maxx-engage.io/credentials/${data.credentialId}`;

  const renderCanvas = useCallback(() => {
    if (canvasRef.current) drawCard(canvasRef.current, data, verifyUrl);
  }, [data, verifyUrl]);

  useEffect(() => {
    if (open) setTimeout(renderCanvas, 50);
  }, [open, renderCanvas]);

  function downloadImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `maxx-engage-${data.skillPathName.toLowerCase().replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function copyLink() {
    navigator.clipboard.writeText(verifyUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const tweetText = encodeURIComponent(
    `I just earned my ${data.skillPathName} credential on Maxx Engage!\n\nScore: ${Math.round(data.score)}/100 · ${data.levelLabel}${data.verifiedByHuman ? " · Human verified ✓" : ""}\n\nVerify it: ${verifyUrl}`
  );
  const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;

  if (!open) {
    return (
      <div onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Share2 className="h-3.5 w-3.5" /> Share
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-background rounded-2xl border shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <p className="font-semibold text-sm">Share your credential</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Card preview */}
          <div className="p-5 space-y-4">
            {/* Visual preview (HTML version, matches canvas aesthetic) */}
            <div className="rounded-xl overflow-hidden border bg-[#0f0f1a] p-6 space-y-3 relative">
              {/* Accent stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ backgroundColor: domainHex(data.domain) }} />

              <div className="flex items-start justify-between gap-3 pl-3">
                <div className="flex-1 min-w-0">
                  <Badge className={cn("text-[10px] mb-2", domainBgClass(data.domain))}>
                    {data.domain}
                  </Badge>
                  <p className="text-white font-extrabold text-xl leading-snug">{data.skillPathName}</p>
                  <p className="text-white/50 text-sm mt-0.5">{data.levelLabel}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn("text-5xl font-black leading-none", scoreTextClass(data.score))}>
                    {Math.round(data.score)}
                  </p>
                  <p className="text-white/30 text-xs mt-1">/ 100</p>
                </div>
              </div>

              <div className="pl-3 flex items-center gap-3 flex-wrap">
                {data.verifiedByHuman && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> Human verified
                  </span>
                )}
                {data.holderName && (
                  <span className="text-xs text-white/40">Earned by {data.holderName}</span>
                )}
              </div>

              <p className="pl-3 text-[10px] text-white/20 font-mono truncate">{verifyUrl}</p>

              {/* Branding */}
              <p className="absolute top-4 right-5 text-xs text-white/20 font-bold tracking-wider">MAXX ENGAGE</p>
            </div>

            {/* Hidden canvas for download */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadImage}>
                <Download className="h-3.5 w-3.5" /> Download image
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
                {copied
                  ? <><CheckCircle className="h-3.5 w-3.5 text-success" /> Copied!</>
                  : <><Copy className="h-3.5 w-3.5" /> Copy link</>
                }
              </Button>
              <a
                href={tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-sm font-medium px-3 hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Share on X
              </a>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-sm font-medium px-3 hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> LinkedIn
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
