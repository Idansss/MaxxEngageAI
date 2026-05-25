import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { CheckCircle, Award, BookOpen, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

async function getSkillPaths() {
  try {
    return await api.skillPaths.list();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const skillPaths = await getSkillPaths();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-linear-to-b from-blue-50 to-white py-20 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4">
              Engine 1 of Civilization OS
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6 leading-tight">
              Prove What You Know.{" "}
              <span className="text-blue-600">Own Your Credentials.</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              AI-graded skill assessments that issue tamper-proof W3C Verifiable Credentials.
              No expensive courses. No gatekeeping. Just your work, fairly judged.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/assess" className={cn(buttonVariants({ size: "lg" }), "text-base")}>Start Free Assessment</Link>
              <Link href="#how-it-works" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "text-base")}>See How It Works</Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free forever for learners &middot; No account required to try
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 px-4 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">How it works</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: <BookOpen className="h-6 w-6 text-blue-600" />,
                  step: "1",
                  title: "Pick a skill",
                  desc: "Choose a skill path and level. Start with a diagnostic assessment to see where you stand.",
                },
                {
                  icon: <Zap className="h-6 w-6 text-blue-600" />,
                  step: "2",
                  title: "Submit your work",
                  desc: "Complete the task at your own pace. Paste your code, writing, or design directly.",
                },
                {
                  icon: <CheckCircle className="h-6 w-6 text-blue-600" />,
                  step: "3",
                  title: "AI grades it",
                  desc: "Claude grades each dimension of the rubric with specific evidence quotes from your work.",
                },
                {
                  icon: <Award className="h-6 w-6 text-blue-600" />,
                  step: "4",
                  title: "Earn a credential",
                  desc: "Score 70+ and get a W3C Verifiable Credential you own — shareable, tamper-proof, forever.",
                },
              ].map((item) => (
                <div key={item.step} className="flex flex-col items-center text-center gap-3 p-6 rounded-xl border bg-gray-50">
                  <div className="rounded-full bg-blue-100 p-3">{item.icon}</div>
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Step {item.step}
                  </span>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Skill Paths */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-2xl font-bold">Available skill paths</h2>
              <Badge variant="outline" className="text-xs">More coming soon</Badge>
            </div>

            {skillPaths.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">Loading skill paths...</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {skillPaths.map((sp) => (
                  <Card key={sp.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base leading-snug">{sp.name}</CardTitle>
                        <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                          {sp.domain}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {sp.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {sp.tags.slice(0, 4).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="pt-1">
                        <p className="text-xs text-muted-foreground mb-3">
                          {sp.levels.length} levels &middot; Credential refreshes every {sp.decay_half_life_months} months
                        </p>
                        <Link href={`/assess?path=${sp.slug}`} className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}>
                          Start assessment
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Trust section */}
        <section className="py-16 px-4 bg-white border-t">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl font-bold mb-4">Built different, on purpose</h2>
            <div className="grid sm:grid-cols-3 gap-6 mt-8 text-sm text-muted-foreground">
              {[
                { title: "Open reasoning", desc: "Every score comes with the AI's exact reasoning and evidence. No black boxes." },
                { title: "You own your data", desc: "Credentials are W3C VC 2.0 — held by you, verifiable by anyone, not locked to our platform." },
                { title: "Works on 3G", desc: "Designed for Africa's internet reality. Fast, lightweight, no app to install." },
              ].map((item) => (
                <div key={item.title} className="space-y-2">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4 text-center text-sm text-muted-foreground">
        <p>
          ProofOS &mdash; Engine 1 of{" "}
          <span className="font-medium text-foreground">Civilization OS</span>.
          {" "}Built for global talent. Owned by no one.
        </p>
      </footer>
    </div>
  );
}
