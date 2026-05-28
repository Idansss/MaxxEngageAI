import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { ContentWrapper } from "@/components/content-wrapper";
import { ServiceWorkerRegistrar } from "@/components/sw-register";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://maxx-engage.io"),
  title: {
    default: "Maxx Engage — Prove Your Skills. Own Your Credentials.",
    template: "%s | Maxx Engage",
  },
  description:
    "AI-graded skill assessments that issue tamper-proof W3C Verifiable Credentials. For every talent on Earth — no gatekeeping, no expensive courses.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Maxx Engage",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    siteName: "Maxx Engage",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@MaxxEngage",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Runs before React hydrates — prevents flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();` }} />
      </head>
      <body className="min-h-full antialiased pb-14 sm:pb-0">
        <Providers>
          <Sidebar />
          <ContentWrapper>
            <Navbar />
            {children}
          </ContentWrapper>
        </Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
