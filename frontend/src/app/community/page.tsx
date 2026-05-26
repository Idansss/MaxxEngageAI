import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BookOpen, ExternalLink, GitBranch, GitPullRequest, MessageCircle } from "lucide-react";

const DOCS = [
  { title: "W3C Verifiable Credentials 2.0", url: "https://www.w3.org/TR/vc-data-model-2.0/" },
  { title: "Gitcoin Passport docs", url: "https://docs.passport.gitcoin.co/" },
  { title: "DID Core spec", url: "https://www.w3.org/TR/did-core/" },
];

export default function CommunityPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">
          Open collaboration
        </p>
        <h1 className="text-3xl font-extrabold">Build Maxx Engage in public</h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
          GitHub coordinates the work, Discord coordinates the people, and trusted public
          knowledge sources help keep assessment context auditable.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitHub collaboration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold">Idansss/MaxxEngageAI</p>
                <p className="text-xs text-muted-foreground mt-1">License AGPL-3.0 · Open source</p>
              </div>
              <a
                href="https://github.com/Idansss/MaxxEngageAI"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                Repository <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-6">
              <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                <GitPullRequest className="h-4 w-4 text-primary" />
                Contribute
              </p>
              <div className="rounded-xl border bg-muted/30 px-4 py-5 text-sm text-muted-foreground leading-relaxed">
                Browse open issues, submit pull requests, or open a discussion on GitHub.
                All contributions welcome — especially from African developers.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Community
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Discord community coming soon. Star the repo to stay updated.
              </p>
              <div className="space-y-2 pt-1">
                {DOCS.map((doc) => (
                  <a
                    key={doc.url}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                      {doc.title}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
