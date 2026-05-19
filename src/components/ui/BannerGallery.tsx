"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./BannerGallery.module.css";

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
    <div className={styles.shell}>
      <div className={styles.backLink}>
        <Link
          href="/experiments"
          className={`text-xs ${styles.backLinkAnchor}`}
        >
          ← back to experiments
        </Link>
      </div>
      <h1 className={`text-base font-semibold ${styles.title}`}>{title}</h1>
      <p className={`text-xs ${styles.count}`}>
        {files.length} SVGs — only mounted while visible
      </p>
      <div className={styles.grid}>
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
    <figure ref={ref} className={styles.card}>
      <div className={styles.preview}>
        {mounted && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={href}
            alt={name}
            loading="lazy"
            decoding="async"
            className={styles.previewImage}
          />
        )}
      </div>
      <figcaption className={`text-xs ${styles.caption}`}>
        <a
          href={href}
          target="_blank"
          rel="noopener"
          className={styles.captionAnchor}
        >
          {name}
        </a>
      </figcaption>
    </figure>
  );
}
