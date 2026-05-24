"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CustomScrollbar.module.css";

/**
 * Custom scrollbar that floats over a scroll container's visible
 * surface — the region NOT obscured by the museum's glassy chrome and
 * notes overlays. The native scrollbar on the underlying container
 * still exists in the document flow (we don't disable scroll), but its
 * appearance is hidden via `scrollbar-width: none` / `::-webkit-
 * scrollbar { display: none }` on the consumer's container, and this
 * component paints a replacement.
 *
 * Why a custom bar at all: the native scrollbar runs the FULL height
 * of the scroll container. With sticky/fixed glass overlays floating
 * over the top, the native scrollbar's upper portion slides behind
 * the blur. This component shrinks the scrollbar to the visible
 * region only (top offset = chrome-h + any extra), so the thumb
 * tracks scroll cleanly in the part of the page that's actually
 * visible.
 *
 * Usage:
 *
 *   const scrollerRef = useRef<HTMLElement>(null);
 *   ...
 *   <main ref={scrollerRef} className={leafBody}>
 *     ...content...
 *   </main>
 *   <CustomScrollbar
 *     scrollerRef={scrollerRef}
 *     topOffsetVar="--chrome-h"
 *     extraTopOffsetVar="--notes-h"
 *     containerSelector="[data-museum-shell]"
 *   />
 *
 * The component anchors its track to the scroller's right edge via
 * `position: fixed` + measuring the scroller's `getBoundingClientRect`
 * on every scroll/resize. Track top = visible-region top; track
 * bottom = visible-region bottom (= scroller bottom).
 */
export function CustomScrollbar({
  scrollerRef,
  topOffsetVar = "--chrome-h",
  extraTopOffsetVar,
  variant = "auto",
}: {
  scrollerRef: React.RefObject<HTMLElement | null>;
  /** CSS variable on scroller (or its ancestor) that defines the
      top-of-visible-surface offset. Default --chrome-h. */
  topOffsetVar?: string;
  /** Optional additional offset (e.g. --notes-h for the body column).
      The track's top will be at (topOffset + extraTopOffset). */
  extraTopOffsetVar?: string;
  /**
   * Visual variant of the thumb. Choose based on what the scrollbar
   * sits over:
   *   - "auto" — theme-token (var(--foreground)). Use over museum-
   *     themed surfaces that flip with dark/light mode.
   *   - "dark" — dark thumb. Use over light backgrounds that DON'T
   *     flip with theme (e.g. white iframes from CRA originals).
   *   - "light" — light thumb. Use over dark backgrounds that don't
   *     flip with theme.
   * Default is "auto".
   */
  variant?: "auto" | "light" | "dark";
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Read a CSS var off the scroller or its closest ancestor that has
  // it defined, fall back to 0.
  const readVar = (name: string): number => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if (!v) return 0;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!scroller || !track || !thumb) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = scroller.getBoundingClientRect();
      const top = readVar(topOffsetVar) + (extraTopOffsetVar ? readVar(extraTopOffsetVar) : 0);
      const visibleH = rect.height - top;
      const contentH = scroller.scrollHeight;

      // Hide the bar entirely when there's nothing to scroll.
      if (contentH <= rect.height || visibleH <= 0) {
        setVisible(false);
        return;
      }
      setVisible(true);

      // Anchor track to the scroller's right edge, top = top-of-visible.
      track.style.top = `${rect.top + top}px`;
      track.style.left = `${rect.right - 10}px`; // 10px wide track
      track.style.height = `${visibleH}px`;

      // Thumb proportions. Floor at 24px so the thumb is grabbable on
      // very long pages.
      const thumbH = Math.max(24, (visibleH / contentH) * visibleH);
      const scrollableRange = contentH - rect.height; // total scrollable distance
      const thumbRange = visibleH - thumbH;
      const ratio = scrollableRange > 0 ? scroller.scrollTop / scrollableRange : 0;
      const thumbTop = ratio * thumbRange;
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translateY(${thumbTop}px)`;
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(scroller);
    window.addEventListener("resize", schedule);

    return () => {
      scroller.removeEventListener("scroll", schedule);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollerRef, topOffsetVar, extraTopOffsetVar]);

  return (
    <div
      ref={trackRef}
      className={styles.track}
      style={{ visibility: visible ? "visible" : "hidden" }}
      aria-hidden="true"
    >
      <div
        ref={thumbRef}
        className={`${styles.thumb} ${
          variant === "dark"
            ? styles.thumbDark
            : variant === "light"
              ? styles.thumbLight
              : styles.thumbAuto
        }`}
      />
    </div>
  );
}
