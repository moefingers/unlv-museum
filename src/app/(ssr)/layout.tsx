import type { ReactNode } from "react";
import { EmbedAwareHeader } from "./_components/EmbedAwareHeader";

export default function SsrShellLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
        />
        <link rel="stylesheet" href="/originals/rest-rant-ssr/style1.css" />
      </head>
      <body>
        <EmbedAwareHeader />
        {children}
      </body>
    </html>
  );
}
