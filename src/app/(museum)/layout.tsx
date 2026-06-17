import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_INIT_INTEGRITY } from "@/lib/theme-script";
import { MuseumToastLayer } from "@/components/ui/MuseumToastLayer";
import MigrationToast from "@/components/ui/MigrationToast";
import "../globals.css";
import styles from "./layout.module.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// LinkedInBot misclassifies any page emitting og:video* as Type=Video, then
// fails to surface og:image — its renderer expects a LinkedIn-hosted video
// URN, not an external MP4, and silently drops the poster. We strip og:video
// (and twitter:player, which can compound the misclassification) from the
// response shown to LinkedInBot only. Every other crawler keeps the full
// payload so Discord/iMessage/Telegram still play the video inline.
export async function generateMetadata(): Promise<Metadata> {
  const ua = (await headers()).get("user-agent") ?? "";
  const isLinkedInBot = /LinkedInBot/i.test(ua);

  return {
    metadataBase: new URL("https://unlv-museum.recanon.com"),
    title: { default: "UNLV Museum", template: "%s | UNLV Museum" },
    description:
      "Projects from UNLV's software development course, rebuilt across three toggleable tiers: original, enhanced, and reimagined.",
    openGraph: {
      title: "UNLV Museum",
      description:
        "Projects from UNLV's software development course, rebuilt across three toggleable tiers.",
      url: "https://unlv-museum.recanon.com",
      siteName: "UNLV Museum",
      type: "website",
      images: [
        {
          url: "/og/stage-poster.png",
          width: 1200,
          height: 630,
          alt: "UNLV Museum — anchored stage view of the project globe",
          type: "image/png",
        },
      ],
      ...(isLinkedInBot
        ? {}
        : {
            videos: [
              {
                url: "https://unlv-museum.recanon.com/og/stage.mp4",
                secureUrl:
                  "https://unlv-museum.recanon.com/og/stage.mp4",
                type: "video/mp4",
                width: 1920,
                height: 1080,
              },
            ],
          }),
    },
    twitter: isLinkedInBot
      ? {
          card: "summary_large_image",
          title: "UNLV Museum",
          description:
            "Projects from UNLV's software development course, rebuilt across three toggleable tiers.",
          images: ["/og/stage-poster.png"],
        }
      : {
          card: "player",
          title: "UNLV Museum",
          description:
            "Projects from UNLV's software development course, rebuilt across three toggleable tiers.",
          images: ["/og/stage-poster.png"],
          players: [
            {
              playerUrl:
                "https://unlv-museum.recanon.com/og/player.html",
              streamUrl:
                "https://unlv-museum.recanon.com/og/stage.mp4",
              width: 1920,
              height: 1080,
            },
          ],
        },
    robots: { index: true, follow: true },
  };
}

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
      className={`${geistSans.variable} ${geistMono.variable}`}
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
      <body>
        <main className={styles.main}>{children}</main>
        {/* Museum-level toast layer — registers the Service Worker
            (public/museum-toast-sw.js) and renders a top-right toast
            stack when intercepted /api/** or /originals/** responses
            cross the 4xx/5xx filter. Headline use case: a visitor
            triggers a 401 from an iframed Original's mutation
            button and sees a "Sign in to continue" toast without the
            project needing per-project UX code. */}
        <MuseumToastLayer />
        {/* Migration reassurance toast: shows once for visitors arriving from
            the old unlv-museum.infinite-syndicate.com host (recanon's redirect
            appends ?from=is), then strips the param. Transition artifact —
            see MigrationToast.tsx for how to retire it. */}
        <MigrationToast />
      </body>
    </html>
  );
}
