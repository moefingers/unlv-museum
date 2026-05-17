"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Renders a banner experiment gallery: a grid of <figure> cards, each
 * lazy-mounting its <img> via IntersectionObserver to keep the DOM small.
 * Mirrors what the previous static index.html files did, now as a real
 * Next.js route so paths and theming integrate with the rest of the app.
 */
export function BannerGallery({
  title,
  basePath,
  files,
}: {
  title: string;
  basePath: string;
  files: string[];
}) {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-6 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mb-3">
        <Link
          href="/experiments"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← back to experiments
        </Link>
      </div>
      <h1 className="mb-2 text-base font-semibold">{title}</h1>
      <p className="mb-6 text-xs text-zinc-500">
        {files.length} SVGs — only mounted while visible
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
        {files.map((name) => (
          <GalleryCard key={name} name={name} basePath={basePath} />
        ))}
      </div>
    </div>
  );
}

function GalleryCard({ name, basePath }: { name: string; basePath: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) setMounted(e.isIntersecting);
      },
      { rootMargin: "200px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const href = `${basePath}/${encodeURI(name)}`;

  return (
    <figure
      ref={ref}
      className="m-0 flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div
        className="grid min-h-[160px] place-items-center p-3"
        style={{
          background:
            "repeating-conic-gradient(rgba(127,127,127,0.08) 0% 25%, transparent 0% 50%) 50% / 16px 16px",
        }}
      >
        {mounted && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt={name}
            loading="lazy"
            decoding="async"
            className="block h-auto max-w-full"
          />
        )}
      </div>
      <figcaption className="border-t border-zinc-200 px-3 py-2 font-mono text-xs break-all text-zinc-500 dark:border-zinc-800">
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {name}
        </a>
      </figcaption>
    </figure>
  );
}
