"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AssessmentExperience } from "../page";

function AssessmentSlugPageInner() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  return (
    <AssessmentExperience
      pathSlug={params.slug}
      start={searchParams.get("start") === "1"}
    />
  );
}

export default function AssessmentSlugPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-28">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <AssessmentSlugPageInner />
      </Suspense>
    </div>
  );
}
