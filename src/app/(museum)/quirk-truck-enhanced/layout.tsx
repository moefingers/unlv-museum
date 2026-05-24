import "./ui/global.css";
import { inter } from "./ui/fonts";
import type { Metadata } from "next";

/**
 * Sub-layout for the quirk-truck Enhanced surface (the EnterPrize-era
 * Historical Enhanced port). The museum's root layout owns <html>/<body>;
 * this layout only applies the era's font + global.css and sets metadata
 * scoped to the EnterPrize surface so tabs in this sub-tree show the
 * original product title.
 */
export const metadata: Metadata = {
  title: {
    template: "%s | EnterPrize",
    default: "EnterPrize",
  },
  description: "Enterprise data, interconnected.",
};

/**
 * Every page in this sub-tree depends on the visitor's session (the
 * dashboard, account, credentials, pages, work-orders, audit-log
 * views all branch on `auth().user.role` and read project-scoped
 * data). Force dynamic rendering so Next.js doesn't try to
 * pre-render them at build time against the stub session.
 */
export const dynamic = "force-dynamic";

export default function EnterPrizeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wrap in a div that scopes the font className without re-declaring
  // <html> / <body> (which would conflict with the museum root layout).
  return <div className={`${inter.className} antialiased`}>{children}</div>;
}
