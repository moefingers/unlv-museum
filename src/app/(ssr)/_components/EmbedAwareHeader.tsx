"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";

/**
 * SSR routes are loaded two ways:
 *  1. Embedded as the "original" iframe inside a museum project page (parent provides chrome).
 *  2. Visited directly (e.g. /originals/rest-rant-ssr/places).
 *
 * In case (2) the user has no way to get back to the museum, switch tiers, or read notes.
 * This client component detects the standalone case on mount and renders a minimal header.
 * Defaults to hidden so embedded users see no flash.
 */
export function EmbedAwareHeader() {
  const pathname = usePathname();
  const standalone = useSyncExternalStore(
    () => () => {},
    () => window.self === window.top,
    () => false,
  );

  if (!standalone) return null;

  // /originals/<slug>/... → museum entry at /<slug>
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments[0] === "originals" ? segments[1] : null;
  const museumHref = slug ? `/${slug}` : "/";

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 1rem",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        fontFamily: "system-ui, sans-serif",
        outline: "none",
      }}
    >
      <Link
        href={museumHref}
        aria-label="Back to museum entry"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0.25rem",
          borderRadius: "0.25rem",
          color: "#71717a",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={18} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#18181b",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          SSR route — viewing standalone
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#71717a" }}>
          Open in the museum to see tier toggle (original / remastered /
          reimagined) and project notes.
        </p>
      </div>
      <Link
        href={museumHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.375rem 0.75rem",
          borderRadius: "0.375rem",
          background: "#18181b",
          color: "#fff",
          fontSize: "0.75rem",
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        Open in museum
        <ExternalLink size={12} />
      </Link>
    </header>
  );
}
