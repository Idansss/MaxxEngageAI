import Link from "next/link";
import { RefreshCw, WifiOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "You're offline",
};

export default function OfflinePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>

      <h1 className="text-2xl font-extrabold mb-2">You&apos;re offline</h1>
      <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
        No internet connection detected. Pages you&apos;ve visited recently may still
        be available below, or try reconnecting and refreshing.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className={buttonVariants({ size: "sm" })}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Try again
        </Link>
        <Link href="/skill-paths" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Browse skill paths
        </Link>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Maxx Engage works offline for pages you&apos;ve already visited.
      </p>
    </main>
  );
}
