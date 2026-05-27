"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 transition-colors"
    >
      {copied ? (
        <><Check className="h-3 w-3 text-success" /> Copied!</>
      ) : (
        <><Copy className="h-3 w-3" /> Copy proof link</>
      )}
    </button>
  );
}
