import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_INIT_INTEGRITY } from "@/lib/theme-script";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://unlv-museum.infinite-syndicate.com"),
  title: { default: "UNLV Museum", template: "%s | UNLV Museum" },
  description:
    "Projects from UNLV's software development course, rebuilt across three toggleable tiers: original, enhanced, and reimagined.",
  openGraph: {
    title: "UNLV Museum",
    description:
      "Projects from UNLV's software development course, rebuilt across three toggleable tiers.",
    url: "https://unlv-museum.infinite-syndicate.com",
    siteName: "UNLV Museum",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Layer-1 FOUC bootstrap. Static file loaded synchronously before
            paint, integrity-verified via SRI. See CONTEXT/internal_docs/
            theme.md (zcanon) "FOUC Prevention" for why this beats the
            previous inline dangerouslySetInnerHTML script under React 19.

            The sync attribute is intentional and load-bearing: this script
            must run before paint to apply the .dark class. next/script with
            strategy="beforeInteractive" hydrates AFTER mount, defeating
            FOUC prevention; <link rel="preload"> doesn't execute; deferred
            scripts run after parse but after style computation. Sync is
            the only option, hence the eslint disable. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          src="/theme-init.js"
          integrity={THEME_INIT_INTEGRITY}
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
